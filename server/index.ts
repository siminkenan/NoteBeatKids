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
import { flushScoreBuffer, consumeDirtyInstitutions, bufferSize, flushStats } from "./scoreBuffer";
import { broadcastLeaderboard, closeSocketIO } from "./socket";
import { redis } from "./redis";
import { setErrorReporter } from "./errorReporter";
import { monthlyResetStats, schemaStats } from "./healthService";
import { startIntegrityScanner } from "./integrityScanner";

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
    sql`CREATE TABLE IF NOT EXISTS admin_devices (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id text NOT NULL,
      device_type text NOT NULL,
      fingerprint text NOT NULL,
      device_name text,
      browser text,
      os text,
      first_login_at timestamp DEFAULT now() NOT NULL,
      last_login_at timestamp DEFAULT now() NOT NULL,
      is_active boolean NOT NULL DEFAULT true
    )`,
    sql`CREATE TABLE IF NOT EXISTS admin_login_logs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_email text NOT NULL,
      ip text,
      browser text,
      os text,
      device_type text,
      fingerprint text,
      success boolean NOT NULL,
      failure_reason text,
      created_at timestamp DEFAULT now() NOT NULL
    )`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_devices_admin_id ON admin_devices(admin_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_admin_login_logs_email ON admin_login_logs(admin_email)`,
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
      created_at timestamp DEFAULT now() NOT NULL
    )`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_at timestamp`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS pending_stars integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS monthly_badges_count integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS last_reset_month varchar(7) NOT NULL DEFAULT ''`,
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
      log(`❌ Migration HATA (kritik): ${e?.message ?? e}`, "error");
    }
  }
  log("✅ Migration: tüm sütunlar ve index'ler kontrol edildi");
}

// Kritik sütunların canlı DB'de gerçekten var olduğunu doğrula
async function verifySchema() {
  const criticalColumns: Array<{ table: string; column: string }> = [
    { table: "classes",         column: "branch_name" },
    { table: "classes",         column: "deleted_at" },
    { table: "teachers",        column: "institution_id" },
    { table: "students",        column: "last_seen_at" },
    { table: "students",        column: "pending_stars" },
    { table: "monthly_stats",   column: "monthly_badges_count" },
    { table: "monthly_stats",   column: "last_reset_month" },
  ];
  const missing: string[] = [];
  for (const { table, column } of criticalColumns) {
    try {
      const rows = await db.execute(
        sql`SELECT 1 FROM information_schema.columns
            WHERE table_name = ${table} AND column_name = ${column} LIMIT 1`
      );
      if ((rows as any).rows?.length === 0) missing.push(`${table}.${column}`);
    } catch (_) {}
  }
  schemaStats.checkedAt = new Date();
  if (missing.length > 0) {
    schemaStats.ok = false;
    schemaStats.missingColumns = missing;
    log(`❌ SCHEMA EKSİK SÜTUNLAR: ${missing.join(", ")} — sorgu hataları olabilir!`, "error");
  } else {
    schemaStats.ok = true;
    schemaStats.missingColumns = [];
    log("✅ Schema doğrulama: tüm kritik sütunlar mevcut");
  }
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

  // Migrations + schema check BEFORE accepting any traffic
  await runMigrations();
  await verifySchema();
  await seedDatabase();

  httpServer.listen(PORT, "0.0.0.0", () => {
    log(`🚀 Server running on port ${PORT}`);
  });

  // ── Error Reporter köprüsünü bağla ───────────────────────────────────────
  setErrorReporter((payload) => { storage.createSystemError(payload).catch(() => {}); });

  // ── SYSTEM_START audit ────────────────────────────────────────────────────
  storage.createAuditLog({ action: "SYSTEM_START", userType: "system", details: JSON.stringify({ port: PORT, nodeVersion: process.version, env: process.env.NODE_ENV }) }).catch(() => {});

  // ── Integrity Scanner başlat ──────────────────────────────────────────────
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
    const flushStart = Date.now();
    try {
      log(`📤 Puan tamponu: ${count} kayıt DB'ye yazılıyor...`);
      await flushScoreBuffer();
      const dirtyIds = consumeDirtyInstitutions();
      for (const instId of dirtyIds) {
        broadcastLeaderboard(instId).catch(() => {});
      }
      flushStats.lastFlushAt = new Date();
      flushStats.lastFlushDurationMs = Date.now() - flushStart;
      flushStats.lastFlushSuccess = true;
      flushStats.lastFlushError = null;
      log(`✅ Puan tamponu temizlendi. ${dirtyIds.length} kurum liderlik tablosu yayınlandı.`);
    } catch (e) {
      flushStats.lastFlushAt = new Date();
      flushStats.lastFlushDurationMs = Date.now() - flushStart;
      flushStats.lastFlushSuccess = false;
      flushStats.lastFlushError = String(e);
      log(`❌ Puan tamponu flush hatası: ${String(e)}`);
    }
  }, 30_000);

  // ── Otomatik aylık sıfırlama ──────────────────────────────────────────────
  const runAutoMonthlyReset = async () => {
    const resetStart = Date.now();
    try {
      await storage.autoCheckMonthlyReset();
      monthlyResetStats.lastRunAt = new Date();
      monthlyResetStats.lastResult = "success";
      const now = new Date();
      const nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0);
      monthlyResetStats.nextRunAt = nextRun;
    } catch (_) {
      monthlyResetStats.lastRunAt = new Date();
      monthlyResetStats.lastResult = "failed";
    }
  };
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
