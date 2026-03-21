import "dotenv/config";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./app";
import { db } from "./db";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

const PORT = parseInt(process.env.PORT || "5000", 10);

async function seedDatabase() {
  try {
    const existing = await db.select().from(schema.admins).limit(1);
    if (existing.length === 0) {
      const bcrypt = await import("bcryptjs");
      const hash = await bcrypt.default.hash("admin123", 10);
      await db.insert(schema.admins).values({
        email: "admin@notebeat.com",
        passwordHash: hash,
      });
    }
    log("Database seeded successfully");
  } catch (err) {
    log(`Database seed skipped: ${(err as Error).message}`);
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
    log(`serving on port ${PORT}`);
  });

  await seedDatabase();
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
