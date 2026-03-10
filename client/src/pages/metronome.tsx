import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useAnimation } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const MIN_BPM = 40;
const MAX_BPM = 208;
const SCHEDULE_AHEAD = 0.12;   // seconds to look ahead
const TICK_INTERVAL = 25;       // ms scheduler interval

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

export default function Metronome() {
  const goBack = () => window.history.back();

  const [bpm, setBpm] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeSig, setTimeSig] = useState<TimeSig>(4);
  const [currentBeat, setCurrentBeat] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextNoteRef = useRef(0);
  const currentBeatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const timeSigRef = useRef(timeSig);
  const isPlayingRef = useRef(false);
  const tapTimesRef = useRef<number[]>([]);
  const pendulumControls = useAnimation();

  // Keep refs in sync
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { timeSigRef.current = timeSig; }, [timeSig]);

  // Pendulum animation — updates smoothly when BPM or playing state changes
  useEffect(() => {
    if (isPlaying) {
      const beatDuration = 60 / bpm;
      pendulumControls.start({
        rotate: ["-30deg", "30deg"],
        transition: {
          duration: beatDuration,
          ease: "easeInOut",
          repeat: Infinity,
          repeatType: "reverse",
        },
      });
    } else {
      pendulumControls.start({
        rotate: "0deg",
        transition: { duration: 0.4, ease: "easeOut" },
      });
    }
  }, [isPlaying, bpm, pendulumControls]);

  const scheduleBeats = useCallback(() => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    while (nextNoteRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const beat = currentBeatRef.current;
      const when = nextNoteRef.current;
      createClick(ctx, beat === 0, when);

      // Schedule visual beat update
      const delay = Math.max(0, (when - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (isPlayingRef.current) setCurrentBeat(beat);
      }, delay);

      const spb = 60 / bpmRef.current;
      nextNoteRef.current += spb;
      currentBeatRef.current = (beat + 1) % timeSigRef.current;
    }
  }, []);

  const start = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    currentBeatRef.current = 0;
    nextNoteRef.current = audioCtxRef.current.currentTime + 0.05;
    isPlayingRef.current = true;
    setIsPlaying(true);
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
  }, []);

  const toggle = useCallback(() => {
    if (isPlayingRef.current) stop(); else start();
  }, [start, stop]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (schedulerRef.current) clearInterval(schedulerRef.current);
    audioCtxRef.current?.close();
  }, []);

  // Tap tempo
  const handleTap = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    // Remove taps older than 3 seconds
    const recent = taps.filter(t => now - t < 3000);
    recent.push(now);
    tapTimesRef.current = recent;

    if (recent.length >= 2) {
      const intervals = recent.slice(1).map((t, i) => t - recent[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const detected = Math.round(60000 / avg);
      const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, detected));
      setBpm(clamped);
    }
  }, []);

  const tempoLabel = (b: number) => {
    if (b < 60) return "Largo";
    if (b < 76) return "Adagio";
    if (b < 108) return "Andante";
    if (b < 120) return "Moderato";
    if (b < 156) return "Allegro";
    if (b < 176) return "Vivace";
    return "Presto";
  };

  return (
    <div
      className="min-h-screen select-none"
      style={{ background: "linear-gradient(160deg, #e8d5ff 0%, #d4e8ff 50%, #ffd6e8 100%)" }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur border-b">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="gap-1.5 rounded-xl font-bold"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <h1 className="text-xl font-extrabold text-purple-700">🎵 Metronom</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-6">

        {/* Pendulum Visual */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl shadow-xl p-6 flex flex-col items-center gap-2"
          style={{ border: "3px solid rgba(168,85,247,0.2)" }}
        >
          {/* Pendulum container */}
          <div className="relative flex flex-col items-center" style={{ height: 180 }}>
            {/* Pivot point */}
            <div className="w-5 h-5 rounded-full bg-yellow-400 border-4 border-yellow-600 shadow-md z-10" />
            {/* Pendulum rod + bob */}
            <motion.div
              animate={pendulumControls}
              style={{ originX: "50%", originY: "0%", transformOrigin: "top center" }}
              className="absolute top-0 flex flex-col items-center"
            >
              {/* Rod */}
              <div
                className="w-2 rounded-full"
                style={{
                  height: 130,
                  background: "linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)",
                  boxShadow: "0 2px 8px rgba(124,58,237,0.3)",
                }}
              />
              {/* Bob */}
              <motion.div
                className="w-10 h-10 rounded-full -mt-1 shadow-lg flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #f9a8d4 0%, #ec4899 100%)",
                  border: "3px solid #be185d",
                }}
                animate={isPlaying ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={{ duration: 60 / bpm, repeat: Infinity }}
              />
            </motion.div>

            {/* Beat flash arcs */}
            <div className="absolute bottom-0 w-48 h-24 rounded-t-full border-4 border-purple-200 opacity-40"
              style={{ left: "50%", transform: "translateX(-50%)" }}
            />
          </div>

          {/* BPM Display */}
          <motion.div
            className="text-center"
            animate={currentBeat === 0 ? { scale: [1, 1.08, 1] } : {}}
            transition={{ duration: 0.1 }}
          >
            <div
              className="text-7xl font-black tabular-nums"
              style={{ color: isPlaying ? "#7c3aed" : "#a78bfa" }}
              data-testid="text-bpm"
            >
              {bpm}
            </div>
            <div className="text-sm font-extrabold text-purple-400 uppercase tracking-widest">BPM</div>
            <div className="text-xs font-bold text-pink-400 mt-1">{tempoLabel(bpm)}</div>
          </motion.div>
        </div>

        {/* Beat Indicators */}
        <div className="flex gap-3">
          {Array.from({ length: timeSig }).map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full shadow-md"
              style={{
                width: i === 0 ? 44 : 36,
                height: i === 0 ? 44 : 36,
                background: currentBeat === i
                  ? (i === 0 ? "#f59e0b" : "#a855f7")
                  : "rgba(255,255,255,0.6)",
                border: i === 0
                  ? "3px solid #d97706"
                  : "3px solid #d8b4fe",
                boxShadow: currentBeat === i
                  ? `0 0 16px ${i === 0 ? "#fbbf24" : "#a855f7"}`
                  : "none",
              }}
              animate={currentBeat === i ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>

        {/* BPM Slider */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl p-5 shadow-lg"
          style={{ border: "2px solid rgba(168,85,247,0.15)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-purple-400">{MIN_BPM} BPM</span>
            <span className="text-sm font-extrabold text-purple-600">Hız Ayarı</span>
            <span className="text-xs font-extrabold text-purple-400">{MAX_BPM} BPM</span>
          </div>
          <Slider
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={[bpm]}
            onValueChange={([v]) => setBpm(v)}
            className="w-full"
            data-testid="slider-bpm"
          />
          <div className="flex justify-between mt-2 text-xs text-purple-300 font-semibold">
            <span>Yavaş</span>
            <span>Orta</span>
            <span>Hızlı</span>
          </div>
        </div>

        {/* Time Signature */}
        <div className="w-full bg-white/70 backdrop-blur rounded-3xl p-4 shadow-lg"
          style={{ border: "2px solid rgba(168,85,247,0.15)" }}
        >
          <p className="text-xs font-extrabold text-purple-500 uppercase tracking-widest text-center mb-3">
            Vuruş Sayısı
          </p>
          <div className="flex gap-3 justify-center">
            {([2, 3, 4] as TimeSig[]).map(sig => (
              <button
                key={sig}
                data-testid={`button-timesig-${sig}`}
                onClick={() => {
                  setTimeSig(sig);
                  if (isPlaying) {
                    currentBeatRef.current = 0;
                  }
                }}
                className="font-black text-xl rounded-2xl transition-all"
                style={{
                  width: 60,
                  height: 60,
                  background: timeSig === sig
                    ? "linear-gradient(135deg, #a855f7, #6366f1)"
                    : "rgba(255,255,255,0.8)",
                  color: timeSig === sig ? "white" : "#8b5cf6",
                  border: timeSig === sig ? "3px solid #7c3aed" : "3px solid #e9d5ff",
                  boxShadow: timeSig === sig ? "0 4px 16px rgba(168,85,247,0.4)" : "none",
                }}
              >
                {sig}/4
              </button>
            ))}
          </div>
        </div>

        {/* Start/Stop + Tap Tempo */}
        <div className="flex gap-4 w-full">
          {/* Tap Tempo */}
          <motion.button
            data-testid="button-tap-tempo"
            className="flex-1 rounded-3xl py-5 font-extrabold text-base shadow-lg"
            style={{
              background: "linear-gradient(135deg, #f9a8d4, #ec4899)",
              border: "3px solid #be185d",
              color: "white",
            }}
            whileTap={{ scale: 0.93 }}
            onClick={handleTap}
          >
            TAP 👆
          </motion.button>

          {/* Start / Stop */}
          <motion.button
            data-testid="button-start-stop"
            className="flex-[2] rounded-3xl py-5 font-black text-xl shadow-xl"
            style={{
              background: isPlaying
                ? "linear-gradient(135deg, #f97316, #ef4444)"
                : "linear-gradient(135deg, #a855f7, #6366f1)",
              border: isPlaying ? "3px solid #b91c1c" : "3px solid #7c3aed",
              color: "white",
              boxShadow: isPlaying
                ? "0 6px 24px rgba(239,68,68,0.4)"
                : "0 6px 24px rgba(139,92,246,0.4)",
            }}
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={toggle}
          >
            {isPlaying ? "⏹ Durdur" : "▶ Başlat"}
          </motion.button>
        </div>

        {/* Quick BPM presets */}
        <div className="w-full bg-white/60 rounded-3xl p-4 shadow"
          style={{ border: "2px solid rgba(168,85,247,0.1)" }}
        >
          <p className="text-xs font-extrabold text-purple-400 uppercase tracking-widest text-center mb-3">
            Hızlı Seçim
          </p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Largo", bpm: 50 },
              { label: "Andante", bpm: 80 },
              { label: "Moderato", bpm: 100 },
              { label: "Allegro", bpm: 140 },
            ].map(p => (
              <button
                key={p.bpm}
                data-testid={`button-preset-${p.label.toLowerCase()}`}
                onClick={() => setBpm(p.bpm)}
                className="rounded-2xl py-2 px-1 text-center transition-all"
                style={{
                  background: bpm === p.bpm ? "linear-gradient(135deg,#a855f7,#6366f1)" : "white",
                  color: bpm === p.bpm ? "white" : "#7c3aed",
                  border: "2px solid #e9d5ff",
                  fontSize: "0.65rem",
                  fontWeight: 800,
                }}
              >
                <div style={{ fontSize: "1rem", fontWeight: 900 }}>{p.bpm}</div>
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
