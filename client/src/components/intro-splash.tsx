import { useEffect, useState, useRef } from "react";
import logoPath from "@assets/ChatGPT_Image_15_Mar_2026_17_32_30_1773585221618.png";

const MELODY = [
  { symbol: "♩", label: "Do", freq: 523.25, color: "#f97316", bg: "#fff7ed", delay: 0 },
  { symbol: "♪", label: "Mi", freq: 659.25, color: "#8b5cf6", bg: "#f5f3ff", delay: 550 },
  { symbol: "♫", label: "Re", freq: 587.33, color: "#06b6d4", bg: "#ecfeff", delay: 1100 },
  { symbol: "♬", label: "Do", freq: 523.25, color: "#ec4899", bg: "#fdf2f8", delay: 1650 },
];

function playXylophone(freq: number) {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtxClass();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 0.01);
    master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.1);

    [[freq, 0.6], [freq * 2, 0.25], [freq * 3, 0.1]].forEach(([f, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(master);
      osc.type = "triangle";
      osc.frequency.value = f as number;
      g.gain.value = amp as number;
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.1);
    });

    setTimeout(() => ctx.close(), 1300);
  } catch {
    // Audio not supported — silent fail
  }
}

type Phase = "entering" | "logo" | "fadeout" | "done";

export default function IntroSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("entering");
  const [visibleNotes, setVisibleNotes] = useState<Set<number>>(new Set());
  const [notesOut, setNotesOut] = useState(false);
  const [logoIn, setLogoIn] = useState(false);
  const called = useRef(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    MELODY.forEach((note, i) => {
      timers.push(setTimeout(() => {
        setVisibleNotes(prev => new Set([...prev, i]));
        playXylophone(note.freq);
      }, note.delay));
    });

    // Notes fade out
    timers.push(setTimeout(() => setNotesOut(true), 2300));
    // Logo fades in
    timers.push(setTimeout(() => { setPhase("logo"); setLogoIn(true); }, 2500));
    // Fade out the whole splash
    timers.push(setTimeout(() => setPhase("fadeout"), 3600));
    // Signal done
    timers.push(setTimeout(() => {
      if (!called.current) { called.current = true; onDone(); }
    }, 4100));

    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      className={`intro-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden ${phase === "fadeout" ? "intro-fadeout" : ""}`}
      style={{
        background: "linear-gradient(135deg, #fde68a 0%, #fca5a5 30%, #c4b5fd 65%, #86efac 100%)",
      }}
    >
      {/* Floating star decorations */}
      <div className="intro-stars-bg pointer-events-none select-none" aria-hidden>
        {["⭐","🌟","✨","🎶","🎵","⭐","🌟","✨"].map((s, i) => (
          <span key={i} className={`intro-star intro-star-${i}`}>{s}</span>
        ))}
      </div>

      {/* Notes */}
      <div
        className={`flex gap-8 sm:gap-12 items-end justify-center transition-all duration-400 ${notesOut ? "opacity-0 scale-75 pointer-events-none" : "opacity-100"}`}
        style={{ transitionDuration: "350ms" }}
      >
        {MELODY.map((note, i) => (
          <div
            key={i}
            className={`intro-note flex flex-col items-center gap-1 ${visibleNotes.has(i) ? "intro-note-pop" : "intro-note-hidden"}`}
            style={{ "--note-color": note.color, "--note-bg": note.bg } as React.CSSProperties}
          >
            <div className="intro-note-circle">
              <span className="intro-note-symbol">{note.symbol}</span>
            </div>
            <span className="intro-note-label">{note.label}</span>
          </div>
        ))}
      </div>

      {/* Logo */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all"
        style={{
          opacity: logoIn ? 1 : 0,
          transform: logoIn ? "scale(1)" : "scale(0.6)",
          transitionDuration: "500ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <img
          src={logoPath}
          alt="NoteBeat Kids"
          className="w-56 h-56 sm:w-72 sm:h-72 object-contain drop-shadow-2xl intro-logo-glow"
          draggable={false}
        />
        <p className="text-white text-sm sm:text-base font-extrabold tracking-widest uppercase drop-shadow-lg" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
          Müzikle Öğren, Eğlenerek Büyü!
        </p>
      </div>
    </div>
  );
}
