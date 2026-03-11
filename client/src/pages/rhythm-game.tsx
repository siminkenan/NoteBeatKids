import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VexFlowRenderer, type NoteData } from "@/components/vexflow-renderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Square, ChevronRight } from "lucide-react";
import type { StudentProgress } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Level {
  name: string;
  nameTr: string;
  description: string;
  patterns: NoteData[][];
}

// ─── Beat durations (in quarter-note beats) ───────────────────────────────────
const BEAT_VAL: Record<string, number> = {
  w: 4, wr: 4,
  h: 2, hr: 2,
  q: 1, qr: 1,
  "8": 0.5, "8r": 0.5,
};
const IS_REST: Record<string, boolean> = { wr: true, hr: true, qr: true, "8r": true };

// ─── Helper to build NoteData ─────────────────────────────────────────────────
const n = (dur: string): NoteData => ({ keys: ["b/4"], duration: dur });
const r = (dur: string): NoteData => ({ keys: ["b/4"], duration: `${dur}r` });

// ─── 10 Levels × 5 Patterns ───────────────────────────────────────────────────
// Every pattern must total exactly 4 beats.
const LEVELS: Record<number, Level> = {
  1: {
    name: "Level 1 – Quarter Notes",
    nameTr: "Seviye 1 – Dörtlük Notalar",
    description: "Sadece dörtlük notalar. Her vuruş 1 atım.",
    patterns: [
      [n("q"), n("q"), n("q"), n("q")],
      [n("q"), n("q"), n("q"), n("q")],
      [n("q"), n("q"), n("q"), n("q")],
      [n("q"), n("q"), n("q"), n("q")],
      [n("q"), n("q"), n("q"), n("q")],
    ],
  },
  2: {
    name: "Level 2 – Quarter Notes + Rests",
    nameTr: "Seviye 2 – Dörtlük Notalar + Suslar",
    description: "Dörtlük notalar ve dörtlük suslar. Sus = sessizlik!",
    patterns: [
      [n("q"), r("q"), n("q"), n("q")],
      [n("q"), n("q"), r("q"), n("q")],
      [r("q"), n("q"), n("q"), r("q")],
      [n("q"), r("q"), r("q"), n("q")],
      [n("q"), n("q"), r("q"), r("q")],
    ],
  },
  3: {
    name: "Level 3 – Quarter + Eighth Notes",
    nameTr: "Seviye 3 – Dörtlük + Sekizlik Notalar",
    description: "Sekizlik nota = yarım vuruş. İki sekizlik = bir dörtlük!",
    patterns: [
      [n("8"), n("8"), n("q"), n("q"), n("q")],
      [n("q"), n("8"), n("8"), n("q"), n("q")],
      [n("q"), n("q"), n("8"), n("8"), n("q")],
      [n("8"), n("8"), n("8"), n("8"), n("q"), n("q")],
      [n("8"), n("8"), n("q"), n("8"), n("8"), n("q")],
    ],
  },
  4: {
    name: "Level 4 – Eighth Notes + Rests",
    nameTr: "Seviye 4 – Sekizlikler + Suslar",
    description: "Dörtlük, sekizlik ve susları birlikte kullan!",
    patterns: [
      [n("8"), n("8"), n("q"), r("q"), n("q")],
      [n("q"), r("q"), n("8"), n("8"), n("q")],
      [n("8"), n("8"), r("q"), n("q"), n("q")],
      [n("q"), n("8"), n("8"), r("q"), n("q")],
      [r("q"), n("8"), n("8"), n("q"), n("q")],
    ],
  },
  5: {
    name: "Level 5 – Eighth Note Patterns",
    nameTr: "Seviye 5 – Sekizlik Kalıpları",
    description: "Çok sekizlik nota! Çift hızda vurular.",
    patterns: [
      [n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8")],
      [n("8"), n("8"), n("8"), n("8"), n("q"), n("q")],
      [n("8"), n("8"), n("q"), n("8"), n("8"), n("q")],
      [n("8"), r("8"), n("8"), r("8"), n("q"), n("q")],
      [n("8"), n("8"), n("8"), n("8"), n("q"), n("8"), n("8")],
    ],
  },
  6: {
    name: "Level 6 – Half Notes",
    nameTr: "Seviye 6 – Yarım Notalar",
    description: "Yarım nota = 2 vuruş. Uzun tut!",
    patterns: [
      [n("h"), n("q"), n("q")],
      [n("q"), n("q"), n("h")],
      [n("h"), n("h")],
      [n("h"), n("q"), r("q")],
      [n("q"), n("h"), n("q")],
    ],
  },
  7: {
    name: "Level 7 – Half Notes + Rests",
    nameTr: "Seviye 7 – Yarım Nota + Suslar",
    description: "Yarım susları da öğren. 2 vuruş sessizlik!",
    patterns: [
      [n("h"), r("h")],
      [n("h"), r("q"), n("q")],
      [r("h"), n("q"), n("q")],
      [n("q"), r("h"), n("q")],
      [n("h"), r("q"), r("q")],
    ],
  },
  8: {
    name: "Level 8 – Syncopation",
    nameTr: "Seviye 8 – Senkop",
    description: "Senkop: Zayıf vuruşlarda vurarak ritmi hissediyoruz!",
    patterns: [
      [n("8"), n("q"), n("q"), n("q"), n("8")],
      [r("q"), n("8"), n("8"), n("q"), n("q")],
      [n("8"), n("8"), r("q"), n("8"), n("8"), n("q")],
      [n("q"), r("8"), n("8"), n("q"), n("q")],
      [n("8"), n("q"), n("8"), r("q"), n("8"), n("8")],
    ],
  },
  9: {
    name: "Level 9 – Mixed Rhythms",
    nameTr: "Seviye 9 – Karışık Ritimler",
    description: "Tüm nota türleri! Dikkatli dinle.",
    patterns: [
      [n("h"), n("8"), n("8"), n("q")],
      [n("q"), n("8"), n("8"), r("q"), n("q")],
      [n("8"), n("8"), n("h"), r("q")],
      [n("q"), n("q"), n("8"), n("8"), r("q")],
      [n("8"), n("8"), n("8"), n("8"), n("h")],
    ],
  },
  10: {
    name: "Level 10 – Advanced",
    nameTr: "Seviye 10 – İleri Ritimler",
    description: "En karmaşık kalıplar. Ritim ustasısın!",
    patterns: [
      [n("8"), n("8"), n("q"), n("8"), n("8"), r("8"), n("8")],
      [n("h"), n("8"), n("8"), n("8"), n("8")],
      [n("q"), r("8"), n("8"), n("q"), n("8"), n("8")],
      [n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), r("q")],
      [r("8"), n("8"), n("q"), n("q"), n("8"), n("8")],
    ],
  },
};

const MAX_LEVEL = 10;
const PATTERNS_PER_LEVEL = 5;
const PASS_SCORE = 3; // need 3/5 correct to advance

// ─── Audio helpers ─────────────────────────────────────────────────────────────
function makeAudioCtx() {
  return new AudioContext();
}

function playTone(ctx: AudioContext, freq: number, type: OscillatorType, duration: number, volume = 0.3) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RhythmGame() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const qc = useQueryClient();

  const [level, setLevel] = useState(1);
  const [exerciseIdx, setExerciseIdx] = useState(0); // 0-4 within a level
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]); // results for current level
  const [bpm, setBpm] = useState(80);
  const [phase, setPhase] = useState<"idle" | "countdown" | "playing" | "result" | "levelup">("idle");
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [feedback, setFeedback] = useState<null | { correct: boolean; accuracy: number; hits: number; total: number }>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const gameStartRef = useRef(0);
  const sessionStartRef = useRef(Date.now());

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = makeAudioCtx();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playClick = useCallback((accent = false) => {
    const ctx = getAudioCtx();
    playTone(ctx, accent ? 1000 : 700, "square", 0.06, accent ? 0.35 : 0.2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playSuccess = useCallback(() => {
    const ctx = getAudioCtx();
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => playTone(ctx, f, "sine", 0.3, 0.5), i * 120);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playFail = useCallback(() => {
    const ctx = getAudioCtx();
    playTone(ctx, 280, "sawtooth", 0.4, 0.4);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playLevelUp = useCallback(() => {
    const ctx = getAudioCtx();
    [392, 523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(ctx, f, "sine", 0.4, 0.6), i * 100);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load saved progress
  const { data: savedProgress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`/api/student/${student!.student.id}/progress`);
      return res.json();
    },
    enabled: !!student,
  });

  useEffect(() => {
    if (!student) { navigate("/student/login"); return; }
  }, [student, navigate]);

  useEffect(() => {
    const p = savedProgress?.find(p => p.appType === "rhythm");
    if (p) {
      setLevel(Math.min(Math.max(p.level, 1), MAX_LEVEL));
      setTotalStars(p.starsEarned);
      setCorrectCount(p.correctAnswers);
      setWrongCount(p.wrongAnswers);
    }
  }, [savedProgress]);

  const currentLevel = LEVELS[Math.min(level, MAX_LEVEL)];
  const currentPattern = currentLevel?.patterns[exerciseIdx] ?? [];

  const stopMetronome = useCallback(() => {
    if (metronomeTimerRef.current) {
      clearInterval(metronomeTimerRef.current);
      metronomeTimerRef.current = null;
    }
    setCurrentBeat(-1);
  }, []);

  // Calculate expected tap times from the pattern at current BPM
  const getExpectedBeats = useCallback(() => {
    const beatMs = (60 / bpm) * 1000;
    const beats: number[] = [];
    let t = 0;
    currentPattern.forEach(note => {
      if (!IS_REST[note.duration]) beats.push(t);
      t += (BEAT_VAL[note.duration] ?? 1) * beatMs;
    });
    return beats;
  }, [currentPattern, bpm]);

  // ─── Play the pattern (listen phase) ────────────────────────────────────────
  const startExercise = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("countdown");
    setHighlightIdx(-1);
    setFeedback(null);
    tapTimesRef.current = [];

    let count = 3;
    setCurrentBeat(-1);

    const tick = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(tick);
        // Start metronome
        const beatMs = (60 / bpm) * 1000;
        let beat = 0;
        playClick(true);
        setCurrentBeat(0);
        setPhase("playing");
        gameStartRef.current = Date.now();

        metronomeTimerRef.current = setInterval(() => {
          beat = (beat + 1) % 4;
          setCurrentBeat(beat);
          playClick(beat === 0);
        }, beatMs);

        // Schedule note highlighting
        let elapsed = 0;
        currentPattern.forEach((note, i) => {
          setTimeout(() => setHighlightIdx(i), elapsed);
          elapsed += (BEAT_VAL[note.duration] ?? 1) * beatMs;
        });

        // End of pattern
        setTimeout(() => {
          stopMetronome();
          setHighlightIdx(-1);
          setPhase("result");
          evaluateTaps();
        }, elapsed + beatMs * 0.5);
      }
    }, 1000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bpm, currentPattern, playClick, stopMetronome]);

  // ─── Evaluate taps ──────────────────────────────────────────────────────────
  const evaluateTaps = useCallback(() => {
    const expected = getExpectedBeats();
    const taps = tapTimesRef.current;
    const tolerance = (60 / bpm) * 1000 * 0.38;

    const matched = new Set<number>();
    let hits = 0;

    expected.forEach(expT => {
      let bestDiff = Infinity;
      let bestIdx = -1;
      taps.forEach((t, i) => {
        if (matched.has(i)) return;
        const d = Math.abs(t - expT);
        if (d < bestDiff) { bestDiff = d; bestIdx = i; }
      });
      if (bestIdx >= 0 && bestDiff <= tolerance) {
        matched.add(bestIdx);
        hits++;
      }
    });

    const total = expected.length;
    const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;
    const correct = hits === total && total > 0;

    setFeedback({ correct, accuracy, hits, total });

    if (correct) {
      playSuccess();
      setCorrectCount(c => c + 1);
    } else {
      playFail();
      setWrongCount(w => w + 1);
    }

    // Track result for this level's 5 exercises
    setExerciseResults(prev => {
      const updated = [...prev, correct];
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getExpectedBeats, bpm, playSuccess, playFail]);

  // ─── Handle tap ─────────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== "playing") return;
    const t = Date.now() - gameStartRef.current;
    tapTimesRef.current.push(t);
    const ctx = getAudioCtx();
    playTone(ctx, 440, "sine", 0.1, 0.25);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleTap();
        if (phase === "idle") startExercise();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap, phase, startExercise]);

  // ─── Move to next exercise ────────────────────────────────────────────────
  const nextExercise = useCallback(() => {
    const nextIdx = exerciseIdx + 1;

    if (nextIdx >= PATTERNS_PER_LEVEL) {
      // Level complete — check if passed
      const allResults = [...exerciseResults];
      const passedCount = allResults.filter(Boolean).length;
      const passed = passedCount >= PASS_SCORE;

      const stars = passedCount >= 5 ? 3 : passedCount >= 4 ? 2 : passedCount >= 3 ? 1 : 0;
      setTotalStars(s => s + stars);

      if (passed && level < MAX_LEVEL) {
        setLevel(l => {
          const newLevel = l + 1;
          saveProgress(newLevel, stars);
          return newLevel;
        });
        playLevelUp();
        setPhase("levelup");
      } else {
        // Retry level
        setExerciseIdx(0);
        setExerciseResults([]);
        setPhase("idle");
        saveProgress(level, stars);
      }
    } else {
      setExerciseIdx(nextIdx);
      setPhase("idle");
      setFeedback(null);
      setHighlightIdx(-1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdx, exerciseResults, level, playLevelUp]);

  const startNewLevel = () => {
    setExerciseIdx(0);
    setExerciseResults([]);
    setFeedback(null);
    setHighlightIdx(-1);
    setPhase("idle");
  };

  const saveProgress = (lv: number, stars: number) => {
    if (!student) return;
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    apiRequest("POST", `/api/student/${student.student.id}/progress`, {
      appType: "rhythm",
      level: lv,
      starsEarned: totalStars + stars,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      timeSpentSeconds: elapsed,
    }).then(() => qc.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }));
  };

  if (!student) return null;

  const beatMs = (60 / bpm) * 1000;

  return (
    <div
      className="min-h-screen select-none flex flex-col"
      style={{ background: "linear-gradient(160deg, #fdf4ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}
    >
      {/* ── Header ── */}
      <header className="bg-white/80 backdrop-blur border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost" size="sm"
            onClick={() => { stopMetronome(); navigate("/student/home"); }}
            className="gap-1.5 rounded-xl font-bold text-purple-700"
            data-testid="btn-back"
          >
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-2xl">🥁</span>
            <h1 className="font-extrabold text-lg text-purple-700">Ritim Antrenörü</h1>
          </div>

          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 rounded-full px-3 py-1">
            <span className="text-base">⭐</span>
            <span className="font-extrabold text-yellow-700 text-sm" data-testid="text-stars">{totalStars}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 flex flex-col gap-5">

        {/* ── Level + Exercise progress ── */}
        <div className="flex items-center justify-between bg-white/70 rounded-2xl px-4 py-3 shadow-sm">
          <div>
            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Seviye</p>
            <p className="text-3xl font-extrabold text-purple-700">{level}</p>
            <p className="text-xs font-semibold text-muted-foreground max-w-[160px] leading-tight">{currentLevel?.nameTr}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xs font-bold text-purple-400 uppercase tracking-widest">Egzersiz</p>
            <div className="flex gap-1.5">
              {Array.from({ length: PATTERNS_PER_LEVEL }).map((_, i) => {
                const done = i < exerciseIdx;
                const current = i === exerciseIdx;
                const result = exerciseResults[i];
                return (
                  <div
                    key={i}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                      current ? "bg-purple-600 text-white scale-110 shadow-md" :
                      done && result ? "bg-green-400 text-white" :
                      done && !result ? "bg-red-300 text-white" :
                      "bg-purple-100 text-purple-300"
                    }`}
                  >
                    {done ? (result ? "✓" : "✗") : i + 1}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground font-semibold">
              {exerciseIdx + 1} / {PATTERNS_PER_LEVEL}
            </p>
          </div>
        </div>

        {/* ── Score bar ── */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-white/70 rounded-xl py-2 text-center shadow-sm">
            <p className="text-xl font-extrabold text-green-500">{correctCount}</p>
            <p className="text-xs text-muted-foreground font-bold">Doğru</p>
          </div>
          <div className="bg-white/70 rounded-xl py-2 text-center shadow-sm">
            <p className="text-xl font-extrabold text-red-400">{wrongCount}</p>
            <p className="text-xs text-muted-foreground font-bold">Yanlış</p>
          </div>
          <div className="bg-white/70 rounded-xl py-2 text-center shadow-sm">
            <p className="text-xl font-extrabold text-purple-600">
              {correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground font-bold">Doğruluk</p>
          </div>
        </div>

        {/* ── Metronome beats ── */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(beat => (
            <motion.div
              key={beat}
              className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
              style={{
                borderColor: beat === 0 ? "#7c3aed" : "#c4b5fd",
                background: currentBeat === beat && phase === "playing"
                  ? beat === 0 ? "#7c3aed" : "#a78bfa"
                  : "white",
              }}
              animate={currentBeat === beat && phase === "playing" ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: beatMs / 1000, ease: "easeOut" }}
            >
              {beat === 0 && currentBeat === beat && phase === "playing" && (
                <div className="w-2.5 h-2.5 rounded-full bg-white" />
              )}
            </motion.div>
          ))}
        </div>

        {/* ── VexFlow notation ── */}
        <div className="bg-white rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-extrabold text-purple-400 uppercase tracking-widest">Ritim Kalıbı</p>
            <p className="text-xs font-bold text-muted-foreground">{currentLevel?.description}</p>
          </div>
          <div className="flex justify-center overflow-x-auto">
            <VexFlowRenderer
              notes={currentPattern}
              width={520}
              height={130}
              showClef
              showTimeSignature
              highlightIndex={highlightIdx}
            />
          </div>
        </div>

        {/* ── BPM Slider ── */}
        <div className="bg-white/70 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="font-extrabold text-sm text-purple-700">🎵 Tempo</p>
            <span className="bg-purple-600 text-white text-sm font-extrabold px-3 py-1 rounded-full" data-testid="text-bpm">
              {bpm} BPM
            </span>
          </div>
          <input
            type="range"
            min={60}
            max={140}
            step={5}
            value={bpm}
            onChange={e => setBpm(Number(e.target.value))}
            disabled={phase !== "idle"}
            className="w-full accent-purple-600 cursor-pointer"
            data-testid="slider-bpm"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-semibold mt-1">
            <span>60 (Yavaş)</span>
            <span>100 (Normal)</span>
            <span>140 (Hızlı)</span>
          </div>
        </div>

        {/* ── Feedback ── */}
        <AnimatePresence>
          {feedback && phase === "result" && (
            <motion.div
              className={`rounded-2xl p-5 text-center border-2 ${feedback.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-5xl mb-2">{feedback.correct ? "🎉" : "🤔"}</p>
              <p className={`text-xl font-extrabold ${feedback.correct ? "text-green-600" : "text-red-500"}`}>
                {feedback.correct ? "Mükemmel!" : "Tekrar Dene!"}
              </p>
              <p className="text-sm font-semibold text-muted-foreground mt-1">
                {feedback.hits}/{feedback.total} vuruş doğru · %{feedback.accuracy} doğruluk
              </p>
              {/* Accuracy bar */}
              <div className="mt-3 h-3 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${feedback.accuracy >= 80 ? "bg-green-400" : feedback.accuracy >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${feedback.accuracy}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Level Up Screen ── */}
        <AnimatePresence>
          {phase === "levelup" && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl p-8 mx-4 text-center shadow-2xl max-w-sm w-full"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <p className="text-6xl mb-3">🏆</p>
                <h2 className="text-2xl font-extrabold text-purple-700 mb-1">Seviye Atladın!</h2>
                <p className="text-lg font-bold text-muted-foreground mb-4">
                  Seviye {level - 1} tamamlandı! → Seviye {level}
                </p>
                <div className="flex justify-center gap-1 mb-6 text-3xl">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.2 }}
                    >
                      ⭐
                    </motion.span>
                  ))}
                </div>
                <Button
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-lg py-6 rounded-2xl"
                  onClick={startNewLevel}
                  data-testid="button-next-level"
                >
                  Seviye {level}'e Geç! →
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Countdown overlay ── */}
        <AnimatePresence>
          {phase === "countdown" && (
            <motion.div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-36 h-36 rounded-full bg-purple-600 flex flex-col items-center justify-center shadow-2xl"
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.1, 1] }}
                transition={{ duration: 0.4 }}
              >
                <span className="text-6xl font-extrabold text-white">3</span>
                <span className="text-purple-200 text-sm font-bold">Hazır ol!</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Controls ── */}
        <div className="flex flex-col gap-3 pb-6">
          {phase === "idle" && (
            <motion.button
              data-testid="button-start"
              className="w-full py-5 rounded-3xl text-xl font-extrabold text-white shadow-xl cursor-pointer flex items-center justify-center gap-3"
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={startExercise}
            >
              <Play className="w-6 h-6" />
              Başlat ve Vur!
            </motion.button>
          )}

          {phase === "playing" && (
            <div className="flex flex-col gap-3">
              <p className="text-center font-extrabold text-purple-600 text-lg">
                🎵 Ritme eşlik et — DOKUN!
              </p>
              <motion.button
                data-testid="button-tap"
                className="w-full py-10 rounded-3xl text-2xl font-extrabold text-white shadow-2xl cursor-pointer flex flex-col items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                  border: "4px solid rgba(255,255,255,0.4)",
                }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(124,58,237,0.5)",
                    `0 0 0 ${Math.round(bpm / 10)}px rgba(124,58,237,0)`,
                    "0 0 0 0 rgba(124,58,237,0)",
                  ],
                }}
                transition={{ duration: beatMs / 1000, repeat: Infinity }}
                onPointerDown={handleTap}
              >
                <span className="text-5xl">🥁</span>
                <span>DOKUN!</span>
              </motion.button>
              <p className="text-center text-xs text-muted-foreground font-semibold">
                Boşluk tuşu ile de vurabilirsin
              </p>
            </div>
          )}

          {phase === "result" && (
            <motion.button
              data-testid="button-next"
              className="w-full py-5 rounded-3xl text-xl font-extrabold text-white shadow-xl cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: feedback?.correct
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #f97316, #ea580c)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={nextExercise}
            >
              {exerciseIdx + 1 >= PATTERNS_PER_LEVEL ? (
                <><span>🏁 Seviyeyi Bitir</span></>
              ) : (
                <><ChevronRight className="w-6 h-6" /> Sonraki Egzersiz</>
              )}
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}
