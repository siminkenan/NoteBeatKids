import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

// ── Language detection ──────────────────────────────────────────────────────
const deviceLang = navigator.language?.toLowerCase() ?? "tr";
const isTurkish = deviceLang.startsWith("tr");

const T = {
  tagline1: isTurkish
    ? "Müzikle Öğren, Eğlenerek Büyü!"
    : "Learn Music Through Play!",
  tagline2: isTurkish
    ? "Learn Music Through Play!"
    : "Müzikle Öğren, Eğlenerek Büyü!",
  teacherLabel: isTurkish ? "Öğretmen Girişi" : "Teacher Login",
  teacherSub: isTurkish ? "Teacher Login" : "Öğretmen Girişi",
  studentLabel: isTurkish ? "Öğrenci Girişi" : "Student Login",
  studentSub: isTurkish ? "Student Login" : "Öğrenci Girişi",
  installTitle: isTurkish ? "Ana Ekrana Ekle" : "Add to Home Screen",
  installBody: isTurkish
    ? "Uygulamayı ana ekranına ekleyerek kolayca açabilirsin."
    : "Add the app to your home screen for easy access.",
  iosStep1: isTurkish
    ? "1. Alttaki 📤 Paylaş butonuna dokun"
    : "1. Tap the 📤 Share button below",
  iosStep2: isTurkish
    ? "2. \"Ana Ekrana Ekle\" seçeneğine dokun"
    : "2. Tap \"Add to Home Screen\"",
  iosStep3: isTurkish ? "3. \"Ekle\" butonuna dokun" : "3. Tap \"Add\"",
  installBtn: isTurkish ? "Kur" : "Install",
  closeBtn: isTurkish ? "Kapat" : "Close",
};

// ── Note symbols ────────────────────────────────────────────────────────────
const NOTE_SYMBOLS = [
  { symbol: "♩",  color: "rgba(255,255,255,0.22)" },
  { symbol: "♪",  color: "rgba(255,200,255,0.20)" },
  { symbol: "♫",  color: "rgba(200,255,255,0.20)" },
  { symbol: "♬",  color: "rgba(255,255,180,0.22)" },
  { symbol: "♭",  color: "rgba(255,200,255,0.20)" },
  { symbol: "♯",  color: "rgba(255,255,200,0.21)" },
  { symbol: "𝄽",  color: "rgba(255,180,200,0.20)" },
  { symbol: "𝄾",  color: "rgba(180,200,255,0.21)" },
  { symbol: "𝅗𝅥", color: "rgba(255,220,100,0.20)" },
  { symbol: "𝄻",  color: "rgba(255,220,120,0.21)" },
  { symbol: "♮",  color: "rgba(200,230,255,0.20)" },
  { symbol: "𝅜",  color: "rgba(255,255,255,0.21)" },
];

const FLOATING_NOTES = Array.from({ length: 12 }, (_, i) => {
  const noteData = NOTE_SYMBOLS[i % NOTE_SYMBOLS.length];
  const leftPercent = (i % 6) * 16 + 2 + (i % 3) * 3;
  const goingDown = i % 2 === 0;
  const duration = 38 + (i % 6) * 4;
  const delay = -(((i * 3.1) % duration));
  return {
    id: i,
    ...noteData,
    left: `${Math.max(1, Math.min(88, leftPercent))}%`,
    goingDown,
    duration,
    delay,
    rotate: -8 + (i % 5) * 4,
  };
});

// ── iOS detection ───────────────────────────────────────────────────────────
const isIOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isStandalone =
  ("standalone" in window.navigator && (window.navigator as any).standalone) ||
  window.matchMedia("(display-mode: standalone)").matches;

export default function Home() {
  const [, navigate] = useLocation();
  const [showInstallModal, setShowInstallModal] = useState(false);
  const deferredPromptRef = useRef<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (isStandalone) return; // already installed
    if (isIOS) {
      setCanInstall(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler as any);
    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  async function handleInstallClick() {
    if (isIOS) {
      setShowInstallModal(true);
      return;
    }
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      await deferredPromptRef.current.userChoice;
      deferredPromptRef.current = null;
      setCanInstall(false);
    } else {
      setShowInstallModal(true);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 60%, #f5576c 100%)",
      }}
    >
      {/* Fa (bass) clef — top left — admin giriş (gizli) */}
      <motion.span
        className="absolute font-bold select-none cursor-pointer z-10"
        style={{ left: "12px", top: "8px", fontSize: "96px", lineHeight: 1, color: "rgba(255,255,255,0.20)" }}
        animate={{ y: [0, -8, 0], opacity: [0.18, 0.30, 0.18] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        onClick={() => navigate("/admin/login")}
      >
        𝄢
      </motion.span>

      {/* Install button — top right */}
      {canInstall && !isStandalone && (
        <motion.button
          data-testid="button-install-pwa"
          className="absolute z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold cursor-pointer select-none"
          style={{
            right: "12px",
            top: "12px",
            background: "rgba(255,255,255,0.22)",
            color: "white",
            border: "1.5px solid rgba(255,255,255,0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.07, background: "rgba(255,255,255,0.32)" } as any}
          whileTap={{ scale: 0.95 }}
          onClick={handleInstallClick}
          title={T.installTitle}
        >
          <span style={{ fontSize: "16px" }}>📲</span>
          <span>{T.installBtn}</span>
        </motion.button>
      )}

      {/* ─── iOS / generic install modal ─── */}
      <AnimatePresence>
        {showInstallModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInstallModal(false)}
          >
            <motion.div
              className="w-full max-w-sm mb-8 mx-4 rounded-3xl p-6 text-center"
              style={{
                background: "linear-gradient(135deg, #764ba2, #f093fb)",
                color: "white",
              }}
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-4xl mb-3">📲</div>
              <h3 className="text-lg font-extrabold mb-2">{T.installTitle}</h3>
              <p className="text-sm text-white/80 mb-4">{T.installBody}</p>
              {isIOS && (
                <div className="bg-white/15 rounded-2xl p-4 text-left space-y-2 text-sm font-semibold mb-4">
                  <p>{T.iosStep1}</p>
                  <p>{T.iosStep2}</p>
                  <p>{T.iosStep3}</p>
                </div>
              )}
              <button
                className="w-full py-3 rounded-2xl font-extrabold text-base cursor-pointer"
                style={{ background: "rgba(255,255,255,0.25)", color: "white" }}
                onClick={() => setShowInstallModal(false)}
              >
                {T.closeBtn}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Falling / Rising Note Symbols ─── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {FLOATING_NOTES.map((n) => (
          <motion.span
            key={n.id}
            className="absolute font-bold leading-none"
            style={{
              left: n.left,
              fontSize: "96px",
              color: n.color,
              rotate: n.rotate,
              top:    n.goingDown ? "-30px" : "unset",
              bottom: n.goingDown ? "unset"  : "-30px",
            }}
            animate={
              n.goingDown
                ? { y: ["0vh", "110vh"] }
                : { y: ["0vh", "-110vh"] }
            }
            transition={{
              duration: n.duration,
              repeat: Infinity,
              ease: "linear",
              delay: n.delay,
            }}
          >
            {n.symbol}
          </motion.span>
        ))}
      </div>

      {/* ─── Subtle background bubbles ─── */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width:  `${80 + i * 50}px`,
              height: `${80 + i * 50}px`,
              background:
                i % 2 === 0
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,215,0,0.07)",
              left: `${(i * 17) % 85}%`,
              top:  `${(i * 23) % 75}%`,
            }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{
              duration: 5 + i,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.7,
            }}
          />
        ))}
      </div>

      {/* ─── Main card ─── */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-7 px-6 w-full max-w-sm"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center gap-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={logoPath}
            alt="NoteBeat Kids"
            className="w-72 h-72 object-contain drop-shadow-2xl"
            data-testid="img-logo"
          />
          {/* Bilingual tagline — primary = device language */}
          <div className="text-center space-y-0.5">
            <p className="text-white font-extrabold text-lg drop-shadow tracking-wide">
              {T.tagline1}
            </p>
            <p className="text-white/75 font-bold text-sm drop-shadow">
              {T.tagline2}
            </p>
          </div>
        </motion.div>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full">
          {/* Teacher Login */}
          <motion.button
            data-testid="button-teacher-login"
            className="w-full py-5 px-8 rounded-3xl shadow-2xl flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #667eea, #764ba2)",
              color: "white",
              border: "4px solid rgba(255,255,255,0.4)",
            }}
            whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/teacher/login")}
          >
            <span className="text-3xl">👩‍🏫</span>
            <div className="text-left leading-tight">
              <p className="text-lg font-extrabold">{T.teacherLabel}</p>
              <p className="text-xs font-bold text-white/80">{T.teacherSub}</p>
            </div>
          </motion.button>

          {/* Student Login */}
          <motion.button
            data-testid="button-student-login"
            className="w-full py-5 px-8 rounded-3xl shadow-2xl flex items-center justify-center gap-3 cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #f093fb, #f5576c)",
              color: "white",
              border: "4px solid rgba(255,255,255,0.4)",
            }}
            whileHover={{ scale: 1.04, boxShadow: "0 20px 40px rgba(0,0,0,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/login")}
          >
            <span className="text-3xl">🎵</span>
            <div className="text-left leading-tight">
              <p className="text-lg font-extrabold">{T.studentLabel}</p>
              <p className="text-xs font-bold text-white/80">{T.studentSub}</p>
            </div>
          </motion.button>
        </div>

      </motion.div>

      {/* Copyright */}
      <p className="fixed bottom-3 left-0 right-0 text-center text-[11px] font-medium text-white/40 pointer-events-none select-none">
        Bütün Hakları Kenan OVALI'ya aittir.
      </p>
    </div>
  );
}
