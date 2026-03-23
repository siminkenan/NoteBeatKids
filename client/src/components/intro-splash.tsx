import { useEffect, useState, useRef } from "react";
import logoPath from "@assets/ChatGPT_Image_15_Mar_2026_17_32_30_1773585221618.png";

type Phase = "in" | "hold" | "out";

export default function IntroSplash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>("in");
  const called = useRef(false);

  function finish() {
    if (called.current) return;
    called.current = true;
    setPhase("out");
    setTimeout(onDone, 500);
  }

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setPhase("hold"), 50));
    timers.push(setTimeout(() => setPhase("out"), 5500));
    timers.push(setTimeout(() => {
      if (!called.current) { called.current = true; onDone(); }
    }, 6200));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      onClick={finish}
      className={`intro-splash fixed inset-0 z-[9999] overflow-hidden cursor-pointer ${phase === "out" ? "intro-fadeout" : ""}`}
      style={{
        background: "linear-gradient(135deg, #fde68a 0%, #fca5a5 30%, #c4b5fd 65%, #86efac 100%)",
      }}
    >
      {/* Floating background decorations */}
      <div className="intro-stars-bg pointer-events-none select-none" aria-hidden>
        {["⭐","🌟","✨","🎶","🎵","⭐","🌟","✨"].map((s, i) => (
          <span key={i} className={`intro-star intro-star-${i}`}>{s}</span>
        ))}
      </div>

      {/* Centered logo container */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">

        {/* Orbit + Logo wrapper */}
        <div
          className="relative flex items-center justify-center"
          style={{
            width: "min(70vmin, 520px)",
            height: "min(70vmin, 520px)",
            opacity: phase === "in" ? 0 : 1,
            transform: phase === "in" ? "scale(0.5)" : "scale(1)",
            transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Orbiting icons */}
          {["🎵","⭐","🎶","🌟","🎵","✨"].map((icon, i) => {
            const dur = 3.5 + i * 0.4;
            const delay = -((i / 6) * dur);
            return (
              <span
                key={i}
                className="absolute text-3xl select-none pointer-events-none"
                style={{
                  animation: `intro-orbit ${dur}s ${delay}s linear infinite`,
                  top: "50%",
                  left: "50%",
                  marginTop: "-1.1rem",
                  marginLeft: "-1.1rem",
                }}
              >
                {icon}
              </span>
            );
          })}

          {/* Logo image — fills the container */}
          <img
            src={logoPath}
            alt="NoteBeat Kids"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              userSelect: "none",
              WebkitUserSelect: "none",
              animation: phase !== "in"
                ? "intro-logo-pulse 2s ease-in-out infinite, intro-logo-float 3.8s ease-in-out infinite"
                : "none",
            }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>

        {/* Subtitle */}
        <p
          className="text-white font-extrabold uppercase drop-shadow-lg select-none"
          style={{
            fontSize: "clamp(0.9rem, 3vw, 1.2rem)",
            textShadow: "0 2px 12px rgba(0,0,0,0.35)",
            letterSpacing: "0.12em",
            opacity: phase === "in" ? 0 : 1,
            transition: "opacity 0.9s ease 0.3s",
            animation: phase === "hold"
              ? "intro-text-shimmer 3s ease-in-out infinite"
              : "none",
          }}
        >
          Müzikle Öğren, Eğlenerek Büyü! 🎼
        </p>

        {/* Tap hint */}
        <p
          className="text-white/60 text-sm select-none"
          style={{
            opacity: phase === "hold" ? 1 : 0,
            transition: "opacity 1s ease 0.8s",
            letterSpacing: "0.05em",
          }}
        >
          🎵 Dokunarak geçebilirsiniz
        </p>
      </div>
    </div>
  );
}
