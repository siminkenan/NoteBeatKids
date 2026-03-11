import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

/* ─────────────────────────────────────────────
   Web Audio API — synthesised drum sounds
   (zero-latency, no file loading required)
───────────────────────────────────────────── */
let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

function noise(c: AudioContext, dur: number): AudioBufferSourceNode {
  const bufLen = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function playKick() {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain); gain.connect(c.destination);
  osc.frequency.setValueAtTime(160, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.15);
  gain.gain.setValueAtTime(1.5, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.5);
}

function playSnare() {
  const c = ctx();
  const n = noise(c, 0.25);
  const ng = c.createGain();
  const bf = c.createBiquadFilter();
  bf.type = "highpass"; bf.frequency.value = 1500;
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(1, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);

  const osc = c.createOscillator();
  const og = c.createGain();
  osc.frequency.value = 180;
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(0.7, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.25);
  n.start(c.currentTime); n.stop(c.currentTime + 0.25);
}

function playHihat(open = false) {
  const c = ctx();
  const n = noise(c, 0.3);
  const bf = c.createBiquadFilter();
  bf.type = "bandpass"; bf.frequency.value = 9000; bf.Q.value = 0.5;
  const ng = c.createGain();
  const dur = open ? 0.5 : 0.08;
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(0.8, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  n.start(c.currentTime); n.stop(c.currentTime + dur + 0.01);
}

function playCrash() {
  const c = ctx();
  const n = noise(c, 1.5);
  const bf = c.createBiquadFilter();
  bf.type = "bandpass"; bf.frequency.value = 5000; bf.Q.value = 0.3;
  const ng = c.createGain();
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(1.2, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.5);
  n.start(c.currentTime); n.stop(c.currentTime + 1.5);

  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = "triangle"; osc.frequency.value = 400;
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(0.3, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.0);
  osc.start(c.currentTime); osc.stop(c.currentTime + 1.0);
}

function playRide() {
  const c = ctx();
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = "triangle"; osc.frequency.value = 750;
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(0.6, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.8);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.8);

  const n = noise(c, 0.1);
  const bf = c.createBiquadFilter();
  bf.type = "highpass"; bf.frequency.value = 7000;
  const ng = c.createGain();
  n.connect(bf); bf.connect(ng); ng.connect(c.destination);
  ng.gain.setValueAtTime(0.4, c.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  n.start(c.currentTime); n.stop(c.currentTime + 0.1);
}

function playTom(freq: number) {
  const c = ctx();
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.frequency.setValueAtTime(freq, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.5, c.currentTime + 0.3);
  osc.connect(og); og.connect(c.destination);
  og.gain.setValueAtTime(1.0, c.currentTime);
  og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.35);
  osc.start(c.currentTime); osc.stop(c.currentTime + 0.35);
}

/* ─────────────────────────────────────────────
   Drum definitions
───────────────────────────────────────────── */
type DrumId = "kick" | "snare" | "hihat" | "crash" | "ride" | "tom1" | "tom2" | "floortom";

interface DrumDef {
  id: DrumId;
  label: string;
  key: string;
  play: () => void;
  color: string;
  rimColor: string;
}

const DRUMS: DrumDef[] = [
  { id: "kick",     label: "Kick",      key: "F", play: playKick,              color: "#1e3a5f", rimColor: "#2d5f8a" },
  { id: "snare",    label: "Snare",     key: "D", play: playSnare,             color: "#3b1a0a", rimColor: "#7c3a10" },
  { id: "hihat",    label: "Hi-Hat",    key: "S", play: () => playHihat(false), color: "#b8860b", rimColor: "#ffd700" },
  { id: "crash",    label: "Crash",     key: "A", play: playCrash,             color: "#8b6914", rimColor: "#d4af37" },
  { id: "ride",     label: "Ride",      key: "G", play: playRide,              color: "#7a6914", rimColor: "#c8a830" },
  { id: "tom1",     label: "Tom 1",     key: "H", play: () => playTom(320),    color: "#1a3a1a", rimColor: "#2d6b2d" },
  { id: "tom2",     label: "Tom 2",     key: "J", play: () => playTom(240),    color: "#1a1a3a", rimColor: "#2d2d7a" },
  { id: "floortom", label: "Floor Tom", key: "K", play: () => playTom(140),    color: "#3a1a2a", rimColor: "#6b2d4a" },
];

const KEY_MAP: Record<string, DrumId> = Object.fromEntries(DRUMS.map(d => [d.key, d.id]));

/* ─────────────────────────────────────────────
   SVG drum kit — top-down realistic layout
   viewBox: 0 0 620 520
───────────────────────────────────────────── */
interface DrumShape {
  id: DrumId;
  type: "circle" | "ellipse";
  cx: number; cy: number;
  rx: number; ry: number;
  isCymbal?: boolean;
}

const SHAPES: DrumShape[] = [
  { id: "crash",    type: "ellipse", cx: 110, cy: 105, rx: 68,  ry: 22, isCymbal: true },
  { id: "hihat",    type: "ellipse", cx: 118, cy: 235, rx: 55,  ry: 18, isCymbal: true },
  { id: "ride",     type: "ellipse", cx: 510, cy: 155, rx: 78,  ry: 25, isCymbal: true },
  { id: "tom1",     type: "circle",  cx: 232, cy: 188, rx: 52,  ry: 52 },
  { id: "tom2",     type: "circle",  cx: 352, cy: 168, rx: 52,  ry: 52 },
  { id: "kick",     type: "circle",  cx: 298, cy: 306, rx: 108, ry: 108 },
  { id: "snare",    type: "circle",  cx: 148, cy: 356, rx: 58,  ry: 58 },
  { id: "floortom", type: "circle",  cx: 472, cy: 352, rx: 72,  ry: 72 },
];

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
export default function DrumKit() {
  const [, navigate] = useLocation();
  const [hits, setHits] = useState<Set<DrumId>>(new Set());
  const [hitLog, setHitLog] = useState<{ id: DrumId; label: string; ts: number }[]>([]);
  const clearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const hit = useCallback((id: DrumId) => {
    const drum = DRUMS.find(d => d.id === id)!;
    drum.play();

    setHits(prev => new Set(prev).add(id));
    if (clearTimers.current[id]) clearTimeout(clearTimers.current[id]);
    clearTimers.current[id] = setTimeout(() => {
      setHits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 180);

    setHitLog(prev => [{ id, label: drum.label, ts: Date.now() }, ...prev.slice(0, 11)]);
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

  const drumInfo = (id: DrumId) => DRUMS.find(d => d.id === id)!;

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #0f0c24 0%, #1a1035 40%, #0c1a2e 100%)" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10"
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)" }}>
        <Button variant="ghost" size="sm"
          onClick={() => navigate("/student/home")}
          className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
          data-testid="btn-back">
          <ArrowLeft className="w-4 h-4" /> Geri
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥁</span>
          <h1 className="font-extrabold text-lg text-white">Online Davul Seti</h1>
        </div>
        <div className="w-16" />
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-2 py-3 gap-3 overflow-hidden">

        {/* Keyboard hints bar */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {DRUMS.map(d => (
            <div key={d.id}
              className="flex items-center gap-1 bg-white/8 border border-white/15 rounded-lg px-2 py-1">
              <kbd className="w-5 h-5 rounded text-[10px] font-black text-black flex items-center justify-center"
                style={{ background: d.rimColor }}>{d.key}</kbd>
              <span className="text-[10px] text-white/70 font-semibold">{d.label}</span>
            </div>
          ))}
        </div>

        {/* SVG Drum Kit */}
        <div className="w-full max-w-2xl">
          <svg
            viewBox="0 0 620 470"
            className="w-full drop-shadow-2xl select-none touch-none"
            style={{ maxHeight: "calc(100vh - 220px)" }}
          >
            <defs>
              {/* Drum head gradients */}
              <radialGradient id="kickGrad" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#2a5080" />
                <stop offset="60%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#0d1f33" />
              </radialGradient>
              <radialGradient id="snareGrad" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#6b3018" />
                <stop offset="60%" stopColor="#3b1a0a" />
                <stop offset="100%" stopColor="#1a0a05" />
              </radialGradient>
              <radialGradient id="tomGrad1" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#2d6b2d" />
                <stop offset="100%" stopColor="#0d220d" />
              </radialGradient>
              <radialGradient id="tomGrad2" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#2d2d8a" />
                <stop offset="100%" stopColor="#0d0d30" />
              </radialGradient>
              <radialGradient id="floorGrad" cx="45%" cy="40%">
                <stop offset="0%" stopColor="#6b2d4a" />
                <stop offset="100%" stopColor="#220d18" />
              </radialGradient>
              {/* Cymbal gradient */}
              <linearGradient id="cymbalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b6914" />
                <stop offset="30%" stopColor="#ffd700" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#d4af37" />
                <stop offset="70%" stopColor="#ffd700" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#8b6914" />
              </linearGradient>
              <linearGradient id="rideGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7a6914" />
                <stop offset="40%" stopColor="#e8c830" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#c8a830" />
                <stop offset="100%" stopColor="#7a6914" />
              </linearGradient>
              {/* Hit flash */}
              <radialGradient id="flashGrad" cx="50%" cy="50%">
                <stop offset="0%" stopColor="white" stopOpacity="0.7" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              {/* Chrome rim */}
              <radialGradient id="rimGrad" cx="50%" cy="30%">
                <stop offset="0%" stopColor="#e8e8e8" />
                <stop offset="50%" stopColor="#aaa" />
                <stop offset="100%" stopColor="#666" />
              </radialGradient>
              {/* Drop shadow */}
              <filter id="shadow">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.6" />
              </filter>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Stand legs / hardware suggestion */}
            <line x1="298" y1="414" x2="180" y2="460" stroke="#444" strokeWidth="4" strokeLinecap="round" />
            <line x1="298" y1="414" x2="298" y2="465" stroke="#444" strokeWidth="4" strokeLinecap="round" />
            <line x1="298" y1="414" x2="416" y2="460" stroke="#444" strokeWidth="4" strokeLinecap="round" />
            {/* Hihat stand */}
            <line x1="118" y1="253" x2="90" y2="420" stroke="#444" strokeWidth="3" strokeLinecap="round" />

            {/* Render all drum shapes */}
            {SHAPES.map(shape => {
              const def = drumInfo(shape.id);
              const active = hits.has(shape.id);

              if (shape.isCymbal) {
                const isRide = shape.id === "ride";
                return (
                  <g key={shape.id} filter="url(#shadow)"
                    style={{ cursor: "pointer" }}
                    onPointerDown={e => { e.preventDefault(); hit(shape.id); }}>
                    {/* Cymbal body */}
                    <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
                      fill={isRide ? "url(#rideGrad)" : "url(#cymbalGrad)"}
                      stroke={def.rimColor} strokeWidth="2" />
                    {/* Cymbal bell (center dome) */}
                    <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx * 0.18} ry={shape.ry * 0.6}
                      fill={active ? "#fff9c4" : def.rimColor}
                      stroke={def.rimColor} strokeWidth="1.5" />
                    {/* Cymbal ridges */}
                    {[0.4, 0.65, 0.85].map((r, i) => (
                      <ellipse key={i} cx={shape.cx} cy={shape.cy}
                        rx={shape.rx * r} ry={shape.ry * r}
                        fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                    ))}
                    {/* Hit flash */}
                    {active && (
                      <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry}
                        fill="url(#flashGrad)" filter="url(#glow)" opacity="0.85" />
                    )}
                    {/* Label */}
                    <text x={shape.cx} y={shape.cy + shape.ry + 14}
                      textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.75)" fontWeight="700"
                      style={{ pointerEvents: "none" }}>
                      {def.label} [{def.key}]
                    </text>
                  </g>
                );
              }

              // Regular drum
              const gradMap: Record<DrumId, string> = {
                kick: "url(#kickGrad)", snare: "url(#snareGrad)",
                tom1: "url(#tomGrad1)", tom2: "url(#tomGrad2)",
                floortom: "url(#floorGrad)",
                hihat: "url(#cymbalGrad)", crash: "url(#cymbalGrad)", ride: "url(#rideGrad)",
              };
              const r = shape.rx;

              return (
                <g key={shape.id} filter="url(#shadow)"
                  style={{ cursor: "pointer" }}
                  onPointerDown={e => { e.preventDefault(); hit(shape.id); }}>
                  {/* Outer rim */}
                  <circle cx={shape.cx} cy={shape.cy} r={r + 6}
                    fill="url(#rimGrad)" stroke="#888" strokeWidth="1" />
                  {/* Tension rods (bolts) */}
                  {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (i / 8) * Math.PI * 2 - Math.PI / 2;
                    const bx = shape.cx + Math.cos(angle) * (r + 2);
                    const by = shape.cy + Math.sin(angle) * (r + 2);
                    return (
                      <circle key={i} cx={bx} cy={by} r={2.5}
                        fill={active ? "#fff" : "#ccc"} stroke="#888" strokeWidth="0.5" />
                    );
                  })}
                  {/* Drum head */}
                  <circle cx={shape.cx} cy={shape.cy} r={r}
                    fill={gradMap[shape.id]} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                  {/* Head inner ring */}
                  <circle cx={shape.cx} cy={shape.cy} r={r * 0.82}
                    fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Center dot */}
                  <circle cx={shape.cx} cy={shape.cy} r={r * 0.12}
                    fill={active ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)"} />
                  {/* Hit flash overlay */}
                  {active && (
                    <circle cx={shape.cx} cy={shape.cy} r={r}
                      fill="url(#flashGrad)" filter="url(#glow)" opacity="0.7" />
                  )}
                  {/* Label */}
                  <text x={shape.cx} y={shape.cy + 1}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={r > 80 ? 15 : 12} fill="rgba(255,255,255,0.85)" fontWeight="800"
                    style={{ pointerEvents: "none" }}>
                    {def.label}
                  </text>
                  <text x={shape.cx} y={shape.cy + (r > 80 ? 20 : 16)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={10} fill="rgba(255,255,255,0.5)" fontWeight="700"
                    style={{ pointerEvents: "none" }}>
                    [{def.key}]
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Hit log */}
        <div className="flex gap-1.5 flex-wrap justify-center min-h-[28px]">
          <AnimatePresence mode="popLayout">
            {hitLog.slice(0, 8).map((h, idx) => {
              const def = drumInfo(h.id);
              return (
                <motion.div key={h.ts}
                  initial={{ opacity: 0, scale: 0.6, y: -10 }}
                  animate={{ opacity: 1 - idx * 0.1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="px-2.5 py-1 rounded-full text-xs font-extrabold text-black"
                  style={{ background: def.rimColor }}>
                  {def.label}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Touch hint */}
        <p className="text-white/30 text-xs font-semibold">
          Tıkla / Dokun / Klavye tuşları
        </p>

      </main>
    </div>
  );
}
