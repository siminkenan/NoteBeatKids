interface CacheEntry { data: any; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

export function getCachedLeaderboard(key: string): any | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

export function setCachedLeaderboard(key: string, data: any, ttlMs = 60_000) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateLeaderboardCache(institutionId: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(institutionId)) cache.delete(key);
  }
}
