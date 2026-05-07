/**
 * RATE LİMİTER
 * ──────────────────────────────────────────────────────────────────────────────
 * Puan spam'ini ve API istismarını önler.
 *
 * - Redis varsa: Redis-backed (çoklu Render instance'da da çalışır)
 * - Redis yoksa: in-memory Map (tek instance için yeterli)
 *
 * Kural: Her studentId için 60 saniyede en fazla MAX_REQUESTS istek.
 */

import type { Request, Response, NextFunction } from "express";
import { redis } from "./redis";

const MAX_REQUESTS = 30;
const WINDOW_SEC   = 60;
const WINDOW_MS    = WINDOW_SEC * 1000;

// ── In-memory fallback ────────────────────────────────────────────────────────
interface RateEntry { count: number; resetAt: number; }
const memStore = new Map<string, RateEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memStore.entries()) {
    if (now >= entry.resetAt) memStore.delete(key);
  }
}, 5 * 60_000);

// ── Redis-backed limiter ──────────────────────────────────────────────────────
async function checkRedisLimit(studentId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `rl:score:${studentId}`;
  try {
    const count = await redis!.incr(key);
    if (count === 1) {
      await redis!.expire(key, WINDOW_SEC);
    }
    if (count > MAX_REQUESTS) {
      const ttl = await redis!.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : WINDOW_SEC };
    }
    return { allowed: true };
  } catch {
    // Redis hata verirse geçir (graceful degradation)
    return { allowed: true };
  }
}

// ── In-memory limiter ─────────────────────────────────────────────────────────
function checkMemLimit(studentId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let entry = memStore.get(studentId);
  if (!entry || now >= entry.resetAt) {
    memStore.set(studentId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

/**
 * Express middleware: req.params.studentId bazlı rate limiting.
 * Yalnızca puan yazma endpoint'lerine ekle.
 */
export async function scoreRateLimit(req: Request, res: Response, next: NextFunction) {
  const studentId = req.params.studentId;
  if (!studentId) return next();

  const result = redis
    ? await checkRedisLimit(studentId)
    : checkMemLimit(studentId);

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfter ?? WINDOW_SEC));
    return res.status(429).json({ message: "Çok fazla istek. Lütfen biraz bekleyin." });
  }

  next();
}
