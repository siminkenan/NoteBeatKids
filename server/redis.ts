/**
 * REDIS İSTEMCİSİ — Upstash / ioredis
 * ──────────────────────────────────────────────────────────────────────────────
 * REDIS_URL  = https://xxx.upstash.io  (Upstash REST formatı)
 *              veya  rediss://default:TOKEN@xxx.upstash.io:6379
 * REDIS_TOKEN = Upstash REST token (REDIS_URL https:// ise gerekli)
 *
 * Kural: Redis bağlanamasa bile uygulama ÇÖKMEZ.
 * Her yerde `redis` null olabilir; null ise in-memory fallback kullan.
 *
 * Üretim notu: KEYS komutu O(N) ve Redis'i bloklar — tüm toplu silme işlemleri
 * SCAN + pipeline kullanır.
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
    // Yeniden bağlanma stratejisi — sonsuz döngüyü önle
    retryStrategy: (times) => {
      if (times > 5) return null; // 5 denemeden sonra vazgeç
      return Math.min(times * 200, 2_000); // 200ms → 2s backoff
    },
  });

  redis.on("connect", () => {
    console.log("[redis] ✅ Bağlantı kuruldu");
  });

  redis.on("ready", () => {
    console.log("[redis] ✅ Hazır");
  });

  redis.on("error", (err) => {
    // Tekrarlayan hataları bastır — sadece konsola yaz
    console.error("[redis] ⚠️  Bağlantı hatası (uygulama çalışmaya devam eder):", err.message);
  });

  redis.on("close", () => {
    console.warn("[redis] ℹ️  Bağlantı kapandı");
  });

  // Bağlantıyı başlat (lazy — hata olsa da uygulama patlamaz)
  redis.connect().catch(() => {});
} else {
  console.warn("[redis] ⚠️  REDIS_URL tanımlı değil — Redis devre dışı (in-memory fallback)");
}

export { redis };
export default redis;

// ── SCAN tabanlı anahtar arama (KEYS'in üretim-güvenli alternatifi) ───────────

/**
 * Bir desene uyan tüm anahtarları SCAN ile listeler.
 * KEYS'ten farklı olarak Redis'i bloklamaz — O(N) ama non-blocking.
 */
export async function redisScan(pattern: string): Promise<string[]> {
  if (!redis) return [];
  const keys: string[] = [];
  let cursor = "0";
  try {
    do {
      const [nextCursor, batch] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "100");
      keys.push(...batch);
      cursor = nextCursor;
    } while (cursor !== "0");
  } catch {
    return [];
  }
  return keys;
}

/**
 * Bir desene uyan anahtarları toplu sil (pipeline — atomik, tek round-trip).
 */
export async function cacheDelPatternScan(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redisScan(pattern);
    if (!keys.length) return;
    const pipeline = redis.pipeline();
    for (const k of keys) pipeline.del(k);
    await pipeline.exec();
  } catch {}
}

// ── Null-safe önbellek yardımcıları ───────────────────────────────────────────

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

/** @deprecated SCAN tabanlı cacheDelPatternScan kullanın */
export async function cacheDelPattern(pattern: string): Promise<void> {
  return cacheDelPatternScan(pattern);
}
