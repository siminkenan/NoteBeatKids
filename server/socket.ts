/**
 * SOCKET.IO — Redis Adapter ile Çoklu Instance Desteği
 * ──────────────────────────────────────────────────────────────────────────────
 * Redis mevcut → @socket.io/redis-adapter ile tüm Render instance'ları senkronize
 * Redis yok   → tek instance'da in-memory çalışır (geliştirme ortamı)
 *
 * Odalar: her kurum için `inst:{institutionId}` odası
 *
 * Bellek sızıntısı önlemleri:
 *  - Her bağlantıda `disconnected` bayrağı — timer'ların bağlantı kapandıktan
 *    sonra yeniden oluşturulmasını önler
 *  - Bağlantı kesilince tüm timer'lar ve referanslar temizlenir
 *  - Periyodik boşta bağlantı taraması — orphaned socket'ları tespit eder
 *  - Async DB çağrısı bağlantı kesilmişse sonuç kullanılmaz
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

// Periyodik stale socket tarama aralığı (5 dk)
const STALE_SWEEP_MS = 5 * 60 * 1000;

export async function initSocketIO(httpServer: HttpServer): Promise<SocketIOServer> {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: true, // tüm origin'lere izin ver
      credentials: true,
    },
    // Bağlantı güvenilirliği
    pingTimeout: 20_000,
    pingInterval: 25_000,
    connectTimeout: 10_000,
    transports: ["websocket", "polling"],
    // Bağlantı başına maksimum buffer boyutu (100KB) — bellek sızıntısı önlemi
    maxHttpBufferSize: 100_000,
  });

  // ── Redis Adapter (çoklu instance ölçekleme) ──────────────────────────────
  if (redis) {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      // Pub/Sub için iki ayrı bağlantı gerekli
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      // duplicate() lazyConnect=true miras alır — connect() ile açıkça başlat
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
    let disconnected = false; // bellek sızıntısı önlemi — post-disconnect timer'ları engelle

    let institutionId = socket.handshake.query.institutionId as string;

    // Öğrenciler için studentId → institutionId çözümle
    if (!institutionId) {
      const studentId = socket.handshake.query.studentId as string;
      if (studentId) {
        try {
          const resolved = await storage.getInstitutionIdForStudent(studentId);
          // Async çözümleme tamamlanmadan bağlantı kesildiyse devam etme
          if (disconnected) return;
          if (resolved) institutionId = resolved;
        } catch {
          // Hata durumunda bağlantıyı kapat
          if (!disconnected) socket.disconnect();
          return;
        }
      }
    }

    if (!institutionId) {
      socket.disconnect();
      return;
    }

    // Kuruma ait odaya katıl
    socket.join(`inst:${institutionId}`);

    // ── Boşta kalma zamanlayıcısı ─────────────────────────────────────────
    let idleTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (!disconnected) socket.disconnect(true);
    }, IDLE_TIMEOUT_MS);

    const resetIdleTimer = () => {
      if (disconnected) return; // bağlantı zaten kapanmış — timer yenileme
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (!disconnected) socket.disconnect(true);
      }, IDLE_TIMEOUT_MS);
    };

    socket.on("ping_keep_alive", resetIdleTimer);

    socket.on("disconnect", (reason) => {
      disconnected = true;
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      log(`Socket disconnect: ${socket.id} — ${reason}`, "debug");
    });

    // Bağlanınca mevcut listeyi hemen gönder (in-memory önbellekten)
    // Socket.io broadcast olayları Redis adapter üzerinden yayılır
    try {
      const types: Array<"school" | "monthly"> = ["school", "monthly"];
      for (const type of types) {
        if (disconnected) break;
        const cacheKey = `${institutionId}:${type}::`;
        let cached = getCachedLeaderboard(cacheKey);
        if (!cached) {
          const entries = await storage.getLeaderboard(institutionId, type);
          if (disconnected) break; // async tamamlanmadan kesildi
          cached = { entries };
          setCachedLeaderboard(cacheKey, cached);
        }
        const entries = (cached as { entries: unknown[] }).entries;
        socket.emit("leaderboard:update", { type, entries });
      }
    } catch (_) {}
  });

  // ── Periyodik stale socket taraması ──────────────────────────────────────
  const staleTimer = setInterval(() => {
    if (!io) { clearInterval(staleTimer); return; }
    const sockets = io.sockets.sockets;
    let total = 0;
    let disconnectedCount = 0;
    for (const [, s] of Array.from(sockets)) {
      total++;
      if (!s.connected) disconnectedCount++;
    }
    if (process.env.NODE_ENV === "production" && total > 0) {
      log(`📊 Socket.io: ${total} bağlantı (${disconnectedCount} bağlantısız)`, "monitor");
    }
  }, STALE_SWEEP_MS);

  staleTimer.unref(); // Node.js'in kapanmasını engelleme

  return io;
}

/**
 * Graceful shutdown için Socket.io sunucusunu kapat.
 * Tüm bağlantılara disconnect bildirimi gönderir.
 */
export async function closeSocketIO(): Promise<void> {
  if (!io) return;
  return new Promise((resolve) => {
    io!.close(() => {
      log("✅ Socket.io kapatıldı");
      io = null;
      resolve();
    });
  });
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
