import { Server as SocketIOServer } from "socket.io";
import { Server as HttpServer } from "http";
import { storage } from "./storage";
import { getCachedLeaderboard, setCachedLeaderboard } from "./leaderboardCache";

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HttpServer) {
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
  });

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

    if (!institutionId) { socket.disconnect(); return; }

    // Kuruma ait odaya katıl
    socket.join(`inst:${institutionId}`);

    // Bağlanınca hemen mevcut listeyi gönder (önbellekten)
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
        socket.emit("leaderboard:update", { type, entries: cached.entries });
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
