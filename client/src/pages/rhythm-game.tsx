import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VexFlowRenderer, type NoteData } from "@/components/vexflow-renderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
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
const PASS_SCORE = 3;
const MAX_RETRIES = 3; // 3 extra tries = 4 total attempts per exercise

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

// Distinct drum hit for tapping feedback: layered kick + noise burst
function playDrumHit(ctx: AudioContext) {
  try {
    // Layer 1: kick drum body (sine sweep down)
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.connect(kickGain);
    kickGain.connect(ctx.destination);
    kick.type = "sine";
    kick.frequency.setValueAtTime(180, ctx.currentTime);
    kick.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);
    kickGain.gain.setValueAtTime(1.2, ctx.currentTime);
    kickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    kick.start(ctx.currentTime);
    kick.stop(ctx.currentTime + 0.25);

    // Layer 2: sharp attack click (high sine burst)
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.type = "square";
    click.frequency.value = 800;
    clickGain.gain.setValueAtTime(0.5, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    click.start(ctx.currentTime);
    click.stop(ctx.currentTime + 0.04);

    // Layer 3: noise burst for snare texture
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 3000;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(0.4, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    noise.start(ctx.currentTime);
  } catch {}
}

// Precise metronome click at a specific Web Audio time
function scheduleClick(ctx: AudioContext, time: number, accent: boolean) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = accent ? 1000 : 700;
    gain.gain.setValueAtTime(accent ? 0.35 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    osc.start(time);
    osc.stop(time + 0.06);
  } catch {}
}

// Phase type: listen first, then tap (no countdown between listen→tap)
type Phase = "idle" | "listen_countdown" | "listening" | "tap_ready" | "tapping" | "result" | "levelup";
// count-in beats remaining (4→3→2→1) shown during tap_ready phase
// stored separately so we don't interfere with currentBeat

// ─── Main Component ────────────────────────────────────────────────────────────
export default function RhythmGame() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const qc = useQueryClient();

  const [level, setLevel] = useState(1);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [exerciseResults, setExerciseResults] = useState<boolean[]>([]);
  const [bpm, setBpm] = useState(80);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [feedback, setFeedback] = useState<null | { correct: boolean; accuracy: number; hits: number; total: number }>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const [hitNoteIndices, setHitNoteIndices] = useState<Set<number>>(new Set());
  const [wrongTapMarkers, setWrongTapMarkers] = useState<number[]>([]);
  const [countInRemaining, setCountInRemaining] = useState(4);
  const [retryCount, setRetryCount] = useState(0);
  const [retryPending, setRetryPending] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const gameStartRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const hitNoteIndicesRef = useRef<Set<number>>(new Set());
  const tapRafRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const retryAutoStartRef = useRef(false);

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
    if (tapRafRef.current) {
      cancelAnimationFrame(tapRafRef.current);
      tapRafRef.current = null;
    }
    setCurrentBeat(-1);
  }, []);

  // Expected beats with their pattern note index (non-rest notes only)
  const getExpectedBeatNotes = useCallback(() => {
    const beatMs = (60 / bpm) * 1000;
    const result: { time: number; patternIdx: number }[] = [];
    let t = 0;
    currentPattern.forEach((note, i) => {
      if (!IS_REST[note.duration]) result.push({ time: t, patternIdx: i });
      t += (BEAT_VAL[note.duration] ?? 1) * beatMs;
    });
    return result;
  }, [currentPattern, bpm]);

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

  // ─── Helper: run a 3-2-1 countdown then call onDone ─────────────────────────
  const runCountdown = useCallback((onDone: () => void) => {
    setCountdown(3);
    let c = 3;
    const tick = setInterval(() => {
      c--;
      setCountdown(c);
      if (c <= 0) {
        clearInterval(tick);
        onDone();
      }
    }, 1000);
  }, []);

  // ─── Unified listen → 4-beat count-in → auto-tap (Web Audio throughout) ──────
  const playPatternThenAutoTap = useCallback(() => {
    const ctx = getAudioCtx();
    const beatSec = 60 / bpm;
    const beatMs = beatSec * 1000;
    const totalBeats = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0);
    const COUNT_IN = 4; // beats of silence after listen before tapping

    // Schedule ALL metronome clicks: listen + count-in + tapping window
    const audioStart = ctx.currentTime + 0.05;
    const totalClicksNeeded = Math.ceil(totalBeats) + COUNT_IN + Math.ceil(totalBeats) + 2;
    for (let i = 0; i < totalClicksNeeded; i++) {
      scheduleClick(ctx, audioStart + i * beatSec, i % 4 === 0);
    }

    const wallStart = Date.now() + (audioStart - ctx.currentTime) * 1000; // ≈ Date.now()+50ms
    const listenEndWall = wallStart + totalBeats * beatMs;
    const tapStartWall = listenEndWall + COUNT_IN * beatMs;
    const tapEndWall = tapStartWall + totalBeats * beatMs;

    // gameStartRef aligned with tap window start
    gameStartRef.current = tapStartWall;

    // Visual beat (runs through all phases)
    const updateBeat = () => {
      const elapsed = (Date.now() - wallStart) / 1000;
      if (elapsed >= 0) setCurrentBeat(Math.floor(elapsed / beatSec) % 4);
      tapRafRef.current = requestAnimationFrame(updateBeat);
    };
    tapRafRef.current = requestAnimationFrame(updateBeat);

    // Note highlights during listen
    let elapsed = wallStart - Date.now(); // initial delay
    currentPattern.forEach((note, i) => {
      setTimeout(() => setHighlightIdx(i), Math.max(0, elapsed));
      elapsed += (BEAT_VAL[note.duration] ?? 1) * beatMs;
    });
    setTimeout(() => setHighlightIdx(-1), listenEndWall - Date.now());

    // Count-in phase: show 4→3→2→1
    for (let b = 0; b < COUNT_IN; b++) {
      setTimeout(() => setCountInRemaining(COUNT_IN - b), listenEndWall - Date.now() + b * beatMs);
    }
    setTimeout(() => setPhase("tap_ready"), listenEndWall - Date.now() + 10);

    // Auto-start tapping after count-in
    setTimeout(() => {
      tapTimesRef.current = [];
      hitNoteIndicesRef.current = new Set();
      setHitNoteIndices(new Set());
      setWrongTapMarkers([]);
      setPhase("tapping");
    }, tapStartWall - Date.now() + 10);

    // End tapping
    setTimeout(() => {
      if (tapRafRef.current) { cancelAnimationFrame(tapRafRef.current); tapRafRef.current = null; }
      setCurrentBeat(-1);
      setPhase("result");
      evaluateTaps();
    }, tapEndWall - Date.now() + beatMs * 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, currentPattern]);

  // ─── PHASE 1: Start listening ────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (phase !== "idle") return;
    setFeedback(null);
    setHighlightIdx(-1);
    setHitNoteIndices(new Set());
    setWrongTapMarkers([]);
    hitNoteIndicesRef.current = new Set();
    setPhase("listen_countdown");

    runCountdown(() => {
      setPhase("listening");
      playPatternThenAutoTap();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runCountdown, playPatternThenAutoTap]);

  // startTapping kept for keyboard shortcut compatibility (Space during tap_ready)
  const startTapping = useCallback(() => {
    // no-op: tapping now starts automatically after count-in
  }, []);

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

    if (correct || retryCountRef.current >= MAX_RETRIES) {
      // ── Exercise final result (correct, or used all retries) ──
      if (correct) { playSuccess(); setCorrectCount(c => c + 1); }
      else          { playFail();   setWrongCount(w => w + 1); }
      setExerciseResults(prev => [...prev, correct]);
      retryCountRef.current = 0;
      setRetryCount(0);
      setRetryPending(false);
    } else {
      // ── Wrong but retries remain → auto-restart ──
      playFail();
      setWrongCount(w => w + 1);
      retryCountRef.current++;
      setRetryCount(retryCountRef.current);
      setRetryPending(true);
      retryAutoStartRef.current = true;
      setTimeout(() => {
        setFeedback(null);
        setHighlightIdx(-1);
        setHitNoteIndices(new Set());
        setWrongTapMarkers([]);
        hitNoteIndicesRef.current = new Set();
        setRetryPending(false);
        setPhase("idle");
      }, 1800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getExpectedBeats, bpm, playSuccess, playFail]);

  // ─── Handle tap — real-time green/red feedback ───────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== "tapping") return;
    const t = Date.now() - gameStartRef.current;
    if (t < 0) return; // before audio start
    tapTimesRef.current.push(t);
    playDrumHit(getAudioCtx());

    const beatNotes = getExpectedBeatNotes();
    const tolerance = (60 / bpm) * 1000 * 0.38;

    let bestDiff = Infinity;
    let bestNote: { time: number; patternIdx: number } | null = null;
    beatNotes.forEach(bn => {
      if (hitNoteIndicesRef.current.has(bn.patternIdx)) return;
      const d = Math.abs(t - bn.time);
      if (d < bestDiff) { bestDiff = d; bestNote = bn; }
    });

    if (bestNote !== null && bestDiff <= tolerance) {
      hitNoteIndicesRef.current = new Set([...hitNoteIndicesRef.current, bestNote.patternIdx]);
      setHitNoteIndices(new Set(hitNoteIndicesRef.current));
    } else {
      const totalMs = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0) * (60 / bpm) * 1000;
      const pct = Math.min(Math.max((t / totalMs) * 100, 0), 100);
      setWrongTapMarkers(prev => [...prev, pct]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bpm, currentPattern, getExpectedBeatNotes]);

  // Keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "idle") startListening();
        else if (phase === "tapping") handleTap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap, phase, startListening]);

  // Auto-restart after retry: when phase returns to idle and flag is set
  useEffect(() => {
    if (phase === "idle" && retryAutoStartRef.current) {
      retryAutoStartRef.current = false;
      startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      setHitNoteIndices(new Set());
      setWrongTapMarkers([]);
      hitNoteIndicesRef.current = new Set();
      retryCountRef.current = 0;
      setRetryCount(0);
      setRetryPending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdx, exerciseResults, level, playLevelUp]);

  const startNewLevel = () => {
    setExerciseIdx(0);
    setExerciseResults([]);
    setFeedback(null);
    setHighlightIdx(-1);
    setHitNoteIndices(new Set());
    setWrongTapMarkers([]);
    hitNoteIndicesRef.current = new Set();
    retryCountRef.current = 0;
    setRetryCount(0);
    setRetryPending(false);
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
              hitIndices={hitNoteIndices}
            />
          </div>

          {/* ── Tap timeline (shown during tapping and result) ── */}
          {(phase === "tapping" || phase === "result") && (() => {
            const beatMs = (60 / bpm) * 1000;
            const totalBeats = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0);
            const totalMs = totalBeats * beatMs;
            const expectedBeatNotes = (() => {
              const res: { pct: number; hit: boolean }[] = [];
              let t = 0;
              currentPattern.forEach((note, i) => {
                if (!IS_REST[note.duration]) {
                  res.push({ pct: (t / totalMs) * 100, hit: hitNoteIndices.has(i) });
                }
                t += (BEAT_VAL[note.duration] ?? 1) * beatMs;
              });
              return res;
            })();
            return (
              <div className="mt-4">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1.5">Vuruş Çizelgesi</p>
                <div className="relative h-9 bg-purple-50 rounded-xl border border-purple-100 overflow-visible">
                  {/* Expected beat marks */}
                  {expectedBeatNotes.map(({ pct, hit }, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full flex flex-col items-center justify-center"
                      style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
                    >
                      <div className={`w-2 h-full rounded-full opacity-30 ${hit ? "bg-green-500" : "bg-purple-400"}`} />
                    </div>
                  ))}
                  {/* Wrong tap red markers */}
                  {wrongTapMarkers.map((pct, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${pct}%` }}
                    >
                      <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center text-white text-[9px] font-black">
                        ✗
                      </div>
                    </div>
                  ))}
                  {/* Correctly hit green markers */}
                  {expectedBeatNotes.map(({ pct, hit }, i) => hit && (
                    <div
                      key={`h${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${pct}%` }}
                    >
                      <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center text-white text-[9px] font-black">
                        ✓
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-semibold">
                  <span>Başlangıç</span>
                  {wrongTapMarkers.length > 0 && (
                    <span className="text-red-400 font-bold">{wrongTapMarkers.length} yanlış vuruş</span>
                  )}
                  <span>Bitiş</span>
                </div>
              </div>
            );
          })()}
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
            step={1}
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
              className={`rounded-2xl p-4 text-center border-2 ${feedback.correct ? "bg-green-50 border-green-300" : retryPending ? "bg-orange-50 border-orange-300" : "bg-red-50 border-red-300"}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-4xl mb-1">{feedback.correct ? "🎉" : retryPending ? "🔄" : "😓"}</p>
              <p className={`text-lg font-extrabold ${feedback.correct ? "text-green-600" : retryPending ? "text-orange-600" : "text-red-500"}`}>
                {feedback.correct
                  ? "Mükemmel!"
                  : retryPending
                  ? `Olmadı — Tekrar! (${retryCount}/${MAX_RETRIES})`
                  : "Hepsi bitti!"}
              </p>
              <p className="text-xs font-semibold text-muted-foreground mt-1">
                {feedback.hits}/{feedback.total} vuruş doğru · %{feedback.accuracy} doğruluk
              </p>
              <div className="mt-2 h-2.5 bg-gray-200 rounded-full overflow-hidden">
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

        {/* ── Countdown overlay (only for listen phase) ── */}
        <AnimatePresence>
          {phase === "listen_countdown" && (
            <motion.div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                key={countdown}
                className="w-40 h-40 rounded-full bg-indigo-600 flex flex-col items-center justify-center shadow-2xl"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 0.35 }}
              >
                <span className="text-7xl font-extrabold text-white leading-none">{countdown}</span>
                <span className="text-white/70 text-sm font-bold mt-1">👂 Dinle!</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 3 Game Panels: Hazırlan / Sayma / Vurma ── */}
        <div className="flex flex-col gap-2.5 pb-6">

          {/* ── Panel 1: Hazırlan ── */}
          <div className={`rounded-2xl border-2 transition-colors duration-300 overflow-hidden ${
            phase === "listening" || phase === "listen_countdown"
              ? "border-indigo-300 bg-indigo-50"
              : phase === "tap_ready"
              ? "border-amber-300 bg-amber-50"
              : phase === "idle"
              ? "border-indigo-200 bg-indigo-50/60"
              : "border-gray-200 bg-gray-50/40 opacity-50"
          }`}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center ${
                phase === "idle" || phase === "listening" || phase === "listen_countdown" || phase === "tap_ready"
                  ? "bg-indigo-500" : "bg-gray-300"
              }`}>1</span>
              <p className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest">Hazırlan</p>
              {retryCount > 0 && phase !== "result" && (
                <span className="ml-auto text-xs font-bold text-orange-500 bg-orange-100 px-2 py-0.5 rounded-full">
                  Deneme {retryCount}/{MAX_RETRIES}
                </span>
              )}
            </div>
            <div className="px-4 pb-4">
              {phase === "idle" && (
                <motion.button
                  data-testid="button-listen"
                  className="w-full py-4 rounded-2xl text-lg font-extrabold text-white shadow-lg cursor-pointer flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #4f46e5, #3730a3)" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={startListening}
                >
                  <span className="text-xl">👂</span> Dinle ve İzle
                </motion.button>
              )}
              {(phase === "listen_countdown") && (
                <div className="text-center py-2">
                  <p className="text-sm font-bold text-indigo-500 mb-1">Hazırlanıyor…</p>
                  <motion.div key={countdown} className="text-5xl font-black text-indigo-600"
                    initial={{ scale: 1.5, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}>
                    {countdown}
                  </motion.div>
                </div>
              )}
              {phase === "listening" && (
                <div className="flex items-center justify-center gap-3 py-2">
                  <span className="text-2xl">🎵</span>
                  <p className="font-extrabold text-indigo-700">Dinliyorsun…</p>
                </div>
              )}
              {phase === "tap_ready" && (
                <div className="text-center py-1">
                  <p className="text-xs font-extrabold text-amber-600 uppercase tracking-widest mb-1">Metronoma eşlik et!</p>
                  <motion.div key={countInRemaining} className="text-6xl font-black text-purple-600"
                    initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18, ease: "easeOut" }}>
                    {countInRemaining}
                  </motion.div>
                </div>
              )}
              {(phase === "tapping" || phase === "result") && (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                  <span className="text-xl">✅</span>
                  <p className="font-extrabold text-sm">Hazırlık tamam</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Panel 2: Sayma ── */}
          <div className={`rounded-2xl border-2 transition-colors duration-300 ${
            phase === "listening" || phase === "tap_ready" || phase === "tapping"
              ? "border-purple-300 bg-purple-50"
              : "border-gray-200 bg-gray-50/40 opacity-50"
          }`}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-3">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center ${
                phase === "listening" || phase === "tap_ready" || phase === "tapping" ? "bg-purple-500" : "bg-gray-300"
              }`}>2</span>
              <p className="text-xs font-extrabold text-purple-600 uppercase tracking-widest">Sayma</p>
            </div>
            <div className="flex justify-center gap-3 px-4 pb-4">
              {[0, 1, 2, 3].map(beat => (
                <motion.div key={beat}
                  className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-sm font-extrabold"
                  style={{
                    borderColor: beat === 0 ? "#7c3aed" : "#c4b5fd",
                    background: currentBeat === beat && (phase === "tapping" || phase === "listening" || phase === "tap_ready")
                      ? beat === 0 ? "#7c3aed" : "#a78bfa" : "white",
                    color: currentBeat === beat && (phase === "tapping" || phase === "listening" || phase === "tap_ready") ? "white" : "#9ca3af",
                  }}
                  animate={currentBeat === beat && (phase === "tapping" || phase === "listening" || phase === "tap_ready") ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: beatMs / 1000, ease: "easeOut" }}
                >
                  {beat + 1}
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Panel 3: Vurma ── */}
          <div className={`rounded-2xl border-2 transition-colors duration-300 ${
            phase === "tapping" ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50/40 opacity-40"
          }`}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <span className={`w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center ${
                phase === "tapping" ? "bg-green-500" : "bg-gray-300"
              }`}>3</span>
              <p className="text-xs font-extrabold text-green-600 uppercase tracking-widest">Vurma</p>
            </div>
            <div className="px-4 pb-4">
              <motion.button
                data-testid="button-tap"
                className={`w-full py-10 rounded-2xl text-2xl font-extrabold flex flex-col items-center justify-center gap-1.5 transition-all ${
                  phase === "tapping"
                    ? "text-white shadow-2xl cursor-pointer"
                    : "text-gray-300 bg-gray-100 cursor-not-allowed shadow-none"
                }`}
                style={phase === "tapping" ? {
                  background: "linear-gradient(135deg, #16a34a, #15803d)",
                  border: "4px solid rgba(255,255,255,0.4)",
                } : {}}
                animate={phase === "tapping" ? {
                  boxShadow: ["0 0 0 0 rgba(22,163,74,0.6)", "0 0 0 18px rgba(22,163,74,0)", "0 0 0 0 rgba(22,163,74,0)"],
                } : {}}
                transition={{ duration: beatMs / 1000, repeat: phase === "tapping" ? Infinity : 0 }}
                onPointerDown={phase === "tapping" ? handleTap : undefined}
                disabled={phase !== "tapping"}
              >
                <span className="text-6xl">🥁</span>
                <span className={phase === "tapping" ? "text-white" : "text-gray-300"}>
                  {phase === "tapping" ? "DOKUN!" : "Bekliyor…"}
                </span>
                {phase === "tapping" && <span className="text-green-200 text-xs font-semibold">Boşluk tuşu da çalışır</span>}
              </motion.button>
            </div>
          </div>

          {/* ── Result: next button or retry message ── */}
          {phase === "result" && !retryPending && (
            <motion.button
              data-testid="button-next"
              className="w-full py-5 rounded-3xl text-xl font-extrabold text-white shadow-xl cursor-pointer flex items-center justify-center gap-2 mt-1"
              style={{
                background: feedback?.correct
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "linear-gradient(135deg, #f97316, #ea580c)",
              }}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={nextExercise}
            >
              {exerciseIdx + 1 >= PATTERNS_PER_LEVEL
                ? <span>🏁 Seviyeyi Bitir</span>
                : <><ChevronRight className="w-6 h-6" /> Sonraki Egzersiz</>}
            </motion.button>
          )}
        </div>
      </main>
    </div>
  );
}
