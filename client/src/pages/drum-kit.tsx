import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import drumImg from "@assets/drum-Photoroom_1773262756209.png";

/* ═══════════════════════════════════════════════════════════
   ACOUSTIC DRUM SYNTHESIS — physical modelling via Web Audio
   Each sound uses layered oscillators + noise + envelopes
   to replicate the physics of real acoustic drum membranes.
═══════════════════════════════════════════════════════════ */
let _ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/** White-noise buffer of given duration */
function noiseBuf(c: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; return src;
}

/** Convenience: create OscillatorNode, schedule start/stop, return it */
function osc(c: AudioContext, type: OscillatorType, freq: number, stop: number): OscillatorNode {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  o.start(c.currentTime); o.stop(c.currentTime + stop); return o;
}

/** Convenience: create GainNode with an exponential decay */
function decay(c: AudioContext, peak: number, dur: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  return g;
}

/* ── KICK (bass drum) ────────────────────────────────────── */
function playKick() {
  const c = ac();
  // Sub-bass body — pitch sweeps from 160 Hz to 45 Hz (acoustic thump)
  const body = osc(c, "sine", 160, 0.6);
  const bg = decay(c, 1.6, 0.55);
  body.frequency.setValueAtTime(160, c.currentTime);
  body.frequency.exponentialRampToValueAtTime(45, c.currentTime + 0.07);
  body.connect(bg); bg.connect(c.destination);

  // Click transient (beater attack)
  const click = osc(c, "sine", 1800, 0.015);
  const cg = decay(c, 0.5, 0.012);
  click.connect(cg); cg.connect(c.destination);

  // Slight low-mid punch at 80 Hz
  const punch = osc(c, "triangle", 80, 0.18);
  const pg = decay(c, 0.6, 0.15);
  punch.connect(pg); pg.connect(c.destination);
}

/* ── SNARE (acoustic, not electronic) ──────────────────────── */
function playSnare() {
  const c = ac();
  // Drum head fundamental ~200 Hz
  const head = osc(c, "sine", 200, 0.18);
  const hg = decay(c, 0.7, 0.14);
  head.connect(hg); hg.connect(c.destination);

  // Second mode of membrane ~330 Hz
  const mode2 = osc(c, "sine", 330, 0.12);
  const m2g = decay(c, 0.35, 0.09);
  mode2.connect(m2g); m2g.connect(c.destination);

  // Snare wires — broadband noise shaped with bandpass
  const wires = noiseBuf(c, 0.25);
  const bf = c.createBiquadFilter();
  bf.type = "bandpass"; bf.frequency.value = 6000; bf.Q.value = 0.4;
  const wg = decay(c, 1.0, 0.22);
  wires.connect(bf); bf.connect(wg); wg.connect(c.destination);

  // Crack transient (high-freq noise burst)
  const crack = noiseBuf(c, 0.025);
  const crg = decay(c, 1.2, 0.02);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 3000;
  crack.connect(hpf); hpf.connect(crg); crg.connect(c.destination);

  wires.start(); wires.stop(c.currentTime + 0.25);
  crack.start(); crack.stop(c.currentTime + 0.025);
}

/* ── HI-HAT (closed) ─────────────────────────────────────── */
function playHihat() {
  const c = ac();
  // 6 detuned square oscillators (metallic hat timbre via inharmonic partials)
  const freqs = [240, 363, 484, 618, 729, 854];
  freqs.forEach(f => {
    const o2 = osc(c, "square", f * 35, 0.08);
    const g2 = decay(c, 0.08, 0.06);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 7000;
    o2.connect(hpf); hpf.connect(g2); g2.connect(c.destination);
  });
  // Noise component
  const n = noiseBuf(c, 0.08);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
  bpf.frequency.value = 9000; bpf.Q.value = 0.6;
  const ng = decay(c, 0.7, 0.06);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.08);
}

/* ── OPEN HI-HAT ─────────────────────────────────────────── */
function playOpenHat() {
  const c = ac();
  const freqs = [240, 363, 484, 618, 729, 854];
  freqs.forEach(f => {
    const o2 = osc(c, "square", f * 35, 0.45);
    const g2 = decay(c, 0.06, 0.42);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
    o2.connect(hpf); hpf.connect(g2); g2.connect(c.destination);
  });
  const n = noiseBuf(c, 0.45);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
  bpf.frequency.value = 8000; bpf.Q.value = 0.5;
  const ng = decay(c, 0.6, 0.42);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.45);
}

/* ── CRASH CYMBAL ─────────────────────────────────────────── */
function playCrash() {
  const c = ac();
  // Complex inharmonic metallic partials (5 oscillators)
  const partials = [220, 311, 435, 521, 650];
  partials.forEach((f, i) => {
    const o2 = osc(c, "sawtooth", f * 22, 1.8);
    const g2 = decay(c, 0.25 - i * 0.03, 1.6 - i * 0.15);
    const lpf = c.createBiquadFilter(); lpf.type = "bandpass";
    lpf.frequency.value = 4000 + i * 1000; lpf.Q.value = 0.3;
    o2.connect(lpf); lpf.connect(g2); g2.connect(c.destination);
  });
  // Noise wash
  const n = noiseBuf(c, 2.0);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
  bpf.frequency.value = 5500; bpf.Q.value = 0.3;
  const ng = decay(c, 1.0, 1.8);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(); n.stop(c.currentTime + 2.0);
}

/* ── RIDE CYMBAL ─────────────────────────────────────────── */
function playRide() {
  const c = ac();
  // Bell-like ping at attack
  const bell = osc(c, "triangle", 880, 0.9);
  const bg2 = decay(c, 0.5, 0.85);
  bell.connect(bg2); bg2.connect(c.destination);

  // Shimmer (partial series)
  [440, 660, 990, 1320].forEach((f, i) => {
    const o2 = osc(c, "triangle", f, 0.9);
    const g2 = decay(c, 0.15 - i * 0.02, 0.7 - i * 0.1);
    const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
    bpf.frequency.value = 3000 + i * 500; bpf.Q.value = 0.8;
    o2.connect(bpf); bpf.connect(g2); g2.connect(c.destination);
  });
  // Noise tail
  const n = noiseBuf(c, 0.6);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
  const ng = decay(c, 0.35, 0.55);
  n.connect(hpf); hpf.connect(ng); ng.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.6);
}

/* ── TOMS ─────────────────────────────────────────────────── */
function playTom(freq: number, dur = 0.38) {
  const c = ac();
  // Head fundamental
  const head = osc(c, "sine", freq, dur);
  const hg = decay(c, 1.0, dur * 0.9);
  head.frequency.setValueAtTime(freq, c.currentTime);
  head.frequency.exponentialRampToValueAtTime(freq * 0.55, c.currentTime + dur * 0.6);
  head.connect(hg); hg.connect(c.destination);

  // Second harmonic (adds body)
  const h2 = osc(c, "sine", freq * 1.5, dur * 0.6);
  const h2g = decay(c, 0.4, dur * 0.5);
  h2.connect(h2g); h2g.connect(c.destination);

  // Attack transient (beater)
  const click = noiseBuf(c, 0.018);
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 3000;
  const cg = decay(c, 0.5, 0.015);
  click.connect(lpf); lpf.connect(cg); cg.connect(c.destination);
  click.start(); click.stop(c.currentTime + 0.018);
}

/* ═══════════════════════════════════════════════════════════
   DRUM ZONE DEFINITIONS
   All positions are % of the image container (top-left origin)
   Tuned to the "NoteBeat Kids" drum illustration.
═══════════════════════════════════════════════════════════ */
type DrumId = "kick" | "snare" | "hihat" | "openhat" | "crash" | "ride" | "tom1" | "tom2" | "floortom";

interface Zone {
  id: DrumId;
  label: string;
  sublabel?: string;
  key: string;
  play: () => void;
  color: string;
  left: number; top: number; width: number; height: number;
}

const ZONES: Zone[] = [
  {
    id: "crash",    label: "Crash",     key: "A", play: playCrash,             color: "#fbbf24",
    left: 6,  top: 5,  width: 25, height: 13,
  },
  {
    id: "hihat",    label: "Hi-Hat",    key: "S", play: playHihat,             color: "#fbbf24",
    left: 7,  top: 27, width: 14, height: 8,
  },
  {
    id: "openhat",  label: "Open Hat",  key: "E", play: playOpenHat,           color: "#fde68a",
    left: 3,  top: 31, width: 8,  height: 6,
  },
  {
    id: "tom1",     label: "Tom 1",     key: "H", play: () => playTom(290, 0.38), color: "#60a5fa",
    left: 23, top: 21, width: 17, height: 14,
  },
  {
    id: "snare",    label: "Snare",     key: "D", play: playSnare,             color: "#f87171",
    left: 9,  top: 42, width: 17, height: 12,
  },
  {
    id: "tom2",     label: "Tom 2",     key: "J", play: () => playTom(220, 0.42), color: "#fb923c",
    left: 54, top: 20, width: 16, height: 14,
  },
  {
    id: "ride",     label: "Ride",      key: "G", play: playRide,              color: "#fbbf24",
    left: 68, top: 5,  width: 25, height: 13,
  },
  {
    id: "floortom", label: "Floor Tom", key: "K", play: () => playTom(130, 0.5), color: "#d4af37",
    left: 68, top: 41, width: 19, height: 15,
  },
  {
    id: "kick",     label: "Kick",      sublabel: "Bass Drum",
                                        key: "F", play: playKick,              color: "#f97316",
    left: 26, top: 44, width: 44, height: 33,
  },
];

const KEY_MAP: Record<string, DrumId> = Object.fromEntries(ZONES.map(z => [z.key, z.id]));

/* ═══════════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════════ */
export default function DrumKit() {
  const [, navigate] = useLocation();
  const [hits, setHits] = useState<Set<DrumId>>(new Set());
  const [log, setLog] = useState<{ id: DrumId; ts: number }[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const hit = useCallback((id: DrumId) => {
    ZONES.find(z => z.id === id)!.play();
    setHits(prev => new Set(prev).add(id));
    setLog(prev => [{ id, ts: Date.now() }, ...prev.slice(0, 10)]);
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => {
      setHits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 180);
  }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const id = KEY_MAP[e.key.toUpperCase()];
      if (id) hit(id);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [hit]);

  const lastZone = log[0] ? ZONES.find(z => z.id === log[0].id) : null;

  return (
    <div className="min-h-screen flex flex-col select-none"
      style={{ background: "linear-gradient(160deg, #0e0920 0%, #0d1a3a 60%, #080d1a 100%)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}>
        <Button variant="ghost" size="sm"
          onClick={() => navigate("/student/home")}
          className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
          data-testid="btn-back-drum">
          <ArrowLeft className="w-4 h-4" /> Geri
        </Button>
        <h1 className="font-extrabold text-lg text-white tracking-tight">🥁 Online Davul Seti</h1>
        {/* Last-hit badge */}
        <div className="w-24 text-right h-7">
          <AnimatePresence mode="wait">
            {lastZone && (
              <motion.span key={log[0]?.ts}
                initial={{ opacity: 0, y: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
                className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-black"
                style={{ background: lastZone.color }}>
                {lastZone.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Drum Image + Hotspots ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-2 py-1 gap-2 min-h-0">
        <div className="relative w-full flex-1 flex items-center justify-center min-h-0">
          <div className="relative"
            style={{
              maxHeight: "calc(100vh - 130px)",
              aspectRatio: "1 / 1",
              width: "min(calc(100vh - 130px), 100%)",
            }}>
            {/* Drum illustration */}
            <img src={drumImg} alt="Davul Seti"
              className="w-full h-full object-contain pointer-events-none"
              draggable={false} />

            {/* Hit zones — absolutely positioned ellipses */}
            {ZONES.map(zone => {
              const active = hits.has(zone.id);
              return (
                <div key={zone.id}
                  data-testid={`drum-zone-${zone.id}`}
                  onPointerDown={e => { e.preventDefault(); hit(zone.id); }}
                  style={{
                    position: "absolute",
                    left: `${zone.left}%`,
                    top: `${zone.top}%`,
                    width: `${zone.width}%`,
                    height: `${zone.height}%`,
                    borderRadius: "50%",
                    cursor: "pointer",
                    touchAction: "none",
                    transition: "box-shadow 0.05s, background 0.05s, border-color 0.05s",
                    background: active
                      ? `radial-gradient(ellipse at 40% 35%, ${zone.color}60 0%, ${zone.color}28 55%, transparent 100%)`
                      : "transparent",
                    boxShadow: active
                      ? `0 0 22px 8px ${zone.color}70, inset 0 0 10px 3px ${zone.color}40`
                      : "none",
                    border: active
                      ? `2px solid ${zone.color}bb`
                      : "1.5px solid rgba(255,255,255,0.06)",
                    zIndex: 10,
                  }}
                >
                  {/* Centre label badge */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}>
                    <div style={{
                      background: active ? zone.color : "rgba(0,0,0,0.62)",
                      color: active ? "#000" : "rgba(255,255,255,0.92)",
                      border: `1.5px solid ${active ? zone.color : "rgba(255,255,255,0.22)"}`,
                      borderRadius: "8px",
                      padding: "1px 6px 2px",
                      fontSize: "11px",
                      fontWeight: 900,
                      lineHeight: 1.35,
                      textAlign: "center",
                      backdropFilter: active ? "none" : "blur(4px)",
                      boxShadow: active ? `0 0 12px ${zone.color}` : "none",
                      transition: "all 0.07s",
                      whiteSpace: "nowrap",
                    }}>
                      {zone.label}
                      <div style={{ fontSize: "9px", fontWeight: 700, opacity: 0.7 }}>
                        [{zone.key}]
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Keyboard shortcut strip ── */}
        <div className="flex gap-1.5 flex-wrap justify-center pb-1.5 flex-shrink-0">
          {ZONES.map(z => (
            <button key={z.id}
              onPointerDown={e => { e.preventDefault(); hit(z.id); }}
              className="flex items-center gap-1 rounded-lg px-1.5 py-1 border transition-all"
              style={{
                background: hits.has(z.id) ? z.color + "28" : "rgba(255,255,255,0.07)",
                borderColor: hits.has(z.id) ? z.color : "rgba(255,255,255,0.14)",
                cursor: "pointer",
              }}>
              <kbd className="w-5 h-5 rounded text-[10px] font-black text-black flex items-center justify-center"
                style={{ background: z.color }}>{z.key}</kbd>
              <span className="text-[10px] text-white/70 font-semibold leading-none">{z.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
