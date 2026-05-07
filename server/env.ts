/**
 * PRODUCTION ORTAM DEĞİŞKENİ DOĞRULAMA
 * ──────────────────────────────────────────────────────────────────────────────
 * Ana süreç başlamadan önce çağrılır. Zorunlu değişkenler eksikse process.exit(1).
 * Önerilen değişkenler production'da uyarı üretir.
 */

interface EnvCheck {
  key: string;
  required: boolean;
  description: string;
}

const CHECKS: EnvCheck[] = [
  { key: "DATABASE_URL",        required: true,  description: "PostgreSQL bağlantı URL'i (Neon)" },
  { key: "SESSION_SECRET",      required: false, description: "Oturum imzalama anahtarı (güçlü rastgele string)" },
  { key: "JWT_ACCESS_SECRET",   required: false, description: "JWT access token imzalama anahtarı" },
  { key: "JWT_REFRESH_SECRET",  required: false, description: "JWT refresh token imzalama anahtarı" },
  { key: "REDIS_URL",           required: false, description: "Redis URL (Upstash — önbellek + WebSocket çoklu instance)" },
  { key: "FRONTEND_URL",        required: false, description: "İzin verilen frontend URL'leri (virgülle ayrılmış)" },
];

const DEFAULT_SECRET = "notebeat-kids-secret-2024";

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const check of CHECKS) {
    const val = process.env[check.key];
    if (!val) {
      if (check.required) {
        missing.push(`  ❌ ${check.key} — ${check.description}`);
      } else if (isProduction) {
        warnings.push(`  ⚠️  ${check.key} — ${check.description}`);
      }
    }
  }

  if (missing.length) {
    console.error(
      "❌ FATAL — Zorunlu ortam değişkenleri eksik:\n" + missing.join("\n") +
      "\nSunucu başlatılamıyor."
    );
    process.exit(1);
  }

  if (isProduction) {
    if (warnings.length) {
      console.warn("⚠️  Önerilen ortam değişkenleri eksik (production performansı ve güvenlik etkilenir):\n" + warnings.join("\n"));
    }

    const secret = process.env.SESSION_SECRET || "";
    if (!secret || secret === DEFAULT_SECRET) {
      console.warn("⚠️  SESSION_SECRET varsayılan değer kullanıyor! Production'da güçlü bir rastgele anahtar belirleyin.");
    }

    if (!process.env.REDIS_URL) {
      console.warn("⚠️  REDIS_URL tanımlı değil — leaderboard önbelleği ve WebSocket çoklu instance desteği devre dışı!");
    }

    if (!process.env.FRONTEND_URL) {
      console.warn("⚠️  FRONTEND_URL tanımlı değil — CORS kısıtlaması zayıf kalıyor!");
    }

    const jwtAccess  = process.env.JWT_ACCESS_SECRET  || "";
    const jwtRefresh = process.env.JWT_REFRESH_SECRET || "";
    if (!jwtAccess || !jwtRefresh) {
      console.warn("⚠️  JWT_ACCESS_SECRET / JWT_REFRESH_SECRET eksik — TOKEN_SECRET (SESSION_SECRET) fallback kullanılıyor.");
    }
  }
}

/** Belirli bir env değişkeninin değerini veya varsayılanı döndürür (log'lamadan) */
export function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}
