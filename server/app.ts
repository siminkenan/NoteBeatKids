import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { createServer } from "http";
import { initSocketIO } from "./socket";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export async function createApp() {
  const app = express();
  const httpServer = createServer(app);

  // Trust proxy (Render, Replit, Vercel)
  app.set("trust proxy", 1);

  // CORS — allow the frontend origin (Vercel or any configured domain) with cookies
  const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, same-origin)
        if (!origin) return callback(null, true);
        if (
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin) ||
          origin.endsWith(".vercel.app") ||
          origin.endsWith(".onrender.com") ||
          origin.includes("localhost")
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

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

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        log(logLine);
      }
    });
    next();
  });

  await registerRoutes(httpServer, app);

  // Socket.io — gerçek zamanlı liderlik güncellemeleri
  initSocketIO(httpServer);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  return { app, httpServer };
}
