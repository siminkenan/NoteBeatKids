/**
 * ADMIN CİHAZ GÜVENLİĞİ
 * Brute-force koruma + User-Agent ayrıştırma (in-memory, sıfır DB sorgusu)
 */

// ── Brute-force koruma ──────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

interface AttemptRecord { count: number; lockedUntil: number | null; }
const loginAttempts = new Map<string, AttemptRecord>();

export function checkBruteForce(email: string): { locked: boolean; minutesLeft?: number } {
  const rec = loginAttempts.get(email);
  if (!rec) return { locked: false };
  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const minutesLeft = Math.ceil((rec.lockedUntil - Date.now()) / 60_000);
    return { locked: true, minutesLeft };
  }
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
    loginAttempts.delete(email);
  }
  return { locked: false };
}

export function recordFailedAttempt(email: string): void {
  const rec = loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
  rec.count++;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = Date.now() + LOCK_DURATION_MS;
  loginAttempts.set(email, rec);
}

export function resetLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

// ── User-Agent ayrıştırma ───────────────────────────────────────────────────
export function detectDeviceType(ua: string): "desktop" | "mobile" {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
    ? "mobile"
    : "desktop";
}

export function extractBrowserInfo(ua: string): { browser: string; os: string; deviceName: string } {
  let browser = "Bilinmiyor";
  let os = "Bilinmiyor";

  // Browser
  if (/Edg\//i.test(ua))           browser = "Microsoft Edge";
  else if (/OPR\//i.test(ua))      browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Browser";
  else if (/Chrome\//i.test(ua))   browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua))  browser = "Firefox";

  // OS
  if (/Windows NT 10/i.test(ua))      os = "Windows 10/11";
  else if (/Windows NT/i.test(ua))    os = "Windows";
  else if (/Mac OS X/i.test(ua))      os = "macOS";
  else if (/Android/i.test(ua)) {
    const m = ua.match(/Android ([0-9.]+)/i);
    os = m ? `Android ${m[1]}` : "Android";
  }
  else if (/iPhone OS/i.test(ua)) {
    const m = ua.match(/iPhone OS ([0-9_]+)/i);
    os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
  }
  else if (/iPad/i.test(ua))          os = "iPadOS";
  else if (/Linux/i.test(ua))         os = "Linux";

  const deviceType = detectDeviceType(ua);
  const deviceName = deviceType === "mobile" ? `${os} Telefon` : `${os} Bilgisayar`;

  return { browser, os, deviceName };
}

export function getClientIp(req: import("express").Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}
