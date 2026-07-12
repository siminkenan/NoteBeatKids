/**
 * INTEGRITY SCANNER — Veri Bütünlüğü Kontrolcüsü
 * Her 4 saatte bir çalışır. SADECE okuma yapar.
 */
import { db } from "./db";
import { sql } from "drizzle-orm";
import { integrityStats } from "./healthService";
import { log } from "./logger";
import { auditLogs } from "@shared/schema";

const SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000;

interface IntegrityWarning { table: string; issue: string; count: number; }

async function runIntegrityChecks(): Promise<IntegrityWarning[]> {
  const warnings: IntegrityWarning[] = [];
  const checks = [
    { label: "students → classes (orphan)",       query: `SELECT COUNT(*)::int AS cnt FROM students s WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = s.class_id)` },
    { label: "classes → teachers (orphan)",        query: `SELECT COUNT(*)::int AS cnt FROM classes c WHERE c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.id = c.teacher_id)` },
    { label: "teachers → institutions (orphan)",   query: `SELECT COUNT(*)::int AS cnt FROM teachers t WHERE t.institution_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM institutions i WHERE i.id = t.institution_id)` },
    { label: "student_progress → students (orphan)",query:`SELECT COUNT(*)::int AS cnt FROM student_progress sp WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = sp.student_id)` },
    { label: "monthly_stats → students (orphan)",  query: `SELECT COUNT(*)::int AS cnt FROM monthly_stats ms WHERE NOT EXISTS (SELECT 1 FROM students s WHERE s.id = ms.student_id)` },
    { label: "student_codes → classes (orphan)",   query: `SELECT COUNT(*)::int AS cnt FROM student_codes sc WHERE NOT EXISTS (SELECT 1 FROM classes c WHERE c.id = sc.class_id)` },
    { label: "teacher_codes → institutions (orphan)",query:`SELECT COUNT(*)::int AS cnt FROM teacher_codes tc WHERE NOT EXISTS (SELECT 1 FROM institutions i WHERE i.id = tc.institution_id)` },
  ];
  for (const check of checks) {
    try {
      const result = await db.execute(sql.raw(check.query));
      const count = (result.rows[0] as any)?.cnt ?? 0;
      if (count > 0) warnings.push({ table: check.label.split(" → ")[0].trim(), issue: check.label, count });
    } catch (e: any) {
      log(`[integrity] Kontrol hatası (${check.label}): ${e?.message}`, "warn");
    }
  }
  return warnings;
}

export async function runIntegrityScan(): Promise<void> {
  const start = Date.now();
  log("[integrity] Bütünlük taraması başlatıldı...", "debug");
  try {
    const warnings = await runIntegrityChecks();
    integrityStats.lastCheckAt = new Date();
    integrityStats.lastResult = warnings.length === 0 ? "ok" : "warnings";
    integrityStats.warningCount = warnings.length;
    if (warnings.length > 0) {
      log(`[integrity] ⚠️  ${warnings.length} bütünlük uyarısı bulundu`, "warn");
      for (const w of warnings) log(`[integrity]   - ${w.issue}: ${w.count} kayıt`, "warn");
      try {
        await db.insert(auditLogs).values({ action: "INTEGRITY_WARNING", userType: "system", details: JSON.stringify({ warningCount: warnings.length, warnings }) });
      } catch (e: any) { log(`[integrity] Audit log yazma hatası: ${e?.message}`, "warn"); }
    } else {
      log(`[integrity] ✅ Tüm bütünlük kontrolleri geçti (${Date.now() - start}ms)`, "debug");
    }
  } catch (e: any) {
    integrityStats.lastCheckAt = new Date();
    integrityStats.lastResult = "failed";
    log(`[integrity] ❌ Tarama başarısız: ${e?.message}`, "error");
  }
}

export function startIntegrityScanner(): void {
  setTimeout(async () => {
    await runIntegrityScan();
    setInterval(runIntegrityScan, SCAN_INTERVAL_MS).unref();
  }, 5 * 60_000).unref();
  log("✅ Integrity Scanner başlatıldı (5dk sonra ilk tarama, 4s'de bir tekrar)");
}
