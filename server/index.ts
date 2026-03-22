import "dotenv/config";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./app";
import { db } from "./db";
import * as schema from "@shared/schema";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function seedDatabase() {
  try {
    const bcrypt = await import("bcryptjs");

    // 🔑 Şifre seçimi
    const adminPassword =
      process.env.ADMIN_PASSWORD || "114344_Kenan";

    const hash = await bcrypt.default.hash(adminPassword, 10);

    const existing = await db.select().from(schema.admins).limit(1);

    if (existing.length === 0) {
      // ➜ Hiç admin yoksa oluştur
      await db.insert(schema.admins).values({
        email: "admin@notebeatkids.com",
        password: hash,
      });

      log("✅ Admin created");
    } else {
      // ➜ Admin varsa her zaman güncelle (Render fix)
      await db
        .update(schema.admins)
        .set({ password: hash })
        .where(schema.admins.email.eq("admin@notebeatkids.com"));

      log("✅ Admin password synced");
    }

  } catch (err) {
    log(`❌ Database seed error: ${(err as Error).message}`);
  }
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
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});