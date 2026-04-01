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
  try {
    await db.execute(
      sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS branch_name text NOT NULL DEFAULT ''`
    );
    log("✅ Migration: branch_name sütunu kontrol edildi");
  } catch (e) {
    console.error("Migration hatası:", e);
  }
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