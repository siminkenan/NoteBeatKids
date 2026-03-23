import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { StudentProgress } from "@shared/schema";

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

const STAGE1: string[][] = [
  ["C","D","E"],["E","D","C"],["C","E","D"],["D","C","E"],["E","C","D"],
  ["C","C","D"],["D","D","C"],["E","E","D"],["C","D","D"],["D","E","E"],
  ["E","D","D"],["C","E","E"],["D","C","C"],["E","C","C"],["D","E","C"],
  ["E","E","C"],["D","D","E"],["C","C","E"],["E","D","E"],["C","E","C"],
  ["D","C","D"],["E","C","E"],["C","D","C"],["D","E","D"],["E","E","E"],
];
const STAGE2: string[][] = [
  ["C","D","E","G"],["G","E","D","C"],["C","F","G","E"],["D","G","F","C"],["E","C","G","D"],
  ["G","D","C","F"],["C","E","G","F"],["F","G","D","C"],["G","C","F","E"],["D","E","G","C"],
  ["F","C","D","G"],["E","D","G","C"],["C","C","D","G"],["G","G","E","D"],["D","D","C","G"],
  ["E","E","G","C"],["C","G","G","D"],["D","C","E","G"],["G","E","C","D"],["E","G","C","D"],
  ["C","D","C","G"],["G","D","G","C"],["D","G","D","E"],["E","C","E","G"],["C","G","C","D"],
];
const STAGE3: string[][] = [
  ["C","D","E","G","A"],["A","G","E","D","C"],["C","E","G","A","E"],["G","E","C","A","G"],["C","D","E","D","C"],
  ["B","A","G","E","D"],["C","B","E","C","G"],["D","E","F","G","A"],["G","E","C","D","A"],["C","D","F","G","B"],
  ["E","F","G","A","G"],["B","G","F","E","D"],["C","C","D","E","G"],["D","E","A","E","D"],["G","F","G","B","C"],
  ["C","E","D","F","G"],["G","A","D","C","D"],["E","G","A","E","D"],["C","F","G","A","C"],["D","F","E","G","B"],
  ["B","C","D","E","F"],["C","G","F","A","D"],["E","D","C","D","E"],["G","F","E","A","E"],["C","D","G","B","C"],
];
const STAGE4: string[][] = [
  ["C","E","G","A","C5","G"],["C5","G","E","C","D","E"],["C","D","E","G","A","C5"],["G","A","C5","A","G","E"],["E","G","A","B","C5","A"],
  ["C","G","E","G","C5","E"],["D","F","A","G","E","D"],["G","E","D","C","B","A"],["C","E","D","E","G","C5"],["E","C","E","G","B","C5"],
  ["G","E","C","G","E","C5"],["C","D","E","G","C5","G"],["E","D","C","E","G","A"],["G","C5","E","C","G","E"],["C","G","C5","E","G","A"],
  ["D","E","F","G","A","B"],["E","F","G","A","B","C5"],["G","F","E","F","G","A"],["C","E","F","G","A","C5"],["E","G","F","A","E","C"],
  ["C","D","E","F","G","A"],["G","F","E","D","C","B"],["C","E","G","A","B","C5"],["D","E","G","B","C5","G"],["C","G","A","B","C5","A"],
];

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getMelodyForStudent(studentId: string, idx: number): string[] {
  const turn = Math.floor(idx / 100) + 1;
  const section = Math.floor((idx % 100) / 25) + 1;
  const qInSection = idx % 25;
  const pool = [STAGE1, STAGE2, STAGE3, STAGE4][section - 1];
  const seed = strHash(`${studentId}-t${turn}-s${section}`);
  return seededShuffle(pool, seed)[qInSection];
}

function getTurn(idx: number): number { return Math.floor(idx / 100) + 1; }
function getSection(idx: number): number { return Math.floor((idx % 100) / 25) + 1; }
function getQInSection(idx: number): number { return (idx % 25) + 1; }

const WHITE_KEYS = ["C","D","E","F","G","A","B","C5"] as const;
const KEY_COLOR: Record<string, string> = {
  C:"#FF6B6B", D:"#FF9F43", E:"#FFC312", F:"#2ECC71", G:"#45AAF2", A:"#9B59B6", B:"#E17055", C5:"#FF6B6B",
};
const KEY_GLOW: Record<string, string> = {
  C:"#FF0000", D:"#FF5500", E:"#FFB000", F:"#00A050", G:"#0070CC", A:"#6C3483", B:"#C0392B", C5:"#FF0000",
};

type Phase = "idle" | "playing" | "listening" | "correct" | "wrong";
type Badge = "bronze" | "silver" | "gold";

const SECTION_NOTES = [
  "Do · Re · Mi",
  "Do · Re · Mi · Fa · Sol",
  "Do · Re · Mi · Fa · Sol · La · Si",
  "Do · Re · Mi · Fa · Sol · La · Si · Do",
];
const SECTION_EXPAND = [
  "",
  "Yeni: Fa (F) ve Sol (G) eklendi!",
  "Yeni: La (A) ve Si (B) eklendi!",
  "Yeni: Tüm oktav — Do (C5) eklendi!",
];

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
  const [melodyBadge, setMelodyBadge] = useState<Badge | null>(null);
  const [showSectionComplete, setShowSectionComplete] = useState(false);
  const [completedSection, setCompletedSection] = useState(1);
  const [showTurnComplete, setShowTurnComplete] = useState<Badge | null>(null);
  const [nextMelodyIdx, setNextMelodyIdx] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const celebTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const [pianoScale, setPianoScale] = useState(1);

  const sid = student?.student.id ?? "";
  const melody = sid ? getMelodyForStudent(sid, melodyIdx) : STAGE1[0];
  const turn = getTurn(melodyIdx);
  const section = getSection(melodyIdx);
  const qInSection = getQInSection(melodyIdx);

  const { data: savedProgress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", sid, "progress"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/student/${sid}/progress`, { credentials: "include" });
      return res.json();
    },
    enabled: !!sid,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!savedProgress || progressLoaded) return;
    const p = savedProgress.find(p => p.appType === "melody");
    if (p) {
      if (p.correctAnswers > 0) setMelodyIdx(p.correctAnswers);
      if (p.starsEarned > 0) setScore(p.starsEarned);
      if (p.notesBadge) setMelodyBadge(p.notesBadge as Badge);
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

  function saveProgress(idx: number, newScore: number, badge?: Badge | null) {
    if (!sid) return;
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    apiRequest("POST", `/api/student/${sid}/progress`, {
      appType: "melody",
      level: getSection(idx),
      starsEarned: newScore,
      correctAnswers: idx,
      wrongAnswers: wrongCountRef.current,
      timeSpentSeconds: elapsed,
      ...(badge !== undefined ? { notesBadge: badge } : {}),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/student", sid, "progress"] });
    }).catch(() => {});
  }

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
      const newScore = score + 1;
      const newStreak = streak + 1;
      const nextIdx = melodyIdx + 1;
      setScore(newScore);
      setStreak(newStreak);
      setPhase("correct");
      playSuccess();

      const isTurnEnd = nextIdx % 100 === 0;
      const isSectionEnd = !isTurnEnd && nextIdx % 25 === 0;
      const isFullComplete = nextIdx >= 300;

      if (isFullComplete || isTurnEnd) {
        const turnNum = Math.ceil(nextIdx / 100);
        const badge: Badge = turnNum >= 3 ? "gold" : turnNum === 2 ? "silver" : "bronze";
        const savedIdx = isFullComplete ? 0 : nextIdx;
        setMelodyBadge(badge);
        setNextMelodyIdx(savedIdx);
        saveProgress(savedIdx, newScore, badge);
        timers.current.push(setTimeout(() => {
          setShowTurnComplete(badge);
          setPhase("idle");
        }, 1500));
      } else if (isSectionEnd) {
        setCompletedSection(getSection(melodyIdx));
        saveProgress(nextIdx, newScore);
        timers.current.push(setTimeout(() => {
          setMelodyIdx(nextIdx);
          setShowSectionComplete(true);
          setPhase("idle");
        }, 1500));
      } else {
        saveProgress(nextIdx, newScore);
        if (newStreak % 5 === 0) {
          setShowCelebration(true);
          if (celebTimerRef.current) clearTimeout(celebTimerRef.current);
          celebTimerRef.current = setTimeout(() => setShowCelebration(false), 3000);
        }
        timers.current.push(setTimeout(() => {
          setMelodyIdx(nextIdx);
          setPlayerSeq([]);
          setPhase("idle");
        }, 1800));
      }
    }
  }

  function handleRetry() { setPlayerSeq([]); setStreak(0); startMelody(); }
  function handleSkip() {
    const nextIdx = melodyIdx + 1;
    if (nextIdx >= 300) {
      setMelodyIdx(0);
      saveProgress(0, score);
    } else {
      setMelodyIdx(nextIdx);
      saveProgress(nextIdx, score);
    }
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

      <div className="w-full max-w-2xl px-4 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className={`px-3 py-1 rounded-full text-xs font-extrabold text-white bg-gradient-to-r ${stageColors[section]}`}
            data-testid="text-stage">
            Tur {turn} · Bölüm {section} · {qInSection}/25
          </div>
          <div className="flex items-center gap-3">
            <span className="text-yellow-400 font-extrabold text-sm" data-testid="text-score">⭐ {score}</span>
            <span className="text-white/40 text-xs">🔥 {streak}</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${stageColors[section]}`}
            animate={{ width: `${(qInSection / 25) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-white/30 text-[10px] font-bold mt-1 text-center">{SECTION_NOTES[section - 1]}</p>
      </div>

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

      {phase === "idle" && !showSectionComplete && !showTurnComplete && (
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

      <div className="relative w-full max-w-2xl px-2 mb-6 select-none flex flex-col items-center overflow-x-hidden">
        <div style={{ transform: `scale(${pianoScale})`, transformOrigin: "top center", width: 540, height: 230 * pianoScale }}>
        <motion.div
          className="relative"
          style={{ width: 538 }}
          animate={wrongPulse ? { x: [-8, 8, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
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
        </div>
      </div>

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

      <AnimatePresence>
        {showSectionComplete && (
          <motion.div
            key="sectioncomplete"
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
                transition={{ duration: 0.8, delay: 0.3 }}>
                🎊
              </motion.p>
              <p className="text-3xl font-extrabold text-yellow-300 mb-2">
                Bölüm {completedSection} Tamamlandı!
              </p>
              <p className="text-white font-bold text-base mb-1">
                Harika iş çıkardın! 25 melodi bitti!
              </p>
              {SECTION_EXPAND[completedSection] && (
                <p className="text-green-300 text-sm font-bold mb-6">
                  ✨ {SECTION_EXPAND[completedSection]}
                </p>
              )}
              <motion.button
                data-testid="button-next-section"
                onClick={() => {
                  setShowSectionComplete(false);
                  setStreak(0);
                  setPlayerSeq([]);
                }}
                className="w-full py-4 rounded-3xl text-white font-extrabold text-xl cursor-pointer shadow-2xl"
                style={{ background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                Sonraki Bölüme Geç →
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTurnComplete && (
          <motion.div
            key="turncomplete"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "linear-gradient(160deg, #0f0c29ee 0%, #302b63ee 50%, #24243eee 100%)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center px-8 max-w-sm"
              initial={{ scale: 0.5, y: 60 }} animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", damping: 18 }}
            >
              <motion.p className="text-8xl mb-4"
                animate={{ rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1, delay: 0.2 }}>
                {showTurnComplete === "bronze" ? "🥉" : showTurnComplete === "silver" ? "🥈" : "🥇"}
              </motion.p>
              <p className="text-4xl font-extrabold text-yellow-300 mb-2">
                {showTurnComplete === "bronze" && "Bronz Rozet! 🥉"}
                {showTurnComplete === "silver" && "Gümüş Rozet! 🥈"}
                {showTurnComplete === "gold" && "Altın Rozet! 🥇"}
              </p>
              <p className="text-white font-bold text-lg mb-1">
                Tüm 4 bölümü tamamladın! 🎉
              </p>
              <p className="text-white/60 text-sm mb-8">
                {showTurnComplete === "bronze" && "Mükemmel başlangıç! Gümüş rozet için tekrar başlayalım."}
                {showTurnComplete === "silver" && "İnanılmaz ilerleme! Altın rozet için bir tur daha!"}
                {showTurnComplete === "gold" && "Tebrikler Usta Müzisyen! Tüm rozetleri kazandın! 🌟"}
              </p>
              {["⭐","🎵","🌟","✨","🎶","💫","🎊"].map((e, i) => (
                <motion.span key={i} className="absolute text-4xl pointer-events-none"
                  style={{ left: "50%", top: "40%" }}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{ x: (i - 3) * 100, y: -250, opacity: 0 }}
                  transition={{ duration: 2, delay: i * 0.15 }}
                >{e}</motion.span>
              ))}
              <motion.button
                data-testid="button-restart-all"
                onClick={() => {
                  setShowTurnComplete(null);
                  setMelodyIdx(nextMelodyIdx);
                  setStreak(0);
                  setPlayerSeq([]);
                  setPhase("idle");
                }}
                className="w-full py-4 rounded-3xl text-white font-extrabold text-xl cursor-pointer shadow-2xl"
                style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
              >
                {showTurnComplete === "gold" ? "🎵 Hadi Baştan Başlayalım!" : "🔁 Bölüm 1'den Başla!"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
