import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { VexFlowRenderer, type NoteData } from "@/components/vexflow-renderer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { StudentProgress } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_LEVEL = 6;
const PATTERNS_PER_LEVEL = 10;
const PASS_THRESHOLD = 7;   // 7/10 to pass a level
const MAX_RETRIES = 3;

const BEAT_VAL: Record<string, number> = {
  w: 4, wr: 4,
  h: 2, hr: 2,
  q: 1, qr: 1,
  "8": 0.5, "8r": 0.5,
};
const IS_REST: Record<string, boolean> = { wr: true, hr: true, qr: true, "8r": true };

// ─── Note builders ────────────────────────────────────────────────────────────
const n = (dur: string): NoteData => ({ keys: ["b/4"], duration: dur });
const r = (dur: string): NoteData => ({ keys: ["b/4"], duration: `${dur}r` });

// ─── Level metadata ───────────────────────────────────────────────────────────
const LEVEL_META: Record<number, { nameTr: string; desc: string; emoji: string }> = {
  1: { nameTr: "Tam ve Yarım Nota",   emoji: "🎵", desc: "Tam nota = 4 vuruş · Yarım nota = 2 vuruş" },
  2: { nameTr: "Yarım ve Dörtlük",    emoji: "🎶", desc: "Yarım nota = 2 vuruş · Dörtlük = 1 vuruş" },
  3: { nameTr: "Nota + Sus",          emoji: "🤫", desc: "Dörtlük sus = 1 vuruş sessizlik!" },
  4: { nameTr: "Karışık Ritimler",    emoji: "🔀", desc: "Tam, yarım, dörtlük ve sus bir arada" },
  5: { nameTr: "Sekizlik Notalar",    emoji: "⚡", desc: "Sekizlik = yarım vuruş (çift hız!)" },
  6: { nameTr: "Usta Ritimcisi",      emoji: "🏆", desc: "Tüm nota türleri karışık!" },
};

// ─── Pattern pools per level ───────────────────────────────────────────────────
// All patterns must total exactly 4 beats (4/4 time)
const POOLS: Record<number, NoteData[][]> = {
  // Level 1 — Whole (4b) + Half (2b)
  1: [
    [n("w")],
    [n("h"), n("h")],
    [n("w")],
    [n("h"), n("h")],
    [n("w")],
    [n("h"), n("h")],
  ],

  // Level 2 — Half (2b) + Quarter (1b)
  2: [
    [n("h"), n("h")],
    [n("h"), n("q"), n("q")],
    [n("q"), n("h"), n("q")],
    [n("q"), n("q"), n("h")],
    [n("q"), n("q"), n("q"), n("q")],
    [n("q"), n("q"), n("h")],
    [n("h"), n("q"), n("q")],
    [n("q"), n("h"), n("q")],
  ],

  // Level 3 — Half (2b) + Quarter (1b) + Quarter Rest (1b)
  3: [
    [n("h"), n("q"), r("q")],
    [n("h"), r("q"), n("q")],
    [n("q"), n("h"), r("q")],
    [r("q"), n("h"), n("q")],
    [n("q"), r("q"), n("h")],
    [r("q"), n("q"), n("h")],
    [n("q"), r("q"), n("q"), n("q")],
    [n("q"), n("q"), r("q"), n("q")],
    [r("q"), n("q"), n("q"), n("q")],
    [n("q"), n("q"), n("q"), r("q")],
    [n("q"), r("q"), n("q"), r("q")],
    [r("q"), n("q"), r("q"), n("q")],
    [n("h"), n("q"), n("q")],
  ],

  // Level 4 — Mix of all L1–L3 (Whole, Half, Quarter, Quarter Rest)
  4: [
    [n("w")],
    [n("h"), n("h")],
    [n("h"), n("q"), n("q")],
    [n("q"), n("h"), n("q")],
    [n("q"), n("q"), n("h")],
    [n("q"), n("q"), n("q"), n("q")],
    [n("h"), n("q"), r("q")],
    [n("h"), r("q"), n("q")],
    [n("q"), n("h"), r("q")],
    [r("q"), n("h"), n("q")],
    [n("q"), r("q"), n("h")],
    [n("q"), r("q"), n("q"), n("q")],
    [n("q"), n("q"), r("q"), n("q")],
    [r("q"), n("q"), n("q"), n("q")],
    [n("q"), n("q"), n("q"), r("q")],
    [n("q"), r("q"), n("q"), r("q")],
  ],

  // Level 5 — Eighth (0.5b) + Quarter (1b) + Half (2b)
  5: [
    [n("h"), n("8"), n("8"), n("q")],
    [n("h"), n("q"), n("8"), n("8")],
    [n("q"), n("8"), n("8"), n("h")],
    [n("8"), n("8"), n("q"), n("h")],
    [n("8"), n("8"), n("8"), n("8"), n("q"), n("q")],
    [n("8"), n("8"), n("8"), n("8"), n("h")],
    [n("h"), n("8"), n("8"), n("8"), n("8")],
    [n("q"), n("8"), n("8"), n("q"), n("q")],
    [n("8"), n("8"), n("q"), n("q"), n("q")],
    [n("q"), n("q"), n("q"), n("8"), n("8")],
    [n("q"), n("q"), n("8"), n("8"), n("q")],
    [n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8"), n("8")],
    [n("q"), n("8"), n("8"), n("8"), n("8"), n("q")],
    [n("8"), n("8"), n("q"), n("8"), n("8"), n("q")],
  ],

  // Level 6 — All note types combined
  6: [
    [n("w")],
    [n("h"), n("h")],
    [n("h"), n("q"), r("q")],
    [n("h"), r("q"), n("q")],
    [n("q"), n("h"), r("q")],
    [r("q"), n("h"), n("q")],
    [n("q"), r("q"), n("h")],
    [n("q"), n("q"), n("q"), n("q")],
    [n("q"), r("q"), n("q"), n("q")],
    [n("q"), n("q"), r("q"), n("q")],
    [n("h"), n("8"), n("8"), n("q")],
    [n("h"), n("q"), n("8"), n("8")],
    [n("8"), n("8"), n("8"), n("8"), n("q"), n("q")],
    [n("8"), n("8"), n("8"), n("8"), n("h")],
    [n("h"), n("8"), n("8"), n("8"), n("8")],
    [n("q"), n("8"), n("8"), n("q"), n("q")],
    [n("8"), n("8"), n("q"), n("q"), n("q")],
    [n("q"), n("q"), n("q"), n("8"), n("8")],
    [n("q"), n("8"), n("8"), n("8"), n("8"), n("q")],
    [n("8"), n("8"), n("q"), n("8"), n("8"), n("q")],
    [n("q"), n("q"), n("8"), n("8"), n("q")],
  ],
};

function generateLevelPatterns(levelNum: number): NoteData[][] {
  const pool = POOLS[Math.min(levelNum, 6)] ?? POOLS[6];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const result: NoteData[][] = [];
  for (let i = 0; i < PATTERNS_PER_LEVEL; i++) result.push(shuffled[i % shuffled.length]);
  return result;
}

// ─── Badge helpers ────────────────────────────────────────────────────────────
type Badge = "bronze" | "silver" | "gold" | null;
const BADGE_ORDER: Badge[] = [null, "bronze", "silver", "gold"];
function nextBadge(current: Badge): Badge {
  const idx = BADGE_ORDER.indexOf(current);
  return BADGE_ORDER[Math.min(idx + 1, BADGE_ORDER.length - 1)];
}
const BADGE_EMOJI: Record<string, string> = { bronze: "🥉", silver: "🥈", gold: "🥇" };
const BADGE_TR: Record<string, string> = { bronze: "Bronz Rozet", silver: "Gümüş Rozet", gold: "Altın Rozet" };
const BADGE_COLOR: Record<string, string> = { bronze: "#b87333", silver: "#aaa9ad", gold: "#d4af37" };

// ─── Audio ────────────────────────────────────────────────────────────────────
function makeAudioCtx() { return new AudioContext(); }
function playTone(ctx: AudioContext, freq: number, type: OscillatorType, dur: number, vol = 0.3) {
  try {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
  } catch {}
}
function playDrumHit(ctx: AudioContext) {
  try {
    const k = ctx.createOscillator(); const kg = ctx.createGain();
    k.connect(kg); kg.connect(ctx.destination);
    k.type = "sine"; k.frequency.setValueAtTime(180, ctx.currentTime);
    k.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);
    kg.gain.setValueAtTime(1.2, ctx.currentTime);
    kg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    k.start(ctx.currentTime); k.stop(ctx.currentTime + 0.25);
    const n2 = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.06), ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n2.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 3000;
    const ng = ctx.createGain();
    n2.connect(f); f.connect(ng); ng.connect(ctx.destination);
    ng.gain.setValueAtTime(0.4, ctx.currentTime);
    ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    n2.start(ctx.currentTime);
  } catch {}
}
function scheduleClick(ctx: AudioContext, time: number, accent: boolean) {
  try {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "square"; o.frequency.value = accent ? 1000 : 700;
    g.gain.setValueAtTime(accent ? 0.35 : 0.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
    o.start(time); o.stop(time + 0.06);
  } catch {}
}

type Phase = "idle" | "listen_countdown" | "listening" | "tap_ready" | "tapping" | "result" | "levelup" | "complete";

// ─── Component ────────────────────────────────────────────────────────────────
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
  const beatDotsRef = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const [feedback, setFeedback] = useState<{ correct: boolean; accuracy: number; hits: number; total: number } | null>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [hitNoteIndices, setHitNoteIndices] = useState<Set<number>>(new Set());
  const [wrongTapMarkers, setWrongTapMarkers] = useState<number[]>([]);
  const [countInRemaining, setCountInRemaining] = useState(4);
  const [retryCount, setRetryCount] = useState(0);
  const [retryPending, setRetryPending] = useState(false);
  const [badge, setBadge] = useState<Badge>(null);
  const [earnedBadge, setEarnedBadge] = useState<Badge>(null); // shown in completion screen
  const [levelStarsEarned, setLevelStarsEarned] = useState(0); // for levelup screen

  const audioCtxRef = useRef<AudioContext | null>(null);
  const tapRafRef = useRef<number | null>(null);
  const tapTimesRef = useRef<number[]>([]);
  const gameStartRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const hitNoteIndicesRef = useRef<Set<number>>(new Set());
  const retryCountRef = useRef(0);
  const retryAutoStartRef = useRef(false);
  const levelPatternsRef = useRef<NoteData[][]>([]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") audioCtxRef.current = makeAudioCtx();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playSuccess = useCallback(() => {
    const ctx = getAudioCtx();
    [523, 659, 784].forEach((f, i) => setTimeout(() => playTone(ctx, f, "sine", 0.3, 0.5), i * 120));
  }, []);
  const playFail = useCallback(() => { playTone(getAudioCtx(), 280, "sawtooth", 0.4, 0.4); }, []);
  const playLevelUp = useCallback(() => {
    const ctx = getAudioCtx();
    [392, 523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(ctx, f, "sine", 0.4, 0.6), i * 100));
  }, []);
  const playComplete = useCallback(() => {
    const ctx = getAudioCtx();
    [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => playTone(ctx, f, "sine", 0.5, 0.8), i * 150));
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

  useEffect(() => { if (!student) navigate("/student/login"); }, [student, navigate]);

  useEffect(() => {
    const p = savedProgress?.find(p => p.appType === "rhythm");
    if (p) {
      setLevel(Math.min(Math.max(p.level, 1), MAX_LEVEL));
      setTotalStars(p.starsEarned);
      setCorrectCount(p.correctAnswers);
      setWrongCount(p.wrongAnswers);
      setBadge((p.notesBadge as Badge) ?? null);
    }
  }, [savedProgress]);

  // Generate patterns when level changes
  useEffect(() => {
    levelPatternsRef.current = generateLevelPatterns(level);
  }, [level]);

  const currentPattern = levelPatternsRef.current[exerciseIdx] ?? [];
  const currentMeta = LEVEL_META[Math.min(level, MAX_LEVEL)];

  const stopMetronome = useCallback(() => {
    if (tapRafRef.current) { cancelAnimationFrame(tapRafRef.current); tapRafRef.current = null; }
    beatDotsRef.current.forEach((el, i) => {
      if (!el) return;
      el.style.transform = "scale(1)";
      el.style.background = "white";
      el.style.color = "#c4b5fd";
      el.style.borderColor = i === 0 ? "#7c3aed" : "#c4b5fd";
      el.style.boxShadow = "none";
    });
  }, []);

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

  const runCountdown = useCallback((onDone: () => void) => {
    setCountdown(3); let c = 3;
    const tick = setInterval(() => { c--; setCountdown(c); if (c <= 0) { clearInterval(tick); onDone(); } }, 1000);
  }, []);

  const playPatternThenAutoTap = useCallback(() => {
    const ctx = getAudioCtx();
    const beatSec = 60 / bpm;
    const beatMs = beatSec * 1000;
    const totalBeats = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0);
    const COUNT_IN = 4;
    const audioStart = ctx.currentTime + 0.05;
    const totalClicksNeeded = Math.ceil(totalBeats) + COUNT_IN + Math.ceil(totalBeats) + 2;
    for (let i = 0; i < totalClicksNeeded; i++) scheduleClick(ctx, audioStart + i * beatSec, i % 4 === 0);

    const wallStart = Date.now() + (audioStart - ctx.currentTime) * 1000;
    const listenEndWall = wallStart + totalBeats * beatMs;
    const tapStartWall = listenEndWall + COUNT_IN * beatMs;
    const tapEndWall = tapStartWall + totalBeats * beatMs;
    gameStartRef.current = tapStartWall;

    let lastBeat = -1;
    const updateBeat = () => {
      const el = (Date.now() - wallStart) / 1000;
      if (el >= 0) {
        const beat = Math.floor(el / beatSec) % 4;
        if (beat !== lastBeat) {
          lastBeat = beat;
          beatDotsRef.current.forEach((el, i) => {
            if (!el) return;
            const isActive = i === beat;
            const isAccent = i === 0;
            el.style.transform = isActive ? "scale(1.3)" : "scale(1)";
            el.style.background = isActive ? (isAccent ? "#7c3aed" : "#a78bfa") : "white";
            el.style.color = isActive ? "white" : "#c4b5fd";
            el.style.borderColor = isAccent ? "#7c3aed" : "#c4b5fd";
            el.style.boxShadow = isActive ? (isAccent ? "0 0 14px #7c3aed88" : "0 0 10px #a78bfa66") : "none";
          });
        }
      }
      tapRafRef.current = requestAnimationFrame(updateBeat);
    };
    tapRafRef.current = requestAnimationFrame(updateBeat);

    let elapsed = wallStart - Date.now();
    currentPattern.forEach((note, i) => {
      setTimeout(() => setHighlightIdx(i), Math.max(0, elapsed));
      elapsed += (BEAT_VAL[note.duration] ?? 1) * beatMs;
    });
    setTimeout(() => setHighlightIdx(-1), listenEndWall - Date.now());
    for (let b = 0; b < COUNT_IN; b++) {
      setTimeout(() => setCountInRemaining(COUNT_IN - b), listenEndWall - Date.now() + b * beatMs);
    }
    setTimeout(() => setPhase("tap_ready"), listenEndWall - Date.now() + 10);
    setTimeout(() => {
      tapTimesRef.current = []; hitNoteIndicesRef.current = new Set();
      setHitNoteIndices(new Set()); setWrongTapMarkers([]); setPhase("tapping");
    }, tapStartWall - Date.now() + 10);
    setTimeout(() => {
      if (tapRafRef.current) { cancelAnimationFrame(tapRafRef.current); tapRafRef.current = null; }
      beatDotsRef.current.forEach((el, i) => {
        if (!el) return;
        el.style.transform = "scale(1)"; el.style.background = "white";
        el.style.color = "#c4b5fd"; el.style.borderColor = i === 0 ? "#7c3aed" : "#c4b5fd"; el.style.boxShadow = "none";
      });
      setPhase("result"); evaluateTaps();
    }, tapEndWall - Date.now() + beatMs * 0.5);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, currentPattern]);

  const startListening = useCallback(() => {
    if (phase !== "idle") return;
    setFeedback(null); setHighlightIdx(-1); setHitNoteIndices(new Set());
    setWrongTapMarkers([]); hitNoteIndicesRef.current = new Set();
    setPhase("listen_countdown");
    runCountdown(() => { setPhase("listening"); playPatternThenAutoTap(); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, runCountdown, playPatternThenAutoTap]);

  const evaluateTaps = useCallback(() => {
    const expected = getExpectedBeats();
    const taps = tapTimesRef.current;
    const tolerance = (60 / bpm) * 1000 * 0.38;
    const matched = new Set<number>(); let hits = 0;
    expected.forEach(expT => {
      let bestDiff = Infinity; let bestIdx = -1;
      taps.forEach((t, i) => { if (matched.has(i)) return; const d = Math.abs(t - expT); if (d < bestDiff) { bestDiff = d; bestIdx = i; } });
      if (bestIdx >= 0 && bestDiff <= tolerance) { matched.add(bestIdx); hits++; }
    });
    const total = expected.length;
    const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;
    const correct = hits === total && total > 0;
    setFeedback({ correct, accuracy, hits, total });
    if (correct || retryCountRef.current >= MAX_RETRIES) {
      if (correct) { playSuccess(); setCorrectCount(c => c + 1); }
      else { playFail(); setWrongCount(w => w + 1); }
      setExerciseResults(prev => [...prev, correct]);
      retryCountRef.current = 0; setRetryCount(0); setRetryPending(false);
    } else {
      playFail(); setWrongCount(w => w + 1);
      retryCountRef.current++; setRetryCount(retryCountRef.current); setRetryPending(true);
      retryAutoStartRef.current = true;
      setTimeout(() => {
        setFeedback(null); setHighlightIdx(-1); setHitNoteIndices(new Set());
        setWrongTapMarkers([]); hitNoteIndicesRef.current = new Set();
        setRetryPending(false); setPhase("idle");
      }, 1800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getExpectedBeats, bpm, playSuccess, playFail]);

  const handleTap = useCallback(() => {
    if (phase !== "tapping") return;
    const raw = Date.now() - gameStartRef.current;
    // Allow taps up to half a beat early (setTimeout imprecision) — clamp to 0
    const halfBeat = (60 / bpm) * 1000 * 0.5;
    if (raw < -halfBeat) return;
    const t = Math.max(0, raw);
    tapTimesRef.current.push(t);
    playDrumHit(getAudioCtx());
    const beatNotes = getExpectedBeatNotes();
    const tolerance = (60 / bpm) * 1000 * 0.38;
    let bestDiff = Infinity; let bestNote: { time: number; patternIdx: number } | null = null;
    beatNotes.forEach(bn => {
      if (hitNoteIndicesRef.current.has(bn.patternIdx)) return;
      const d = Math.abs(t - bn.time);
      if (d < bestDiff) { bestDiff = d; bestNote = bn; }
    });
    if (bestNote !== null && bestDiff <= tolerance) {
      hitNoteIndicesRef.current = new Set([...hitNoteIndicesRef.current, (bestNote as any).patternIdx]);
      setHitNoteIndices(new Set(hitNoteIndicesRef.current));
    } else {
      const totalMs = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0) * (60 / bpm) * 1000;
      const pct = Math.min(Math.max((t / totalMs) * 100, 0), 100);
      setWrongTapMarkers(prev => [...prev, pct]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bpm, currentPattern, getExpectedBeatNotes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); if (phase === "idle") startListening(); else if (phase === "tapping") handleTap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleTap, phase, startListening]);

  useEffect(() => {
    if (phase === "idle" && retryAutoStartRef.current) { retryAutoStartRef.current = false; startListening(); }
  }, [phase, startListening]);

  const saveProgress = useCallback((lv: number, stars: number, bdg: Badge) => {
    if (!student) return;
    const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    apiRequest("POST", `/api/student/${student.student.id}/progress`, {
      appType: "rhythm", level: lv, starsEarned: stars,
      correctAnswers: correctCount, wrongAnswers: wrongCount,
      timeSpentSeconds: elapsed, notesBadge: bdg,
    }).then(() => qc.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, correctCount, wrongCount]);

  const resetExerciseState = () => {
    setFeedback(null); setHighlightIdx(-1); setHitNoteIndices(new Set());
    setWrongTapMarkers([]); hitNoteIndicesRef.current = new Set();
    retryCountRef.current = 0; setRetryCount(0); setRetryPending(false);
  };

  const nextExercise = useCallback(() => {
    // exerciseResults was just updated via setExerciseResults in evaluateTaps
    // we use a snapshot from state (with one extra frame lag) — this is safe since user clicks button
    const nextIdx = exerciseIdx + 1;
    if (nextIdx >= PATTERNS_PER_LEVEL) {
      // Level complete — compute results
      const allResults = [...exerciseResults]; // length = PATTERNS_PER_LEVEL (last was added)
      const passedCount = allResults.filter(Boolean).length;
      const passed = passedCount >= PASS_THRESHOLD;
      const perfect = passedCount === PATTERNS_PER_LEVEL;

      // Stars: perfect = 5 (3 + 2), passed = 2, fail = 0
      const stars = perfect ? 5 : passed ? 2 : 0;
      const newTotalStars = totalStars + stars;
      setTotalStars(newTotalStars);
      setLevelStarsEarned(stars);

      if (passed) {
        if (level >= MAX_LEVEL) {
          // GAME COMPLETE!
          const newBadge = nextBadge(badge);
          setBadge(newBadge);
          setEarnedBadge(newBadge);
          playComplete();
          saveProgress(1, 0, newBadge); // reset level & stars, save badge
          setPhase("complete");
        } else {
          playLevelUp();
          saveProgress(level + 1, newTotalStars, badge);
          setLevel(l => l + 1);
          setPhase("levelup");
        }
      } else {
        // Fail — retry level
        setExerciseIdx(0); setExerciseResults([]);
        resetExerciseState(); setPhase("idle");
        saveProgress(level, newTotalStars, badge);
      }
    } else {
      setExerciseIdx(nextIdx);
      setPhase("idle"); resetExerciseState();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdx, exerciseResults, level, totalStars, badge, playLevelUp, playComplete, saveProgress]);

  const startNewLevel = () => {
    setExerciseIdx(0); setExerciseResults([]);
    resetExerciseState(); setPhase("idle");
  };

  const startNewRun = () => {
    setTotalStars(0); setExerciseIdx(0); setExerciseResults([]);
    resetExerciseState(); setPhase("idle");
    // level was already reset to 1 in saveProgress
    levelPatternsRef.current = generateLevelPatterns(1);
  };

  if (!student) return null;
  const beatMs = (60 / bpm) * 1000;
  const meta = currentMeta ?? LEVEL_META[1];

  return (
    <div className="min-h-screen select-none flex flex-col"
      style={{ background: "linear-gradient(160deg, #fdf4ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}>

      {/* ── Header (2-row sticky) ── */}
      <header className="bg-white/90 backdrop-blur border-b border-purple-100 sticky top-0 z-50">
        {/* Row 1: Back | Title */}
        <div className="max-w-xl mx-auto px-3 pt-2 pb-1 flex items-center justify-between">
          <Button variant="ghost" size="sm"
            onClick={() => { stopMetronome(); navigate("/student/home"); }}
            className="gap-1 rounded-xl font-bold text-purple-700 shrink-0" data-testid="btn-back">
            <ArrowLeft className="w-4 h-4" /> Geri
          </Button>
          <div className="flex items-center gap-1.5">
            <span className="text-xl">🥁</span>
            <h1 className="font-extrabold text-base text-purple-700">Ritim Antrenörü</h1>
          </div>
          <div className="w-16" />
        </div>
        {/* Row 2: Beat counter (left) | Badge path (right) */}
        <div className="max-w-xl mx-auto px-3 pb-2 flex items-center justify-between gap-2">
          {/* Beat counter — direct DOM refs */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-extrabold text-purple-400 uppercase tracking-widest mr-0.5">4/4</span>
            {[0, 1, 2, 3].map(beat => (
              <div
                key={beat}
                ref={el => { beatDotsRef.current[beat] = el; }}
                className="w-9 h-9 rounded-xl border-2 flex flex-col items-center justify-center font-extrabold select-none"
                style={{
                  borderColor: beat === 0 ? "#7c3aed" : "#c4b5fd",
                  background: "white",
                  color: "#c4b5fd",
                  fontSize: beat === 0 ? "14px" : "13px",
                  transition: "transform 0.06s ease-out, background 0.06s, box-shadow 0.06s",
                  willChange: "transform",
                }}>
                {beat + 1}
              </div>
            ))}
          </div>
          {/* Badge path + stars */}
          <div className="flex items-center gap-0.5 bg-purple-50 border border-purple-200 rounded-full px-2.5 py-1">
            {(["bronze", "silver", "gold"] as const).map(b => (
              <span key={b} className="text-sm leading-none"
                style={{ filter: BADGE_ORDER.indexOf(badge) >= BADGE_ORDER.indexOf(b) ? "none" : "grayscale(1) opacity(0.3)" }}
                title={BADGE_TR[b]}>
                {BADGE_EMOJI[b]}
              </span>
            ))}
            <span className="text-[10px] font-extrabold text-purple-600 ml-1" data-testid="text-stars">{totalStars}/30⭐</span>
          </div>
        </div>
      </header>

      {/* ── COMPLETE overlay ── */}
      <AnimatePresence>
        {phase === "complete" && earnedBadge && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-3xl p-8 mx-4 text-center shadow-2xl max-w-sm w-full"
              initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.55 }}>
              <motion.div className="text-8xl mb-2"
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.2, delay: 0.5 }}>
                {BADGE_EMOJI[earnedBadge]}
              </motion.div>
              <h2 className="text-2xl font-extrabold mb-1" style={{ color: BADGE_COLOR[earnedBadge] }}>
                {BADGE_TR[earnedBadge]} Kazandın!
              </h2>
              <p className="text-muted-foreground font-semibold mb-2 text-sm">Tüm 6 seviyeyi tamamladın!</p>
              <div className="flex justify-center gap-1 mb-4 text-2xl">
                {Array.from({ length: 5 }).map((_, i) => (
                  <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.15 }}>⭐</motion.span>
                ))}
              </div>
              {/* Badge collection */}
              <div className="flex justify-center gap-4 mb-5">
                {(["bronze", "silver", "gold"] as const).map(b => {
                  const earned = BADGE_ORDER.indexOf(earnedBadge) >= BADGE_ORDER.indexOf(b);
                  return (
                    <div key={b} className="text-center">
                      <div className="text-3xl" style={{ filter: earned ? "none" : "grayscale(1) opacity(0.3)" }}>
                        {BADGE_EMOJI[b]}
                      </div>
                      <div className="text-[10px] font-bold mt-0.5" style={{ color: earned ? BADGE_COLOR[b] : "#999" }}>
                        {BADGE_TR[b].split(" ")[0]}
                      </div>
                    </div>
                  );
                })}
              </div>
              {earnedBadge !== "gold" && (
                <p className="text-xs text-muted-foreground mb-3 font-semibold">
                  Bir sonraki hedef: {earnedBadge === "bronze" ? BADGE_EMOJI["silver"] + " Gümüş Rozet" : BADGE_EMOJI["gold"] + " Altın Rozet"}!
                </p>
              )}
              <Button className="w-full font-extrabold text-lg py-5 rounded-2xl"
                style={{ background: BADGE_COLOR[earnedBadge], color: "white" }}
                onClick={startNewRun} data-testid="button-new-run">
                {earnedBadge === "gold" ? "Tekrar Oyna! 🏆" : "Yeni Tur Başlat! →"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEVEL UP overlay ── */}
      <AnimatePresence>
        {phase === "levelup" && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-white rounded-3xl p-8 mx-4 text-center shadow-2xl max-w-sm w-full"
              initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}>
              <p className="text-6xl mb-2">🎉</p>
              <h2 className="text-2xl font-extrabold text-purple-700 mb-1">Seviye Atladın!</h2>
              <p className="text-lg font-bold text-muted-foreground mb-3">
                Seviye {level - 1} → Seviye {level}
              </p>
              {/* Stars earned for this level */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 mb-4">
                <p className="text-xs font-bold text-yellow-700 mb-1">Bu Seviyeden Kazandın</p>
                <div className="flex justify-center gap-1 text-2xl">
                  {Array.from({ length: levelStarsEarned }).map((_, i) => (
                    <motion.span key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.15 }}>⭐</motion.span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground font-semibold mt-1">
                  {levelStarsEarned === 5 ? "🏅 Mükemmel (10/10)!" : "✅ Geçti"} · Toplam: {totalStars} ⭐
                </p>
              </div>
              <div className="mb-3 p-3 rounded-xl" style={{ background: "#f5f3ff", border: "1.5px solid #c4b5fd" }}>
                <p className="text-xs font-bold text-purple-500 mb-0.5">Seviye {level}</p>
                <p className="font-extrabold text-purple-700">{LEVEL_META[level]?.emoji} {LEVEL_META[level]?.nameTr}</p>
                <p className="text-xs text-muted-foreground">{LEVEL_META[level]?.desc}</p>
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-lg py-5 rounded-2xl"
                onClick={startNewLevel} data-testid="button-next-level">
                Seviye {level}'e Geç! →
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Listen countdown overlay ── */}
      <AnimatePresence>
        {phase === "listen_countdown" && (
          <motion.div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div key={countdown}
              className="w-40 h-40 rounded-full bg-indigo-600 flex flex-col items-center justify-center shadow-2xl"
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }} transition={{ duration: 0.35 }}>
              <span className="text-7xl font-extrabold text-white leading-none">{countdown}</span>
              <span className="text-white/70 text-sm font-bold mt-1">👂 Hazırlan!</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout — single centered column ── */}
      <main className="flex-1 w-full overflow-y-auto px-3 pt-3 pb-4">
        <div className="max-w-xl mx-auto flex flex-col gap-3">

          {/* ── Row 1: Level + exercise dots + score ── */}
          <div className="bg-white/85 rounded-2xl px-4 py-3 shadow-sm flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Seviye</p>
                  <p className="text-3xl font-extrabold text-purple-700 leading-none">{level}</p>
                </div>
                <div>
                  <p className="font-extrabold text-sm text-purple-700">{meta.emoji} {meta.nameTr}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold">{meta.desc}</p>
                </div>
              </div>
              {/* Mini score */}
              <div className="flex gap-2 text-center">
                <div className="bg-green-50 rounded-xl px-2 py-1">
                  <p className="text-base font-extrabold text-green-500">{correctCount}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">Doğru</p>
                </div>
                <div className="bg-red-50 rounded-xl px-2 py-1">
                  <p className="text-base font-extrabold text-red-400">{wrongCount}</p>
                  <p className="text-[10px] text-muted-foreground font-bold">Yanlış</p>
                </div>
              </div>
            </div>
            {/* Exercise progress dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: PATTERNS_PER_LEVEL }).map((_, i) => {
                const done = i < exerciseResults.length;
                const current = i === exerciseIdx;
                const result = exerciseResults[i];
                return (
                  <div key={i} className={`flex-1 h-6 rounded-lg flex items-center justify-center text-[9px] font-extrabold transition-all ${
                    current ? "bg-purple-600 text-white shadow-md" :
                    done && result ? "bg-green-400 text-white" :
                    done ? "bg-red-300 text-white" :
                    "bg-purple-100 text-purple-300"
                  }`}>
                    {done ? (result ? "✓" : "✗") : i + 1}
                  </div>
                );
              })}
            </div>
            {/* Pass bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">Geçiş:</span>
              <div className="flex gap-0.5 flex-1">
                {Array.from({ length: PATTERNS_PER_LEVEL }).map((_, i) => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                    i < exerciseResults.filter(Boolean).length ? "bg-green-400" :
                    i < exerciseResults.length ? "bg-red-300" :
                    i < PASS_THRESHOLD ? "bg-amber-300" : "bg-gray-150"
                  }`} />
                ))}
              </div>
              <span className="text-[10px] font-bold text-amber-600 shrink-0">{PASS_THRESHOLD}/10</span>
            </div>
          </div>

          {/* ── Row 2: VexFlow notation ── */}
          <div className="bg-white rounded-3xl px-4 pt-3 pb-2 shadow-md">
            <p className="text-[10px] font-extrabold text-purple-400 uppercase tracking-widest mb-1">Ritim Kalıbı — 4/4</p>
            <div className="flex justify-center overflow-x-auto">
              <VexFlowRenderer
                notes={currentPattern}
                width={480} height={150}
                showClef showTimeSignature
                highlightIndex={highlightIdx}
                hitIndices={hitNoteIndices}
              />
            </div>
            {/* Tap timeline (shown while tapping / result) */}
            {(phase === "tapping" || phase === "result") && (() => {
              const totalBeats = currentPattern.reduce((acc, n) => acc + (BEAT_VAL[n.duration] ?? 1), 0);
              const totalMs = totalBeats * beatMs;
              const expectedBeatNotes = (() => {
                const res: { pct: number; hit: boolean }[] = [];
                let t = 0;
                currentPattern.forEach((note, i) => {
                  if (!IS_REST[note.duration]) res.push({ pct: (t / totalMs) * 100, hit: hitNoteIndices.has(i) });
                  t += (BEAT_VAL[note.duration] ?? 1) * beatMs;
                });
                return res;
              })();
              return (
                <div className="mt-2">
                  <div className="relative h-8 bg-purple-50 rounded-xl border border-purple-100">
                    {expectedBeatNotes.map(({ pct, hit }, i) => (
                      <div key={i} className="absolute top-0 h-full flex items-center" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                        <div className={`w-1.5 h-full rounded-full opacity-25 ${hit ? "bg-green-500" : "bg-purple-400"}`} />
                      </div>
                    ))}
                    {wrongTapMarkers.map((pct, i) => (
                      <div key={i} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${pct}%` }}>
                        <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center text-white text-[9px] font-black">✗</div>
                      </div>
                    ))}
                    {expectedBeatNotes.map(({ pct, hit }, i) => hit && (
                      <div key={`h${i}`} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10" style={{ left: `${pct}%` }}>
                        <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center text-white text-[9px] font-black">✓</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* ── Row 3: Tempo ── */}
          <div className="bg-white/80 rounded-2xl px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="font-extrabold text-sm text-purple-700">🎵 Tempo</p>
              <span className="bg-purple-600 text-white text-sm font-extrabold px-3 py-1 rounded-full" data-testid="text-bpm">{bpm} BPM</span>
            </div>
            <input type="range" min={60} max={140} step={1} value={bpm}
              onChange={e => setBpm(Number(e.target.value))} disabled={phase !== "idle"}
              className="w-full accent-purple-600 cursor-pointer" data-testid="slider-bpm" />
            <div className="flex justify-between text-xs text-muted-foreground font-semibold mt-1">
              <span>🐢 60</span><span>100</span><span>140 🐇</span>
            </div>
          </div>

          {/* ── Row 5: UNIFIED ACTION ZONE (Hazırlan + Dinle + Vurma) ── */}
          <div className={`rounded-3xl shadow-lg overflow-hidden transition-all duration-300 border-2 ${
            phase === "idle"             ? "border-indigo-300 bg-indigo-50" :
            phase === "listen_countdown" ? "border-indigo-400 bg-indigo-50" :
            phase === "listening"        ? "border-indigo-400 bg-indigo-100" :
            phase === "tap_ready"        ? "border-amber-400 bg-amber-50" :
            phase === "tapping"          ? "border-green-400 bg-green-50" :
            phase === "result" && feedback?.correct ? "border-green-400 bg-green-50" :
            phase === "result"           ? "border-red-300 bg-red-50" :
            "border-gray-200 bg-gray-50"
          }`}>

            {/* Step indicators */}
            <div className="flex border-b border-black/5">
              {[
                { label: "Hazırlan", active: ["idle","listen_countdown","listening","tap_ready"].includes(phase), done: ["tapping","result"].includes(phase), icon: "👂" },
                { label: "Dinle",    active: ["listening"].includes(phase), done: ["tap_ready","tapping","result"].includes(phase), icon: "🎵" },
                { label: "Vur!",     active: ["tapping"].includes(phase), done: phase === "result", icon: "🥁" },
              ].map((step, i) => (
                <div key={i} className={`flex-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${
                  step.active ? "text-purple-700 bg-white/50" :
                  step.done ? "text-green-600" : "text-gray-300"
                }`}>
                  <span>{step.icon}</span> {step.label}
                  {step.done && <span className="text-green-500">✓</span>}
                </div>
              ))}
            </div>

            {/* ACTION CONTENT */}
            <div className="p-4">
              <AnimatePresence mode="wait">

                {/* IDLE — big listen button */}
                {phase === "idle" && (
                  <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <motion.button data-testid="button-listen"
                      className="w-full py-8 rounded-2xl text-xl font-extrabold text-white shadow-xl cursor-pointer flex flex-col items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #4f46e5, #3730a3)" }}
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} onClick={startListening}>
                      <span className="text-5xl">👂</span>
                      <span>Dinle ve İzle</span>
                      <span className="text-indigo-200 text-sm font-semibold">veya Space tuşuna bas</span>
                    </motion.button>
                    {retryCount > 0 && (
                      <p className="text-center text-xs font-bold text-orange-500 mt-2">Deneme {retryCount}/{MAX_RETRIES}</p>
                    )}
                  </motion.div>
                )}

                {/* LISTEN COUNTDOWN — big number */}
                {phase === "listen_countdown" && (
                  <motion.div key="countdown" className="text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Hazırlanıyor…</p>
                    <motion.div key={countdown} className="text-8xl font-black text-indigo-600"
                      initial={{ scale: 1.6, opacity: 0.3 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25 }}>
                      {countdown}
                    </motion.div>
                  </motion.div>
                )}

                {/* LISTENING — wave animation */}
                {phase === "listening" && (
                  <motion.div key="listening" className="text-center py-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Dinliyorsun…</p>
                    <div className="flex justify-center gap-1.5 mb-2">
                      {[0,1,2,3,4].map(i => (
                        <motion.div key={i} className="w-3 bg-indigo-500 rounded-full"
                          animate={{ height: ["12px","40px","12px"] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }} />
                      ))}
                    </div>
                    <p className="text-indigo-600 font-extrabold">🎵 Kalıbı takip et!</p>
                  </motion.div>
                )}

                {/* TAP READY — count-in + tap zone gets ready */}
                {phase === "tap_ready" && (
                  <motion.div key="tapready" className="text-center py-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-xs font-extrabold text-amber-600 uppercase tracking-widest mb-1">Sıra sende! Hazır ol…</p>
                    <motion.div key={countInRemaining} className="text-8xl font-black text-purple-600"
                      initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}>
                      {countInRemaining}
                    </motion.div>
                    <p className="text-amber-500 font-bold text-sm mt-1">Metronom ile birlikte vur!</p>
                  </motion.div>
                )}

                {/* TAPPING — giant tap button */}
                {phase === "tapping" && (
                  <motion.div key="tapping" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                    <motion.button data-testid="button-tap"
                      className="w-full py-10 rounded-2xl text-white font-extrabold flex flex-col items-center justify-center gap-2 cursor-pointer shadow-2xl"
                      style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", border: "4px solid rgba(255,255,255,0.4)" }}
                      animate={{ boxShadow: ["0 0 0 0 rgba(22,163,74,0.7)", "0 0 0 24px rgba(22,163,74,0)", "0 0 0 0 rgba(22,163,74,0)"] }}
                      transition={{ duration: beatMs / 1000, repeat: Infinity }}
                      onPointerDown={handleTap}>
                      <span className="text-7xl">🥁</span>
                      <span className="text-2xl font-extrabold">DOKUN!</span>
                      <span className="text-green-200 text-sm">Space tuşu da çalışır</span>
                    </motion.button>
                  </motion.div>
                )}

                {/* RESULT — feedback + next button */}
                {phase === "result" && feedback && (
                  <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-3">
                    <div className="text-center">
                      <p className="text-5xl mb-1">{feedback.correct ? "🎉" : retryPending ? "🔄" : "😓"}</p>
                      <p className={`text-xl font-extrabold ${feedback.correct ? "text-green-600" : retryPending ? "text-orange-600" : "text-red-500"}`}>
                        {feedback.correct ? "Mükemmel!" : retryPending ? `Tekrar Dene! (${retryCount}/${MAX_RETRIES})` : "Olmadı!"}
                      </p>
                      <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                        {feedback.hits}/{feedback.total} vuruş doğru · %{feedback.accuracy} doğruluk
                      </p>
                      <div className="mt-2 h-3 bg-gray-200 rounded-full overflow-hidden mx-4">
                        <motion.div className={`h-full rounded-full ${feedback.accuracy >= 80 ? "bg-green-400" : feedback.accuracy >= 50 ? "bg-yellow-400" : "bg-red-400"}`}
                          initial={{ width: 0 }} animate={{ width: `${feedback.accuracy}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
                      </div>
                    </div>
                    {!retryPending && (
                      <motion.button data-testid="button-next"
                        className="w-full py-5 rounded-2xl text-lg font-extrabold text-white shadow-xl cursor-pointer flex items-center justify-center gap-2"
                        style={{ background: feedback.correct ? "linear-gradient(135deg, #22c55e, #16a34a)" : "linear-gradient(135deg, #f97316, #ea580c)" }}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={nextExercise}>
                        {exerciseIdx + 1 >= PATTERNS_PER_LEVEL
                          ? (feedback.correct ? "Seviye Tamamla! 🏆" : "Sonuçları Gör →")
                          : (<>Sonraki Soru <span className="text-sm opacity-75">({exerciseIdx + 2}/{PATTERNS_PER_LEVEL})</span></>)
                        }
                      </motion.button>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
