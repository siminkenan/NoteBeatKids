import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import drumImg from "@assets/drum-Photoroom_1773262756209.png";

/* ═══════════════════════════════════════════════════════
   WEB AUDIO CONTEXT
═══════════════════════════════════════════════════════ */
let _ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/* ── helpers ── */
function noiseBuf(c: AudioContext, dur: number): AudioBufferSourceNode {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf; return src;
}
function mkOsc(c: AudioContext, type: OscillatorType, freq: number, t: number, stop: number): OscillatorNode {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  o.start(t); o.stop(t + stop); return o;
}
function mkDecay(c: AudioContext, peak: number, dur: number, t: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

/* ═══════════════════════════════════════════════════════
   ACOUSTIC SYNTHESIS — each fn accepts optional `when`
   so the sequencer can schedule notes precisely.
═══════════════════════════════════════════════════════ */
function playKick(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  const body = mkOsc(c, "sine", 160, t, 0.6);
  const bg = mkDecay(c, 1.6, 0.55, t);
  body.frequency.setValueAtTime(160, t);
  body.frequency.exponentialRampToValueAtTime(45, t + 0.07);
  body.connect(bg); bg.connect(c.destination);
  const click = mkOsc(c, "sine", 1800, t, 0.015);
  const cg = mkDecay(c, 0.5, 0.012, t);
  click.connect(cg); cg.connect(c.destination);
  const punch = mkOsc(c, "triangle", 80, t, 0.18);
  const pg = mkDecay(c, 0.6, 0.15, t);
  punch.connect(pg); pg.connect(c.destination);
}

function playSnare(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  const head = mkOsc(c, "sine", 200, t, 0.18);
  const hg = mkDecay(c, 0.7, 0.14, t);
  head.connect(hg); hg.connect(c.destination);
  const mode2 = mkOsc(c, "sine", 330, t, 0.12);
  const m2g = mkDecay(c, 0.35, 0.09, t);
  mode2.connect(m2g); m2g.connect(c.destination);
  const wires = noiseBuf(c, 0.25);
  const bf = c.createBiquadFilter(); bf.type = "bandpass"; bf.frequency.value = 6000; bf.Q.value = 0.4;
  const wg = mkDecay(c, 1.0, 0.22, t);
  wires.connect(bf); bf.connect(wg); wg.connect(c.destination);
  wires.start(t); wires.stop(t + 0.25);
  const crack = noiseBuf(c, 0.025);
  const crg = mkDecay(c, 1.2, 0.02, t);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 3000;
  crack.connect(hpf); hpf.connect(crg); crg.connect(c.destination);
  crack.start(t); crack.stop(t + 0.025);
}

function playHihat(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  [240, 363, 484, 618, 729, 854].forEach(f => {
    const o = mkOsc(c, "square", f * 35, t, 0.08);
    const g = mkDecay(c, 0.08, 0.06, t);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 7000;
    o.connect(hpf); hpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.08);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 9000; bpf.Q.value = 0.6;
  const ng = mkDecay(c, 0.7, 0.06, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.08);
}

function playOpenHat(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  [240, 363, 484, 618, 729, 854].forEach(f => {
    const o = mkOsc(c, "square", f * 35, t, 0.45);
    const g = mkDecay(c, 0.06, 0.42, t);
    const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
    o.connect(hpf); hpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.45);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 8000; bpf.Q.value = 0.5;
  const ng = mkDecay(c, 0.6, 0.42, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.45);
}

function playCrash(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  [220, 311, 435, 521, 650].forEach((f, i) => {
    const o = mkOsc(c, "sawtooth", f * 22, t, 1.8);
    const g = mkDecay(c, 0.25 - i * 0.03, 1.6 - i * 0.15, t);
    const bpf = c.createBiquadFilter(); bpf.type = "bandpass";
    bpf.frequency.value = 4000 + i * 1000; bpf.Q.value = 0.3;
    o.connect(bpf); bpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 2.0);
  const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 5500; bpf.Q.value = 0.3;
  const ng = mkDecay(c, 1.0, 1.8, t);
  n.connect(bpf); bpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 2.0);
}

function playRide(when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  const bell = mkOsc(c, "triangle", 880, t, 0.9);
  const bg = mkDecay(c, 0.5, 0.85, t);
  bell.connect(bg); bg.connect(c.destination);
  [440, 660, 990, 1320].forEach((f, i) => {
    const o = mkOsc(c, "triangle", f, t, 0.9);
    const g = mkDecay(c, 0.15 - i * 0.02, 0.7 - i * 0.1, t);
    const bpf = c.createBiquadFilter(); bpf.type = "bandpass"; bpf.frequency.value = 3000 + i * 500; bpf.Q.value = 0.8;
    o.connect(bpf); bpf.connect(g); g.connect(c.destination);
  });
  const n = noiseBuf(c, 0.6);
  const hpf = c.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = 6000;
  const ng = mkDecay(c, 0.35, 0.55, t);
  n.connect(hpf); hpf.connect(ng); ng.connect(c.destination);
  n.start(t); n.stop(t + 0.6);
}

function playTom(freq: number, dur = 0.38, when?: number) {
  const c = ac(); const t = when ?? c.currentTime;
  const head = mkOsc(c, "sine", freq, t, dur);
  const hg = mkDecay(c, 1.0, dur * 0.9, t);
  head.frequency.setValueAtTime(freq, t);
  head.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur * 0.6);
  head.connect(hg); hg.connect(c.destination);
  const h2 = mkOsc(c, "sine", freq * 1.5, t, dur * 0.6);
  const h2g = mkDecay(c, 0.4, dur * 0.5, t);
  h2.connect(h2g); h2g.connect(c.destination);
  const click = noiseBuf(c, 0.018);
  const lpf = c.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = 3000;
  const cg = mkDecay(c, 0.5, 0.015, t);
  click.connect(lpf); lpf.connect(cg); cg.connect(c.destination);
  click.start(t); click.stop(t + 0.018);
}

/* ═══════════════════════════════════════════════════════
   DRUM ZONES (interactive hit areas on image)
═══════════════════════════════════════════════════════ */
type DrumId = "kick" | "snare" | "hihat" | "openhat" | "crash" | "ride" | "tom1" | "tom2" | "floortom";

interface Zone {
  id: DrumId; label: string; key: string;
  play: (when?: number) => void; color: string;
  left: number; top: number; width: number; height: number;
}

const ZONES: Zone[] = [
  { id: "crash",    label: "Crash",     key: "A", play: playCrash,                     color: "#fbbf24", left: 6,  top: 5,  width: 25, height: 13 },
  { id: "hihat",    label: "Hi-Hat",    key: "S", play: playHihat,                     color: "#fbbf24", left: 7,  top: 27, width: 14, height: 8  },
  { id: "openhat",  label: "Open Hat",  key: "E", play: playOpenHat,                   color: "#fde68a", left: 3,  top: 31, width: 8,  height: 6  },
  { id: "tom1",     label: "Tom 1",     key: "H", play: (w) => playTom(290, 0.38, w),  color: "#60a5fa", left: 23, top: 21, width: 17, height: 14 },
  { id: "snare",    label: "Snare",     key: "D", play: playSnare,                     color: "#f87171", left: 9,  top: 42, width: 17, height: 12 },
  { id: "tom2",     label: "Tom 2",     key: "J", play: (w) => playTom(220, 0.42, w),  color: "#fb923c", left: 54, top: 20, width: 16, height: 14 },
  { id: "ride",     label: "Ride",      key: "G", play: playRide,                      color: "#fbbf24", left: 68, top: 5,  width: 25, height: 13 },
  { id: "floortom", label: "Floor Tom", key: "K", play: (w) => playTom(130, 0.5, w),   color: "#d4af37", left: 68, top: 41, width: 19, height: 15 },
  { id: "kick",     label: "Kick",      key: "F", play: playKick,                      color: "#f97316", left: 26, top: 44, width: 44, height: 33 },
];
const KEY_MAP: Record<string, DrumId> = Object.fromEntries(ZONES.map(z => [z.key, z.id]));

/* ═══════════════════════════════════════════════════════
   SEQUENCER DRUM ROWS (7 rows, top = high → bottom = low)
═══════════════════════════════════════════════════════ */
const SEQ_DRUMS: Array<{ id: DrumId; label: string; color: string; play: (when?: number) => void }> = [
  { id: "crash",    label: "Crash",     color: "#fbbf24", play: playCrash },
  { id: "ride",     label: "Ride",      color: "#e5c05a", play: playRide },
  { id: "hihat",    label: "Hi-Hat",    color: "#fde68a", play: playHihat },
  { id: "tom1",     label: "Tom 1",     color: "#60a5fa", play: (w) => playTom(290, 0.38, w) },
  { id: "tom2",     label: "Tom 2",     color: "#fb923c", play: (w) => playTom(220, 0.42, w) },
  { id: "snare",    label: "Snare",     color: "#f87171", play: playSnare },
  { id: "floortom", label: "Floor Tom", color: "#d4af37", play: (w) => playTom(130, 0.5, w) },
  { id: "kick",     label: "Kick",      color: "#f97316", play: playKick },
];

const STEPS = 16; // 4 measures × 4 beats
type Pattern = Record<DrumId, boolean[]>;
function emptyPattern(): Pattern {
  const p = {} as Pattern;
  SEQ_DRUMS.forEach(d => { p[d.id] = new Array(STEPS).fill(false); });
  return p;
}

/* ═══════════════════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════════════════ */
export default function DrumKit() {
  const [, navigate] = useLocation();

  /* ── pad hits (live play) ── */
  const [hits, setHits] = useState<Set<DrumId>>(new Set());
  const [lastHit, setLastHit] = useState<{ id: DrumId; ts: number } | null>(null);
  const hitTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  /* ── sequencer ── */
  const [pattern, setPattern] = useState<Pattern>(emptyPattern);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(90);

  const patternRef = useRef(pattern);
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextNoteRef = useRef(0);
  const stepRef = useRef(0);
  const liveStepRef = useRef(-1); // tracks which step is currently sounding

  useEffect(() => { patternRef.current = pattern; }, [pattern]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  /* ── live hit (+ live record when playing) ── */
  const hit = useCallback((id: DrumId) => {
    ZONES.find(z => z.id === id)!.play();
    setHits(prev => new Set(prev).add(id));
    setLastHit({ id, ts: Date.now() });
    clearTimeout(hitTimers.current[id]);
    hitTimers.current[id] = setTimeout(() => {
      setHits(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 180);
    // Live-record into sequencer while playing
    if (isPlayingRef.current && liveStepRef.current >= 0) {
      const step = liveStepRef.current;
      setPattern(prev => {
        const next = { ...prev, [id]: [...prev[id]] };
        next[id][step] = true;
        return next;
      });
    }
  }, []);

  /* ── keyboard ── */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === " ") { e.preventDefault(); setIsPlaying(p => !p); return; }
      const id = KEY_MAP[e.key.toUpperCase()];
      if (id) hit(id);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [hit]);

  /* ── sequencer scheduler ── */
  useEffect(() => {
    if (!isPlaying) {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      setCurrentStep(-1);
      liveStepRef.current = -1;
      return;
    }
    const c = ac();
    nextNoteRef.current = c.currentTime + 0.05;
    stepRef.current = 0;

    schedulerRef.current = setInterval(() => {
      const ctx2 = ac();
      const stepDur = 60 / bpmRef.current / 4; // 16th note
      while (nextNoteRef.current < ctx2.currentTime + 0.12) {
        const step = stepRef.current % STEPS;
        const when = nextNoteRef.current;
        // fire all active drums at this step
        SEQ_DRUMS.forEach(drum => {
          if (patternRef.current[drum.id]?.[step]) drum.play(when);
        });
        // sync visual playhead + live-record ref
        const delayMs = Math.max(0, (when - ctx2.currentTime) * 1000);
        const capturedStep = step;
        setTimeout(() => {
          setCurrentStep(capturedStep);
          liveStepRef.current = capturedStep;
        }, delayMs);
        nextNoteRef.current += stepDur;
        stepRef.current++;
      }
    }, 25);

    return () => { if (schedulerRef.current) clearInterval(schedulerRef.current); };
  }, [isPlaying]);

  /* ── toggle sequencer cell ── */
  const toggleStep = (id: DrumId, step: number) => {
    setPattern(prev => {
      const next = { ...prev, [id]: [...prev[id]] };
      next[id][step] = !next[id][step];
      return next;
    });
  };

  const lastZone = lastHit ? ZONES.find(z => z.id === lastHit.id) : null;

  return (
    <div className="h-screen flex flex-col select-none overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0e0920 0%, #0d1a3a 60%, #080d1a 100%)" }}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)" }}>
        <Button variant="ghost" size="sm"
          onClick={() => navigate("/student/home")}
          className="gap-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
          data-testid="btn-back-drum">
          <ArrowLeft className="w-4 h-4" /> Geri
        </Button>
        <h1 className="font-extrabold text-base text-white tracking-tight">🥁 Online Davul Seti</h1>
        <div className="w-20 text-right h-6">
          <AnimatePresence mode="wait">
            {lastZone && (
              <motion.span key={lastHit?.ts}
                initial={{ opacity: 0, y: -6, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold text-black"
                style={{ background: lastZone.color }}>
                {lastZone.label}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── Drum Kit Image (top half) ── */}
      <div className="flex-shrink-0 flex justify-center px-2 pt-1"
        style={{ height: "clamp(140px, 36vh, 320px)" }}>
        <div className="relative h-full" style={{ aspectRatio: "1/1" }}>
          <img src={drumImg} alt="Davul Seti"
            className="w-full h-full object-contain pointer-events-none" draggable={false} />
          {ZONES.map(zone => {
            const active = hits.has(zone.id);
            return (
              <div key={zone.id}
                data-testid={`drum-zone-${zone.id}`}
                onPointerDown={e => { e.preventDefault(); hit(zone.id); }}
                style={{
                  position: "absolute", left: `${zone.left}%`, top: `${zone.top}%`,
                  width: `${zone.width}%`, height: `${zone.height}%`,
                  borderRadius: "50%", cursor: "pointer", touchAction: "none",
                  background: active ? `radial-gradient(ellipse, ${zone.color}55 0%, transparent 80%)` : "transparent",
                  boxShadow: active ? `0 0 18px 6px ${zone.color}60` : "none",
                  border: active ? `2px solid ${zone.color}bb` : "1.5px solid rgba(255,255,255,0.05)",
                  zIndex: 10, transition: "all 0.05s",
                }}>
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                  <div style={{
                    background: active ? zone.color : "rgba(0,0,0,0.6)",
                    color: active ? "#000" : "rgba(255,255,255,0.9)",
                    border: `1.5px solid ${active ? zone.color : "rgba(255,255,255,0.2)"}`,
                    borderRadius: "7px", padding: "1px 5px",
                    fontSize: "10px", fontWeight: 900, lineHeight: 1.3,
                    whiteSpace: "nowrap", textAlign: "center",
                    boxShadow: active ? `0 0 10px ${zone.color}` : "none",
                    transition: "all 0.06s",
                  }}>
                    {zone.label}<div style={{ fontSize: "8px", opacity: 0.65 }}>[{zone.key}]</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sequencer Controls ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0 border-t border-white/8">
        {/* Play / Stop */}
        <button
          data-testid="btn-seq-play"
          onClick={() => setIsPlaying(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-extrabold text-sm text-black transition-all"
          style={{ background: isPlaying ? "#f87171" : "#4ade80", boxShadow: `0 0 12px ${isPlaying ? "#f87171" : "#4ade80"}66` }}>
          {isPlaying ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {isPlaying ? "Dur" : "Çal"}
        </button>

        {/* REC indicator — shown when playing */}
        {isPlaying && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-1 rounded-md"
            style={{ background: "rgba(239,68,68,0.2)", border: "1.5px solid #ef4444" }}>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-400 text-[10px] font-extrabold">REC</span>
          </motion.div>
        )}

        {/* BPM */}
        <div className="flex items-center gap-1.5 flex-1">
          <span className="text-white/60 text-xs font-bold flex-shrink-0">BPM</span>
          <input type="range" min={50} max={160} value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            className="flex-1 h-1.5 rounded accent-yellow-400" />
          <span className="text-yellow-400 font-extrabold text-sm w-7 text-right">{bpm}</span>
        </div>

        {/* Clear */}
        <button
          data-testid="btn-seq-clear"
          onClick={() => setPattern(emptyPattern())}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-xs font-bold transition-all">
          <Trash2 className="w-3.5 h-3.5" /> Temizle
        </button>
      </div>

      {/* ── Sequencer Grid ── */}
      <div className="flex-1 px-2 pb-2 overflow-hidden flex flex-col gap-0.5" style={{ minHeight: 0 }}>

        {/* Beat header: measure numbers */}
        <div className="flex items-center mb-0.5">
          <div style={{ width: 66 }} />
          {[1, 2, 3, 4].map(m => (
            <div key={m} className="flex-1 flex gap-0.5 px-0.5">
              <div className="flex-1 text-center text-[9px] font-extrabold text-white/30">{m}. Ölçü</div>
            </div>
          ))}
        </div>

        {/* Drum rows */}
        {SEQ_DRUMS.map(drum => (
          <div key={drum.id} className="flex items-center gap-0" style={{ flex: "1 1 0", minHeight: 0 }}>
            {/* Label */}
            <div className="flex-shrink-0 text-right pr-2 flex items-center justify-end"
              style={{ width: 66 }}>
              <div className="px-1.5 py-0.5 rounded text-[10px] font-extrabold"
                style={{
                  background: `${drum.color}22`,
                  color: drum.color,
                  border: `1px solid ${drum.color}44`,
                  whiteSpace: "nowrap",
                }}>
                {drum.label}
              </div>
            </div>

            {/* 4 measures × 4 beats = 16 cells */}
            <div className="flex flex-1 gap-0.5 min-w-0">
              {[0, 1, 2, 3].map(measure => (
                <div key={measure}
                  className="flex gap-0.5 flex-1"
                  style={{ borderLeft: measure > 0 ? "2px solid rgba(255,255,255,0.12)" : "none", paddingLeft: measure > 0 ? 4 : 0 }}>
                  {[0, 1, 2, 3].map(beat => {
                    const step = measure * 4 + beat;
                    const on = pattern[drum.id]?.[step] ?? false;
                    const isCurrent = currentStep === step && isPlaying;
                    return (
                      <button key={beat}
                        data-testid={`seq-cell-${drum.id}-${step}`}
                        onClick={() => toggleStep(drum.id, step)}
                        className="flex-1 rounded transition-all"
                        style={{
                          minWidth: 0,
                          background: on
                            ? (isCurrent ? `${drum.color}` : `${drum.color}cc`)
                            : isCurrent
                              ? "rgba(255,255,255,0.25)"
                              : beat === 0
                                ? "rgba(255,255,255,0.11)"  // beat 1 of measure = slightly highlighted
                                : "rgba(255,255,255,0.06)",
                          boxShadow: on && isCurrent ? `0 0 10px 3px ${drum.color}88` : "none",
                          border: on
                            ? `1.5px solid ${drum.color}88`
                            : `1px solid rgba(255,255,255,${isCurrent ? "0.3" : "0.1"})`,
                          transform: on && isCurrent ? "scale(1.06)" : "scale(1)",
                          aspectRatio: "1 / 1",
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
