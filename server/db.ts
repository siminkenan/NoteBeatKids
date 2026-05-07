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

const isProduction = process.env.NODE_ENV === "production";

/**
 * Neon Scale / PgBouncer uyumlu bağlantı havuzu.
 *
 * Neon önerileri:
 *  - Doğrudan bağlantı (5432): max 10–20 (compute başına limit var)
 *  - PgBouncer (6543): max 50+ güvenle kullanılabilir
 *  - SSL zorunlu (rejectUnauthorized: false Neon için gerekli)
 *  - statement_timeout aşırı uzun sorgulardan korur
 *  - keepAlive kalıcı bağlantıların düşmesini önler
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Havuz boyutu — DB_POOL_MAX env ile geçersiz kılınabilir
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),

  // Boşta kalan bağlantı zaman aşımı
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || "30000", 10),

  // Bağlantı kurma zaman aşımı (Neon uyandırma ~3 sn bekleyebilir)
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || "8000", 10),

  // Sunucu kapanmadan havuzu sonlandırmaya izin ver
  allowExitOnIdle: false,

  // SSL — Neon ve üretim ortamları için zorunlu
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : undefined,

  // TCP keepalive — uzun yaşayan bağlantıların NAT/firewall tarafından düşürülmesini önler
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,

  // Bağlantı başına ifade zaman aşımı (30 sn) — sonsuz sorgulardan korur
  // Bu pg Pool üzerinden query'e eklenir; set_config ile de ayarlanabilir
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || "30000", 10),
} as ConstructorParameters<typeof Pool>[0]);

pool.on("error", (err: Error) => {
  logger.error({ err: err.message }, "[db] Beklenmeyen pool hatası");
});

pool.on("connect", () => {
  logger.debug("[db] Yeni bağlantı açıldı");
  // statement_timeout'u bağlantı bazlı da ayarla (PgBouncer uyumlu)
  if (isProduction && process.env.DB_STATEMENT_TIMEOUT) {
    const timeoutMs = parseInt(process.env.DB_STATEMENT_TIMEOUT, 10);
    pool.query(`SET statement_timeout = ${timeoutMs}`).catch(() => {});
  }
});

pool.on("remove", () => {
  logger.debug("[db] Bağlantı havuzdan çıkarıldı");
});

/**
 * Geçici DB hatalarında yeniden deneme.
 * Ağ titremesi, Neon uyandırma gecikmesi, kısa süreli kesintiler için.
 * Kısıtlama ihlalleri gibi kalıcı hatalar için yeniden deneme yapılmaz.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      // Kalıcı hatalar için yeniden deneme yapma
      const code: string = err?.code ?? "";
      if (["23505", "23503", "42P01", "42703"].includes(code)) throw err;
      if (i < retries - 1) {
        logger.warn({ code, attempt: i + 1 }, "[db] Geçici hata — yeniden deneniyor");
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}

/** Havuz sağlık istatistiklerini döndürür */
export function poolStats() {
  return {
    total: pool.totalCount,
    idle:  pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export const db = drizzle(pool, { schema });
export { pool as default };
