/**
 * RATE LİMİTER
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis varsa: Redis-backed (çoklu Render instance'da da çalışır)
 * Redis yoksa: in-memory Map (tek instance için yeterli)
 *
 * ÖNEMLI: Express 4 async middleware sorununu önlemek için
 * dışarı verilen `scoreRateLimit` senkron bir wrapper'dır.
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
  for (const [key, entry] of Array.from(memStore.entries())) {
    if (now >= entry.resetAt) memStore.delete(key);
  }
}, 5 * 60_000).unref();

// ── Redis-backed limiter ──────────────────────────────────────────────────────
async function checkRedisLimit(studentId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = `rl:score:${studentId}`;
  try {
    const count = await redis!.incr(key);
    if (count === 1) await redis!.expire(key, WINDOW_SEC);
    if (count > MAX_REQUESTS) {
      const ttl = await redis!.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : WINDOW_SEC };
    }
    return { allowed: true };
  } catch {
    return { allowed: true }; // Redis hata verirse geçir
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

// ── Async iç fonksiyon ────────────────────────────────────────────────────────
async function _scoreRateLimitAsync(req: Request, res: Response, next: NextFunction): Promise<void> {
  const studentId = req.params.studentId as string;
  if (!studentId) { next(); return; }

  const result = redis
    ? await checkRedisLimit(studentId)
    : checkMemLimit(studentId);

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfter ?? WINDOW_SEC));
    res.status(429).json({ message: "Çok fazla istek. Lütfen biraz bekleyin." });
    return;
  }
  next();
}

/**
 * Express middleware (senkron wrapper — Express 4 uyumlu).
 * Yalnızca puan yazma endpoint'lerine ekle.
 */
export function scoreRateLimit(req: Request, res: Response, next: NextFunction): void {
  _scoreRateLimitAsync(req, res, next).catch(next);
}
