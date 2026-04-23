/**
 * BASİT BELLEK-İÇİ RATE LİMİTER
 * ─────────────────────────────────────────────────────────────────────────────
 * Puan spam'ini ve API istismarını önler.
 * Dış bağımlılık yok — saf in-memory Map kullanır.
 *
 * Kural: Her studentId için 60 saniyede en fazla MAX_REQUESTS istek.
 * Aşılırsa: 429 Too Many Requests döner.
 */

import type { Request, Response, NextFunction } from "express";

const MAX_REQUESTS = 30;   // 60 saniyede maksimum puan-kayıt isteği
const WINDOW_MS    = 60_000; // 60 saniye pencere

interface RateEntry {
  count: number;
  resetAt: number;
}

// studentId → { count, resetAt }
const store = new Map<string, RateEntry>();

// Bellek sızıntısını önle: her 5 dakikada bir süresi dolmuş girişleri temizle
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now >= entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);

/**
 * Express middleware: req.params.studentId bazlı rate limiting.
 * Yalnızca puan yazma endpoint'lerine ekle.
 */
export function scoreRateLimit(req: Request, res: Response, next: NextFunction) {
  const studentId = req.params.studentId;
  if (!studentId) return next(); // studentId yoksa geç (auth katmanı zaten reddeder)

  const now = Date.now();
  let entry = store.get(studentId);

  if (!entry || now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(studentId, entry);
    return next();
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
    return res.status(429).json({ message: "Çok fazla istek. Lütfen biraz bekleyin." });
  }

  next();
}
