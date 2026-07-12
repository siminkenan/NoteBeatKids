import express, { type Request, type Response, type NextFunction } from "express";
import type { IncomingMessage, ServerResponse } from "http";
import cors from "cors";
import session from "express-session";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { initSocketIO } from "./socket";
import { log } from "./logger";
import rateLimit from "express-rate-limit";
import { validateEnv } from "./env";
import { reportSystemError } from "./errorReporter";

export { log };

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

/** Auth endpoint rate limiter — in-memory (tek instance için yeterli, düşük yük) */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 30,                   // 15 dk'da en fazla 30 giriş denemesi
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Çok fazla giriş denemesi. Lütfen 15 dakika bekleyin." },
  skip: (req) => process.env.NODE_ENV !== "production",
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// Tüm origin'lere izin ver — JWT Bearer token ile auth zaten güvende.

export async function createApp() {
  // Ortam değişkenleri doğrulama — eksikse process.exit(1)
  validateEnv();

  const app = express();
  const httpServer = createServer(app);

  // ── Güvenlik başlıkları ────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: false,      // Vite HMR / inline script için kapalı
      crossOriginEmbedderPolicy: false,
      frameguard: false,                 // Replit preview iframe'i için devre dışı
    })
  );

  // ── Sıkıştırma (gzip/brotli) ──────────────────────────────────────────────
  app.use(compression());

  // ── Proxy güveni (Render, Replit, Vercel) ─────────────────────────────────
  app.set("trust proxy", 1);

  // ── CORS — tüm origin'lere izin ver ───────────────────────────────────────
  app.use(cors({ origin: true, credentials: true }));

  // ── Body parser ───────────────────────────────────────────────────────────
  app.use(
    express.json({
      limit: "10mb",
      verify: (req: IncomingMessage, _res: ServerResponse, buf: Buffer) => {
        (req as any).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false }));

  // ── Session (SADECE geliştirme — production'da devre dışı) ───────────────
  // Production'da tüm auth JWT Bearer token ile yapılır — session gerekmez.
  // Geliştirmede Replit aynı-origin fallback için tutulur.
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "notebeat-kids-secret-2024",
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false,
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 gün
          httpOnly: true,
        },
        // Store: in-memory (varsayılan) — dev-only, production'da kullanılmıyor
      })
    );
  }

  // ── İstek loglama ─────────────────────────────────────────────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;
    let capturedJson: Record<string, unknown> | undefined;
    const origJson = res.json.bind(res) as Response["json"];
    res.json = function (body: unknown) {
      capturedJson = body as Record<string, unknown>;
      return origJson(body);
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
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), ts: new Date().toISOString() });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    // DB kontrolü
    try {
      const { pool } = await import("./db");
      await pool.query("SELECT 1");
      checks.db = "ok";
    } catch (e: any) {
      checks.db = `error: ${e?.message}`;
    }
    // Redis kontrolü
    try {
      const { redis } = await import("./redis");
      checks.redis = (redis && redis.status === "ready") ? "ok" : (redis ? redis.status : "disabled");
    } catch {
      checks.redis = "disabled";
    }
    // Pool istatistikleri
    try {
      const { poolStats } = await import("./db");
      const stats = poolStats();
      checks.dbPool = `total=${stats.total} idle=${stats.idle} waiting=${stats.waiting}`;
    } catch {}

    const allOk = checks.db === "ok";
    res.status(allOk ? 200 : 503).json({ status: allOk ? "ready" : "degraded", checks });
  });

  // ── Rotalar ───────────────────────────────────────────────────────────────
  await registerRoutes(httpServer, app);

  // ── Socket.io ─────────────────────────────────────────────────────────────
  await initSocketIO(httpServer);

  // ── Global hata yakalayıcı ────────────────────────────────────────────────
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    if (status >= 500) {
      log(`❌ Sunucu hatası: ${message} — ${err?.stack?.split("\n")[1]?.trim() ?? ""}`, "error");
      // Beklenmeyen 500 hatalarını Error Center'a raporla (fire-and-forget)
      reportSystemError({
        severity: "error",
        route: req.path,
        message,
        stack: err?.stack?.slice(0, 2000) ?? null,
        requestId: (req as any).id ?? null,
      });
    }
    if (res.headersSent) return next(err);
    res.status(status).json({ message });
  });

  return { app, httpServer };
}
