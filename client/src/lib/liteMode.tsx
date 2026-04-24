/**
 * LİTE MODE CONTEXT
 * ──────────────────────────────────────────────────────────────────────────────
 * Zayıf cihazlarda animasyonları ve ağır işlemleri otomatik devre dışı bırakır.
 *
 * Ne yapar:
 *   - Lite Mode tespit edilirse <html> etiketine "lite-mode" sınıfı ekler
 *   - framer-motion için reducedMotion="always" ayarlar (tüm animasyonlar 0ms)
 *   - useLiteMode() hook'u ile bileşenler Lite Mode'u okuyabilir
 *
 * Ne YAPMAZ:
 *   - UI tasarımını değiştirmez
 *   - Layout veya renk değiştirmez
 *   - Herhangi bir özelliği kaldırmaz
 */

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { detectDevice, getLiteModeOverride } from "./deviceDetect";

const LiteModeContext = createContext<boolean>(false);

export function LiteModeProvider({ children }: { children: React.ReactNode }) {
  const [isLite] = useState<boolean>(() => {
    const override = getLiteModeOverride();
    if (override !== null) return override;
    return detectDevice() === "lite";
  });

  useEffect(() => {
    if (isLite) {
      document.documentElement.classList.add("lite-mode");
    } else {
      document.documentElement.classList.remove("lite-mode");
    }
  }, [isLite]);

  return (
    <LiteModeContext.Provider value={isLite}>
      {/* framer-motion animasyonlarını Lite Mode'da tamamen kapat */}
      <MotionConfig reducedMotion={isLite ? "always" : "user"}>
        {children}
      </MotionConfig>
    </LiteModeContext.Provider>
  );
}

/** Bileşenin Lite Mode'da olup olmadığını döndürür */
export function useLiteMode(): boolean {
  return useContext(LiteModeContext);
}
