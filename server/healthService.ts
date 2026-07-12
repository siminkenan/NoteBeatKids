/**
 * HEALTH SERVICE — Sistem Sağlık Toplayıcısı
 * ──────────────────────────────────────────────────────────────────────────────
 * Tüm sistem bileşenlerinin durumunu ON-DEMAND okur.
 * Hiçbir veri yazmaz. Polling yapmaz.
 * Sadece GET /api/admin/health çağrılınca tetiklenir.
 */

import { pool, poolStats } from "./db";
import { redis } from "./redis";
import { getSocketStats } from "./socket";
import { bufferSize, dirtyInstitutionCount, flushStats } from "./scoreBuffer";
import { getApiMetrics } from "./apiMetrics";

export interface HealthReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "critical";

  postgresql: {
    status: "ok" | "error" | "slow";
    pingMs: number | null;
    poolTotal: number;
    poolIdle: number;
    poolWaiting: number;
  };

  redis: {
    status: "ok" | "disabled" | "error";
    memoryUsedMB: number | null;
    hitRate: number | null;
    keyCount: number | null;
    connected: boolean;
  };

  socketio: {
    totalSockets: number;
    connectedSockets: number;
    totalRooms: number;
  };

  scoreBuffer: {
    pendingEntries: number;
    dirtyInstitutions: number;
    lastFlushAt: string | null;
    lastFlushDurationMs: number | null;
    lastFlushSuccess: boolean | null;
    lastFlushError: string | null;
  };

  leaderboard: {
    lastBroadcastAt: string | null;
    lastBroadcastDurationMs: number | null;
  };

  monthlyReset: {
    lastRunAt: string | null;
    lastResult: "success" | "failed" | "skipped" | null;
    nextRunAt: string | null;
  };

  api: {
    totalRequests: number;
    requestsLastHour: number;
    avgResponseMs: number;
    slowestEndpoint: { path: string; avgMs: number } | null;
  };

  integrity: {
    lastCheckAt: string | null;
    lastResult: "ok" | "warnings" | "failed" | null;
    warningCount: number;
  };

  system: {
    nodeVersion: string;
    uptime: number;
    rssMemoryMB: number;
    heapUsedMB: number;
    heapTotalMB: number;
  };
}

// ── Leaderboard broadcast izleme (socket.ts tarafından güncellenir) ────────────
export const leaderboardStats = {
  lastBroadcastAt: null as Date | null,
  lastBroadcastDurationMs: null as number | null,
};

// ── Monthly reset izleme (index.ts tarafından güncellenir) ────────────────────
export const monthlyResetStats = {
  lastRunAt: null as Date | null,
  lastResult: null as "success" | "failed" | "skipped" | null,
  nextRunAt: null as Date | null,
};

// ── Integrity scanner izleme (integrityScanner.ts tarafından güncellenir) ─────
export const integrityStats = {
  lastCheckAt: null as Date | null,
  lastResult: null as "ok" | "warnings" | "failed" | null,
  warningCount: 0,
};

// ── PostgreSQL ping ────────────────────────────────────────────────────────────
async function checkPostgres(): Promise<HealthReport["postgresql"]> {
  const stats = poolStats();
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const pingMs = Date.now() - start;
    return {
      status: pingMs > 2000 ? "slow" : "ok",
      pingMs,
      poolTotal: stats.total,
      poolIdle: stats.idle,
      poolWaiting: stats.waiting,
    };
  } catch {
    return {
      status: "error",
      pingMs: null,
      poolTotal: stats.total,
      poolIdle: stats.idle,
      poolWaiting: stats.waiting,
    };
  }
}

// ── Redis sağlık kontrolü ──────────────────────────────────────────────────────
async function checkRedis(): Promise<HealthReport["redis"]> {
  if (!redis) {
    return { status: "disabled", memoryUsedMB: null, hitRate: null, keyCount: null, connected: false };
  }

  try {
    const [memInfo, statsInfo] = await Promise.all([
      redis.info("memory"),
      redis.info("stats"),
    ]);

    const memMatch = memInfo.match(/used_memory:(\d+)/);
    const hitMatch = statsInfo.match(/keyspace_hits:(\d+)/);
    const missMatch = statsInfo.match(/keyspace_misses:(\d+)/);

    const memBytes = memMatch ? parseInt(memMatch[1]) : 0;
    const hits = hitMatch ? parseInt(hitMatch[1]) : 0;
    const misses = missMatch ? parseInt(missMatch[1]) : 0;
    const total = hits + misses;
    const hitRate = total > 0 ? Math.round((hits / total) * 100) : null;

    // Yaklaşık key sayısı
    let keyCount: number | null = null;
    try {
      const dbInfo = await redis.info("keyspace");
      const match = dbInfo.match(/keys=(\d+)/);
      if (match) keyCount = parseInt(match[1]);
    } catch {}

    return {
      status: redis.status === "ready" ? "ok" : "error",
      memoryUsedMB: Math.round(memBytes / 1024 / 1024),
      hitRate,
      keyCount,
      connected: redis.status === "ready",
    };
  } catch {
    return {
      status: "error",
      memoryUsedMB: null,
      hitRate: null,
      keyCount: null,
      connected: false,
    };
  }
}

// ── Ana health raporu ──────────────────────────────────────────────────────────
export async function getHealthReport(): Promise<HealthReport> {
  const [pg, rd] = await Promise.all([checkPostgres(), checkRedis()]);

  const socketStats = getSocketStats();
  const apiMetrics = getApiMetrics();
  const mem = process.memoryUsage();

  const overall: HealthReport["overall"] =
    pg.status === "error" ? "critical" :
    rd.status === "error" || pg.status === "slow" ? "degraded" :
    "healthy";

  return {
    timestamp: new Date().toISOString(),
    overall,

    postgresql: pg,
    redis: rd,

    socketio: socketStats,

    scoreBuffer: {
      pendingEntries: bufferSize(),
      dirtyInstitutions: dirtyInstitutionCount(),
      lastFlushAt: flushStats.lastFlushAt?.toISOString() ?? null,
      lastFlushDurationMs: flushStats.lastFlushDurationMs,
      lastFlushSuccess: flushStats.lastFlushSuccess,
      lastFlushError: flushStats.lastFlushError,
    },

    leaderboard: {
      lastBroadcastAt: leaderboardStats.lastBroadcastAt?.toISOString() ?? null,
      lastBroadcastDurationMs: leaderboardStats.lastBroadcastDurationMs,
    },

    monthlyReset: {
      lastRunAt: monthlyResetStats.lastRunAt?.toISOString() ?? null,
      lastResult: monthlyResetStats.lastResult,
      nextRunAt: monthlyResetStats.nextRunAt?.toISOString() ?? null,
    },

    api: apiMetrics,

    integrity: {
      lastCheckAt: integrityStats.lastCheckAt?.toISOString() ?? null,
      lastResult: integrityStats.lastResult,
      warningCount: integrityStats.warningCount,
    },

    system: {
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      rssMemoryMB: Math.round(mem.rss / 1024 / 1024),
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    },
  };
}
