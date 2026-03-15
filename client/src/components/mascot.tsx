import { useEffect, useRef, useState } from "react";
import mascotPath from "@/assets/mascot.png";

type MascotReaction = "idle" | "bounce" | "tilt" | "note" | "pulse" | "point";
const IDLE_LIST: MascotReaction[] = ["bounce", "tilt", "note"];

const DEFAULT_POS = { x: 20, y: 24 };

function loadPos() {
  try {
    const saved = localStorage.getItem("mascot_pos");
    if (saved) return JSON.parse(saved) as { x: number; y: number };
  } catch {}
  return DEFAULT_POS;
}

export default function Mascot() {
  const [reaction, setReaction] = useState<MascotReaction>("idle");
  const [showNote, setShowNote] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fixed position loaded once from localStorage
  const pos = loadPos();

  function applyReaction(r: MascotReaction) {
    setReaction(r);
    setShowNote(r === "note");
    setShowPulse(r === "pulse");
    clearTimeout(reactionTimer.current!);
    reactionTimer.current = setTimeout(() => {
      setReaction("idle");
      setShowNote(false);
      setShowPulse(false);
    }, 1400);
  }

  useEffect(() => {
    const onEvent = (e: Event) => applyReaction((e as CustomEvent).detail);
    window.addEventListener("mascot-react", onEvent);

    const idleInterval = setInterval(() => {
      setReaction(cur => {
        if (cur === "idle") {
          applyReaction(IDLE_LIST[Math.floor(Math.random() * IDLE_LIST.length)]);
        }
        return cur;
      });
    }, 3000);

    return () => {
      window.removeEventListener("mascot-react", onEvent);
      clearInterval(idleInterval);
      clearTimeout(reactionTimer.current!);
    };
  }, []);

  const anim =
    reaction === "bounce" ? "mascot-bounce"     :
    reaction === "tilt"   ? "mascot-tilt"       :
    reaction === "point"  ? "mascot-point"      :
    reaction === "pulse"  ? "mascot-pulse-anim" : "";

  return (
    <div
      className="mascot-wrapper"
      style={{ right: pos.x, bottom: pos.y }}
      aria-hidden
    >
      {showNote && (
        <>
          <span className="mascot-floating-note mascot-note-1">♪</span>
          <span className="mascot-floating-note mascot-note-2">🎵</span>
          <span className="mascot-floating-note mascot-note-3">♫</span>
        </>
      )}
      {showPulse && (
        <>
          <span className="mascot-pulse-ring mascot-pulse-ring-1" />
          <span className="mascot-pulse-ring mascot-pulse-ring-2" />
        </>
      )}
      <img
        src={mascotPath}
        alt="Maestro"
        className={`mascot-img ${anim}`}
        draggable={false}
      />
    </div>
  );
}
