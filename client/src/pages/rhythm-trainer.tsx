import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Volume2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

// ─── Audio helpers ────────────────────────────────────────────────────────────
function createClick(ctx: AudioContext, accent: boolean, when: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.value = accent ? 1800 : 1100;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.55 : 0.32, when + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, when + (accent ? 0.055 : 0.04));
  osc.start(when);
  osc.stop(when + 0.07);
}

// ─── Pattern definitions ──────────────────────────────────────────────────────
// 16 slots = one 4/4 bar divided into 16th notes
// true = hit, false = rest/silence
const PATTERNS: Record<number, { slots: boolean[]; label: string }[]> = {
  1: [
    { label: "Dörtlük Notalar",   slots: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean) },
    { label: "Üç Dörtlük",        slots: [1,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0].map(Boolean) },
    { label: "İlk ve Son",        slots: [1,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean) },
  ],
  2: [
    { label: "Dörtlük + Sekizlik", slots: [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,0,0].map(Boolean) },
    { label: "Çift Sekizlik",      slots: [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0].map(Boolean) },
    { label: "Son Sekizlik",       slots: [1,0,0,0, 1,0,0,0, 1,0,1,0, 1,0,1,0].map(Boolean) },
  ],
  3: [
    { label: "Dinleme + Vuruş",    slots: [1,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,0,0].map(Boolean) },
    { label: "Ortada Sessizlik",   slots: [1,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0].map(Boolean) },
    { label: "Sekizlik + Sessiz",  slots: [1,0,1,0, 0,0,0,0, 1,0,1,0, 1,0,0,0].map(Boolean) },
  ],
  4: [
    { label: "Senkop 1",  slots: [0,0,1,0, 1,0,0,0, 0,0,1,0, 1,0,0,0].map(Boolean) },
    { label: "Senkop 2",  slots: [1,0,0,0, 0,0,1,0, 0,0,1,0, 1,0,0,0].map(Boolean) },
    { label: "Senkop 3",  slots: [0,0,1,0, 0,0,1,0, 1,0,0,0, 0,0,1,0].map(Boolean) },
  ],
};

// ─── Level config ─────────────────────────────────────────────────────────────
const LEVEL_INFO: Record<number, { name: string; color: string; bg: string; desc: string }> = {
  1: { name: "Seviye 1", color: "#22c55e", bg: "#dcfce7", desc: "Dörtlük Notalar" },
  2: { name: "Seviye 2", color: "#3b82f6", bg: "#dbeafe", desc: "Sekizlik Notalar" },
  3: { name: "Seviye 3", color: "#a855f7", bg: "#f3e8ff", desc: "Sessizlikler" },
  4: { name: "Seviye 4", color: "#ef4444", bg: "#fee2e2", desc: "Senkopasyon" },
};

const TOLERANCE_PERFECT = 80;   // ms
const TOLERANCE_GOOD = 160;     // ms
const TOLERANCE_MISS = 280;     // ms

type Phase = "idle" | "listen" | "countdown" | "tap" | "result";
type HitResult = "perfect" | "good" | "late" | "early" | "miss";

const HIT_COLORS: Record<HitResult, string> = {
  perfect: "#22c55e",
  good:    "#3b82f6",
  late:    "#f97316",
  early:   "#f59e0b",
  miss:    "#ef4444",
};
const HIT_LABELS: Record<HitResult, string> = {
  perfect: "Mükemmel! ✨",
  good:    "İyi! 👍",
  late:    "Geç 🐢",
  early:   "Erken 🐇",
  miss:    "Kaçırdın ❌",
};

function scoreHit(expected: number, actual: number | null): HitResult {
  if (actual === null) return "miss";
  const diff = actual - expected;
  if (Math.abs(diff) <= TOLERANCE_PERFECT) return "perfect";
  if (Math.abs(diff) <= TOLERANCE_GOOD) return "good";
  if (diff > 0) return "late";
  return "early";
}

export default function RhythmTrainer() {
  const { student } = useAuth();

  // BPM — try reading from shared localStorage key (set by metronome if active)
  const savedBpm = parseInt(localStorage.getItem("notebeat_bpm") || "90", 10);
  const [bpm, setBpm] = useState<number>(Math.min(Math.max(savedBpm, 40), 208));
  const [level, setLevel] = useState(1);
  const [unlockedLevel, setUnlockedLevel] = useState(1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [currentSlot, setCurrentSlot] = useState(-1);
  const [patternIdx, setPatternIdx] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const [hitResults, setHitResults] = useState<HitResult[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [stars, setStars] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [totalStarsEarned, setTotalStarsEarned] = useState(0);
  const [sessionStart] = useState(Date.now());
  const [tapFlash, setTapFlash] = useState(false);
  const [countdownBeat, setCountdownBeat] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const phaseStartTimeRef = useRef<number>(0);
  const tapsRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pattern = PATTERNS[level][patternIdx];
  const slotDuration = (60 / bpm / 4) * 1000; // ms per 16th note slot
  const barDuration = slotDuration * 16;        // ms per bar

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const cleanup = () => {
    if (slotTimerRef.current) clearInterval(slotTimerRef.current);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    setCurrentSlot(-1);
    setCountdownBeat(-1);
  };

  // ─── Expected tap times (ms from phase start) for hits in pattern ─────────
  const expectedTapTimes = pattern.slots
    .map((hit, i) => hit ? i * slotDuration : null)
    .filter((t): t is number => t !== null);

  // ─── Play pattern ────────────────────────────────────────────────────────────
  const playPattern = useCallback((ctx: AudioContext, startAt: number, onSlotChange?: (slot: number) => void) => {
    pattern.slots.forEach((hit, i) => {
      const t = startAt + (i * slotDuration / 1000);
      if (hit) createClick(ctx, i % 4 === 0, t);
    });
    let slot = 0;
    const iv = setInterval(() => {
      onSlotChange?.(slot);
      slot++;
      if (slot >= 16) clearInterval(iv);
    }, slotDuration);
    slotTimerRef.current = iv;
  }, [pattern, slotDuration]);

  // ─── Start listen phase ──────────────────────────────────────────────────────
  const startListen = () => {
    cleanup();
    setPhase("listen");
    setTaps([]);
    tapsRef.current = [];
    setHitResults([]);
    const ctx = getAudioCtx();
    const startAt = ctx.currentTime + 0.1;
    playPattern(ctx, startAt, (slot) => setCurrentSlot(slot));
    tapTimeoutRef.current = setTimeout(() => {
      setCurrentSlot(-1);
      startCountdown();
    }, barDuration + 200);
  };

  // ─── Countdown ───────────────────────────────────────────────────────────────
  const startCountdown = () => {
    setPhase("countdown");
    const ctx = getAudioCtx();
    const startAt = ctx.currentTime + 0.1;
    for (let i = 0; i < 4; i++) {
      const t = startAt + i * (60 / bpm);
      createClick(ctx, i === 0, t);
    }
    let beat = 0;
    const iv = setInterval(() => {
      setCountdownBeat(beat + 1);
      beat++;
      if (beat >= 4) {
        clearInterval(iv);
        setCountdownBeat(-1);
        startTapPhase();
      }
    }, (60 / bpm) * 1000);
    slotTimerRef.current = iv as unknown as ReturnType<typeof setInterval>;
  };

  // ─── Tap phase ───────────────────────────────────────────────────────────────
  const startTapPhase = () => {
    setPhase("tap");
    setCurrentSlot(-1);
    tapsRef.current = [];
    setTaps([]);
    phaseStartTimeRef.current = Date.now();
    // Auto-end after bar + buffer
    tapTimeoutRef.current = setTimeout(() => {
      endTapPhase();
    }, barDuration + 500);
  };

  // ─── End & score ─────────────────────────────────────────────────────────────
  const endTapPhase = useCallback(() => {
    cleanup();
    const tapList = tapsRef.current.slice();
    const usedTaps = new Set<number>();

    const results: HitResult[] = expectedTapTimes.map((expected) => {
      let best: number | null = null;
      let bestDiff = Infinity;
      tapList.forEach((t, i) => {
        if (usedTaps.has(i)) return;
        const d = Math.abs(t - expected);
        if (d < bestDiff) { bestDiff = d; best = i; }
      });
      if (best !== null && bestDiff <= TOLERANCE_MISS) {
        usedTaps.add(best);
        const actual = tapList[best];
        return scoreHit(expected, actual);
      }
      return "miss";
    });

    const scored = results.filter(r => r !== "miss").length;
    const perfectGood = results.filter(r => r === "perfect" || r === "good").length;
    const acc = Math.round((perfectGood / Math.max(expectedTapTimes.length, 1)) * 100);
    const s = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 50 ? 1 : 0;

    setHitResults(results);
    setAccuracy(acc);
    setStars(s);
    setPhase("result");

    const newAttempt = attemptCount + 1;
    const newSuccess = acc >= 70 ? successCount + 1 : successCount;
    const newStarsTotal = totalStarsEarned + s;
    setAttemptCount(newAttempt);
    setSuccessCount(newSuccess);
    setTotalStarsEarned(newStarsTotal);

    // Unlock next level after 2 successes
    if (newSuccess >= 2 && level < 4) {
      setUnlockedLevel(Math.max(unlockedLevel, level + 1));
    }

    // Save progress
    if (student) {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      apiRequest("POST", `/api/student/${student.student.id}/progress`, {
        appType: "rhythm_trainer",
        level: Math.max(unlockedLevel, level),
        starsEarned: newStarsTotal,
        correctAnswers: newSuccess,
        wrongAnswers: newAttempt - newSuccess,
        timeSpentSeconds: elapsed,
      }).catch(() => {});
    }
  }, [expectedTapTimes, attemptCount, successCount, totalStarsEarned, level, unlockedLevel, student, sessionStart]);

  // ─── Handle tap ──────────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== "tap") return;
    const t = Date.now() - phaseStartTimeRef.current;
    tapsRef.current = [...tapsRef.current, t];
    setTaps(prev => [...prev, t]);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
    // Play a soft tap sound
    const ctx = getAudioCtx();
    createClick(ctx, false, ctx.currentTime);
  }, [phase]);

  // ─── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (phase === "idle" || phase === "result") return;
        handleTap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, handleTap]);

  useEffect(() => () => cleanup(), []);

  // ─── Pick random pattern ─────────────────────────────────────────────────────
  const pickPattern = (lvl: number) => {
    const idx = Math.floor(Math.random() * PATTERNS[lvl].length);
    setPatternIdx(idx);
    return idx;
  };

  const handleStart = () => {
    pickPattern(level);
    setAttemptCount(0);
    setSuccessCount(0);
    setTotalStarsEarned(0);
    startListen();
  };

  const handleNextAttempt = () => {
    const idx = Math.floor(Math.random() * PATTERNS[level].length);
    setPatternIdx(idx);
    setTimeout(() => startListen(), 100);
    setPhase("idle");
  };

  const lv = LEVEL_INFO[level];

  // ─── Pattern grid ─────────────────────────────────────────────────────────────
  const renderGrid = (highlightSlot = -1, hitRes?: HitResult[]) => {
    let hitIdx = 0;
    return (
      <div className="flex gap-1 justify-center flex-wrap">
        {pattern.slots.map((hit, i) => {
          const isBeat = i % 4 === 0;
          const isHighlighted = i === highlightSlot;
          const res = hit && hitRes ? hitRes[hitIdx++] : null;
          return (
            <motion.div
              key={i}
              className="rounded-lg flex items-center justify-center text-lg font-extrabold"
              style={{
                width: 36, height: 36,
                background: isHighlighted
                  ? lv.color
                  : res
                  ? HIT_COLORS[res] + "44"
                  : hit
                  ? (isBeat ? lv.bg : "#f0fdf4")
                  : "#f1f5f9",
                border: `2px solid ${isHighlighted ? lv.color : hit ? lv.color + "66" : "#e2e8f0"}`,
                color: isHighlighted ? "#fff" : hit ? lv.color : "#94a3b8",
                transform: isHighlighted ? "scale(1.15)" : "scale(1)",
                transition: "all 0.08s",
              }}
              animate={isHighlighted ? { scale: 1.15 } : { scale: 1 }}
            >
              {hit ? (isBeat ? "♩" : "♪") : (i % 4 === 0 ? "·" : "·")}
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #fef9c3 0%, #dcfce7 50%, #dbeafe 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2">
        <button
          onClick={() => { cleanup(); window.history.back(); }}
          className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shadow"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-extrabold text-xl text-gray-800 leading-tight">Ritim Antrenörü 🥁</h1>
          <p className="text-xs text-gray-500 font-semibold">Dinle ve tekrarla!</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-yellow-500 font-extrabold text-sm bg-white/70 rounded-xl px-3 py-1.5 shadow">
          ⭐ {totalStarsEarned}
        </div>
      </div>

      {/* Level selector */}
      <div className="px-4 flex gap-2 mt-2">
        {[1, 2, 3, 4].map(lvl => {
          const info = LEVEL_INFO[lvl];
          const locked = lvl > unlockedLevel;
          return (
            <button
              key={lvl}
              disabled={locked || phase !== "idle" && phase !== "result"}
              onClick={() => { setLevel(lvl); setAttemptCount(0); setSuccessCount(0); }}
              className="flex-1 rounded-xl py-2 text-xs font-extrabold transition-all"
              style={{
                background: level === lvl ? info.color : locked ? "#e2e8f0" : info.bg,
                color: level === lvl ? "#fff" : locked ? "#94a3b8" : info.color,
                border: `2px solid ${level === lvl ? info.color : "transparent"}`,
                opacity: locked ? 0.5 : 1,
              }}
              data-testid={`button-level-${lvl}`}
            >
              {locked ? "🔒" : `S${lvl}`}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-bold mt-1 mb-3" style={{ color: lv.color }}>{lv.desc}</p>

      {/* BPM control */}
      <div className="px-6 mb-4">
        <div className="bg-white/70 rounded-2xl p-3 shadow flex items-center gap-3">
          <Volume2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            type="range"
            min={40} max={208}
            value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            disabled={phase !== "idle" && phase !== "result"}
            className="flex-1 accent-indigo-500"
            data-testid="input-bpm"
          />
          <span className="font-extrabold text-sm text-gray-700 w-16 text-right">{bpm} BPM</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 pb-8 gap-5">
        {/* Pattern grid */}
        <div className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-lg w-full max-w-md">
          <p className="text-xs font-bold text-center text-gray-400 uppercase tracking-widest mb-3">
            {pattern.label}
          </p>
          {renderGrid(
            phase === "listen" ? currentSlot : -1,
            phase === "result" ? hitResults : undefined
          )}
          {/* Beat labels */}
          <div className="flex justify-between mt-2 px-1">
            {[1, 2, 3, 4].map(b => (
              <span key={b} className="text-xs font-bold text-gray-400" style={{ width: 36, textAlign: "center" }}>{b}</span>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        {successCount > 0 && (
          <div className="w-full max-w-md bg-white/70 rounded-xl p-3 shadow">
            <p className="text-xs font-bold text-gray-500 mb-1">Seviye İlerlemesi: {successCount}/2 başarı</p>
            <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(successCount / 2) * 100}%`, background: lv.color }}
              />
            </div>
          </div>
        )}

        {/* Phase content */}
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-4 w-full max-w-md"
            >
              <button
                onClick={handleStart}
                className="w-40 h-40 rounded-full shadow-2xl flex flex-col items-center justify-center gap-2 text-white font-extrabold text-xl transition-all active:scale-95"
                style={{ background: `linear-gradient(135deg, ${lv.color}, ${lv.color}bb)` }}
                data-testid="button-start"
              >
                <Play className="w-10 h-10" />
                BAŞLA
              </button>
              <p className="text-sm text-gray-500 font-semibold text-center">
                Ritmi dinle, sonra tekrarla
              </p>
            </motion.div>
          )}

          {phase === "listen" && (
            <motion.div
              key="listen"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                className="w-28 h-28 rounded-full flex items-center justify-center"
                style={{ background: lv.bg, border: `4px solid ${lv.color}` }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 60 / bpm, repeat: Infinity }}
              >
                <span className="text-5xl">👂</span>
              </motion.div>
              <p className="font-extrabold text-lg" style={{ color: lv.color }}>Dinliyorsun...</p>
              <p className="text-sm text-gray-500">Ritmi dikkatle dinle!</p>
            </motion.div>
          )}

          {phase === "countdown" && (
            <motion.div
              key="countdown"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="font-extrabold text-lg text-gray-700">Hazır mısın?</p>
              <div className="flex gap-3">
                {[1, 2, 3, 4].map(b => (
                  <motion.div
                    key={b}
                    className="w-12 h-12 rounded-full flex items-center justify-center font-extrabold text-xl"
                    style={{
                      background: countdownBeat === b ? lv.color : lv.bg,
                      color: countdownBeat === b ? "#fff" : lv.color,
                      border: `2px solid ${lv.color}`,
                    }}
                    animate={countdownBeat === b ? { scale: 1.25 } : { scale: 1 }}
                    transition={{ duration: 0.1 }}
                  >
                    {b}
                  </motion.div>
                ))}
              </div>
              <p className="text-sm text-gray-500 font-semibold">Sayım bitince tıkla!</p>
            </motion.div>
          )}

          {phase === "tap" && (
            <motion.div
              key="tap"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <motion.button
                onPointerDown={handleTap}
                className="w-44 h-44 rounded-full shadow-2xl flex flex-col items-center justify-center gap-2 text-white font-extrabold text-xl select-none"
                style={{
                  background: tapFlash
                    ? `linear-gradient(135deg, #fff, ${lv.color}66)`
                    : `linear-gradient(135deg, ${lv.color}, ${lv.color}cc)`,
                  border: `4px solid ${tapFlash ? "#fff" : "rgba(255,255,255,0.3)"}`,
                  boxShadow: tapFlash ? `0 0 40px ${lv.color}88` : "0 8px 32px rgba(0,0,0,0.2)",
                  transition: "all 0.08s",
                }}
                whileTap={{ scale: 0.92 }}
                data-testid="button-tap"
              >
                <span className="text-5xl">{tapFlash ? "💥" : "🥁"}</span>
                <span style={{ color: tapFlash ? lv.color : "white" }}>VURU!</span>
              </motion.button>
              <div className="flex gap-2 flex-wrap justify-center">
                {taps.map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full"
                    style={{ background: lv.color }}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500 font-semibold">Ekrana dokun veya SPACE tuşuna bas</p>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 w-full max-w-md"
            >
              {/* Star display */}
              <div className="flex gap-2">
                {[1, 2, 3].map(s => (
                  <motion.span
                    key={s}
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: s * 0.15 }}
                    className="text-4xl"
                  >
                    {stars >= s ? "⭐" : "☆"}
                  </motion.span>
                ))}
              </div>

              {/* Accuracy */}
              <div
                className="rounded-2xl px-8 py-4 text-center shadow"
                style={{ background: lv.bg, border: `2px solid ${lv.color}33` }}
              >
                <p className="text-4xl font-extrabold" style={{ color: lv.color }}>%{accuracy}</p>
                <p className="text-sm font-bold text-gray-600">doğruluk</p>
              </div>

              {/* Friendly message */}
              <p className="font-extrabold text-lg text-gray-700 text-center">
                {accuracy >= 90 ? "🎉 Harika Ritim!" : accuracy >= 70 ? "👏 Güzel Zamanlama!" : accuracy >= 50 ? "💪 Biraz Daha Pratik!" : "🔄 Tekrar Dene!"}
              </p>

              {/* Hit results */}
              <div className="w-full bg-white/80 rounded-2xl p-4 shadow flex flex-wrap gap-2 justify-center">
                {hitResults.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ background: HIT_COLORS[r] }}
                  >
                    {HIT_LABELS[r]}
                  </div>
                ))}
              </div>

              {/* Progress info */}
              <p className="text-xs text-gray-500 font-semibold">
                {successCount >= 2 && level < 4
                  ? `🔓 ${LEVEL_INFO[level + 1].name} açıldı!`
                  : successCount >= 2 && level === 4
                  ? "🏆 Tüm seviyeleri tamamladın!"
                  : `${successCount}/2 başarı — ${2 - successCount} tane daha başar`}
              </p>

              {/* Buttons */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleNextAttempt}
                  className="flex-1 py-3 rounded-xl font-extrabold text-white shadow-lg"
                  style={{ background: lv.color }}
                  data-testid="button-retry"
                >
                  🔄 Tekrar
                </button>
                {successCount >= 2 && level < 4 && (
                  <button
                    onClick={() => { setLevel(level + 1); setAttemptCount(0); setSuccessCount(0); setPhase("idle"); }}
                    className="flex-1 py-3 rounded-xl font-extrabold text-white shadow-lg"
                    style={{ background: LEVEL_INFO[level + 1].color }}
                    data-testid="button-next-level"
                  >
                    ➡️ Sonraki Seviye
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
