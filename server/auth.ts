/**
 * JWT AUTH — Access Token (15dk) + Refresh Token (30 gün)
 * ──────────────────────────────────────────────────────────────────────────────
 * Access token  : kısa ömürlü JWT, Authorization: Bearer header ile gönderilir
 * Refresh token : uzun ömürlü JWT, Redis'te JTI (token ID) ile saklanır
 * Eski HMAC     : mevcut `teacherToken` ile geriye dönük uyumluluk korunur
 *
 * Env vars:
 *   JWT_ACCESS_SECRET   — access token imzalama anahtarı
 *   JWT_REFRESH_SECRET  — refresh token imzalama anahtarı
 *   ACCESS_TOKEN_TTL    — ör: "15m" (varsayılan)
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { redis } from "./redis";

// ── Sır anahtarları ───────────────────────────────────────────────────────────
const BASE_SECRET  = process.env.SESSION_SECRET || "notebeat-kids-secret-2024";
const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || BASE_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || BASE_SECRET + "-refresh";
const ACCESS_TTL     = (process.env.ACCESS_TOKEN_TTL || "15m") as string;
const REFRESH_TTL_S  = 30 * 24 * 60 * 60; // 30 gün (saniye)

export type TokenRole = "admin" | "teacher";

interface TokenPayload {
  sub: string;
  role: TokenRole;
  type: "access" | "refresh";
  jti: string;
}

// ── Eski HMAC sistemi — geriye dönük uyumluluk ────────────────────────────────
export function signLegacyToken(id: string, prefix: string): string {
  const payload = Buffer.from(`${prefix}:${id}`).toString("base64url");
  const sig = crypto.createHmac("sha256", BASE_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyLegacyToken(token: string, prefix: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", BASE_SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const decoded = Buffer.from(payload, "base64url").toString();
    if (!decoded.startsWith(`${prefix}:`)) return null;
    return decoded.slice(prefix.length + 1);
  } catch {
    return null;
  }
}

// ── Yeni JWT sistemi ──────────────────────────────────────────────────────────

export function signAccessToken(id: string, role: TokenRole): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { sub: id, role, type: "access", jti } as TokenPayload,
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL } as jwt.SignOptions
  );
}

export function signRefreshToken(id: string, role: TokenRole): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    { sub: id, role, type: "refresh", jti } as TokenPayload,
    REFRESH_SECRET,
    { expiresIn: `${REFRESH_TTL_S}s` } as jwt.SignOptions
  );
}

/** Access token doğrula — senkron, sadece imza + tip kontrolü */
export function verifyAccessToken(token: string, role: TokenRole): string | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as TokenPayload;
    if (payload.type !== "access" || payload.role !== role) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** Refresh token Redis'e kaydet (JTI ile) */
export async function storeRefreshToken(token: string): Promise<void> {
  if (!redis) return;
  try {
    const payload = jwt.decode(token) as TokenPayload | null;
    if (!payload?.jti || !payload?.sub || !payload?.role) return;
    await redis.set(`rt:${payload.role}:${payload.sub}:${payload.jti}`, "1", "EX", REFRESH_TTL_S);
  } catch {}
}

/** Refresh token geçersiz kıl (çıkış yaparken) */
export async function invalidateRefreshToken(token: string): Promise<void> {
  if (!redis) return;
  try {
    const payload = jwt.decode(token) as TokenPayload | null;
    if (!payload?.jti || !payload?.sub || !payload?.role) return;
    await redis.del(`rt:${payload.role}:${payload.sub}:${payload.jti}`);
  } catch {}
}

/** Kullanıcının TÜM refresh token'larını geçersiz kıl (tüm cihazlardan çıkış) */
export async function invalidateAllRefreshTokens(id: string, role: TokenRole): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(`rt:${role}:${id}:*`);
    if (keys.length) await redis.del(...keys);
  } catch {}
}

/**
 * Refresh token doğrula:
 * 1. JWT imzası geçerli mi?
 * 2. Redis'te kayıtlı mı? (geçersiz kılınmış mı kontrol)
 *
 * Redis yoksa: JWT imzası yeterlidir (biraz daha az güvenli ama çalışır)
 */
export async function verifyRefreshToken(token: string, role: TokenRole): Promise<string | null> {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET) as TokenPayload;
    if (payload.type !== "refresh" || payload.role !== role) return null;

    if (redis) {
      const exists = await redis.exists(`rt:${role}:${payload.sub}:${payload.jti}`);
      if (!exists) return null; // Geçersiz kılınmış veya süresi dolmuş
    }
    return payload.sub;
  } catch {
    return null;
  }
}

/** Bearer header'dan token çıkar */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
