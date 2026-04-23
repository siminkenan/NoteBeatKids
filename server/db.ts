import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
    "Copy .env.example to .env and fill in your database connection string."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // 600 eş zamanlı kullanıcı için yeterli
  idleTimeoutMillis: 30_000,  // 30 sn boşta bağlantıyı kapat
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Beklenmeyen pool hatası:", err.message);
});

export const db = drizzle(pool, { schema });
