import "dotenv/config";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./app";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

const PORT = parseInt(process.env.PORT || "5000", 10);

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

  await seedDatabase();

  // Her 40 saniyede bekleyen yıldızları liderlik tablosuna yansıt
  setInterval(async () => {
    try {
      await storage.flushPendingStars();
    } catch (e) {
      // sessizce devam et
    }
  }, 40_000);
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});