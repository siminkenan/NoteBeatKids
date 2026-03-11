import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import drumImg from "@assets/drum-Photoroom_1773262756209.png";

/* ─────────────────────────────────────────────
   Web Audio API — synthesised drum sounds
───────────────────────────────────────────── */
let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}
function noise(c: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; return src;
}
function playKick() {
  const c = ctx(); const osc = c.createOscillator(); const g = c.createGain();
  osc.connect(g); g.connect(c.destination);
  osc.frequency.setValueAtTime(160, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.15);
  g.gain.setValueAtTime(1.8, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.55);
  osc.start(); osc.stop(c.currentTime + 0.55);
}
function playSnare() {
  const c = ctx();
  const n = noise(c, 0.25); const ng = c.createGain(); const bf = c.createBiquadFilter();
  bf.type = "highpass"; bf.frequency.value = 1500;
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(1, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
  const osc = c.createOscillator(); const og = c.createGain();
  osc.frequency.value = 180; osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(0.7, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  osc.start(); osc.stop(c.currentTime + 0.25); n.start(); n.stop(c.currentTime + 0.25);
}
function playHihat() {
  const c = ctx(); const n = noise(c, 0.1); const bf = c.createBiquadFilter();
  bf.type = "bandpass"; bf.frequency.value = 9000; bf.Q.value = 0.5;
  const ng = c.createGain();
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(0.8, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
  n.start(); n.stop(c.currentTime + 0.1);
}
function playCrash() {
  const c = ctx(); const n = noise(c, 1.5); const bf = c.createBiquadFilter();
  bf.type = "bandpass"; bf.frequency.value = 5000; bf.Q.value = 0.3;
  const ng = c.createGain();
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(1.2, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5);
  n.start(); n.stop(c.currentTime + 1.5);
}
function playRide() {
  const c = ctx(); const osc = c.createOscillator(); const og = c.createGain();
  osc.type = "triangle"; osc.frequency.value = 750;
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(0.6, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
  osc.start(); osc.stop(c.currentTime + 0.8);
}
function playTom(freq: number) {
  const c = ctx(); const osc = c.createOscillator(); const og = c.createGain();
  osc.frequency.setValueAtTime(freq, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, c.currentTime + 0.3);
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(1.0, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
  osc.start(); osc.stop(c.currentTime + 0.35);
}

/* ─────────────────────────────────────────────
   Drum definitions — positions are % of the
   image container (top-left origin)
───────────────────────────────────────────── */
type DrumId = "kick" | "snare" | "hihat" | "crash" | "ride" | "tom1" | "tom2" | "floortom";

interface DrumZone {
  id: DrumId;
  label: string;
  key: string;
  play: () => void;
  color: string;
  // Position & size as % of image container
  left: number; top: number; width: number; height: number;
  // Label badge position offset (relative to zone top-left)
  labelX?: number; labelY?: number;
}

const ZONES: DrumZone[] = [
  {
    id: "crash", label: "Crash", key: "A", play: playCrash, color: "#fbbf24",
    left: 7, top: 6, width: 25, height: 13,
    labelX: 50, labelY: -20,
  },
  {
    id: "hihat", label: "Hi-Hat", key: "S", play: playHihat, color: "#fbbf24",
    left: 7, top: 28, width: 15, height: 8,
    labelX: 50, labelY: -20,
  },
  {
    id: "tom1", label: "Tom 1", key: "H", play: () => playTom(320), color: "#60a5fa",
    left: 23, top: 23, width: 17, height: 13,
    labelX: 50, labelY: -20,
  },
  {
    id: "snare", label: "Snare", key: "D", play: playSnare, color: "#f87171",
    left: 2, top: 40, width: 18, height: 13,
    labelX: 50, labelY: -20,
  },
  {
    id: "tom2", label: "Tom 2", key: "J", play: () => playTom(240), color: "#fb923c",
    left: 53, top: 21, width: 17, height: 13,
    labelX: 50, labelY: -20,
  },
  {
    id: "ride", label: "Ride", key: "G", play: playRide, color: "#fbbf24",
    left: 67, top: 6, width: 25, height: 13,
    labelX: 50, labelY: -20,
  },
  {
    id: "floortom", label: "Floor Tom", key: "K", play: () => playTom(140), color: "#d4af37",
    left: 67, top: 41, width: 20, height: 15,
    labelX: 50, labelY: -20,
  },
  {
    id: "kick", label: "Kick", key: "F", play: playKick, color: "#f97316",
    left: 26, top: 43, width: 44, height: 33,
    labelX: 50, labelY: 105,
  },
];

const KEY_MAP: Record<string, DrumId> = Object.fromEntries(ZONES.map(z => [z.key, z.id]));

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function DrumKit() {
  const [, navigate] = useLocation();
  const [hits, setHits] = useState<Set<DrumId>>(new Set());
  const [lastHit, setLastHit] = useState<{ id: DrumId; ts: number } | null>(null);
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const hit = useCallback((id: DrumId) => {
    const zone = ZONES.find(z => z.id === id)!;
    zone.play();
    setHits(prev => new Set(prev).add(id));
    setLastHit({ id, ts: Date.now() });
    clearTimeout(clearTimers.current[id]);
    clearTimers.current[id] = setTimeout(() => {
      setHits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 200);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const id = KEY_MAP[e.key.toUpperCase()];
      if (id) hit(id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hit]);

  const lastZone = lastHit ? ZONES.find(z => z.id === lastHit.id) : null;

  return (
    <div className="min-h-screen flex flex-col select-none"
      style={{ background: "linear-gradient(160deg, #1a0a2e 0%, #0d1a3a 60%, #0a1020 100%)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
        <Button variant="ghost" size="sm"
          onClick={() => navigate("/student/home")}
          className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
          data-testid="btn-back">
          <ArrowLeft className="w-4 h-4" /> Geri
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="font-extrabold text-lg text-white">🥁 Online Davul Seti</h1>
        </div>
        {/* Last hit badge */}
        <div className="w-24 text-right">
          <AnimatePresence mode="wait">
            {lastZone && (
              <motion.span key={lastHit?.ts}
                initial={{ opacity: 0, y: -8, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                className="inline-block px-3 py-1 rounded-full text-xs font-extrabold text-black"
                style={{ background: lastZone.color }}>
                {lastZone.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main — drum kit image with hotspots */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 py-2 gap-2 min-h-0">

        {/* Image container */}
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
          <div className="relative"
            style={{ maxHeight: "calc(100vh - 140px)", aspectRatio: "1 / 1", maxWidth: "min(calc(100vh - 140px), 100%)" }}>

            {/* Drum image */}
            <img src={drumImg} alt="Davul Seti"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false} />

            {/* Hotspot zones */}
            {ZONES.map(zone => {
              const active = hits.has(zone.id);
              return (
                <div key={zone.id}
                  style={{
                    position: "absolute",
                    left: `${zone.left}%`,
                    top: `${zone.top}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                    borderRadius: "50%",
                    cursor: "pointer",
                    transition: "all 0.1s",
                    background: active
                      ? `radial-gradient(ellipse, ${zone.color}55 0%, ${zone.color}22 60%, transparent 100%)`
                      : "transparent",
                    boxShadow: active
                      ? `0 0 24px 8px ${zone.color}88, inset 0 0 12px 4px ${zone.color}44`
                      : "none",
                    border: active ? `2px solid ${zone.color}cc` : "2px solid transparent",
                    zIndex: 10,
                  }}
                  onPointerDown={e => { e.preventDefault(); hit(zone.id); }}
                >
                  {/* Key badge — always visible */}
                  <div style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                  }}>
                    <div style={{
                      background: active ? zone.color : "rgba(0,0,0,0.65)",
                      color: active ? "#000" : "rgba(255,255,255,0.9)",
                      border: `1.5px solid ${active ? zone.color : "rgba(255,255,255,0.3)"}`,
                      borderRadius: "8px",
                      padding: "2px 7px",
                      fontSize: "11px",
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                      textAlign: "center",
                      backdropFilter: "blur(4px)",
                      transition: "all 0.1s",
                      boxShadow: active ? `0 0 10px ${zone.color}` : "none",
                    }}>
                      <div>{zone.label}</div>
                      <div style={{ fontSize: "9px", opacity: 0.7 }}>[{zone.key}]</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Keyboard shortcuts strip */}
        <div className="flex gap-1.5 flex-wrap justify-center pb-1 flex-shrink-0">
          {ZONES.map(z => (
            <button key={z.id}
              className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all border"
              style={{
                background: hits.has(z.id) ? z.color + "33" : "rgba(255,255,255,0.07)",
                borderColor: hits.has(z.id) ? z.color : "rgba(255,255,255,0.15)",
                cursor: "pointer",
              }}
              onPointerDown={e => { e.preventDefault(); hit(z.id); }}
            >
              <kbd className="w-5 h-5 rounded text-[10px] font-black text-black flex items-center justify-center flex-shrink-0"
                style={{ background: z.color }}>{z.key}</kbd>
              <span className="text-[10px] text-white/70 font-semibold">{z.label}</span>
            </button>
          ))}
        </div>

      </main>
    </div>
  );
}
