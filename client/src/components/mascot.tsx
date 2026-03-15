import { useEffect, useRef, useState } from "react";
import mascotPath from "@/assets/mascot.png";

type MascotReaction = "idle" | "bounce" | "tilt" | "note" | "pulse" | "point";

const IDLE_ANIMATIONS: MascotReaction[] = ["bounce", "tilt", "note"];

let _setReaction: ((r: MascotReaction) => void) | null = null;

export function triggerMascotReaction(reaction: MascotReaction) {
  _setReaction?.(reaction);
}

export default function Mascot() {
  const [reaction, setReaction] = useState<MascotReaction>("idle");
  const [showNote, setShowNote] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  _setReaction = (r) => {
    setReaction(r);
    if (r === "note") setShowNote(true);
    if (r === "pulse") setShowPulse(true);
    clearTimeout(reactionTimer.current!);
    reactionTimer.current = setTimeout(() => {
      setReaction("idle");
      setShowNote(false);
      setShowPulse(false);
    }, 1400);
  };

  useEffect(() => {
    const handleEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail as MascotReaction;
      triggerMascotReaction(detail);
    };
    window.addEventListener("mascot-react", handleEvent);

    idleTimer.current = setInterval(() => {
      if (reaction === "idle") {
        const pick = IDLE_ANIMATIONS[Math.floor(Math.random() * IDLE_ANIMATIONS.length)];
        triggerMascotReaction(pick);
      }
    }, 3000);

    return () => {
      window.removeEventListener("mascot-react", handleEvent);
      clearInterval(idleTimer.current!);
      clearTimeout(reactionTimer.current!);
      _setReaction = null;
    };
  }, [reaction]);

  const animClass =
    reaction === "bounce" ? "mascot-bounce" :
    reaction === "tilt"   ? "mascot-tilt"   :
    reaction === "point"  ? "mascot-point"  :
    reaction === "pulse"  ? "mascot-pulse-anim" : "";

  return (
    <div className="mascot-wrapper" aria-hidden>
      {/* Floating music notes */}
      {showNote && (
        <>
          <span className="mascot-floating-note mascot-note-1">♪</span>
          <span className="mascot-floating-note mascot-note-2">🎵</span>
          <span className="mascot-floating-note mascot-note-3">♫</span>
        </>
      )}

      {/* Pulse circles */}
      {showPulse && (
        <>
          <span className="mascot-pulse-ring mascot-pulse-ring-1" />
          <span className="mascot-pulse-ring mascot-pulse-ring-2" />
        </>
      )}

      {/* Mascot image */}
      <img
        src={mascotPath}
        alt="Maestro"
        className={`mascot-img ${animClass}`}
        draggable={false}
      />
    </div>
  );
}
