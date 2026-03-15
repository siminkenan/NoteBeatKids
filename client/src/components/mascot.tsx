import { useEffect, useRef, useState, useCallback } from "react";
import mascotPath from "@/assets/mascot.png";

type MascotReaction = "idle" | "bounce" | "tilt" | "note" | "pulse" | "point";
const IDLE_LIST: MascotReaction[] = ["bounce", "tilt", "note"];

const FIXED_POS_KEY = "mascot_pos";
const DRAG_POS_KEY  = "mascot_pos_student";
const DEFAULT_POS   = { x: 20, y: 24 };

function loadPos(key: string) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved) as { x: number; y: number };
  } catch {}
  return DEFAULT_POS;
}

interface MascotProps {
  draggable?: boolean;
}

export default function Mascot({ draggable = false }: MascotProps) {
  const [reaction, setReaction] = useState<MascotReaction>("idle");
  const [showNote, setShowNote] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const storageKey = draggable ? DRAG_POS_KEY : FIXED_POS_KEY;

  const [pos, setPos] = useState(() => draggable ? loadPos(storageKey) : DEFAULT_POS);
  const draggingRef = useRef(false);
  const wrapperRef  = useRef<HTMLDivElement>(null);

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
        if (cur === "idle") applyReaction(IDLE_LIST[Math.floor(Math.random() * IDLE_LIST.length)]);
        return cur;
      });
    }, 3000);
    return () => {
      window.removeEventListener("mascot-react", onEvent);
      clearInterval(idleInterval);
      clearTimeout(reactionTimer.current!);
    };
  }, []);

  function clamp(x: number, y: number) {
    const w = wrapperRef.current?.offsetWidth ?? 340;
    const h = wrapperRef.current?.offsetHeight ?? 340;
    return {
      x: Math.max(-w * 0.4, Math.min(window.innerWidth  - w * 0.6, x)),
      y: Math.max(-h * 0.4, Math.min(window.innerHeight - h * 0.6, y)),
    };
  }

  function savePos(p: { x: number; y: number }) {
    setPos(p);
    try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch {}
  }

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;
    e.preventDefault();
    draggingRef.current = true;
    const snap = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    let last = { x: pos.x, y: pos.y };

    const move = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      last = clamp(snap.px - (ev.clientX - snap.mx), snap.py - (ev.clientY - snap.my));
      setPos(last);
    };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", move);
      savePos(last);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up, { once: true });
  }, [draggable, pos]);

  // Touch drag
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!draggable) return;
    const t = e.touches[0];
    draggingRef.current = true;
    const snap = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y };
    let last = { x: pos.x, y: pos.y };

    const move = (ev: TouchEvent) => {
      if (!draggingRef.current) return;
      const tt = ev.touches[0];
      last = clamp(snap.px - (tt.clientX - snap.mx), snap.py - (tt.clientY - snap.my));
      setPos(last);
    };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener("touchmove", move);
      savePos(last);
    };
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up, { once: true });
  }, [draggable, pos]);

  const anim =
    reaction === "bounce" ? "mascot-bounce"     :
    reaction === "tilt"   ? "mascot-tilt"       :
    reaction === "point"  ? "mascot-point"      :
    reaction === "pulse"  ? "mascot-pulse-anim" : "";

  return (
    <div
      ref={wrapperRef}
      className="mascot-wrapper"
      style={{
        right: pos.x,
        bottom: pos.y,
        pointerEvents: draggable ? "auto" : "none",
        cursor: draggable ? "grab" : "default",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
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
