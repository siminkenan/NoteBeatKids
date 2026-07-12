/**
 * API METRİK TOPLAYICI
 * ──────────────────────────────────────────────────────────────────────────────
 * İstek sayısı, yanıt süreleri ve en yavaş endpoint'i izler.
 * Tüm veriler yalnızca in-memory tutulur — DB/Redis yükü yok.
 * Health endpoint dışında hiçbir yere veri yazmaz.
 */

import type { Request, Response, NextFunction } from "express";

interface EndpointStats {
  count: number;
  totalMs: number;
}

const state = {
  totalRequests: 0,
  requestTimestamps: [] as number[],
  endpoints: new Map<string, EndpointStats>(),
};

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Express middleware — her API isteğini izler */
export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api")) { next(); return; }

  const start = Date.now();
  state.totalRequests++;
  state.requestTimestamps.push(start);

  // Eski kayıtları temizle (bellek sızıntısı önlemi)
  if (state.requestTimestamps.length > 10_000) {
    const cutoff = Date.now() - ONE_HOUR_MS;
    let i = 0;
    while (i < state.requestTimestamps.length && state.requestTimestamps[i] < cutoff) i++;
    state.requestTimestamps.splice(0, i);
  }

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    // Route pattern kullan (varsa), yoksa ham path
    const key = `${req.method} ${req.route?.path ?? req.path}`;
    const existing = state.endpoints.get(key) ?? { count: 0, totalMs: 0 };
    existing.count++;
    existing.totalMs += durationMs;
    state.endpoints.set(key, existing);
  });

  next();
}

/** Health endpoint için anlık metrik snapshot */
export function getApiMetrics() {
  const now = Date.now();
  const cutoff = now - ONE_HOUR_MS;
  const lastHour = state.requestTimestamps.filter(t => t >= cutoff).length;

  let slowest: { path: string; avgMs: number } | null = null;
  let totalMs = 0;
  let totalCount = 0;

  for (const [path, m] of Array.from(state.endpoints.entries())) {
    if (m.count === 0) continue;
    const avg = m.totalMs / m.count;
    totalMs += m.totalMs;
    totalCount += m.count;
    if (!slowest || avg > slowest.avgMs) {
      slowest = { path, avgMs: Math.round(avg) };
    }
  }

  return {
    totalRequests: state.totalRequests,
    requestsLastHour: lastHour,
    avgResponseMs: totalCount > 0 ? Math.round(totalMs / totalCount) : 0,
    slowestEndpoint: slowest,
  };
}
