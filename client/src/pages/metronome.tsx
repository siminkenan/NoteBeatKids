import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MIN_BPM = 40;
const MAX_BPM = 208;
const SCHEDULE_AHEAD = 0.12;
const TICK_INTERVAL = 25;

type TimeSig = 2 | 3 | 4;

function createClick(ctx: AudioContext, accent: boolean, when: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.value = accent ? 1800 : 1100;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.6 : 0.35, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, when + (accent ? 0.055 : 0.04));
  osc.start(when);
  osc.stop(when + 0.07);
}

interface TapMark {
  id: number;
  beatIdx: number;      // which beat in measure this tap was closest to
  offsetRatio: number;  // 0–1 within that beat slot
  result: "perfect" | "good" | "early" | "late";
  color: string;
  label: string;
}

const RESULT_META = {
  perfect: { color: "#22c55e", label: "MÜKEMMEL ✨" },
  good:    { color: "#60a5fa", label: "İYİ 👍" },
  early:   { color: "#fbbf24", label: "ERKEN ⬆" },
  late:    { color: "#fb923c", label: "GEÇ ⬇" },
};

export default function Metronome() {
  const goBack = () => window.history.back();

  const [bpm, setBpm]           = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSig, setTimeSig]   = useState<TimeSig>(4);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [beatPhase, setBeatPhase] = useState(0);      // 0–1 progress through current beat
  const [tapMarks, setTapMarks] = useState<TapMark[]>([]);
  const [lastResult, setLastResult] = useState<TapMark | null>(null);
  const [tapFlash, setTapFlash] = useState(false);

  const audioCtxRef    = useRef<AudioContext | null>(null);
  const schedulerRef   = useRef<number | null>(null);
  const nextNoteRef    = useRef(0);
  const currentBeatRef = useRef(0);
  const bpmRef         = useRef(bpm);
  const timeSigRef     = useRef(timeSig);
  const isPlayingRef   = useRef(false);
  const tapTimesRef    = useRef<number[]>([]);
  const pendulumControls = useAnimation();

  // Beat timestamps (real wall-clock ms) — populated as beats are scheduled
  const beatTimestampsRef = useRef<{ wallMs: number; beat: number }[]>([]);
  const tapIdRef = useRef(0);
  const phaseRafRef = useRef<number | null>(null);

  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);

  // Pendulum animation
  useEffect(() => {
    if (isPlaying) {
      const beatDuration = 60 / bpm;
      pendulumControls.start({
        rotate: ["-32deg", "32deg"],
        transition: { duration: beatDuration, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" },
      });
    } else {
      pendulumControls.start({ rotate: "0deg", transition: { duration: 0.4, ease: "easeOut" } });
    }
  }, [isPlaying, bpm, pendulumControls]);

  // RAF loop to update beat phase indicator
  const phaseLoop = useCallback(() => {
    if (!audioCtxRef.current || !isPlayingRef.current) return;
    const ctx = audioCtxRef.current;
    const spb = 60 / bpmRef.current;
    const recentBeat = beatTimestampsRef.current[beatTimestampsRef.current.length - 1];
    if (recentBeat) {
      const elapsed = ctx.currentTime - (recentBeat.wallMs / 1000 - ctx.currentTime + ctx.currentTime);
      // Use scheduled AudioContext time instead
    }
    phaseRafRef.current = requestAnimationFrame(phaseLoop);
  }, []);

  const scheduleBeats = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    while (nextNoteRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beat = currentBeatRef.current;
      const when = nextNoteRef.current;
      createClick(ctx, beat === 0, when);

      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      const wallMs = Date.now() + delay;

      // Record wall-clock timestamp for this beat
      beatTimestampsRef.current.push({ wallMs, beat });
      // Keep only last 16 beats
      if (beatTimestampsRef.current.length > 16) {
        beatTimestampsRef.current = beatTimestampsRef.current.slice(-16);
      }

      setTimeout(() => {
        if (!isPlayingRef.current) return;
        setCurrentBeat(beat);
        // Update phase via animation frame
        const spb = 60000 / bpmRef.current;
        const phaseStart = Date.now();
        const updatePhase = () => {
          const elapsed = Date.now() - phaseStart;
          const p = Math.min(elapsed / spb, 1);
          setBeatPhase(p);
          if (p < 1 && isPlayingRef.current) requestAnimationFrame(updatePhase);
        };
        requestAnimationFrame(updatePhase);
      }, delay);

      const spb = 60 / bpmRef.current;
      nextNoteRef.current += spb;
      currentBeatRef.current = (beat + 1) % timeSigRef.current;
    }
  }, []);

  const start = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    currentBeatRef.current = 0;
    nextNoteRef.current = audioCtxRef.current.currentTime + 0.05;
    isPlayingRef.current = true;
    beatTimestampsRef.current = [];
    setIsPlaying(true);
    setTapMarks([]);
    schedulerRef.current = window.setInterval(scheduleBeats, TICK_INTERVAL);
    scheduleBeats();
  }, [scheduleBeats]);

  const stop = useCallback(() => {
    if (schedulerRef.current !== null) {
      clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    setCurrentBeat(-1);
    setBeatPhase(0);
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) stop(); else start();
  }, [start, stop]);

  useEffect(() => () => {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    audioCtxRef.current?.close();
  }, []);

  // ── Tap tempo ────────────────────────────────────────────────────────────────
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    const recent = taps.filter(t => now - t < 3000);
    recent.push(now);
    tapTimesRef.current = recent;
    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const detected = Math.round(60000 / avg);
      setBpm(Math.max(MIN_BPM, Math.min(MAX_BPM, detected)));
    }
  }, []);

  // ── Rhythm pad tap ────────────────────────────────────────────────────────────
  const handleRhythmTap = useCallback(() => {
    if (!isPlaying) return;
    const now = Date.now();
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 100);

    const spbMs = 60000 / bpmRef.current;
    const sig = timeSigRef.current;
    const measureMs = spbMs * sig;

    // Find nearest beat timestamp
    const beats = beatTimestampsRef.current;
    if (beats.length === 0) return;

    let nearest = beats[0];
    for (const b of beats) {
      if (Math.abs(b.wallMs - now) < Math.abs(nearest.wallMs - now)) nearest = b;
    }
    const diffMs = now - nearest.wallMs;  // + = late, - = early
    const absDiff = Math.abs(diffMs);

    let result: "perfect" | "good" | "early" | "late";
    if (absDiff <= 80) result = "perfect";
    else if (absDiff <= 160) result = "good";
    else if (diffMs > 0) result = "late";
    else result = "early";

    const meta = RESULT_META[result];

    // Calculate position on the rhythm strip
    // The strip shows `sig` beats of the current measure
    // tapBeat = which beat the tap aligns to
    const tapBeat = nearest.beat;
    // offsetRatio = where within that beat (0=start, 0.5=middle, 1=end)
    const rawOffset = diffMs / spbMs; // −0.5..+0.5 relative to beat center
    const offsetRatio = Math.max(0, Math.min(1, 0.5 + rawOffset * 0.5));

    const mark: TapMark = {
      id: tapIdRef.current++,
      beatIdx: tapBeat,
      offsetRatio,
      result,
      color: meta.color,
      label: meta.label,
    };

    setTapMarks(prev => [...prev.slice(-sig * 4), mark]);
    setLastResult(mark);
    setTimeout(() => setLastResult(null), 700);
  }, [isPlaying]);

  // Keyboard
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); if (isPlaying) handleRhythmTap(); else toggle(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [handleRhythmTap, isPlaying, toggle]);

  const changeBpm = (delta: number) => {
    setBpm(prev => Math.max(MIN_BPM, Math.min(MAX_BPM, prev + delta)));
  };

  const tempoLabel = (b: number) => {
    if (b < 60) return "Largo";
    if (b < 76) return "Adagio";
    if (b < 108) return "Andante";
    if (b < 120) return "Moderato";
    if (b < 156) return "Allegro";
    if (b < 176) return "Vivace";
    return "Presto";
  };

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen select-none pb-10"
      style={{ background: "linear-gradient(160deg, #e8d5ff 0%, #d4e8ff 50%, #ffd6e8 100%)" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}
            className="gap-1.5 rounded-xl font-bold" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
          <h1 className="text-xl font-extrabold text-purple-700">🎵 Metronom</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 flex flex-col items-center gap-5">

        {/* Pendulum + BPM Display */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl shadow-xl p-5 flex flex-col items-center gap-3"
          style={{ border: "3px solid rgba(168,85,247,0.2)" }}>
          {/* Pendulum */}
          <div className="relative flex flex-col items-center" style={{ height: 160 }}>
            <div className="w-5 h-5 rounded-full bg-yellow-400 border-4 border-yellow-600 shadow-md z-10" />
            <motion.div animate={pendulumControls}
              style={{ originX: "50%", originY: "0%", transformOrigin: "top center" }}
              className="absolute top-0 flex flex-col items-center">
              <div className="w-2 rounded-full" style={{
                height: 110,
                background: "linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)",
                boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
              }} />
              <motion.div className="w-10 h-10 rounded-full -mt-1 shadow-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f9a8d4 0%, #ec4899 100%)", border: "3px solid #be185d" }}
                animate={isPlaying ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 60 / bpm, repeat: Infinity }} />
            </motion.div>
            <div className="absolute bottom-0 w-44 h-20 rounded-t-full border-4 border-purple-200 opacity-40"
              style={{ left: "50%", transform: "translateX(-50%)" }} />
          </div>

          {/* BPM number + fine-tune buttons */}
          <div className="flex items-center gap-3">
            {/* Minus buttons */}
            <div className="flex flex-col gap-1">
              <button onClick={() => changeBpm(-5)}
                className="w-10 h-9 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center hover:bg-purple-200 transition-colors"
                data-testid="button-bpm-minus5">
                −5
              </button>
              <button onClick={() => changeBpm(-1)}
                className="w-10 h-9 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center hover:bg-purple-200 transition-colors"
                data-testid="button-bpm-minus1">
                −1
              </button>
            </div>

            <motion.div className="text-center flex-1"
              animate={currentBeat === 0 ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.1 }}>
              <div className="text-7xl font-black tabular-nums"
                style={{ color: isPlaying ? "#7c3aed" : "#a78bfa" }}
                data-testid="text-bpm">
                {bpm}
              </div>
              <div className="text-xs font-extrabold text-purple-400 uppercase tracking-widest">BPM</div>
              <div className="text-xs font-bold text-pink-400 mt-0.5">{tempoLabel(bpm)}</div>
            </motion.div>

            {/* Plus buttons */}
            <div className="flex flex-col gap-1">
              <button onClick={() => changeBpm(5)}
                className="w-10 h-9 rounded-xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center hover:bg-purple-200 transition-colors"
                data-testid="button-bpm-plus5">
                +5
              </button>
              <button onClick={() => changeBpm(1)}
                className="w-10 h-9 rounded-xl bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center hover:bg-purple-200 transition-colors"
                data-testid="button-bpm-plus1">
                +1
              </button>
            </div>
          </div>
        </div>

        {/* Beat indicator dots */}
        <div className="flex gap-3">
          {Array.from({ length: timeSig }).map((_, i) => (
            <motion.div key={i} className="rounded-full shadow-md" style={{
              width: i === 0 ? 44 : 36,
              height: i === 0 ? 44 : 36,
              background: currentBeat === i ? (i === 0 ? "#f59e0b" : "#a855f7") : "rgba(255,255,255,0.6)",
              border: i === 0 ? "3px solid #d97706" : "3px solid #d8b4fe",
              boxShadow: currentBeat === i ? `0 0 16px ${i === 0 ? "#fbbf24" : "#a855f7"}` : "none",
            }}
              animate={currentBeat === i ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }} />
          ))}
        </div>

        {/* BPM Slider */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl p-5 shadow-lg"
          style={{ border: "2px solid rgba(168,85,247,0.15)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-purple-400">{MIN_BPM}</span>
            <span className="text-sm font-extrabold text-purple-600">Hız Ayarı</span>
            <span className="text-xs font-extrabold text-purple-400">{MAX_BPM}</span>
          </div>
          <Slider min={MIN_BPM} max={MAX_BPM} step={1} value={[bpm]}
            onValueChange={([v]) => setBpm(v)} className="w-full" data-testid="slider-bpm" />
          <div className="flex justify-between mt-2 text-xs text-purple-300 font-semibold">
            <span>Yavaş</span><span>Orta</span><span>Hızlı</span>
          </div>
        </div>

        {/* Time Signature */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl p-4 shadow-lg"
          style={{ border: "2px solid rgba(168,85,247,0.15)" }}>
          <p className="text-xs font-extrabold text-purple-500 uppercase tracking-widest text-center mb-3">
            Vuruş Sayısı
          </p>
          <div className="flex gap-3 justify-center">
            {([2, 3, 4] as TimeSig[]).map(sig => (
              <button key={sig} data-testid={`button-timesig-${sig}`}
                onClick={() => { setTimeSig(sig); if (isPlaying) currentBeatRef.current = 0; }}
                className="font-black text-xl rounded-2xl transition-all"
                style={{
                  width: 60, height: 60,
                  background: timeSig === sig ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(255,255,255,0.8)",
                  color: timeSig === sig ? "white" : "#8b5cf6",
                  border: timeSig === sig ? "3px solid #7c3aed" : "3px solid #e9d5ff",
                  boxShadow: timeSig === sig ? "0 4px 16px rgba(168,85,247,0.4)" : "none",
                }}>
                {sig}/4
              </button>
            ))}
          </div>
        </div>

        {/* Start/Stop + Tap Tempo */}
        <div className="flex gap-4 w-full">
          <motion.button data-testid="button-tap-tempo"
            className="flex-1 rounded-3xl py-5 font-extrabold text-base shadow-lg"
            style={{ background: "linear-gradient(135deg, #f9a8d4, #ec4899)", border: "3px solid #be185d", color: "white" }}
            whileTap={{ scale: 0.93 }} onClick={handleTapTempo}>
            TAP 👆
          </motion.button>
          <motion.button data-testid="button-start-stop"
            className="flex-[2] rounded-3xl py-5 font-black text-xl shadow-xl"
            style={{
              background: isPlaying ? "linear-gradient(135deg, #f97316, #ef4444)" : "linear-gradient(135deg, #a855f7, #6366f1)",
              border: isPlaying ? "3px solid #b91c1c" : "3px solid #7c3aed",
              color: "white",
              boxShadow: isPlaying ? "0 6px 24px rgba(239,68,68,0.4)" : "0 6px 24px rgba(139,92,246,0.4)",
            }}
            whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }} onClick={toggle}>
            {isPlaying ? "⏹ Durdur" : "▶ Başlat"}
          </motion.button>
        </div>

        {/* Quick BPM presets */}
        <div className="w-full bg-white/60 rounded-3xl p-4 shadow"
          style={{ border: "2px solid rgba(168,85,247,0.1)" }}>
          <p className="text-xs font-extrabold text-purple-400 uppercase tracking-widest text-center mb-3">Hızlı Seçim</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Largo", bpm: 50 }, { label: "Andante", bpm: 80 },
              { label: "Moderato", bpm: 100 }, { label: "Allegro", bpm: 140 },
            ].map(p => (
              <button key={p.bpm} data-testid={`button-preset-${p.label.toLowerCase()}`}
                onClick={() => setBpm(p.bpm)}
                className="rounded-2xl py-2 px-1 text-center transition-all"
                style={{
                  background: bpm === p.bpm ? "linear-gradient(135deg,#a855f7,#6366f1)" : "white",
                  color: bpm === p.bpm ? "white" : "#7c3aed",
                  border: "2px solid #e9d5ff", fontSize: "0.65rem", fontWeight: 800,
                }}>
                <div style={{ fontSize: "1rem", fontWeight: 900 }}>{p.bpm}</div>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Rhythm Practice Pad ─────────────────────────────────────────────── */}
        <div className="w-full rounded-3xl overflow-hidden shadow-xl"
          style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", border: "3px solid rgba(139,92,246,0.5)" }}>

          {/* Header */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between">
            <div>
              <p className="text-white font-extrabold text-base">🥁 Ritim Uygulama Pedi</p>
              <p className="text-purple-300 text-xs font-semibold">
                {isPlaying ? "Metronom ile birlikte vur!" : "Önce metronomu başlat"}
              </p>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-1">
                {Array.from({ length: timeSig }).map((_, i) => (
                  <motion.div key={i}
                    animate={currentBeat === i ? { scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] } : { scale: 1, opacity: 0.3 }}
                    transition={{ duration: 0.12 }}
                    className="rounded-full"
                    style={{ width: i === 0 ? 10 : 8, height: i === 0 ? 10 : 8, background: i === 0 ? "#fbbf24" : "#a78bfa" }} />
                ))}
              </div>
            )}
          </div>

          {/* Rhythm Strip — shows current measure with beat lines + tap marks */}
          <div className="mx-4 mb-3 relative" style={{ height: 56 }}>
            {/* Background bar */}
            <div className="absolute inset-0 rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }} />

            {/* Beat division lines */}
            {Array.from({ length: timeSig + 1 }).map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0"
                style={{
                  left: `${(i / timeSig) * 100}%`,
                  width: i === 0 || i === timeSig ? 2 : 1,
                  background: i % timeSig === 0 ? "rgba(251,191,36,0.8)" : "rgba(167,139,250,0.4)",
                }} />
            ))}

            {/* Beat progress fill */}
            {isPlaying && (
              <motion.div className="absolute top-0 bottom-0 left-0 rounded-l-xl"
                style={{
                  width: `${((currentBeat + beatPhase) / timeSig) * 100}%`,
                  background: "linear-gradient(90deg, rgba(168,85,247,0.25), rgba(139,92,246,0.1))",
                  borderRight: "2px solid rgba(168,85,247,0.7)",
                  transition: "width 0.02s linear",
                }} />
            )}

            {/* Tap marks */}
            {tapMarks.slice(-timeSig * 3).map(m => {
              const leftPct = ((m.beatIdx + m.offsetRatio) / timeSig) * 100;
              return (
                <motion.div key={m.id}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 1, opacity: 0.85 }}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full"
                  style={{ left: `${leftPct}%`, width: 12, height: 12, background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
              );
            })}

            {/* Beat labels */}
            {Array.from({ length: timeSig }).map((_, i) => (
              <span key={i} className="absolute text-xs font-extrabold"
                style={{
                  left: `${(i / timeSig) * 100 + (0.5 / timeSig) * 100}%`,
                  transform: "translateX(-50%)",
                  bottom: 4,
                  color: currentBeat === i ? "#fbbf24" : "rgba(167,139,250,0.5)",
                  fontSize: 10,
                  fontWeight: 900,
                }}>
                {i + 1}
              </span>
            ))}
          </div>

          {/* Tap button */}
          <div className="px-4 pb-5 flex flex-col items-center gap-3">
            {/* Feedback */}
            <div className="h-8 flex items-center justify-center">
              <AnimatePresence>
                {lastResult && (
                  <motion.p key={lastResult.id}
                    initial={{ opacity: 0, y: -8, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.15 }}
                    className="text-base font-extrabold"
                    style={{ color: lastResult.color, textShadow: `0 0 12px ${lastResult.color}` }}>
                    {lastResult.label}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              onPointerDown={handleRhythmTap}
              disabled={!isPlaying}
              className="rounded-3xl font-black text-2xl shadow-2xl flex flex-col items-center justify-center gap-1"
              style={{
                width: 220,
                height: 90,
                background: tapFlash
                  ? "radial-gradient(circle, #fff 0%, #a855f7 60%)"
                  : isPlaying
                    ? "linear-gradient(135deg, #7c3aed, #4338ca)"
                    : "rgba(255,255,255,0.08)",
                border: tapFlash ? "3px solid #fff" : `3px solid ${isPlaying ? "#a855f7" : "rgba(255,255,255,0.1)"}`,
                color: isPlaying ? "white" : "rgba(255,255,255,0.3)",
                boxShadow: tapFlash ? "0 0 40px #a855f7, 0 0 12px #fff" : isPlaying ? "0 8px 32px rgba(124,58,237,0.5)" : "none",
                transition: "all 0.07s",
                opacity: isPlaying ? 1 : 0.5,
              }}
              whileTap={isPlaying ? { scale: 0.88 } : {}}
              data-testid="button-rhythm-tap"
            >
              <span>{tapFlash ? "💥" : "🥁"}</span>
              <span className="text-sm font-extrabold tracking-wide">
                {isPlaying ? "DOKUN!" : "Metronom kapalı"}
              </span>
            </motion.button>

            <p className="text-purple-400 text-xs font-semibold">
              {isPlaying ? "SPACE tuşu da kullanılabilir" : "▶ Başlat butonuna bas"}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
