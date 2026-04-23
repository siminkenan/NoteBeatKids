/**
 * PUAN TAMPONU (Score Buffer)
 * ─────────────────────────────────────────────────────────────────────────────
 * Öğrencilerden gelen puan kaydetme isteklerini veritabanına ANINDA yazmak
 * yerine bellekte biriktirir. Her 30 saniyede bir toplu (batch) olarak DB'ye
 * yazar. Bu sayede Neon üzerindeki DB yazma yükü %90+ azalır.
 *
 * Güvenlik: Sunucu yeniden başlarsa buffer boşalır; mevcut DB verisi korunur.
 * Kayıp riski: En fazla 30 saniyelik aktif oyun verisi (kabul edilebilir).
 */

import { db } from "./db";
import { studentProgress, monthlyStats } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { StudentProgress } from "@shared/schema";

// ── Tampon yapısı ────────────────────────────────────────────────────────────

interface BufferEntry {
  studentId: string;
  appType: string;
  institutionId: string | null;
  /** Veritabanına yazılacak en son mutlak değerler */
  data: {
    level?: number;
    starsEarned?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    timeSpentSeconds?: number;
    notesBadge?: string | null;
  };
  /** Bir önceki flush'tan bu yana biriken yıldız farkı (monthly_stats için) */
  cumulativeDeltaStars: number;
  /** Bir önceki flush'tan bu yana biriken rozet farkı (monthly_stats için) */
  cumulativeDeltaBadges: number;
  /** DB'de daha önce var mıydı? (INSERT mi, UPDATE mi yapılacak?) */
  existingId: string | null;
  /** Son bilinen DB yıldız değeri (delta hesabı için temel) */
  baselineStars: number;
  /** Son bilinen DB rozet durumu */
  baselineHadBadge: boolean;
}

// key: "studentId:appType"
const buffer = new Map<string, BufferEntry>();

// Puanı değişen kurumların ID'leri (flush sonrası leaderboard yayını için)
const dirtyInstitutions = new Set<string>();

/** Puanı tampona yazarken kurum ID'sini kirli olarak işaretle. */
export function markInstitutionDirty(institutionId: string) {
  dirtyInstitutions.add(institutionId);
}

/** Kirli kurum listesini al ve temizle (flush sonrası çağrılır). */
export function consumeDirtyInstitutions(): string[] {
  const ids = Array.from(dirtyInstitutions);
  dirtyInstitutions.clear();
  return ids;
}

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

/** Tampondaki anlık "mevcut" veriyi döndürür (DB sorgusu olmadan). */
export function getBuffered(studentId: string, appType: string): Partial<BufferEntry["data"]> & { id?: string } | null {
  const entry = buffer.get(`${studentId}:${appType}`);
  return entry ? { ...entry.data, id: entry.existingId ?? undefined } : null;
}

/**
 * Puanı tampona yaz. DB'ye yazmaz.
 * `baselineRecord` — DB'den ya da önceki tampon girişinden gelen mevcut kayıt.
 */
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

  // Delta hesabı: ÖNCEKI durum (tampon öncelikli, yoksa DB)
  const prevStars = existingBufferEntry
    ? (existingBufferEntry.data.starsEarned ?? 0)
    : (baselineRecord?.starsEarned ?? 0);
  const prevHadBadge = existingBufferEntry
    ? !!existingBufferEntry.data.notesBadge
    : !!baselineRecord?.notesBadge;

  const newStars = newData.starsEarned ?? 0;
  const newHasBadge = !!newData.notesBadge;

  const deltaStars = Math.max(0, newStars - prevStars);
  const deltaBadges = (!prevHadBadge && newHasBadge) ? 1 : 0;

  // Eğer bu key için zaten tampon girişi varsa: delta'yı biriktir, veriyi üzerine yaz
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

  // Anında dönüş için sentetik StudentProgress nesnesi oluştur
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
    createdAt: baselineRecord?.createdAt ?? now,
    updatedAt: now,
  };

  return syntheticRecord;
}

/** Tampondaki belirli öğrencinin verilerini döndürür (getProgressByStudent için). */
export function getBufferedByStudent(studentId: string): Map<string, BufferEntry> {
  const result = new Map<string, BufferEntry>();
  for (const [key, entry] of buffer.entries()) {
    if (entry.studentId === studentId) result.set(key, entry);
  }
  return result;
}

// ── Toplu veritabanı yazma (Batch Flush) ─────────────────────────────────────

let isFlushing = false;

/**
 * Tampondaki TÜM bekleyen puanları veritabanına tek seferde yazar.
 * Her 30 saniyede bir çağrılır. Eş zamanlı çalışmayı önler.
 */
export async function flushScoreBuffer(): Promise<void> {
  if (isFlushing || buffer.size === 0) return;
  isFlushing = true;

  // Mevcut tamponu kopyala ve hemen temizle (yeni yazılar birikmesine devam eder)
  const snapshot = new Map(buffer);
  buffer.clear();

  try {
    for (const [, entry] of snapshot.entries()) {
      const { studentId, appType, data, existingId, cumulativeDeltaStars, cumulativeDeltaBadges } = entry;

      // 1. studentProgress tablosuna yaz
      if (existingId && !existingId.startsWith("buf_")) {
        // Mevcut kayıt → UPDATE
        await db.update(studentProgress)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(studentProgress.id, existingId));
      } else {
        // Yeni kayıt → INSERT (ON CONFLICT yoksay — eş zamanlı insert koruması)
        await db.insert(studentProgress)
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
          .onConflictDoNothing();
      }

      // 2. monthly_stats güncelle (sadece değişim varsa)
      if (cumulativeDeltaStars > 0 || cumulativeDeltaBadges > 0) {
        await incrementMonthlyStatsBatch(studentId, cumulativeDeltaStars, cumulativeDeltaBadges);
      }
    }
  } finally {
    isFlushing = false;
  }
}

/** monthly_stats tablosunu atomik olarak günceller. */
async function incrementMonthlyStatsBatch(studentId: string, deltaStars: number, deltaBadges: number): Promise<void> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existing = await db.select().from(monthlyStats)
      .where(eq(monthlyStats.studentId, studentId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(monthlyStats)
        .set({
          monthlyStars: sql`monthly_stars + ${deltaStars}`,
          monthlyBadgesCount: sql`monthly_badges_count + ${deltaBadges}`,
        })
        .where(eq(monthlyStats.studentId, studentId));
    } else {
      await db.insert(monthlyStats)
        .values({ studentId, monthlyStars: deltaStars, monthlyBadgesCount: deltaBadges, lastResetMonth: currentMonth })
        .onConflictDoNothing();
    }
  } catch (_) {}
}

/** Tamponda bekleyen entry sayısı (izleme için). */
export function bufferSize(): number {
  return buffer.size;
}

/** Belirli key için tamponu doğrudan döndür (upsertProgress'te kullanılır). */
export function getBufferEntry(studentId: string, appType: string): BufferEntry | null {
  return buffer.get(`${studentId}:${appType}`) ?? null;
}
