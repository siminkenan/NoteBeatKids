import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { StudentProgress } from "@shared/schema";

// ── WebAudio Piano ────────────────────────────────────────────────────────────
let _ctx: AudioContext | null = null;
function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

const FREQ: Record<string, number> = {
  C: 261.63, D: 293.66, E: 329.63, F: 349.23,
  G: 392.00, A: 440.00, B: 493.88, C5: 523.25,
};

function playNote(note: string, dur = 1.0) {
  const ctx = getCtx();
  const freq = FREQ[note];
  if (!freq) return;
  const t = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0, t);
  masterGain.gain.linearRampToValueAtTime(0.5, t + 0.012);
  masterGain.gain.exponentialRampToValueAtTime(0.22, t + 0.18);
  masterGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  [1, 2, 3, 4].forEach((h, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.value = freq * h;
    g.gain.value = [0.6, 0.25, 0.1, 0.05][i];
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur);
  });
}

function playSuccess() {
  ["E","G","C5"].forEach((n, i) => setTimeout(() => playNote(n, 0.4), i * 150));
}
function playError() {
  const ctx = getCtx(); const t = ctx.currentTime;
  const osc = ctx.createOscillator(); const g = ctx.createGain();
  osc.type = "sawtooth"; osc.frequency.value = 140;
  g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.4);
}

// ── Melody database ───────────────────────────────────────────────────────────
const STAGE1: string[][] = [
  ["C","D","E"],["E","D","C"],["C","E","D"],["D","C","E"],["E","C","D"],
  ["C","C","D"],["D","D","C"],["E","E","D"],["C","D","D"],["D","E","E"],
  ["E","D","D"],["C","E","E"],["D","C","C"],["E","C","C"],["D","E","C"],
  ["E","E","C"],["D","D","E"],["C","C","E"],["E","D","E"],["C","E","C"],
  ["D","C","D"],["E","C","E"],["C","D","C"],["D","E","D"],["E","E","E"],
];
// Bölüm 2: C D E F G (5 nota)
const STAGE2: string[][] = [
  ["C","D","E","G"],["G","E","D","C"],["C","F","G","E"],["D","G","F","C"],["E","C","G","D"],
  ["G","D","C","F"],["C","E","G","F"],["F","G","D","C"],["G","C","F","E"],["D","E","G","C"],
  ["F","C","D","G"],["E","D","G","C"],["C","C","D","G"],["G","G","E","D"],["D","D","C","G"],
  ["E","E","G","C"],["C","G","G","D"],["D","C","E","G"],["G","E","C","D"],["E","G","C","D"],
  ["C","D","C","G"],["G","D","G","C"],["D","G","D","E"],["E","C","E","G"],["C","G","C","D"],
];
// Bölüm 3: C D E F G A B (7 nota)
const STAGE3: string[][] = [
  ["C","D","E","G","A"],["A","G","E","D","C"],["C","E","G","A","E"],["G","E","C","A","G"],["C","D","E","D","C"],
  ["B","A","G","E","D"],["C","B","E","C","G"],["D","E","F","G","A"],["G","E","C","D","A"],["C","D","F","G","B"],
  ["E","F","G","A","G"],["B","G","F","E","D"],["C","C","D","E","G"],["D","E","A","E","D"],["G","F","G","B","C"],
  ["C","E","D","F","G"],["G","A","D","C","D"],["E","G","A","E","D"],["C","F","G","A","C"],["D","F","E","G","B"],
  ["B","C","D","E","F"],["C","G","F","A","D"],["E","D","C","D","E"],["G","F","E","A","E"],["C","D","G","B","C"],
];
// Bölüm 4: C D E F G A B C5 (tam oktav, 6 nota)
const STAGE4: string[][] = [
  ["C","E","G","A","C5","G"],["C5","G","E","C","D","E"],["C","D","E","G","A","C5"],["G","A","C5","A","G","E"],["E","G","A","B","C5","A"],
  ["C","G","E","G","C5","E"],["D","F","A","G","E","D"],["G","E","D","C","B","A"],["C","E","D","E","G","C5"],["E","C","E","G","B","C5"],
  ["G","E","C","G","E","C5"],["C","D","E","G","C5","G"],["E","D","C","E","G","A"],["G","C5","E","C","G","E"],["C","G","C5","E","G","A"],
  ["D","E","F","G","A","B"],["E","F","G","A","B","C5"],["G","F","E","F","G","A"],["C","E","F","G","A","C5"],["E","G","F","A","E","C"],
  ["C","D","E","F","G","A"],["G","F","E","D","C","B"],["C","E","G","A","B","C5"],["D","E","G","B","C5","G"],["C","G","A","B","C5","A"],
];
const ALL_MELODIES = [...STAGE1, ...STAGE2, ...STAGE3, ...STAGE4];

const STAGE_POOLS = [
  ["C","D","E"],
  ["C","D","E","F","G"],
  ["C","D","E","F","G","A","B"],
  ["C","D","E","F","G","A","B","C5"],
];
function getMelody(idx: number): string[] {
  const base = idx % 100;
  const m = ALL_MELODIES[base];
  if (idx < 100) return m;
  const shift = Math.floor(idx / 100);
  const stageIdx = Math.floor(base / 25);
  const pool = STAGE_POOLS[stageIdx];
  return m.map(n => { const i = pool.indexOf(n); return i >= 0 ? pool[(i + shift) % pool.length] : n; });
}
function getStageNum(idx: number): number { return Math.floor((idx % 100) / 25) + 1; }
function getMelodyInStage(idx: number): number { return (idx % 25) + 1; }

// ── Piano layout ─────────────────────────────────────────────────────────────
const WHITE_KEYS = ["C","D","E","F","G","A","B","C5"] as const;
const KEY_COLOR: Record<string, string> = {
  C:"#FF6B6B", D:"#FF9F43", E:"#FFC312", F:"#2ECC71", G:"#45AAF2", A:"#9B59B6", B:"#E17055", C5:"#FF6B6B",
};
const KEY_GLOW: Record<string, string> = {
  C:"#FF0000", D:"#FF5500", E:"#FFB000", F:"#00A050", G:"#0070CC", A:"#6C3483", B:"#C0392B", C5:"#FF0000",
};
// White key index where a black key appears to the RIGHT: C D F G A (not E, B)
const HAS_BLACK_RIGHT = new Set(["C","D","F","G","A"]);

type Phase = "idle" | "playing" | "listening" | "correct" | "wrong";

export default function MelodyEcho() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [melodyIdx, setMelodyIdx] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [playerSeq, setPlayerSeq] = useState<string[]>([]);
  const [litKey, setLitKey] = useState<string | null>(null);
  const [litPos, setLitPos] = useState<number>(-1);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wrongPulse, setWrongPulse] = useState(false);
  const [melodyBadge, setMelodyBadge] = useState<"bronze" | "silver" | "gold" | null>(null);
  const [showAllComplete, setShowAllComplete] = useState(false);
  const [newBadge, setNewBadge] = useState<"bronze" | "silver" | "gold" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // clearTimers'dan bağımsız
  const wrongCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const [pianoScale, setPianoScale] = useState(1);

  // ── Kayıtlı ilerlemeyi yükle ─────────────────────────────────────────────
  const { data: savedProgress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`/api/student/${student!.student.id}/progress`);
      return res.json();
    },
    enabled: !!student,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!savedProgress || progressLoaded) return;
    const p = savedProgress.find(p => p.appType === "melody");
    if (p) {
      if (p.correctAnswers > 0) setMelodyIdx(p.correctAnswers);
      if (p.starsEarned > 0) setScore(p.starsEarned);
      if (p.notesBadge) setMelodyBadge(p.notesBadge as "bronze" | "silver" | "gold");
    }
    setProgressLoaded(true);
  }, [savedProgress, progressLoaded]);

  useEffect(() => {
    function updateScale() {
      const available = Math.min(window.innerWidth - 24, 680);
      setPianoScale(Math.min(1, available / 540));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  function nextBadge(current: "bronze" | "silver" | "gold" | null): "bronze" | "silver" | "gold" {
    if (!current) return "bronze";
    if (current === "bronze") return "silver";
    return "gold";
  }

  function saveProgress(
    currentMelodyIdx: number,
    newScore: number,
    newStage: number,
    badge?: "bronze" | "silver" | "gold" | null,
  ) {
    const sid = student?.student.id;
    if (!sid) return;
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    apiRequest("POST", `/api/student/${sid}/progress`, {
      appType: "melody",
      level: newStage,
      starsEarned: newScore,
      correctAnswers: currentMelodyIdx,
      wrongAnswers: wrongCountRef.current,
      timeSpentSeconds: elapsed,
      ...(badge !== undefined ? { notesBadge: badge } : {}),
    }).catch(() => {});
  }

  const melody = getMelody(melodyIdx);
  const stage = getStageNum(melodyIdx);
  const numInStage = getMelodyInStage(melodyIdx);

  function clearTimers() { timers.current.forEach(clearTimeout); timers.current = []; }

  function startMelody() {
    clearTimers();
    setPhase("playing");
    setPlayerSeq([]);
    setLitPos(-1);
    const GAP = 900;
    melody.forEach((note, i) => {
      timers.current.push(setTimeout(() => {
        setLitKey(note);
        setLitPos(i);
        playNote(note, 0.65);
        timers.current.push(setTimeout(() => { setLitKey(null); setLitPos(-1); }, 420));
      }, i * GAP));
    });
    timers.current.push(setTimeout(() => setPhase("listening"), melody.length * GAP + 300));
  }

  function handleKeyPress(note: string) {
    if (phase !== "listening") return;
    playNote(note, 0.5);
    setPressedKey(note);
    timers.current.push(setTimeout(() => setPressedKey(null), 180));

    const newSeq = [...playerSeq, note];
    setPlayerSeq(newSeq);

    if (newSeq[newSeq.length - 1] !== melody[newSeq.length - 1]) {
      playError();
      wrongCountRef.current += 1;
      setWrongPulse(true);
      setTimeout(() => setWrongPulse(false), 600);
      setPhase("wrong");
      return;
    }
    if (newSeq.length === melody.length) {
      playSuccess();
      const newScore = score + 1;
      const newStreak = streak + 1;
      const nextIdx = melodyIdx + 1;
      setScore(newScore);
      setStreak(newStreak);
      setPhase("correct");

      if (nextIdx >= 100) {
        // Tüm 100 melodi tamamlandı → rozet ver
        const earned = nextBadge(melodyBadge);
        setNewBadge(earned);
        setMelodyBadge(earned);
        saveProgress(0, newScore, 1, earned); // sıfırla + rozeti kaydet
        timers.current.push(setTimeout(() => {
          setShowAllComplete(true);
          setPhase("idle");
        }, 1800));
      } else {
        saveProgress(nextIdx, newScore, getStageNum(melodyIdx));
        if (newStreak % 5 === 0) {
          setShowCelebration(true);
          if (celebTimerRef.current) clearTimeout(celebTimerRef.current);
          celebTimerRef.current = setTimeout(() => setShowCelebration(false), 3000);
        }
        timers.current.push(setTimeout(() => {
          setMelodyIdx(nextIdx);
          setPlayerSeq([]);
          setPhase("idle");
        }, 2000));
      }
    }
  }

  function handleRetry() { setPlayerSeq([]); setStreak(0); startMelody(); }
  function handleSkip() {
    const nextIdx = melodyIdx + 1;
    saveProgress(nextIdx, score, getStageNum(nextIdx));
    setMelodyIdx(nextIdx);
    setPlayerSeq([]);
    setPhase("idle");
  }

  useEffect(() => () => clearTimers(), []);

  const stageColors = ["","from-orange-400 to-red-400","from-green-400 to-teal-400",
    "from-blue-400 to-indigo-500","from-purple-400 to-pink-500"];

  return (
    <div className="min-h-screen flex flex-col items-center"
      style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}
    >
      {/* ── Header ── */}
      <div className="w-full max-w-2xl flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => { clearTimers(); navigate("/student/home"); }}
          className="text-white/60 hover:text-white text-2xl cursor-pointer"
          data-testid="button-back"
        >←</button>
        <div className="text-center">
          <h1 className="text-white font-extrabold text-xl tracking-wide">🎹 Melodi Taklit Oyunu</h1>
          <p className="text-white/50 text-xs font-bold">Melody Echo · NoteBeat Kids</p>
        </div>
        <div className="text-center min-w-[40px]">
          {melodyBadge === "bronze" && <span className="text-xl" title="Bronz Rozet">🥉</span>}
          {melodyBadge === "silver" && <span className="text-xl" title="Gümüş Rozet">🥈</span>}
          {melodyBadge === "gold" && <span className="text-xl" title="Altın Rozet">🥇</span>}
        </div>
      </div>

      {/* ── Stage + score bar ── */}
      <div className="w-full max-w-2xl px-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className={`px-3 py-1 rounded-full text-xs font-extrabold text-white bg-gradient-to-r ${stageColors[stage]}`}
            data-testid="text-stage">
            Bölüm {stage} · Melodi {numInStage}/25
          </div>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 font-extrabold text-sm" data-testid="text-score">⭐ {score}</span>
            <span className="text-white/40 text-xs">🔥 {streak}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${stageColors[stage]}`}
            animate={{ width: `${(numInStage / 25) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* ── Status display ── */}
      <div className="w-full max-w-2xl px-4 mb-4 min-h-[72px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {phase === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-white/70 text-sm font-bold mb-2">
                {melody.length} notalı melodi — hazır mısın?
              </p>
              <div className="flex gap-2 justify-center">
                {melody.map((_, i) => (
                  <span key={i} className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs text-white/30">
                    {i + 1}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
          {phase === "playing" && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-blue-300 font-extrabold text-lg animate-pulse">🎵 Dinle...</p>
              <div className="flex gap-2 justify-center mt-2">
                {melody.map((n, i) => (
                  <motion.span key={i}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold border-2"
                    animate={litPos === i
                      ? { scale: 1.4, backgroundColor: KEY_GLOW[n], borderColor: KEY_GLOW[n], color: "#fff" }
                      : { scale: 1, backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.3)" }
                    }
                    transition={{ duration: 0.1 }}
                  >{n === "C5" ? "C" : n}</motion.span>
                ))}
              </div>
            </motion.div>
          )}
          {phase === "listening" && (
            <motion.div key="listening" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-green-300 font-extrabold text-lg">🎹 Şimdi sıra sende!</p>
              <div className="flex gap-2 justify-center mt-2">
                {melody.map((n, i) => {
                  const pressed = i < playerSeq.length;
                  const correct = pressed && playerSeq[i] === n;
                  return (
                    <span key={i}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{
                        backgroundColor: pressed ? (correct ? KEY_GLOW[n] : "#ef4444") : "rgba(255,255,255,0.05)",
                        borderColor: pressed ? (correct ? KEY_GLOW[n] : "#ef4444") : "rgba(255,255,255,0.2)",
                      }}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}
          {phase === "correct" && (
            <motion.div key="correct" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-yellow-300 font-extrabold text-2xl">⭐ Harika! Doğru! ⭐</p>
              <p className="text-white/60 text-sm mt-1">Sıradaki melodiye geçiliyor...</p>
            </motion.div>
          )}
          {phase === "wrong" && (
            <motion.div key="wrong" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center">
              <p className="text-red-400 font-extrabold text-xl mb-3">❌ Tekrar dene!</p>
              <div className="flex gap-3 justify-center">
                <button onClick={handleRetry}
                  className="px-5 py-2 rounded-2xl bg-blue-500 hover:bg-blue-400 text-white font-extrabold text-sm cursor-pointer transition-colors"
                  data-testid="button-retry">🔁 Tekrar Dinle</button>
                <button onClick={handleSkip}
                  className="px-5 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 font-bold text-sm cursor-pointer transition-colors"
                  data-testid="button-skip">Geç →</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── LISTEN button ── */}
      {phase === "idle" && (
        <motion.button
          onClick={startMelody}
          data-testid="button-listen"
          className="mb-5 px-10 py-4 rounded-3xl text-white font-extrabold text-xl shadow-2xl cursor-pointer"
          style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
          whileHover={{ scale: 1.07, boxShadow: "0 0 40px rgba(240,147,251,0.5)" }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          🎵 DİNLE
        </motion.button>
      )}

      {/* ── Piano keyboard ── */}
      {/* White key: 62px, gap: 6px → keyboard total = 8×62 + 7×6 = 538px */}
      <div className="relative w-full max-w-2xl px-2 mb-6 select-none flex flex-col items-center overflow-x-hidden">
        <div style={{ transform: `scale(${pianoScale})`, transformOrigin: "top center", width: 540, height: 230 * pianoScale }}>
        <motion.div
          className="relative"
          style={{ width: 538 }}
          animate={wrongPulse ? { x: [-8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {/* White keys */}
          <div className="flex gap-1.5 touch-none">
            {WHITE_KEYS.map((note) => {
              const isLit = litKey === note;
              const isPressed = pressedKey === note;
              return (
                <motion.div
                  key={note}
                  data-testid={`key-${note}`}
                  onPointerDown={(e) => { e.preventDefault(); handleKeyPress(note); }}
                  className="rounded-b-2xl cursor-pointer shadow-lg border-2 flex flex-col justify-end items-center pb-2 flex-shrink-0"
                  style={{
                    width: 62,
                    height: 180,
                    backgroundColor: isLit ? KEY_GLOW[note] : isPressed ? KEY_COLOR[note] : "#F8F5FF",
                    borderColor: isLit ? KEY_GLOW[note] : isPressed ? KEY_COLOR[note] : "#D0C8E8",
                    boxShadow: isLit
                      ? `0 0 30px ${KEY_GLOW[note]}, 0 4px 12px rgba(0,0,0,0.4)`
                      : "0 4px 12px rgba(0,0,0,0.4)",
                    userSelect: "none",
                  }}
                  animate={isLit ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 0.2 }}
                >
                  <span className="text-xs font-extrabold"
                    style={{ color: isLit || isPressed ? "#fff" : "#9086B8" }}>
                    {note === "C5" ? "C" : note}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Black keys — absolutely positioned relative to fixed 538px container */}
          {/* Black key between wi and wi+1: left = wi*68 + 62 - 20 = wi*68 + 42 */}
          {([0,1,3,4,5] as const).map((wi) => (
            <div key={`bk-${wi}`}
              className="absolute top-0 rounded-b-xl pointer-events-none z-10"
              style={{
                left: wi * 68 + 43,
                width: 38,
                height: 114,
                background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
                boxShadow: "0 6px 16px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.07)",
              }}
            />
          ))}
        </motion.div>

        {/* Dot indicators below keys */}
        <div className="flex gap-1.5 mt-2" style={{ width: 538 * pianoScale }}>
          {WHITE_KEYS.map((note) => {
            const active = melody.includes(note);
            return (
              <div key={`lbl-${note}`}
                className="text-center font-bold text-sm flex-shrink-0"
                style={{ width: 62, color: active ? KEY_COLOR[note] : "rgba(255,255,255,0.12)" }}>
                {active ? "●" : "○"}
              </div>
            );
          })}
        </div>
        <p className="text-white/25 text-xs mt-1 font-bold">
          Bu melodide kullanılan notalar ● ile işaretli
        </p>
        </div>{/* end scale wrapper */}
      </div>

      {/* ── Celebration overlay ── */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            key="celebration"
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="text-center"
              initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}>
              <p className="text-6xl mb-4">🎉</p>
              <p className="text-4xl font-extrabold text-yellow-300 drop-shadow-2xl">Müthiş!</p>
              <p className="text-2xl text-white/80 font-bold mt-2">5 doğru art arda! 🌟</p>
              {["⭐","🎵","🌟","✨","🎶"].map((e, i) => (
                <motion.span key={i} className="absolute text-3xl"
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: (i - 2) * 120, y: -200, opacity: 0 }}
                  transition={{ duration: 1.5, delay: i * 0.1 }}
                >{e}</motion.span>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tüm Bölümler Tamamlandı Ekranı ── */}
      <AnimatePresence>
        {showAllComplete && (
          <motion.div
            key="allcomplete"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "linear-gradient(160deg, #0f0c29ee 0%, #302b63ee 50%, #24243eee 100%)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center px-8 max-w-sm"
              initial={{ scale: 0.5, y: 60 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18 }}
            >
              <motion.p className="text-7xl mb-4"
                animate={{ rotate: [0, -10, 10, -8, 8, 0] }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                {newBadge === "bronze" ? "🥉" : newBadge === "silver" ? "🥈" : "🥇"}
              </motion.p>
              <p className="text-4xl font-extrabold text-yellow-300 mb-2">
                {newBadge === "bronze" && "Bronz Rozet!"}
                {newBadge === "silver" && "Gümüş Rozet!"}
                {newBadge === "gold" && "Altın Rozet!"}
              </p>
              <p className="text-white font-bold text-lg mb-1">Tüm bölümleri tamamladın! 🎉</p>
              <p className="text-white/60 text-sm mb-8">
                {newBadge === "bronze" && "Harika bir başlangıç! Şimdi Bölüm 1'den tekrar başlayalım."}
                {newBadge === "silver" && "Muhteşem ilerleme! Bir tur daha yapıp altın rozeti kazanalım."}
                {newBadge === "gold" && "Tebrikler Usta Müzisyen! En yüksek rozeti kazandın! 🌟"}
              </p>
              <motion.button
                data-testid="button-restart-all"
                onClick={() => {
                  setShowAllComplete(false);
                  setMelodyIdx(0);
                  setStreak(0);
                  setPlayerSeq([]);
                  setPhase("idle");
                }}
                className="w-full py-4 rounded-3xl text-white font-extrabold text-xl cursor-pointer shadow-2xl"
                style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                🎵 Hadi Baştan Başlayalım!
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
