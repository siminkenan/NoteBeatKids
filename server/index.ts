import "dotenv/config";
import { validateEnv } from "./env";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./logger";
import { pool, poolStats } from "./db";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { flushScoreBuffer, consumeDirtyInstitutions, bufferSize } from "./scoreBuffer";
import { broadcastLeaderboard, closeSocketIO } from "./socket";
import { redis } from "./redis";
import { monthlyResetStats } from "./healthService";
import { startIntegrityScanner } from "./integrityScanner";
import { setErrorReporter } from "./errorReporter";

const PORT = parseInt(process.env.PORT || "5000", 10);

// ── Beklenmedik hata yakalama ─────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  log(`❌ uncaughtException: ${err.message}\n${err.stack}`, "fatal");
  // Uygulamayı öldürme — sadece logla (Render otomatik yeniden başlatır)
});

process.on("unhandledRejection", (reason) => {
  log(`⚠️  unhandledRejection: ${String(reason)}`, "warn");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function gracefulShutdown(signal: string, httpServer: import("http").Server) {
  log(`🛑 ${signal} alındı — kapatılıyor...`);

  // Audit: SYSTEM_STOP
  storage.createAuditLog({ action: "SYSTEM_STOP", userType: "system", details: JSON.stringify({ signal }) }).catch(() => {});

  // 1. Yeni HTTP bağlantılarını reddet
  httpServer.close(async () => {
    log("✅ HTTP sunucusu kapatıldı");
  });

  // 2. Socket.io bağlantılarını temiz kapat
  try {
    await closeSocketIO();
  } catch (e) {
    log(`⚠️  Socket.io kapatma hatası: ${String(e)}`);
  }

  // 3. Kalan puanları flush et
  try {
    const pending = bufferSize();
    if (pending > 0) {
      log(`📤 ${pending} bekleyen puan DB'ye yazılıyor...`);
      await flushScoreBuffer();
      log("✅ Puan tamponu temizlendi");
    }
  } catch (e) {
    log(`⚠️  Puan tamponu flush hatası: ${String(e)}`);
  }

  // 4. Redis kapat
  if (redis) {
    try { await redis.quit(); log("✅ Redis bağlantısı kapatıldı"); } catch {}
  }

  // 5. DB pool kapat
  try {
    const stats = poolStats();
    log(`📊 DB pool kapanıyor: ${stats.total} bağlantı (${stats.idle} boşta)`);
    await pool.end();
    log("✅ DB pool kapatıldı");
  } catch {}

  log("👋 Sunucu düzgün kapatıldı");
  process.exit(0);
}

async function runMigrations() {
  const migrations = [
    sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS branch_name text NOT NULL DEFAULT ''`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_at timestamp`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS pending_stars integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS monthly_badges_count integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS last_reset_month varchar(7) NOT NULL DEFAULT ''`,
    // system_errors tablosu (Error Center)
    sql`CREATE TABLE IF NOT EXISTS system_errors (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      severity text NOT NULL DEFAULT 'error',
      route text,
      institution_id text,
      teacher_id text,
      student_id text,
      admin_id text,
      message text NOT NULL,
      stack text,
      request_id text,
      resolved boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    // audit_logs tablosuna index'ler (büyüdükçe kritik)
    sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_id ON audit_logs(institution_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
    sql`CREATE INDEX IF NOT EXISTS idx_system_errors_created_at ON system_errors(created_at)`,
    // Performans index'leri
    sql`CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_teachers_institution_id ON teachers(institution_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress(student_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_monthly_stats_student_id ON monthly_stats(student_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_student_codes_student_id ON student_codes(student_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_student_codes_code ON student_codes(code)`,
    sql`CREATE INDEX IF NOT EXISTS idx_classes_class_code ON classes(class_code)`,
  ];
  for (const m of migrations) {
    try { await db.execute(m); } catch (e: any) {
      log(`Migration hatası: ${e?.message ?? e}`, "warn");
    }
  }
  log("✅ Migration: tüm sütunlar ve index'ler kontrol edildi");
}

async function seedDatabase() {
  try {
    await db.delete(schema.admins).where(eq(schema.admins.email, "admin@notebeatkids.com"));
  } catch (_) {}
  log("✅ Admin seed skipped — created on first login");
}

async function main() {
  log(`🚀 NoteBeat Kids başlatılıyor (${process.env.NODE_ENV || "development"})...`);

  const { app, httpServer } = await createApp();

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`🚀 Server running on port ${PORT}`);
  });

  await runMigrations();
  await seedDatabase();

  // ── Error Reporter bağlantısı (storage hazır olduktan sonra) ──────────────
  setErrorReporter((data) => storage.createSystemError(data).catch(() => {}));

  // ── Audit: SYSTEM_START ───────────────────────────────────────────────────
  storage.createAuditLog({
    action: "SYSTEM_START",
    userType: "system",
    details: JSON.stringify({ nodeVersion: process.version, env: process.env.NODE_ENV ?? "development" }),
  }).catch(() => {});

  // ── Integrity Scanner (4s'de bir, 5dk sonra başlar) ──────────────────────
  startIntegrityScanner();

  // ── Bellek kullanımı izleme ───────────────────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    setInterval(() => {
      const mem = process.memoryUsage();
      const mb = (n: number) => `${Math.round(n / 1024 / 1024)}MB`;
      const pool = poolStats();
      log(
        `📊 Bellek: RSS=${mb(mem.rss)} Heap=${mb(mem.heapUsed)}/${mb(mem.heapTotal)} | ` +
        `DB Pool: total=${pool.total} idle=${pool.idle} waiting=${pool.waiting}`,
        "monitor"
      );
    }, 5 * 60_000); // Her 5 dakikada bir
  }

  // ── Puan tamponu flush — her 30 saniyede toplu DB yazma ───────────────────
  setInterval(async () => {
    const count = bufferSize();
    if (count === 0) return;
    try {
      log(`📤 Puan tamponu: ${count} kayıt DB'ye yazılıyor...`);
      await flushScoreBuffer();
      const dirtyIds = consumeDirtyInstitutions();
      for (const instId of dirtyIds) {
        broadcastLeaderboard(instId).catch(() => {});
      }
      log(`✅ Puan tamponu temizlendi. ${dirtyIds.length} kurum liderlik tablosu yayınlandı.`);
      // Audit: FLUSH_SUCCESS
      storage.createAuditLog({
        action: "FLUSH_SUCCESS",
        userType: "system",
        details: JSON.stringify({ flushedCount: count, broadcastedInstitutions: dirtyIds.length }),
      }).catch(() => {});
    } catch (e) {
      log(`❌ Puan tamponu flush hatası: ${String(e)}`);
      // Audit: FLUSH_FAILED
      storage.createAuditLog({
        action: "FLUSH_FAILED",
        userType: "system",
        details: JSON.stringify({ error: String(e), pendingCount: count }),
      }).catch(() => {});
    }
  }, 30_000);

  // ── Otomatik aylık sıfırlama ──────────────────────────────────────────────
  const runAutoMonthlyReset = async () => {
    const resetStart = Date.now();
    try {
      await storage.autoCheckMonthlyReset();
      monthlyResetStats.lastRunAt = new Date();
      monthlyResetStats.lastResult = "success";
      monthlyResetStats.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      storage.createAuditLog({
        action: "MONTHLY_RESET_SUCCESS",
        userType: "system",
        details: JSON.stringify({ durationMs: Date.now() - resetStart }),
      }).catch(() => {});
    } catch (e) {
      monthlyResetStats.lastRunAt = new Date();
      monthlyResetStats.lastResult = "failed";
      monthlyResetStats.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      storage.createAuditLog({
        action: "MONTHLY_RESET_FAILED",
        userType: "system",
        details: JSON.stringify({ error: String(e) }),
      }).catch(() => {});
    }
  };
  monthlyResetStats.nextRunAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await runAutoMonthlyReset();
  setInterval(runAutoMonthlyReset, 24 * 60 * 60 * 1000);

  // ── Graceful shutdown kayıt ───────────────────────────────────────────────
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM", httpServer));
  process.on("SIGINT",  () => gracefulShutdown("SIGINT",  httpServer));
}

main().catch((err) => {
  log(`❌ Fatal server error: ${err?.message ?? err}\n${err?.stack ?? ""}`, "fatal");
  process.exit(1);
});
