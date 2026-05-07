/**
 * LİDERLİK TABLOSU ÖNBELLEK
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis varsa → Redis önbelleği (tüm Render instance'larında paylaşılır)
 * Redis yoksa → in-memory Map (tek instance, geliştirme ortamı)
 *
 * TTL: 30 saniye (yıldız değişince scoreBuffer flush sonrası zaten güncellenir)
 */

import { redis } from "./redis";

const TTL_SEC = 30;
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

async function redisDel(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(REDIS_PREFIX + pattern + "*");
    if (keys.length) await redis.del(...keys);
  } catch {}
}

// ── Public API (hem async hem sync versiyonlar) ────────────────────────────────

/** Önbellek oku — Redis'ten. Yoksa in-memory'ye bak. */
export async function getCachedLeaderboardAsync(key: string): Promise<unknown | null> {
  // Redis dene
  const redisVal = await redisGet(key);
  if (redisVal !== null) return redisVal;
  // In-memory fallback
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}

/** Önbelleğe yaz — Redis + in-memory her ikisine */
export async function setCachedLeaderboardAsync(key: string, data: unknown): Promise<void> {
  await redisSet(key, data);
  memCache.set(key, { data, expiresAt: Date.now() + TTL_SEC * 1000 });
}

/** Kurumun tüm cache'ini temizle */
export async function invalidateLeaderboardCacheAsync(institutionId: string): Promise<void> {
  await redisDel(institutionId + ":");
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(institutionId)) memCache.delete(k);
  }
}

// ── Geriye dönük uyumlu senkron API (routes.ts'deki mevcut çağrılar için) ──────
export function getCachedLeaderboard(key: string): unknown | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}

export function setCachedLeaderboard(key: string, data: unknown, ttlMs = TTL_SEC * 1000) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
  // Fire-and-forget Redis update
  redisSet(key, data).catch(() => {});
}

export function invalidateLeaderboardCache(institutionId: string) {
  for (const k of Array.from(memCache.keys())) {
    if (k.startsWith(institutionId)) memCache.delete(k);
  }
  redisDel(institutionId + ":").catch(() => {});
}
