import { useLocation } from "wouter";
import { motion } from "framer-motion";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

// All note value symbols — size matches the tagline text (~18px)
const NOTE_SYMBOLS = [
  { symbol: "𝅜",  color: "rgba(255,255,255,0.09)" },
  { symbol: "𝅗𝅥", color: "rgba(255,220,100,0.10)" },
  { symbol: "♩",  color: "rgba(255,255,255,0.10)" },
  { symbol: "♪",  color: "rgba(255,200,255,0.09)" },
  { symbol: "♫",  color: "rgba(200,255,255,0.08)" },
  { symbol: "♬",  color: "rgba(255,255,180,0.09)" },
  { symbol: "𝄽",  color: "rgba(255,180,200,0.08)" },
  { symbol: "𝄾",  color: "rgba(180,200,255,0.09)" },
  { symbol: "𝄿",  color: "rgba(255,255,255,0.07)" },
  { symbol: "𝄻",  color: "rgba(255,220,120,0.08)" },
  { symbol: "𝄼",  color: "rgba(200,255,200,0.08)" },
  { symbol: "♭",  color: "rgba(255,200,255,0.09)" },
  { symbol: "♯",  color: "rgba(255,255,200,0.09)" },
  { symbol: "♮",  color: "rgba(200,230,255,0.08)" },
];

// 30 notes spread across 10 columns, alternating up/down direction
const FLOATING_NOTES = Array.from({ length: 30 }, (_, i) => {
  const noteData = NOTE_SYMBOLS[i % NOTE_SYMBOLS.length];
  const col = i % 10;
  const leftPercent = col * 10 + 2 + (i % 3) * 2; // slight jitter per column
  const goingDown = i % 2 === 0;
  // Very slow: 40–65 seconds per pass
  const duration = 40 + (i % 10) * 2.5;
  // Stagger start so screen is always populated
  const delay = -(((i * 2.3) % duration));

  return {
    id: i,
    ...noteData,
    left: `${Math.max(1, Math.min(97, leftPercent))}%`,
    goingDown,
    duration,
    delay,
    rotate: -10 + (i % 5) * 5, // subtle tilt
  };
});

export default function Home() {
  const [, navigate] = useLocation();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 30%, #f093fb 60%, #f5576c 100%)",
      }}
    >
      {/* Fa (bass) clef — top left */}
      <motion.span
        className="absolute font-bold select-none pointer-events-none z-0"
        style={{ left: "12px", top: "8px", fontSize: "96px", lineHeight: 1, color: "rgba(255,255,255,0.20)" }}
        animate={{ y: [0, -8, 0], opacity: [0.18, 0.30, 0.18] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        𝄢
      </motion.span>

      {/* ─── Falling / Rising Note Symbols ─── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {FLOATING_NOTES.map((n) => (
          <motion.span
            key={n.id}
            className="absolute font-bold leading-none"
            style={{
              left: n.left,
              /* match tagline font size: text-lg ≈ 18px */
              fontSize: "18px",
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
        {/* Logo — click secretly opens admin login */}
        <motion.div
          className="flex flex-col items-center gap-3"
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img
            src={logoPath}
            alt="NoteBeat Kids"
            className="w-52 h-52 object-contain drop-shadow-2xl cursor-pointer"
            onClick={() => navigate("/admin/login")}
            data-testid="img-logo"
          />
          {/* Bilingual tagline */}
          <div className="text-center space-y-0.5">
            <p className="text-white font-extrabold text-lg drop-shadow tracking-wide">
              Learn Music Through Play!
            </p>
            <p className="text-white/75 font-bold text-sm drop-shadow">
              Müzik Öğrenmenin En Eğlenceli Yolu!
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
              <p className="text-lg font-extrabold">Teacher Login</p>
              <p className="text-xs font-bold text-white/80">Öğretmen Girişi</p>
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
              <p className="text-lg font-extrabold">Student Login</p>
              <p className="text-xs font-bold text-white/80">Öğrenci Girişi</p>
            </div>
          </motion.button>
        </div>

      </motion.div>
    </div>
  );
}
