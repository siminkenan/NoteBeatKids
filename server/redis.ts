/**
 * REDIS İSTEMCİSİ — Upstash / ioredis
 * ──────────────────────────────────────────────────────────────────────────────
 * REDIS_URL  = https://xxx.upstash.io  (Upstash REST formatı)
 *              veya  rediss://default:TOKEN@xxx.upstash.io:6379
 * REDIS_TOKEN = Upstash REST token (REDIS_URL https:// ise gerekli)
 *
 * Kural: Redis bağlanamasa bile uygulama ÇÖKMEZ.
 * Her yerde `redis` null olabilir; null ise in-memory fallback kullan.
 */

import Redis from "ioredis";

function buildRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  const token = process.env.REDIS_TOKEN?.trim();
  if (!url) return null;

  // Upstash REST formatı → Redis protokolüne çevir
  if (url.startsWith("https://")) {
    const host = url.replace("https://", "");
    return `rediss://default:${token}@${host}:6379`;
  }
  return url; // Zaten redis:// veya rediss://
}

let redis: Redis | null = null;

const redisUrl = buildRedisUrl();

if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    connectTimeout: 5_000,
    lazyConnect: true,
    tls: redisUrl.startsWith("rediss://") ? {} : undefined,
  });

  redis.on("connect", () => {
    console.log("[redis] ✅ Bağlantı kuruldu");
  });

  redis.on("error", (err) => {
    // Sadece ilk hatayı logla — sonraki sessiz
    console.error("[redis] ⚠️  Bağlantı hatası (uygulama çalışmaya devam eder):", err.message);
  });

  // Bağlantıyı başlat (lazy — hata olsa da uygulama patlamaz)
  redis.connect().catch(() => {});
} else {
  console.warn("[redis] ⚠️  REDIS_URL tanımlı değil — Redis devre dışı (in-memory fallback)");
}

export { redis };
export default redis;

/** Önbellek yardımcıları — null-safe */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? (JSON.parse(val) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 30): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {}
}

export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {}
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length) await redis.del(...keys);
  } catch {}
}
