import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { initSocketIO } from "./socket";
import { log } from "./logger";
import rateLimit from "express-rate-limit";

export { log };

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/** Auth endpoint rate limiter — Redis'siz, hafıza-içi (yeterli tek instance için) */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 30,                   // 15 dk'da en fazla 30 giriş denemesi
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla giriş denemesi. Lütfen 15 dakika bekleyin." },
  skip: (req) => process.env.NODE_ENV !== "production",
});

export async function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // ── Güvenlik başlıkları ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite HMR / inline script için kapalı
      crossOriginEmbedderPolicy: false,
    })
  );

  // ── Sıkıştırma (gzip/brotli) ──────────────────────────────────────────────
  app.use(compression());

  // ── Proxy güveni (Render, Replit, Vercel) ─────────────────────────────────
  app.set("trust proxy", 1);

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin) ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com") ||
          origin.includes("localhost") ||
          origin.includes("replit.dev")
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    })
  );

  // ── Body parser ───────────────────────────────────────────────────────────
  app.use(
    express.json({
      limit: "10mb",
      verify: (req, _res, buf) => { req.rawBody = buf; },
    })
  );
  app.use(express.urlencoded({ extended: false }));

  // ── Session ───────────────────────────────────────────────────────────────
  const isProduction = process.env.NODE_ENV === "production";
  const sessionConfig: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "notebeat-kids-secret-2024",
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  if (isProduction && process.env.DATABASE_URL) {
    const PgSession = connectPgSimple(session);
    sessionConfig.store = new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
    });
  }

  app.use(session(sessionConfig));

  // ── İstek loglama ─────────────────────────────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJson: Record<string, any> | undefined;
    const origJson = res.json;
    res.json = function (body, ...args) {
      capturedJson = body;
      return origJson.apply(res, [body, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJson && res.statusCode >= 400) logLine += ` :: ${JSON.stringify(capturedJson)}`;
        log(logLine);
      }
    });
    next();
  });

  // ── Sağlık / Hazırlık endpoint'leri ──────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), ts: new Date().toISOString() });
  });

  app.get("/ready", async (_req, res) => {
    const checks: Record<string, string> = {};
    // DB kontrolü
    try {
      const { db } = await import("./db");
      await db.execute({ sql: "SELECT 1", params: [] } as any);
      checks.db = "ok";
    } catch (e: any) {
      checks.db = `error: ${e?.message}`;
    }
    // Redis kontrolü
    try {
      const { redis } = await import("./redis");
      if (redis && redis.status === "ready") {
        checks.redis = "ok";
      } else {
        checks.redis = redis ? redis.status : "disabled";
      }
    } catch {
      checks.redis = "disabled";
    }

    const allOk = checks.db === "ok";
    res.status(allOk ? 200 : 503).json({ status: allOk ? "ready" : "degraded", checks });
  });

  // ── Rotalar ───────────────────────────────────────────────────────────────
  await registerRoutes(httpServer, app);

  // ── Socket.io ─────────────────────────────────────────────────────────────
  initSocketIO(httpServer);

  // ── Global hata yakalayıcı ────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (status >= 500) {
      log(`❌ Sunucu hatası: ${message} — ${err?.stack?.split("\n")[1]?.trim() ?? ""}`, "error");
    }
    if (res.headersSent) return next(err);
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
