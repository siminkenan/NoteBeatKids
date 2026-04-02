import "dotenv/config";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./app";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "./storage";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function runMigrations() {
  const migrations = [
    // Kolon eklemeleri
    sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS branch_name text NOT NULL DEFAULT ''`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS last_seen_at timestamp`,
    sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS pending_stars integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS monthly_badges_count integer NOT NULL DEFAULT 0`,
    sql`ALTER TABLE monthly_stats ADD COLUMN IF NOT EXISTS last_reset_month varchar(7) NOT NULL DEFAULT ''`,
    // Performans index'leri (800 eş zamanlı kullanıcı için)
    sql`CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON classes(teacher_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_teachers_institution_id ON teachers(institution_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress(student_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_monthly_stats_student_id ON monthly_stats(student_id)`,
    sql`CREATE INDEX IF NOT EXISTS idx_student_codes_student_id ON student_codes(student_id)`,
  ];
  for (const m of migrations) {
    try {
      await db.execute(m);
    } catch (e: any) {
      console.error("Migration hatası:", e?.message ?? e);
    }
  }
  log("✅ Migration: tüm sütunlar ve index'ler kontrol edildi");
}

async function seedDatabase() {
  // Admin artık ilk girişte otomatik oluşturuluyor.
  // Eski "admin@notebeatkids.com" kaydı varsa temizle (tek seferlik migrasyon).
  try {
    await db
      .delete(schema.admins)
      .where(eq(schema.admins.email, "admin@notebeatkids.com"));
  } catch (_) {
    // Tablo yoksa veya kayıt yoksa devam et
  }
  log("✅ Admin seed skipped — created on first login");
}

async function main() {
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

  // Her 40 saniyede bekleyen yıldızları liderlik tablosuna yansıt
  setInterval(async () => {
    try {
      await storage.flushPendingStars();
    } catch (e) {
      // sessizce devam et
    }
  }, 40_000);

  // Her gün 1 kez önceki ayın şampiyonlarını otomatik kaydet (ay başı sıfırlama)
  const runAutoMonthlyReset = async () => {
    try {
      await storage.autoCheckMonthlyReset();
    } catch (e) {
      // sessizce devam et
    }
  };
  await runAutoMonthlyReset(); // sunucu başlangıcında bir kez çalıştır
  setInterval(runAutoMonthlyReset, 24 * 60 * 60 * 1000); // her 24 saatte bir
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});