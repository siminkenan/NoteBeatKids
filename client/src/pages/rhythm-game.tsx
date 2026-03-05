import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VexFlowRenderer, type NoteData } from "@/components/vexflow-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music, Play, Square, Volume2 } from "lucide-react";
import type { StudentProgress } from "@shared/schema";

// Rhythm patterns by level
const LEVELS: Record<number, { name: string; description: string; patterns: NoteData[][] }> = {
  1: {
    name: "Seviye 1 - Yarım & Dörtlük Notalar",
    description: "Yarım ve dörtlük notalarla ritme eşlik et",
    patterns: [
      [{ keys: ["b/4"], duration: "h" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }],
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "h" }],
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }],
    ],
  },
  2: {
    name: "Seviye 2 - Dörtlük Suslar",
    description: "Yarım, dörtlük notalar ve dörtlük suslar",
    patterns: [
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "qr" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }],
      [{ keys: ["b/4"], duration: "h" }, { keys: ["b/4"], duration: "qr" }, { keys: ["b/4"], duration: "q" }],
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "qr" }, { keys: ["b/4"], duration: "q" }],
    ],
  },
  3: {
    name: "Seviye 3 - Yarım Suslar",
    description: "Kalıplara yarım suslar ekleniyor",
    patterns: [
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "hr" }],
      [{ keys: ["b/4"], duration: "h" }, { keys: ["b/4"], duration: "hr" }],
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "hr" }, { keys: ["b/4"], duration: "q" }],
    ],
  },
  4: {
    name: "Seviye 4 - Sekizlik Notalar",
    description: "Hızlı sekizlik notalar eklendi!",
    patterns: [
      [{ keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }],
      [{ keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "h" }],
      [{ keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "h" }],
    ],
  },
  5: {
    name: "Seviye 5 - Karışık Ritimler",
    description: "Tüm nota türleri bir arada!",
    patterns: [
      [{ keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "qr" }, { keys: ["b/4"], duration: "q" }, { keys: ["b/4"], duration: "q" }],
      [{ keys: ["b/4"], duration: "h" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "8" }, { keys: ["b/4"], duration: "qr" }],
    ],
  },
};

// Duration in beats
const DURATION_BEATS: Record<string, number> = {
  "w": 4, "wr": 4,
  "h": 2, "hr": 2,
  "q": 1, "qr": 1,
  "8": 0.5, "8r": 0.5,
};

// Is a rest?
const IS_REST: Record<string, boolean> = {
  "wr": true, "hr": true, "qr": true, "8r": true,
};

export default function RhythmGame() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const qc = useQueryClient();

  const [level, setLevel] = useState(1);
  const [patternIndex, setPatternIndex] = useState(0);
  const [bpm, setBpm] = useState(80);
  const [phase, setPhase] = useState<"idle" | "listening" | "tapping" | "result">("idle");
  const [tapResults, setTapResults] = useState<boolean[]>([]);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [totalStars, setTotalStars] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [countdown, setCountdown] = useState(0);
  const [metronomeActive, setMetronomeActive] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [gameMessage, setGameMessage] = useState("");

  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapTimeRef = useRef<number[]>([]);
  const tapIndexRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const sessionStartRef = useRef(Date.now());

  const { data: progress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`/api/student/${student!.student.id}/progress`);
      return res.json();
    },
    enabled: !!student,
  });

  useEffect(() => {
    if (!student) { navigate("/student/login"); return; }
    const rhythmProgress = progress?.find(p => p.appType === "rhythm");
    if (rhythmProgress) {
      setLevel(rhythmProgress.level);
      setScore({ correct: rhythmProgress.correctAnswers, wrong: rhythmProgress.wrongAnswers });
      setTotalStars(rhythmProgress.starsEarned);
    }
  }, [student, progress]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const playClick = useCallback((isAccent = false) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = isAccent ? 880 : 660;
      gain.gain.setValueAtTime(isAccent ? 0.4 : 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch {}
  }, []);

  const playTapSound = useCallback((correct: boolean) => {
    try {
      const ctx = getAudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = correct ? 523 : 200;
      osc.type = correct ? "sine" : "sawtooth";
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {}
  }, []);

  const startMetronome = useCallback((bpmValue: number) => {
    if (metronomeRef.current) clearInterval(metronomeRef.current);
    const interval = (60 / bpmValue) * 1000;
    let beat = 0;
    playClick(true);
    setCurrentBeat(0);
    metronomeRef.current = setInterval(() => {
      beat = (beat + 1) % 4;
      setCurrentBeat(beat);
      playClick(beat === 0);
    }, interval);
    setMetronomeActive(true);
  }, [playClick]);

  const stopMetronome = useCallback(() => {
    if (metronomeRef.current) {
      clearInterval(metronomeRef.current);
      metronomeRef.current = null;
    }
    setMetronomeActive(false);
  }, []);

  const currentLevel = LEVELS[Math.min(level, 5)];
  const patterns = currentLevel?.patterns ?? [];
  const currentPattern = patterns[patternIndex % patterns.length];

  const getExpectedBeats = useCallback(() => {
    if (!currentPattern) return [];
    const beats: number[] = [];
    let time = 0;
    const beatDurationMs = (60 / bpm) * 1000;
    currentPattern.forEach(note => {
      const dur = DURATION_BEATS[note.duration] ?? 1;
      if (!IS_REST[note.duration]) {
        beats.push(time);
      }
      time += dur * beatDurationMs;
    });
    return beats;
  }, [currentPattern, bpm]);

  const startExercise = useCallback(() => {
    tapTimeRef.current = [];
    tapIndexRef.current = 0;
    setTapResults([]);
    setFeedback(null);
    setHighlightIdx(-1);
    setGameMessage("");

    setPhase("listening");
    setCountdown(3);

    let count = 3;
    const countInterval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countInterval);
        startMetronome(bpm);
        setPhase("tapping");
        gameStartTimeRef.current = Date.now();
        setGameMessage("Ritme dokun!");

        const beatDuration = (60 / bpm) * 1000;
        const totalDuration = currentPattern.reduce((acc, n) => acc + (DURATION_BEATS[n.duration] ?? 1), 0) * beatDuration;

        // Auto-highlight notes
        let elapsed = 0;
        currentPattern.forEach((note, i) => {
          const dur = DURATION_BEATS[note.duration] ?? 1;
          setTimeout(() => setHighlightIdx(i), elapsed);
          elapsed += dur * beatDuration;
        });

        setTimeout(() => {
          setHighlightIdx(-1);
          stopMetronome();
          setPhase("result");
          evaluateTaps();
        }, totalDuration + beatDuration);
      }
    }, 1000);
  }, [bpm, currentPattern, startMetronome, stopMetronome]);

  const evaluateTaps = useCallback(() => {
    const expected = getExpectedBeats();
    const taps = tapTimeRef.current;
    const tolerance = (60 / bpm) * 1000 * 0.35;

    let results: boolean[] = [];
    let matched = new Set<number>();

    expected.forEach(expTime => {
      let bestDiff = Infinity;
      let bestIdx = -1;
      taps.forEach((tapTime, ti) => {
        if (matched.has(ti)) return;
        const diff = Math.abs(tapTime - expTime);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = ti; }
      });
      const ok = bestIdx >= 0 && bestDiff <= tolerance;
      if (ok) matched.add(bestIdx);
      results.push(ok);
    });

    const correct = results.filter(Boolean).length;
    const wrong = results.filter(b => !b).length;
    const allCorrect = correct === expected.length && wrong === 0;

    setTapResults(results);
    setFeedback(allCorrect ? "correct" : "wrong");
    setGameMessage(allCorrect ? "Mükemmel! Kusursuz ritim!" : `${correct}/${expected.length} vuruş doğru`);

    const stars = allCorrect ? 3 : correct > expected.length / 2 ? 1 : 0;
    const newCorrect = score.correct + correct;
    const newWrong = score.wrong + wrong;
    const newStars = totalStars + stars;
    const newLevel = allCorrect && patternIndex >= patterns.length - 1 ? Math.min(level + 1, 6) : level;

    setScore({ correct: newCorrect, wrong: newWrong });
    setTotalStars(newStars);

    if (student) {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      apiRequest("POST", `/api/student/${student.student.id}/progress`, {
        appType: "rhythm",
        level: newLevel,
        starsEarned: newStars,
        correctAnswers: newCorrect,
        wrongAnswers: newWrong,
        timeSpentSeconds: elapsed,
      }).then(() => qc.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }));
    }
  }, [getExpectedBeats, bpm, score, totalStars, level, patternIndex, patterns.length, student, qc]);

  const handleTapFixed = useCallback(() => {
    if (phase !== "tapping") return;
    const elapsed = Date.now() - gameStartTimeRef.current;
    tapTimeRef.current.push(elapsed);
    playTapSound(true);
  }, [phase, playTapSound]);

  const nextPattern = () => {
    const nextIdx = (patternIndex + 1) % patterns.length;
    setPatternIndex(nextIdx);
    if (feedback === "correct" && patternIndex >= patterns.length - 1) {
      setLevel(l => Math.min(l + 1, 6));
    }
    setPhase("idle");
    setFeedback(null);
    setGameMessage("");
    setTapResults([]);
  };

  const BPM_OPTIONS = [60, 70, 80, 90, 100, 110, 120];

  if (!student) return null;

  return (
    <div className="min-h-screen select-none"
      style={{ background: "linear-gradient(160deg, #fff3e0 0%, #ffe0b2 50%, #ffd7b0 100%)" }}
      onKeyDown={e => e.code === "Space" && handleTapFixed()}
      tabIndex={0}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { stopMetronome(); navigate("/student/home"); }} className="gap-1.5 rounded-xl font-bold">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥁</span>
            <h1 className="font-extrabold text-lg text-orange-700">Ritmi Yakala</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-500">⭐</span>
            <span className="font-extrabold text-yellow-700 text-sm" data-testid="text-stars">{totalStars}</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Level & Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/80 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-orange-500">{level}</p>
            <p className="text-xs text-muted-foreground font-bold">Seviye</p>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-green-500">{score.correct}</p>
            <p className="text-xs text-muted-foreground font-bold">Doğru</p>
          </div>
          <div className="bg-white/80 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-extrabold text-red-400">{score.wrong}</p>
            <p className="text-xs text-muted-foreground font-bold">Kaçırılan</p>
          </div>
        </div>

        {/* Level name */}
        <div className="text-center">
          <Badge className="font-extrabold text-sm px-4 py-1.5 rounded-full bg-orange-500 text-white border-0">
            {currentLevel?.name}
          </Badge>
          <p className="text-sm text-muted-foreground font-semibold mt-1">{currentLevel?.description}</p>
        </div>

        {/* Metronome beats */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3].map(beat => (
            <motion.div
              key={beat}
              className="w-10 h-10 rounded-full border-2"
              style={{
                background: metronomeActive && currentBeat === beat
                  ? beat === 0 ? "#f97316" : "#fbbf24"
                  : "white",
                borderColor: beat === 0 ? "#f97316" : "#d1d5db",
              }}
              animate={metronomeActive && currentBeat === beat ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.15 }}
            />
          ))}
        </div>

        {/* VexFlow notation */}
        <div className="bg-white rounded-3xl p-4 shadow-md overflow-x-auto">
          <p className="text-xs font-extrabold text-muted-foreground text-center mb-3 uppercase tracking-widest">Ritim Kalıbı</p>
          <div className="flex justify-center">
            <VexFlowRenderer
              notes={currentPattern ?? []}
              width={500}
              height={130}
              showClef
              showTimeSignature
              highlightIndex={highlightIdx}
            />
          </div>
        </div>

        {/* BPM selector */}
        <div className="bg-white/80 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Volume2 className="w-4 h-4 text-orange-500" />
            <p className="font-extrabold text-sm text-foreground">Tempo: {bpm} BPM</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {BPM_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => { setBpm(b); if (metronomeActive) { stopMetronome(); setTimeout(() => startMetronome(b), 100); } }}
                className={`px-3 py-1.5 rounded-xl text-sm font-extrabold cursor-pointer border-2 transition-all ${b === bpm ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"}`}
                data-testid={`button-bpm-${b}`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Countdown overlay */}
        <AnimatePresence>
          {phase === "listening" && countdown > 0 && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center bg-black/40 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="w-32 h-32 rounded-full bg-orange-500 flex items-center justify-center shadow-2xl"
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
              >
                <span className="text-6xl font-extrabold text-white">{countdown}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback overlay */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              className="rounded-2xl p-4 text-center"
              style={{ background: feedback === "correct" ? "#dcfce7" : "#fee2e2" }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-4xl mb-2">{feedback === "correct" ? "🎉" : "🤔"}</p>
              <p className={`text-xl font-extrabold ${feedback === "correct" ? "text-green-600" : "text-red-500"}`}>
                {gameMessage}
              </p>
              {tapResults.length > 0 && (
                <div className="flex justify-center gap-2 mt-3">
                  {tapResults.map((ok, i) => (
                    <span key={i} className={`text-xl ${ok ? "text-green-500" : "text-red-400"}`}>{ok ? "✓" : "✗"}</span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls */}
        <div className="flex flex-col gap-4">
          {phase === "idle" && (
            <motion.button
              data-testid="button-start"
              className="w-full py-5 rounded-3xl text-xl font-extrabold text-white shadow-xl cursor-pointer flex items-center justify-center gap-3"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startExercise}
            >
              <Play className="w-6 h-6" />
              Alıştırmayı Başlat
            </motion.button>
          )}

          {phase === "tapping" && (
            <>
              <p className="text-center font-extrabold text-orange-600">{gameMessage}</p>
              <motion.button
                data-testid="button-tap"
                className="w-full py-8 rounded-3xl text-2xl font-extrabold text-white shadow-2xl cursor-pointer flex items-center justify-center gap-3 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #f97316, #ea580c)",
                  border: "4px solid rgba(255,255,255,0.5)",
                }}
                animate={{ boxShadow: ["0 0 0 0 rgba(249,115,22,0.4)", "0 0 0 20px rgba(249,115,22,0)", "0 0 0 0 rgba(249,115,22,0)"] }}
                transition={{ duration: (60 / bpm), repeat: Infinity }}
                onPointerDown={handleTapFixed}
              >
                <span className="text-4xl">🥁</span>
                DOKUN!
              </motion.button>
              <p className="text-center text-xs text-muted-foreground font-semibold">BOŞLUK tuşu ile de çalışır</p>
            </>
          )}

          {phase === "result" && (
            <motion.button
              data-testid="button-next"
              className="w-full py-5 rounded-3xl text-xl font-extrabold text-white shadow-xl cursor-pointer"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={nextPattern}
            >
              Sonraki Kalıp →
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}
