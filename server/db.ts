import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@shared/schema";
import { logger } from "./logger";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
    "Copy .env.example to .env and fill in your database connection string."
  );
}

// Ortam değişkenlerinden havuz ayarları — Neon Scale / PgBouncer uyumlu
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_POOL_MAX || "20", 10),
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || "5000", 10),
  // PgBouncer uyumluluğu için statement_timeout
  allowExitOnIdle: false,
});

pool.on("error", (err: Error) => {
  logger.error({ err: err.message }, "[db] Beklenmeyen pool hatası");
});

pool.on("connect", () => {
  logger.debug("[db] Yeni bağlantı açıldı");
});

/** Geçici DB hatalarında yeniden deneme (ağ titremesi vb.) */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 300
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // Kalıcı hatalar için yeniden deneme yapma
      const code: string = err?.code ?? "";
      if (["23505", "23503", "42P01"].includes(code)) throw err;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

export const db = drizzle(pool, { schema });
export { pool };
