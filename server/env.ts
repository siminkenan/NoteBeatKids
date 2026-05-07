/**
 * ORTAM DEĞİŞKENİ DOĞRULAMA
 * ──────────────────────────────────────────────────────────────────────────────
 * Production'da zorunlu değişkenler eksikse process.exit(1).
 * Development/Replit'te eksik değişkenler sadece uyarı üretir, sunucu kapanmaz.
 */

const PRODUCTION_REQUIRED = [
  { key: "DATABASE_URL",       description: "PostgreSQL bağlantı URL'i (Neon)" },
  { key: "SESSION_SECRET",     description: "Oturum imzalama anahtarı (güçlü rastgele string)" },
  { key: "JWT_ACCESS_SECRET",  description: "JWT access token imzalama anahtarı" },
  { key: "JWT_REFRESH_SECRET", description: "JWT refresh token imzalama anahtarı" },
];

const PRODUCTION_RECOMMENDED = [
  { key: "REDIS_URL",     description: "Redis URL (Upstash — leaderboard önbelleği + WebSocket)" },
  { key: "FRONTEND_URL",  description: "İzin verilen frontend URL'leri (virgülle ayrılmış)" },
];

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // --- Production: zorunlu değişkenler eksikse kapat ---
    const missing = PRODUCTION_REQUIRED.filter(c => !process.env[c.key]);
    if (missing.length) {
      console.error(
        "❌ FATAL — Production'da zorunlu ortam değişkenleri eksik:\n" +
        missing.map(c => `  ❌ ${c.key} — ${c.description}`).join("\n") +
        "\nSunucu başlatılamıyor."
      );
      process.exit(1);
    }

    // Önerilen değişkenler yoksa uyar ama devam et
    const recommended = PRODUCTION_RECOMMENDED.filter(c => !process.env[c.key]);
    if (recommended.length) {
      console.warn(
        "⚠️  Production'da önerilen değişkenler eksik (performans/güvenlik etkilenir):\n" +
        recommended.map(c => `  ⚠️  ${c.key} — ${c.description}`).join("\n")
      );
    }

    const secret = process.env.SESSION_SECRET || "";
    if (secret === "notebeat-kids-secret-2024") {
      console.warn("⚠️  SESSION_SECRET varsayılan değer kullanıyor! Production'da güçlü bir anahtar belirleyin.");
    }
  } else {
    // --- Development/Replit: sadece uyar, kapanma yok ---
    const allChecks = [...PRODUCTION_REQUIRED, ...PRODUCTION_RECOMMENDED];
    const missing = allChecks.filter(c => !process.env[c.key]);
    if (missing.length) {
      console.warn(
        "⚠️  [DEV] Bazı ortam değişkenleri eksik (uygulama fallback ile çalışacak):\n" +
        missing.map(c => `  ⚠️  ${c.key} — ${c.description}`).join("\n")
      );
    }
    if (!process.env.DATABASE_URL) {
      console.warn("⚠️  [DEV] DATABASE_URL eksik — DB işlemleri başarısız olabilir.");
    }
    if (!process.env.REDIS_URL) {
      console.info("ℹ️  [DEV] REDIS_URL yok — in-memory önbellek ve socket fallback kullanılıyor.");
    }
  }
}

/** Belirli bir env değişkeninin değerini veya varsayılanı döndürür */
export function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}
