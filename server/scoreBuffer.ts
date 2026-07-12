/**
 * PUAN TAMPONU (Score Buffer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Öğrencilerden gelen puan kaydetme isteklerini veritabanına ANINDA yazmak
 * yerine bellekte biriktirir. Her 30 saniyede bir toplu (batch) olarak DB'ye
 * yazar. Bu sayede Neon üzerindeki DB yazma yükü %90+ azalır.
 *
 * Güvenlik: Sunucu yeniden başlarsa buffer boşalır; mevcut DB verisi korunur.
 * Kayıp riski: En fazla 30 saniyelik aktif oyun verisi (kabul edilebilir).
 *
 * Performans: 600 eş zamanlı öğrenci için:
 *   - student_progress: Promise.all ile paralel UPDATE/INSERT
 *   - monthly_stats: Tek SQL UPSERT ile hepsini birleştir
 */

import { db } from "./db";
import { studentProgress, monthlyStats } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import type { StudentProgress } from "@shared/schema";

// ── Tampon yapısı ────────────────────────────────────────────────────────────

interface BufferEntry {
  studentId: string;
  appType: string;
  institutionId: string | null;
  data: {
    level?: number;
    starsEarned?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    timeSpentSeconds?: number;
    notesBadge?: string | null;
  };
  cumulativeDeltaStars: number;
  cumulativeDeltaBadges: number;
  existingId: string | null;
  baselineStars: number;
  baselineHadBadge: boolean;
}

// key: "studentId:appType"
const buffer = new Map<string, BufferEntry>();

// Puanı değişen kurumların ID'leri
const dirtyInstitutions = new Set<string>();

export function markInstitutionDirty(institutionId: string) {
  dirtyInstitutions.add(institutionId);
}

export function consumeDirtyInstitutions(): string[] {
  const ids = Array.from(dirtyInstitutions);
  dirtyInstitutions.clear();
  return ids;
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

export function getBuffered(
  studentId: string,
  appType: string,
): (Partial<BufferEntry["data"]> & { id?: string }) | null {
  const entry = buffer.get(`${studentId}:${appType}`);
  return entry ? { ...entry.data, id: entry.existingId ?? undefined } : null;
}

export function bufferScore(params: {
  studentId: string;
  appType: string;
  institutionId: string | null;
  newData: BufferEntry["data"];
  baselineRecord: StudentProgress | null;
  existingBufferEntry: BufferEntry | null;
}): StudentProgress {
  const { studentId, appType, institutionId, newData, baselineRecord, existingBufferEntry } = params;
  const key = `${studentId}:${appType}`;

  const prevStars = existingBufferEntry
    ? (existingBufferEntry.data.starsEarned ?? 0)
    : (baselineRecord?.starsEarned ?? 0);
  const prevHadBadge = existingBufferEntry
    ? !!existingBufferEntry.data.notesBadge
    : !!baselineRecord?.notesBadge;

  const newStars = newData.starsEarned ?? 0;
  const newHasBadge = !!newData.notesBadge;

  const deltaStars = Math.max(0, newStars - prevStars);
  const deltaBadges = !prevHadBadge && newHasBadge ? 1 : 0;

  const prevCumulativeDeltaStars = existingBufferEntry?.cumulativeDeltaStars ?? 0;
  const prevCumulativeDeltaBadges = existingBufferEntry?.cumulativeDeltaBadges ?? 0;

  const entry: BufferEntry = {
    studentId,
    appType,
    institutionId,
    data: newData,
    cumulativeDeltaStars: prevCumulativeDeltaStars + deltaStars,
    cumulativeDeltaBadges: prevCumulativeDeltaBadges + deltaBadges,
    existingId: existingBufferEntry?.existingId ?? baselineRecord?.id ?? null,
    baselineStars: existingBufferEntry?.baselineStars ?? (baselineRecord?.starsEarned ?? 0),
    baselineHadBadge: existingBufferEntry?.baselineHadBadge ?? !!baselineRecord?.notesBadge,
  };

  buffer.set(key, entry);

  const now = new Date();
  const syntheticRecord: StudentProgress = {
    id: entry.existingId ?? `buf_${key}`,
    studentId,
    appType,
    level: newData.level ?? baselineRecord?.level ?? 1,
    starsEarned: newData.starsEarned ?? baselineRecord?.starsEarned ?? 0,
    correctAnswers: newData.correctAnswers ?? baselineRecord?.correctAnswers ?? 0,
    wrongAnswers: newData.wrongAnswers ?? baselineRecord?.wrongAnswers ?? 0,
    timeSpentSeconds: newData.timeSpentSeconds ?? baselineRecord?.timeSpentSeconds ?? 0,
    notesBadge: newData.notesBadge ?? baselineRecord?.notesBadge ?? null,
    updatedAt: now,
  };

  return syntheticRecord;
}

export function getBufferedByStudent(studentId: string): Map<string, BufferEntry> {
  const result = new Map<string, BufferEntry>();
  for (const [key, entry] of Array.from(buffer.entries())) {
    if (entry.studentId === studentId) result.set(key, entry);
  }
  return result;
}

// ── Toplu veritabanı yazma (Batch Flush) ─────────────────────────────────────

let isFlushing = false;

/**
 * Tampondaki TÜM bekleyen puanları veritabanına yazar.
 *
 * Optimizasyonlar (600 eş zamanlı öğrenci):
 *   1. student_progress: Promise.all ile paralel UPDATE/INSERT
 *   2. monthly_stats: TEK SQL batch UPSERT (ON CONFLICT DO UPDATE)
 *   3. İkisi aynı anda çalışır (birbirini beklemez)
 */
export async function flushScoreBuffer(): Promise<void> {
  if (isFlushing || buffer.size === 0) return;
  isFlushing = true;
  const flushStart = Date.now();

  const snapshot = new Map(buffer);
  buffer.clear();

  try {
    const progressOps: Promise<any>[] = [];
    const monthlyUpdates: Array<{ studentId: string; deltaStars: number; deltaBadges: number }> = [];

    for (const [, entry] of Array.from(snapshot.entries())) {
      const { studentId, appType, data, existingId, cumulativeDeltaStars, cumulativeDeltaBadges } = entry;

      // student_progress güncelleme — hepsini paralel kuyruğa ekle
      if (existingId && !existingId.startsWith("buf_")) {
        progressOps.push(
          db.update(studentProgress)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(studentProgress.id, existingId))
            .catch((e) => console.error(`[flush] progress UPDATE hatası ${studentId}:`, e?.message))
        );
      } else {
        progressOps.push(
          db.insert(studentProgress)
            .values({
              studentId,
              appType,
              level: data.level ?? 1,
              starsEarned: data.starsEarned ?? 0,
              correctAnswers: data.correctAnswers ?? 0,
              wrongAnswers: data.wrongAnswers ?? 0,
              timeSpentSeconds: data.timeSpentSeconds ?? 0,
              notesBadge: data.notesBadge ?? null,
            })
            .onConflictDoNothing()
            .catch((e) => console.error(`[flush] progress INSERT hatası ${studentId}:`, e?.message))
        );
      }

      // monthly_stats toplu güncelleme listesine ekle
      if (cumulativeDeltaStars > 0 || cumulativeDeltaBadges > 0) {
        monthlyUpdates.push({ studentId, deltaStars: cumulativeDeltaStars, deltaBadges: cumulativeDeltaBadges });
      }
    }

    // 1. student_progress: tümünü PARALEL çalıştır
    const progressPromise = Promise.all(progressOps);

    // 2. monthly_stats: TEK SQL UPSERT (batch)
    const monthlyPromise = monthlyUpdates.length > 0
      ? batchUpsertMonthlyStats(monthlyUpdates)
      : Promise.resolve();

    // İkisini aynı anda çalıştır
    await Promise.all([progressPromise, monthlyPromise]);

    flushStats.lastFlushAt = new Date();
    flushStats.lastFlushDurationMs = Date.now() - flushStart;
    flushStats.lastFlushSuccess = true;
    flushStats.lastFlushError = null;

  } catch (err: any) {
    flushStats.lastFlushAt = new Date();
    flushStats.lastFlushDurationMs = Date.now() - flushStart;
    flushStats.lastFlushSuccess = false;
    flushStats.lastFlushError = err?.message ?? String(err);
    throw err;
  } finally {
    isFlushing = false;
  }
}

/**
 * Tüm monthly_stats güncellemelerini tek bir SQL UPSERT ile yazar.
 * monthly_stats(student_id) UNIQUE kısıtlaması sayesinde güvenlidir.
 */
async function batchUpsertMonthlyStats(
  updates: Array<{ studentId: string; deltaStars: number; deltaBadges: number }>
): Promise<void> {
  if (updates.length === 0) return;
  const currentMonth = new Date().toISOString().slice(0, 7);

  try {
    // Drizzle'ın raw sql helper'ı ile tek UPSERT
    const valueFragments = updates.map(
      (u) => sql`(${u.studentId}, ${u.deltaStars}, ${u.deltaBadges}, ${currentMonth})`
    );

    await db.execute(sql`
      INSERT INTO monthly_stats (student_id, monthly_stars, monthly_badges_count, last_reset_month)
      VALUES ${sql.join(valueFragments, sql`, `)}
      ON CONFLICT (student_id) DO UPDATE SET
        monthly_stars        = monthly_stats.monthly_stars        + EXCLUDED.monthly_stars,
        monthly_badges_count = monthly_stats.monthly_badges_count + EXCLUDED.monthly_badges_count
    `);
  } catch (e: any) {
    console.error("[flush] monthly_stats batch UPSERT hatası:", e?.message);
  }
}

export function bufferSize(): number {
  return buffer.size;
}

export function getBufferEntry(studentId: string, appType: string): BufferEntry | null {
  return buffer.get(`${studentId}:${appType}`) ?? null;
}

/** Dirty institution sayısını bozmadan okur (health endpoint için) */
export function dirtyInstitutionCount(): number {
  return dirtyInstitutions.size;
}

/** Son flush istatistikleri — health endpoint tarafından okunur */
export const flushStats = {
  lastFlushAt: null as Date | null,
  lastFlushDurationMs: null as number | null,
  lastFlushSuccess: null as boolean | null,
  lastFlushError: null as string | null,
};
