import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Map, Star, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { StudentProgress } from "@shared/schema";

// ─── Constants ─────────────────────────────────────────────────────────────────
const TRAVEL_MS = 2000;         // block travel time from spawn to hit line
const TOLERANCE_PERFECT = 80;   // ms
const TOLERANCE_GOOD = 160;     // ms
const TOLERANCE_MISS = 280;     // ms
const COUNTDOWN_BEATS = 4;

// ─── Types ────────────────────────────────────────────────────────────────────
type HitResult = "perfect" | "good" | "early" | "late" | "miss";
type Phase = "idle" | "countdown" | "playing" | "result";
type View = "map" | "game";

interface Block {
  id: number;
  hitTime: number;    // ms from gameStart
  state: "active" | "hit" | "missed";
  result?: HitResult;
}
interface FloatText { id: number; text: string; color: string; x: number; y: number; }

// ─── Level definitions ────────────────────────────────────────────────────────
// pattern = beat offsets in quarter notes; each level plays 3 measures
function makeLevel(bpm: number, beats: number[]) {
  return { bpm, beats };
}
const LEVELS = [
  makeLevel(72, [0,1,2,3]),                           // 1
  makeLevel(76, [0,1,2,3,4,5,6,7]),                   // 2
  makeLevel(80, [0,2,4,6]),                           // 3
  makeLevel(82, [0,1,3,4,5,7]),                       // 4
  makeLevel(84, [0,1,2,4,5,6]),                       // 5
  makeLevel(88, [0,0.5,1,2,2.5,3]),                   // 6
  makeLevel(90, [0,1,1.5,2,3,3.5]),                   // 7
  makeLevel(92, [0,0.5,1.5,2,2.5,3.5]),              // 8
  makeLevel(94, [0,0.5,1,1.5,2,2.5,3,3.5]),          // 9
  makeLevel(96, [0,1,1.5,2,3]),                       // 10
  makeLevel(98, [0,2,3,4,6,7]),                       // 11 (rests)
  makeLevel(100, [0,1,4,5,6]),                        // 12
  makeLevel(100, [0,2,4,5,8,10]),                     // 13
  makeLevel(102, [0,3,4,5]),                          // 14
  makeLevel(104, [0,1,4,6,8,11]),                     // 15
  makeLevel(106, [0,0.5,1,2,3,3.5]),                  // 16 mixed
  makeLevel(108, [0,0.5,2,2.5,3]),                    // 17
  makeLevel(110, [0,1,1.5,2.5,3,3.5]),               // 18
  makeLevel(112, [0,0.5,1,1.5,2,3]),                  // 19
  makeLevel(114, [0,0.5,1,2,2.5,3,3.5]),             // 20
  makeLevel(116, [0,0.5,1,1.5,2,2.5,3,3.5]),         // 21 faster
  makeLevel(118, [0,0.25,0.5,1,2,2.5,3]),            // 22
  makeLevel(120, [0,0.5,1,1.5,2,2.5,3,3.5]),         // 23
  makeLevel(124, [0,0.25,1,1.5,2,2.75,3]),            // 24
  makeLevel(128, [0,0.5,1,1.5,2,2.5,3,3.5]),         // 25
  makeLevel(130, [0,0.5,1.5,2,3,3.5]),               // 26 complex
  makeLevel(132, [0,0.25,0.75,1.5,2,3,3.5]),         // 27
  makeLevel(134, [0,0.5,1,1.75,2,2.5,3.25,3.75]),    // 28
  makeLevel(136, [0,0.25,1,1.25,2,2.25,3,3.25]),     // 29
  makeLevel(138, [0,0.75,1,1.75,2,2.75,3,3.75]),     // 30
  makeLevel(140, [0.5,1,1.5,2.5,3,3.5]),             // 31 syncopation
  makeLevel(142, [0,0.5,1.5,2,2.5,3.5]),             // 32
  makeLevel(144, [0.25,0.75,1.5,2.25,2.75,3.5]),     // 33
  makeLevel(146, [0,0.5,1.5,2.5,3,3.75]),            // 34
  makeLevel(148, [0.5,1,1.5,2,2.5,3,3.5]),           // 35
  makeLevel(150, [0,0.25,0.75,1,1.5,2,2.25,3,3.75]),// 36 advanced
  makeLevel(152, [0,0.25,0.5,1,1.5,2,2.5,3,3.25,3.75]),// 37
  makeLevel(155, [0,0.25,0.75,1,1.5,1.75,2.25,2.75,3,3.5]),// 38
  makeLevel(158, [0,0.5,0.75,1,1.5,2,2.25,2.75,3,3.5]),    // 39
  makeLevel(160, [0,0.25,0.5,0.75,1,1.5,2,2.25,2.75,3,3.5,3.75]),// 40
];

// ─── Themes ───────────────────────────────────────────────────────────────────
function getTheme(level: number) {
  if (level <= 13) return {
    bg: "linear-gradient(180deg, #052e16 0%, #166534 40%, #22c55e 100%)",
    laneColor: "#16a34a",
    blockColor: "#4ade80",
    blockGlow: "#22c55e",
    accentColor: "#86efac",
    name: "Müzik Ormanı 🌲",
    sky: "linear-gradient(180deg, #052e16 0%, #064e3b 100%)",
  };
  if (level <= 27) return {
    bg: "linear-gradient(180deg, #1e1b4b 0%, #4338ca 40%, #818cf8 100%)",
    laneColor: "#4338ca",
    blockColor: "#818cf8",
    blockGlow: "#6366f1",
    accentColor: "#c7d2fe",
    name: "Ritim Şehri 🏙️",
    sky: "linear-gradient(180deg, #0f0a3c 0%, #1e1b4b 100%)",
  };
  return {
    bg: "linear-gradient(180deg, #0c0a1a 0%, #4c1d95 40%, #c026d3 100%)",
    laneColor: "#7c3aed",
    blockColor: "#c084fc",
    blockGlow: "#a855f7",
    accentColor: "#e9d5ff",
    name: "Uzay Müziği 🚀",
    sky: "linear-gradient(180deg, #000010 0%, #0c0a1a 100%)",
  };
}

// ─── Audio helpers ────────────────────────────────────────────────────────────
function createClick(ctx: AudioContext, accent: boolean, when: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "square";
  osc.frequency.value = accent ? 1800 : 1100;
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  osc.start(when); osc.stop(when + 0.08);
}

const HIT_COLORS: Record<HitResult, string> = {
  perfect: "#4ade80", good: "#60a5fa", early: "#fbbf24", late: "#fb923c", miss: "#f87171",
};
const HIT_LABELS: Record<HitResult, string> = {
  perfect: "MÜKEMMEL! ✨", good: "İYİ! 👍", early: "ERKEN ⬆", late: "GEÇ ⬇", miss: "KAÇIRDIN ❌",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function RhythmAdventure() {
  const { student } = useAuth();
  const [view, setView] = useState<View>("map");
  const [selectedLevel, setSelectedLevel] = useState(0); // 0-indexed
  const [highestCompleted, setHighestCompleted] = useState(-1);
  const [totalStars, setTotalStars] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [floatTexts, setFloatTexts] = useState<FloatText[]>([]);
  const [resultData, setResultData] = useState<{ accuracy: number; stars: number; score: number; maxCombo: number } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [tapFlash, setTapFlash] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState(false);
  const [sessionStart] = useState(Date.now());

  const blocksRef = useRef<Block[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const gameStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lastPeakRef = useRef(0);
  const floatIdRef = useRef(0);
  const tapUsedRef = useRef<Set<number>>(new Set());
  const hitLineRef = useRef<HTMLDivElement | null>(null);

  const { data: progress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => (await fetch(`/api/student/${student!.student.id}/progress`)).json(),
    enabled: !!student,
    staleTime: 0,
  });

  useEffect(() => {
    const p = progress?.find(p => p.appType === "rhythm_adventure");
    if (p) {
      setHighestCompleted(p.level - 1);
      setTotalStars(p.starsEarned);
    }
  }, [progress]);

  const level = LEVELS[selectedLevel];
  const theme = getTheme(selectedLevel + 1);

  // Build block list for current level (3 measures)
  function buildBlocks(): Block[] {
    const msPerBeat = 60000 / level.bpm;
    const measureBeats = 4;
    const allBeats: number[] = [];
    for (let m = 0; m < 3; m++) {
      level.beats.forEach(b => allBeats.push(m * measureBeats + b));
    }
    return allBeats.map((b, i) => ({
      id: i,
      hitTime: b * msPerBeat,
      state: "active" as const,
      result: undefined,
    }));
  }

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // ── Microphone setup ─────────────────────────────────────────────────────────
  const setupMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = getAudioCtx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;
      setMicActive(true);
      setMicError(false);
    } catch {
      setMicError(true);
    }
  };

  const stopMic = () => {
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    analyserRef.current = null;
    setMicActive(false);
  };

  // Mic peak detection loop
  const detectMicPeak = useCallback(() => {
    if (!analyserRef.current || phase !== "playing") return;
    const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(buf);
    const peak = buf.reduce((mx, v) => Math.max(mx, Math.abs(v - 128)), 0);
    const now = Date.now();
    if (peak > 30 && now - lastPeakRef.current > 150) {
      lastPeakRef.current = now;
      processTap();
    }
  }, [phase]);

  // ── Game loop ─────────────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const now = Date.now() - gameStartRef.current;
    const updated = blocksRef.current.map(b => {
      if (b.state !== "active") return b;
      if (now > b.hitTime + TOLERANCE_MISS) {
        return { ...b, state: "missed" as const, result: "miss" as HitResult };
      }
      return b;
    });
    // Check for newly missed blocks and update combo/score
    updated.forEach((b, i) => {
      if (b.state === "missed" && blocksRef.current[i]?.state === "active") {
        comboRef.current = 0;
        setCombo(0);
        addFloat("KAÇIRDIN ❌", HIT_COLORS.miss, 50, 45);
      }
    });
    blocksRef.current = updated;
    setBlocks([...updated]);
    if (analyserRef.current) detectMicPeak();
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [detectMicPeak]);

  // ── Tap processing ────────────────────────────────────────────────────────────
  const processTap = useCallback(() => {
    if (phase !== "playing") return;
    const now = Date.now() - gameStartRef.current;
    const ctx = getAudioCtx();
    createClick(ctx, false, ctx.currentTime);
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);

    // Find nearest active block
    let best: { idx: number; diff: number } | null = null;
    blocksRef.current.forEach((b, i) => {
      if (b.state !== "active") return;
      const diff = now - b.hitTime;
      if (diff < -TOLERANCE_MISS) return; // too early even to count
      if (tapUsedRef.current.has(b.id)) return;
      if (!best || Math.abs(diff) < Math.abs(best.diff)) best = { idx: i, diff };
    });

    if (!best || Math.abs(best.diff) > TOLERANCE_MISS) {
      // Ghost tap — no nearby block
      addFloat("⚡", "#94a3b8", 50, 45);
      return;
    }

    tapUsedRef.current.add(blocksRef.current[best.idx].id);
    const diff = best.diff;
    let result: HitResult;
    if (Math.abs(diff) <= TOLERANCE_PERFECT) result = "perfect";
    else if (Math.abs(diff) <= TOLERANCE_GOOD) result = "good";
    else if (diff > 0) result = "late";
    else result = "early";

    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    if (newCombo > maxComboRef.current) { maxComboRef.current = newCombo; setMaxCombo(newCombo); }
    setCombo(newCombo);

    const multiplier = Math.min(1 + Math.floor(newCombo / 5) * 0.25, 3);
    const pts = result === "perfect" ? 100 : result === "good" ? 70 : 30;
    const earned = Math.round(pts * multiplier);
    scoreRef.current += earned;
    setScore(scoreRef.current);

    const updated = [...blocksRef.current];
    updated[best.idx] = { ...updated[best.idx], state: "hit", result };
    blocksRef.current = updated;
    setBlocks([...updated]);
    addFloat(HIT_LABELS[result], HIT_COLORS[result], 50, 40);
  }, [phase]);

  // ── Float text helper ─────────────────────────────────────────────────────────
  const addFloat = (text: string, color: string, x: number, y: number) => {
    const id = floatIdRef.current++;
    setFloatTexts(prev => [...prev.slice(-8), { id, text, color, x, y }]);
    setTimeout(() => setFloatTexts(prev => prev.filter(f => f.id !== id)), 900);
  };

  // ── Start game ────────────────────────────────────────────────────────────────
  const startGame = () => {
    if (phase !== "idle") return;
    const bl = buildBlocks();
    blocksRef.current = bl;
    tapUsedRef.current = new Set();
    setBlocks(bl);
    scoreRef.current = 0; comboRef.current = 0; maxComboRef.current = 0;
    setScore(0); setCombo(0); setMaxCombo(0); setFloatTexts([]);
    setResultData(null);
    setPhase("countdown");

    // Schedule countdown clicks + game start
    const ctx = getAudioCtx();
    const beatMs = 60000 / level.bpm;
    const startAt = ctx.currentTime + 0.2;
    for (let i = 0; i < COUNTDOWN_BEATS; i++) {
      createClick(ctx, i === 0, startAt + i * beatMs / 1000);
    }
    let cd = COUNTDOWN_BEATS;
    setCountdown(cd);
    const cdInterval = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) {
        clearInterval(cdInterval);
        setPhase("playing");
        gameStartRef.current = Date.now();
        rafRef.current = requestAnimationFrame(gameLoop);
        const totalDuration = blocksRef.current[blocksRef.current.length - 1].hitTime + beatMs * 2;
        timerRef.current = setTimeout(() => endGame(), totalDuration);
      }
    }, beatMs);
  };

  // ── End game ──────────────────────────────────────────────────────────────────
  const endGame = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setPhase("result");

    const allBlocks = blocksRef.current;
    const total = allBlocks.length;
    const perfectGood = allBlocks.filter(b => b.result === "perfect" || b.result === "good").length;
    const acc = Math.round((perfectGood / Math.max(total, 1)) * 100);
    const s = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 50 ? 1 : 0;
    const passed = acc >= 65;

    const res = { accuracy: acc, stars: s, score: scoreRef.current, maxCombo: maxComboRef.current };
    setResultData(res);

    if (passed && selectedLevel >= highestCompleted) {
      setHighestCompleted(selectedLevel);
    }
    setTotalStars(prev => prev + s);

    if (student) {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      apiRequest("POST", `/api/student/${student.student.id}/progress`, {
        appType: "rhythm_adventure",
        level: Math.max(highestCompleted + 1, passed ? selectedLevel + 1 : selectedLevel) + 1,
        starsEarned: totalStars + s,
        correctAnswers: perfectGood,
        wrongAnswers: total - perfectGood,
        timeSpentSeconds: elapsed,
      }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }))
        .catch(() => {});
    }
  }, [selectedLevel, highestCompleted, student, sessionStart, totalStars]);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMic();
  }, []);

  // ── Keyboard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); processTap(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [processTap]);

  // ─── RENDER ────────────────────────────────────────────────────────────────────
  if (view === "map") return <LevelMap
    highestCompleted={highestCompleted}
    totalStars={totalStars}
    onSelectLevel={lvl => { setSelectedLevel(lvl); setView("game"); setPhase("idle"); }}
    onBack={() => window.history.back()}
  />;

  const now = phase === "playing" ? Date.now() - gameStartRef.current : 0;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden select-none" style={{ background: theme.sky }}>
      {/* HUD */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 z-20">
        <button onClick={() => { if (rafRef.current) cancelAnimationFrame(rafRef.current); setPhase("idle"); setView("map"); }}
          className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center" data-testid="button-back">
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="text-center">
          <p className="text-white font-extrabold text-sm leading-tight">Seviye {selectedLevel + 1}</p>
          <p className="text-white/60 text-xs">{theme.name}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-white font-extrabold text-sm">{score.toLocaleString()}</span>
          {combo > 1 && (
            <motion.span key={combo} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
              className="text-xs font-extrabold" style={{ color: theme.accentColor }}>
              x{combo} KOMBO
            </motion.span>
          )}
        </div>
      </div>

      {/* 3D Lane */}
      <div className="flex-1 relative overflow-hidden" style={{ perspective: "500px" }}>
        {/* Lane floor with 3D rotation */}
        <div className="absolute inset-0 flex justify-center items-end pb-24"
          style={{ perspective: "500px" }}>
          <div className="relative" style={{ width: "280px", height: "520px", transform: "rotateX(40deg)", transformOrigin: "bottom center" }}>
            {/* Road */}
            <div className="absolute inset-0 rounded-t-3xl"
              style={{ background: `linear-gradient(180deg, ${theme.laneColor}11 0%, ${theme.laneColor}88 100%)`, border: `2px solid ${theme.laneColor}66` }} />
            {/* Lane lines */}
            {[33, 67].map(pct => (
              <div key={pct} className="absolute top-0 bottom-0 w-px opacity-30"
                style={{ left: `${pct}%`, background: theme.accentColor }} />
            ))}
            {/* Moving road stripes */}
            {[0, 20, 40, 60, 80].map(p => (
              <div key={p} className="absolute left-1/2 w-4 h-12 -translate-x-1/2 rounded-sm opacity-20"
                style={{ bottom: `${p}%`, background: theme.accentColor }} />
            ))}

            {/* Blocks */}
            {blocks.map(block => {
              if (block.state === "missed") return null;
              const elapsed = now;
              const spawnTime = block.hitTime - TRAVEL_MS;
              const rawPos = (elapsed - spawnTime) / TRAVEL_MS;
              const pos = Math.max(0, Math.min(1, rawPos));
              if (rawPos < -0.1 || rawPos > 1.2) return null;
              const topPct = (1 - pos) * 100;
              const blockH = 20 + pos * 30;
              const blockW = 140 + pos * 100;
              const opacity = pos < 0.1 ? pos * 10 : block.state === "hit" ? 0 : 1;

              return (
                <motion.div
                  key={block.id}
                  className="absolute left-1/2 -translate-x-1/2 rounded-xl flex items-center justify-center font-extrabold"
                  style={{
                    top: `${topPct}%`,
                    height: blockH,
                    width: blockW,
                    background: block.state === "hit" ? "transparent" : `linear-gradient(135deg, ${theme.blockColor}, ${theme.blockGlow})`,
                    boxShadow: block.state !== "hit" ? `0 0 ${8 + pos * 16}px ${theme.blockGlow}` : "none",
                    opacity,
                    border: block.state !== "hit" ? `2px solid ${theme.accentColor}88` : "none",
                    transition: "opacity 0.15s",
                  }}
                  animate={block.state === "hit" ? { scale: [1, 1.4, 0], opacity: [1, 1, 0] } : {}}
                  transition={{ duration: 0.2 }}
                >
                  {block.state !== "hit" && <span style={{ color: "#fff", fontSize: 14, opacity: 0.8 }}>♩</span>}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Hit line */}
        <div ref={hitLineRef} className="absolute left-1/2 -translate-x-1/2 w-72 h-1 rounded-full"
          style={{ bottom: 96, background: `linear-gradient(90deg, transparent, ${theme.accentColor}, transparent)`, boxShadow: `0 0 12px ${theme.accentColor}` }} />

        {/* Float texts */}
        <AnimatePresence>
          {floatTexts.map(f => (
            <motion.div key={f.id}
              className="absolute pointer-events-none font-extrabold text-base z-30"
              style={{ left: `${f.x}%`, top: `${f.y}%`, color: f.color, textShadow: `0 0 10px ${f.color}` }}
              initial={{ opacity: 1, y: 0, x: "-50%" }}
              animate={{ opacity: 0, y: -50, x: "-50%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9 }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Tap button */}
      <div className="flex flex-col items-center pb-8 pt-2 z-20 gap-3">
        <div className="flex items-center gap-3">
          <motion.button
            onPointerDown={processTap}
            className="w-24 h-24 rounded-full flex flex-col items-center justify-center font-extrabold text-white shadow-2xl"
            style={{
              background: tapFlash
                ? `radial-gradient(circle, #fff 0%, ${theme.blockColor} 100%)`
                : `radial-gradient(circle, ${theme.blockColor} 0%, ${theme.laneColor} 100%)`,
              boxShadow: tapFlash ? `0 0 40px ${theme.blockGlow}` : `0 8px 32px ${theme.laneColor}88`,
              border: `3px solid ${theme.accentColor}88`,
              transition: "all 0.08s",
            }}
            whileTap={{ scale: 0.88 }}
            data-testid="button-tap"
          >
            <span className="text-3xl">{tapFlash ? "💥" : "🥁"}</span>
          </motion.button>

          <button onClick={micActive ? stopMic : setupMic}
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: micActive ? "#22c55e44" : "#ffffff22", border: `2px solid ${micActive ? "#22c55e" : "#ffffff44"}` }}
            data-testid="button-mic">
            {micActive ? <Mic className="w-5 h-5 text-green-400" /> : <MicOff className="w-5 h-5 text-white/50" />}
          </button>
        </div>
        <p className="text-white/40 text-xs">Dokun veya SPACE tuşuna bas</p>
      </div>

      {/* Countdown overlay */}
      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div className="absolute inset-0 flex items-center justify-center bg-black/60 z-40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div key={countdown}
              initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.2 }}
              className="text-9xl font-extrabold" style={{ color: theme.accentColor }}>
              {countdown > 0 ? countdown : "GİT!"}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle / Result overlay */}
      <AnimatePresence>
        {(phase === "idle" || phase === "result") && (
          <motion.div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-40 px-6 gap-5"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {phase === "idle" ? (
              <>
                <p className="text-4xl font-extrabold text-white text-center">Seviye {selectedLevel + 1}</p>
                <p className="text-white/70 font-semibold text-center">{theme.name}</p>
                <p className="text-white/50 text-sm">{level.bpm} BPM · {level.beats.length * 3} vuruş</p>
                <motion.button onClick={startGame}
                  className="w-36 h-36 rounded-full flex flex-col items-center justify-center font-extrabold text-white text-xl shadow-2xl mt-4"
                  style={{ background: `linear-gradient(135deg, ${theme.blockColor}, ${theme.laneColor})`, border: `4px solid ${theme.accentColor}88` }}
                  whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  data-testid="button-start">
                  <span className="text-4xl">▶</span>
                  OYNA
                </motion.button>
              </>
            ) : resultData && (
              <>
                <div className="flex gap-2 mb-2">
                  {[1,2,3].map(s => (
                    <motion.span key={s} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: s * 0.15 }} className="text-5xl">
                      {resultData.stars >= s ? "⭐" : "☆"}
                    </motion.span>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-5xl font-extrabold text-white">%{resultData.accuracy}</p>
                  <p className="text-white/60 text-sm mt-1">doğruluk</p>
                </div>
                <p className="text-white font-extrabold text-2xl">{resultData.score.toLocaleString()} puan</p>
                <p style={{ color: theme.accentColor }} className="font-bold">Max Kombo: x{resultData.maxCombo}</p>
                <p className="text-lg font-extrabold text-white text-center">
                  {resultData.accuracy >= 90 ? "🎉 Muhteşem!" : resultData.accuracy >= 70 ? "🌟 Harika!" : resultData.accuracy >= 50 ? "💪 İyi Gidiyorsun!" : "🔄 Tekrar Dene!"}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setPhase("idle")}
                    className="px-6 py-3 rounded-xl font-extrabold text-white"
                    style={{ background: theme.laneColor }} data-testid="button-retry">
                    🔄 Tekrar
                  </button>
                  {resultData.accuracy >= 65 && selectedLevel < 39 && (
                    <button onClick={() => { setSelectedLevel(l => l + 1); setPhase("idle"); }}
                      className="px-6 py-3 rounded-xl font-extrabold text-white"
                      style={{ background: theme.blockColor }} data-testid="button-next-level">
                      ➡️ Sonraki
                    </button>
                  )}
                  <button onClick={() => { setPhase("idle"); setView("map"); }}
                    className="px-6 py-3 rounded-xl font-extrabold text-white bg-white/20"
                    data-testid="button-map">
                    🗺️ Harita
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Level Map Component ──────────────────────────────────────────────────────
function LevelMap({ highestCompleted, totalStars, onSelectLevel, onBack }:
  { highestCompleted: number; totalStars: number; onSelectLevel: (l: number) => void; onBack: () => void }) {

  const groups = [
    { label: "Müzik Ormanı 🌲", range: [0, 12], color: "#16a34a", bg: "#dcfce7" },
    { label: "Ritim Şehri 🏙️",   range: [13, 26], color: "#4338ca", bg: "#e0e7ff" },
    { label: "Uzay Müziği 🚀",    range: [27, 39], color: "#7c3aed", bg: "#f3e8ff" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #fef9c3 0%, #dcfce7 50%, #dbeafe 100%)" }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-5 pb-3 bg-white/80 backdrop-blur shadow-sm">
        <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow" data-testid="button-back">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <div>
          <h1 className="font-extrabold text-xl text-gray-800">Ritim Macerası 🥁</h1>
          <p className="text-xs text-gray-500 font-semibold">40 seviye · {totalStars} ⭐ toplam</p>
        </div>
      </div>

      <div className="px-4 py-6 space-y-8 pb-16">
        {groups.map(g => (
          <div key={g.label}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 flex-1 rounded-full" style={{ background: g.color + "44" }} />
              <span className="text-sm font-extrabold" style={{ color: g.color }}>{g.label}</span>
              <div className="h-1 flex-1 rounded-full" style={{ background: g.color + "44" }} />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: g.range[1] - g.range[0] + 1 }, (_, i) => {
                const lvlIdx = g.range[0] + i;
                const done = lvlIdx <= highestCompleted;
                const unlocked = lvlIdx <= highestCompleted + 1;
                const isNext = lvlIdx === highestCompleted + 1;
                return (
                  <motion.button
                    key={lvlIdx}
                    disabled={!unlocked}
                    onClick={() => onSelectLevel(lvlIdx)}
                    whileHover={unlocked ? { scale: 1.08 } : {}}
                    whileTap={unlocked ? { scale: 0.95 } : {}}
                    className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 font-extrabold text-xs shadow"
                    style={{
                      background: done ? g.color : isNext ? g.bg : "#f1f5f9",
                      color: done ? "#fff" : isNext ? g.color : "#94a3b8",
                      border: isNext ? `2px solid ${g.color}` : "none",
                      boxShadow: isNext ? `0 0 12px ${g.color}44` : undefined,
                      opacity: unlocked ? 1 : 0.4,
                    }}
                    data-testid={`button-level-${lvlIdx + 1}`}
                  >
                    {!unlocked ? "🔒" : done ? "⭐" : lvlIdx + 1}
                    {unlocked && <span style={{ fontSize: 9, opacity: 0.8 }}>{lvlIdx + 1}</span>}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
