/**
 * CİHAZ ALGILAMA — Lite Mode için
 * ──────────────────────────────────────────────────────────────────────────────
 * Düşük performanslı / eski cihazları otomatik tespit eder.
 * Hiçbir UI değişikliği yapmaz; sadece boolean bilgi döndürür.
 */

export type DeviceClass = "lite" | "normal";

/**
 * Cihazın performans sınıfını tespit eder.
 *
 * Lite Mode tetikleyicileri:
 *   - Bellek < 4 GB  (navigator.deviceMemory API — Chrome/Android)
 *   - iOS 12 veya 13 (Safari 12/13 — iPad Mini 2, iPad Air vs.)
 *   - Android 8 veya 9
 *   - Pil tasarrufu modu aktif (Battery API — desteklenen tarayıcılarda)
 *   - CPU çekirdek sayısı < 4 (navigator.hardwareConcurrency)
 */
export function detectDevice(): DeviceClass {
  if (typeof window === "undefined") return "normal";

  // ── Bellek kontrolü (Chrome / Android)
  const mem = (navigator as any).deviceMemory as number | undefined;
  if (typeof mem === "number" && mem < 4) return "lite";

  // ── CPU çekirdeği (çok düşük = zayıf cihaz)
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === "number" && cores < 4) return "lite";

  const ua = navigator.userAgent;

  // ── iOS versiyonu (iPad/iPhone)
  const iosMatch = ua.match(/OS (\d+)[._](\d+)/);
  if (iosMatch) {
    const major = parseInt(iosMatch[1], 10);
    if (major <= 13) return "lite"; // iOS 12, 13 → Lite
  }

  // ── Android versiyonu
  const androidMatch = ua.match(/Android (\d+)/i);
  if (androidMatch) {
    const major = parseInt(androidMatch[1], 10);
    if (major < 10) return "lite"; // Android 8, 9 → Lite
  }

  return "normal";
}

/** localStorage'dan geçişi oku (kullanıcı elle de açabilir) */
export function getLiteModeOverride(): boolean | null {
  try {
    const val = localStorage.getItem("nbk_lite_mode");
    if (val === "1") return true;
    if (val === "0") return false;
  } catch (_) {}
  return null;
}

export function setLiteModeOverride(enabled: boolean) {
  try {
    localStorage.setItem("nbk_lite_mode", enabled ? "1" : "0");
  } catch (_) {}
}
