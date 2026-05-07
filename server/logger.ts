/**
 * YAPISAL LOGGER — pino
 * ──────────────────────────────────────────────────────────────────────────────
 * Üretimde JSON çıktısı, geliştirmede okunabilir format.
 * Tüm console.log / log() çağrıları buraya yönlendirilebilir.
 */

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } }
      : undefined,
});

/** Express log formatı ile uyumlu yardımcı */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  if (process.env.NODE_ENV === "production") {
    logger.info({ source }, message);
  } else {
    console.log(`${formattedTime} [${source}] ${message}`);
  }
}

export default logger;
