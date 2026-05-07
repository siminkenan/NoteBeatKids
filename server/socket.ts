/**
 * SOCKET.IO — Redis Adapter ile Çoklu Instance Desteği
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis mevcut → @socket.io/redis-adapter ile tüm Render instance'ları senkronize
 * Redis yok   → tek instance'da in-memory çalışır (geliştirme ortamı)
 *
 * Odalar: her kurum için `inst:{institutionId}` odası
 */

import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "http";
import { storage } from "./storage";
import { getCachedLeaderboard, setCachedLeaderboard } from "./leaderboardCache";
import { redis } from "./redis";
import { log } from "./logger";

let io: SocketIOServer | null = null;

// Boşta kalan socket'ları kapat (30 dk)
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export async function initSocketIO(httpServer: HttpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (
          !origin ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com") ||
          origin.includes("localhost") ||
          origin.includes("replit.dev")
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Socket CORS blocked: ${origin}`));
      },
      credentials: true,
    },
    // Bağlantı güvenilirliği
    pingTimeout: 20_000,
    pingInterval: 25_000,
    connectTimeout: 10_000,
    transports: ["websocket", "polling"],
  });

  // ── Redis Adapter (çoklu instance ölçekleme) ──────────────────────────────
  if (redis) {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      // Pub/Sub için iki ayrı bağlantı gerekli
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      log("✅ Socket.io Redis adapter etkinleştirildi (çoklu instance desteği)");
    } catch (err: any) {
      log(`⚠️  Socket.io Redis adapter başlatılamadı, in-memory devam ediyor: ${err?.message}`);
    }
  } else {
    log("ℹ️  Socket.io in-memory adapter kullanıyor (tek instance)");
  }

  // ── Bağlantı yönetimi ─────────────────────────────────────────────────────
  io.on("connection", async (socket) => {
    let institutionId = socket.handshake.query.institutionId as string;

    // Öğrenciler için studentId → institutionId çözümle
    if (!institutionId) {
      const studentId = socket.handshake.query.studentId as string;
      if (studentId) {
        const resolved = await storage.getInstitutionIdForStudent(studentId).catch(() => null);
        if (resolved) institutionId = resolved;
      }
    }

    if (!institutionId) {
      socket.disconnect();
      return;
    }

    // Kuruma ait odaya katıl
    socket.join(`inst:${institutionId}`);

    // Boşta kalma zamanlayıcısı
    let idleTimer = setTimeout(() => {
      socket.disconnect(true);
    }, IDLE_TIMEOUT_MS);

    socket.on("ping_keep_alive", () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => socket.disconnect(true), IDLE_TIMEOUT_MS);
    });

    socket.on("disconnect", () => {
      clearTimeout(idleTimer);
    });

    // Bağlanınca mevcut listeyi hemen gönder (önbellekten)
    try {
      const types: Array<"school" | "monthly"> = ["school", "monthly"];
      for (const type of types) {
        const cacheKey = `${institutionId}:${type}::`;
        let cached = getCachedLeaderboard(cacheKey);
        if (!cached) {
          const entries = await storage.getLeaderboard(institutionId, type);
          cached = { entries };
          setCachedLeaderboard(cacheKey, cached);
        }
        const entries = (cached as { entries: unknown[] }).entries;
        socket.emit("leaderboard:update", { type, entries });
      }
    } catch (_) {}
  });

  return io;
}

/** Yıldız değişince kurumun tüm bağlı kullanıcılarına anlık gönder */
export async function broadcastLeaderboard(institutionId: string) {
  if (!io) return;
  try {
    const types: Array<"school" | "monthly"> = ["school", "monthly"];
    for (const type of types) {
      const cacheKey = `${institutionId}:${type}::`;
      const entries = await storage.getLeaderboard(institutionId, type);
      setCachedLeaderboard(cacheKey, { entries });
      io.to(`inst:${institutionId}`).emit("leaderboard:update", { type, entries });
    }
  } catch (_) {}
}
