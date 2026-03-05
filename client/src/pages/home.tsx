import { useLocation } from "wouter";
import { motion } from "framer-motion";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

// All note value symbols with labels
const NOTE_SYMBOLS = [
  { symbol: "𝅜", name: "Tam / Whole", size: 44, color: "rgba(255,255,255,0.18)" },
  { symbol: "𝅗𝅥", name: "İki Dörtlük / Half", size: 38, color: "rgba(255,220,100,0.20)" },
  { symbol: "♩", name: "Dörtlük / Quarter", size: 36, color: "rgba(255,255,255,0.22)" },
  { symbol: "♪", name: "Sekizlik / Eighth", size: 34, color: "rgba(255,200,255,0.20)" },
  { symbol: "♫", name: "Sekizlik çift / Beamed 8th", size: 36, color: "rgba(200,255,255,0.18)" },
  { symbol: "♬", name: "Onaltılık / Sixteenth", size: 32, color: "rgba(255,255,180,0.20)" },
  { symbol: "𝄽", name: "Dörtlük sus / Quarter Rest", size: 36, color: "rgba(255,180,200,0.18)" },
  { symbol: "𝄾", name: "Sekizlik sus / Eighth Rest", size: 30, color: "rgba(180,200,255,0.20)" },
  { symbol: "𝄿", name: "Onaltılık sus / 16th Rest", size: 28, color: "rgba(255,255,255,0.15)" },
  { symbol: "𝄻", name: "Tam sus / Whole Rest", size: 32, color: "rgba(255,220,120,0.18)" },
  { symbol: "𝄼", name: "Yarım sus / Half Rest", size: 32, color: "rgba(200,255,200,0.18)" },
  { symbol: "♭", name: "Bemol / Flat", size: 40, color: "rgba(255,200,255,0.20)" },
  { symbol: "♯", name: "Diyez / Sharp", size: 34, color: "rgba(255,255,200,0.20)" },
  { symbol: "♮", name: "Natürel / Natural", size: 32, color: "rgba(200,230,255,0.18)" },
];

// Generate a large set of falling/rising notes spread across the screen
const FLOATING_NOTES = Array.from({ length: 36 }, (_, i) => {
  const noteData = NOTE_SYMBOLS[i % NOTE_SYMBOLS.length];
  const column = i % 12; // 12 columns
  const leftPercent = (column / 12) * 100 + (Math.random() * 6 - 3);
  const goingDown = i % 2 === 0; // alternating direction
  const duration = 7 + (i % 7) * 1.5;
  const delay = -(i * 0.9) % duration; // stagger start

  return {
    id: i,
    ...noteData,
    left: `${Math.max(1, Math.min(96, leftPercent))}%`,
    goingDown,
    duration,
    delay,
    rotate: -15 + (i % 7) * 5,
    scale: 0.7 + (i % 4) * 0.15,
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
      {/* ─── Falling / Rising Note Symbols ─── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {FLOATING_NOTES.map((n) => (
          <motion.span
            key={n.id}
            className="absolute font-bold leading-none"
            style={{
              left: n.left,
              fontSize: n.size * n.scale,
              color: n.color,
              rotate: n.rotate,
              // start position: top of screen (going down) or bottom (going up)
              top: n.goingDown ? "-60px" : "unset",
              bottom: n.goingDown ? "unset" : "-60px",
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
              width: `${80 + i * 50}px`,
              height: `${80 + i * 50}px`,
              background: i % 2 === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,215,0,0.07)",
              left: `${(i * 17) % 85}%`,
              top: `${(i * 23) % 75}%`,
            }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.7 }}
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
            className="w-52 h-52 object-contain drop-shadow-2xl"
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

        {/* Admin link */}
        <motion.button
          data-testid="link-admin"
          className="text-white/55 text-xs font-bold underline cursor-pointer"
          onClick={() => navigate("/admin/login")}
          whileHover={{ color: "rgba(255,255,255,0.9)" }}
        >
          Admin Access · Yönetici Girişi
        </motion.button>
      </motion.div>

      {/* ─── Note legend strip at the bottom ─── */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-5 z-10 pointer-events-none select-none">
        {[
          { sym: "𝅜", tr: "Tam", en: "Whole" },
          { sym: "𝅗𝅥", tr: "Yarım", en: "Half" },
          { sym: "♩", tr: "Dörtlük", en: "Quarter" },
          { sym: "♪", tr: "Sekizlik", en: "Eighth" },
          { sym: "♬", tr: "Onaltılık", en: "16th" },
        ].map((n) => (
          <div key={n.sym} className="flex flex-col items-center gap-0.5">
            <span className="text-white/50 text-2xl font-bold">{n.sym}</span>
            <span className="text-white/40 text-[9px] font-bold leading-tight text-center">
              {n.en}<br />{n.tr}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
