/**
 * CİHAZ PARMAK İZİ
 * SubtleCrypto API ile SHA-256 hash — düz metin saklanmaz.
 */

export function getDeviceType(): "desktop" | "mobile" {
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop";
}

export async function getDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    getDeviceType(),
  ].join("||");

  const encoder = new TextEncoder();
  const data = encoder.encode(components);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
