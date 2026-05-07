/**
 * LİDERLİK TABLOSU ÖNBELLEK
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis varsa → Redis önbelleği (tüm Render instance'larında paylaşılır)
 * Redis yoksa → in-memory Map (tek instance, geliştirme ortamı)
 *
 * TTL: 30 saniye (yıldız değişince scoreBuffer flush sonrası zaten güncellenir)
 *
 * Üretim notu:
 *   - redisDel: KEYS yerine SCAN kullanır (non-blocking, O(N) ama üretim güvenli)
 *   - Toplu silme: pipeline ile tek round-trip
 *   - Tüm dış çağrılar async versiyonları kullanmalı (çok instance desteği için)
 */

import { redis, redisScan } from "./redis";

const TTL_SEC     = 30;
const REDIS_PREFIX = "lb:";

// ── In-memory fallback ─────────────────────────────────────────────────────────
interface MemEntry { data: unknown; expiresAt: number; }
const memCache = new Map<string, MemEntry>();

// ── Redis yardımcıları ─────────────────────────────────────────────────────────

async function redisGet(key: string): Promise<unknown | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(REDIS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function redisSet(key: string, data: unknown): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(REDIS_PREFIX + key, JSON.stringify(data), "EX", TTL_SEC);
  } catch {}
}

/**
 * Bir desene uyan önbellek anahtarlarını sil.
 * SCAN kullanır (KEYS değil) — üretim ortamında Redis'i bloklamaz.
 * Pipeline ile toplu silme yapar — tek network round-trip.
 */
async function redisDel(keyPrefix: string): Promise<void> {
  if (!redis) return;
  try {
    const pattern = REDIS_PREFIX + keyPrefix + "*";
    const keys = await redisScan(pattern);
    if (!keys.length) return;
    const pipeline = redis.pipeline();
    for (const k of keys) pipeline.del(k);
    await pipeline.exec();
  } catch {}
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Önbellek oku — Redis önce (çok instance paylaşımı), sonra in-memory fallback.
 * Leaderboard endpoint'lerinde bu async versiyonu kullanın.
 */
export async function getCachedLeaderboardAsync(key: string): Promise<unknown | null> {
  const redisVal = await redisGet(key);
  if (redisVal !== null) return redisVal;

  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}

/**
 * Önbelleğe yaz — Redis + in-memory her ikisine.
 * Leaderboard endpoint'lerinde bu async versiyonu kullanın.
 */
export async function setCachedLeaderboardAsync(key: string, data: unknown): Promise<void> {
  await redisSet(key, data);
  memCache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
}

/**
 * Kurumun tüm önbelleğini temizle (yıldız değişince çağrılır).
 */
export async function invalidateLeaderboardCacheAsync(institutionId: string): Promise<void> {
  await redisDel(institutionId + ":");
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(institutionId)) memCache.delete(k);
  }
}

// ── Geriye dönük uyumlu senkron API (socket.ts ve eski çağrılar için) ──────────

/** Sadece in-memory okur — Socket.io bağlantı anında ilk veri için yeterli */
export function getCachedLeaderboard(key: string): unknown | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}

/** In-memory yazar + Redis'e fire-and-forget (socket.ts için) */
export function setCachedLeaderboard(key: string, data: unknown, ttlMs = TTL_SEC * 1000) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  redisSet(key, data).catch(() => {});
}

/** Hem sync in-memory hem async Redis invalidation */
export function invalidateLeaderboardCache(institutionId: string) {
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(institutionId)) memCache.delete(k);
  }
  redisDel(institutionId + ":").catch(() => {});
}
