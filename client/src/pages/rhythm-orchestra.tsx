import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { OrchestraSong } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Music, Play, Star, Drum, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type HitResult = "perfect" | "good" | "ok" | "early" | "late" | "miss";
type Phase = "select" | "mode" | "countdown" | "playing" | "results";
type GameMode = "original" | "kids";
type LaneMode = "single" | "dual" | "full";

interface GameNote {
  id: string;
  lane: number;
  hitTime: number;
  type: "quarter" | "eighth";
  state: "pending" | HitResult;
}

interface HitFeedback {
  id: string;
  lane: number;
  result: HitResult;
  ts: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LANES = [
  { name: "Kick",   tr: "Davul",     action: "Ayak Vur",     emoji: "🥁", color: "#f97316", glow: "rgba(249,115,22,0.6)"  },
  { name: "Snare",  tr: "Trampet",   action: "Alkış",         emoji: "🎵", color: "#3b82f6", glow: "rgba(59,130,246,0.6)"  },
  { name: "Hi-Hat", tr: "Hi-Hat",    action: "Parmak Şıklat", emoji: "✨", color: "#eab308", glow: "rgba(234,179,8,0.6)"   },
  { name: "Clap",   tr: "El Çırpma", action: "El Çırp",       emoji: "👏", color: "#22c55e", glow: "rgba(34,197,94,0.6)"   },
  { name: "Perc",   tr: "Perküsyon", action: "Göğüs Vur",     emoji: "💥", color: "#a855f7", glow: "rgba(168,85,247,0.6)"  },
];

const LANE_MODES: Record<LaneMode, number[]> = {
  single: [0, 1],
  dual:   [0, 1, 2],
  full:   [0, 1, 2, 3, 4],
};

const HIT_PERFECT = 40;
const HIT_GOOD    = 80;
const HIT_OK      = 120;
const TRAVEL_BEATS = 4;
const LANE_KEYS   = ["f", "g", "h", "j", "k"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTravelTime(bpm: number) {
  return TRAVEL_BEATS * (60000 / bpm);
}

function generateNotes(
  pattern: Record<string, number[]>,
  bpm: number,
  activeLanes: number[]
): GameNote[] {
  const stepMs = (60000 / bpm) / 4;
  const laneKeys = ["kick", "snare", "hihat", "clap", "perc"];
  const measures = 32;
  const notes: GameNote[] = [];

  for (let m = 0; m < measures; m++) {
    for (let s = 0; s < 16; s++) {
      for (const laneIdx of activeLanes) {
        const key = laneKeys[laneIdx];
        const pat = pattern[key];
        if (!pat) continue;
        if (pat[s % pat.length]) {
          notes.push({
            id: `${laneIdx}-${m}-${s}-${Math.random()}`,
            lane: laneIdx,
            hitTime: (m * 16 + s) * stepMs,
            type: s % 2 === 0 ? "quarter" : "eighth",
            state: "pending",
          });
        }
      }
    }
  }
  return notes.sort((a, b) => a.hitTime - b.hitTime);
}

function getStarCount(accuracy: number) {
  if (accuracy >= 90) return 3;
  if (accuracy >= 70) return 2;
  if (accuracy >= 50) return 1;
  return 0;
}

function getHitLabel(r: HitResult, tr = true): string {
  if (!tr) {
    const map: Record<HitResult, string> = { perfect: "PERFECT!", good: "İYİ!", ok: "TAMAM", early: "ERKEN", late: "GEÇ", miss: "MISS" };
    return map[r];
  }
  const map: Record<HitResult, string> = { perfect: "MÜKEMMEL!", good: "İYİ!", ok: "TAMAM!", early: "ERKEN!", late: "GEÇ!", miss: "KAÇTI!" };
  return map[r];
}

function getHitColor(r: HitResult): string {
  const map: Record<HitResult, string> = {
    perfect: "#fbbf24", good: "#34d399", ok: "#60a5fa",
    early: "#fb923c", late: "#fb923c", miss: "#f87171",
  };
  return map[r];
}

// ─── Song Select ─────────────────────────────────────────────────────────────

function SongSelect({ songs, onSelect }: { songs: OrchestraSong[]; onSelect: (s: OrchestraSong) => void }) {
  const [, navigate] = useLocation();

  if (songs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6 text-white">
        <Music size={80} className="text-purple-300 mb-6 opacity-60" />
        <h2 className="text-2xl font-bold mb-3 text-center">Şarkı Bulunamadı</h2>
        <p className="text-purple-200 text-center mb-8">Öğretmenin henüz şarkı yüklememiş. Biraz bekle!</p>
        <Button variant="outline" onClick={() => navigate("/student/home")} className="border-white/30 text-white hover:bg-white/10" data-testid="btn-back-home">
          <ArrowLeft size={16} className="mr-2" /> Ana Menüye Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <button onClick={() => navigate("/student/home")} className="flex items-center gap-2 text-purple-300 hover:text-white mb-6 transition-colors" data-testid="btn-back-home">
          <ArrowLeft size={20} /> Ana Menü
        </button>
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎼</div>
          <h1 className="text-3xl font-bold mb-1">Ritim Orkestrası</h1>
          <p className="text-purple-200">Bir şarkı seç ve oynamaya başla!</p>
        </div>
        <div className="space-y-3">
          {songs.map(song => (
            <motion.button
              key={song.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(song)}
              className="w-full bg-white/10 hover:bg-white/20 rounded-2xl p-4 text-left flex items-center gap-4 transition-all border border-white/10 hover:border-purple-400/50"
              data-testid={`btn-song-${song.id}`}
            >
              <div className="text-3xl">🎵</div>
              <div className="flex-1">
                <div className="font-bold text-lg">{song.name}</div>
                <div className="text-purple-300 text-sm">{song.bpm} BPM</div>
              </div>
              <Play size={24} className="text-purple-300" />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mode Select ─────────────────────────────────────────────────────────────

function ModeSelect({
  song,
  gameMode,
  laneMode,
  onGameMode,
  onLaneMode,
  onStart,
  onBack,
}: {
  song: OrchestraSong;
  gameMode: GameMode;
  laneMode: LaneMode;
  onGameMode: (m: GameMode) => void;
  onLaneMode: (m: LaneMode) => void;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-purple-300 hover:text-white mb-6 transition-colors" data-testid="btn-back-songs">
          <ArrowLeft size={20} /> Şarkılar
        </button>

        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🎵</div>
          <h2 className="text-2xl font-bold">{song.name}</h2>
          <p className="text-purple-300">{song.bpm} BPM</p>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-3 text-purple-200">Zorluk Seviyesi</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["original", "kids"] as GameMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => onGameMode(m)}
                  className={`p-4 rounded-2xl border-2 transition-all text-center ${gameMode === m ? "border-purple-400 bg-purple-600/40" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
                  data-testid={`btn-mode-${m}`}
                >
                  <div className="text-2xl mb-1">{m === "original" ? "🎸" : "⭐"}</div>
                  <div className="font-bold">{m === "original" ? "Orijinal" : "Çocuklar İçin"}</div>
                  <div className="text-xs text-purple-300 mt-1">{m === "original" ? "Gerçek ritim" : "Basitleştirilmiş"}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-purple-200">Şerit Modu</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["single", "dual", "full"] as LaneMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => onLaneMode(m)}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${laneMode === m ? "border-yellow-400 bg-yellow-500/20" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
                  data-testid={`btn-lanemode-${m}`}
                >
                  <div className="text-xl mb-1">{m === "single" ? "🥁" : m === "dual" ? "🥁🎵" : "🎼"}</div>
                  <div className="font-bold text-sm">{m === "single" ? "Tekli" : m === "dual" ? "İkili" : "Orkestra"}</div>
                  <div className="text-xs text-purple-300">{LANE_MODES[m].length} şerit</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-purple-200 mb-2">Aktif Şeritler</h4>
            <div className="flex gap-2 flex-wrap">
              {LANE_MODES[laneMode].map(i => (
                <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium text-white" style={{ background: LANES[i].color + "66" }}>
                  <span>{LANES[i].emoji}</span>
                  <span>{LANES[i].tr}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={onStart}
            className="w-full py-4 text-xl font-bold rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0"
            data-testid="btn-start-game"
          >
            🎮 Oyunu Başlat
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ bpm, onDone }: { bpm: number; onDone: () => void }) {
  const [count, setCount] = useState(4);
  const [beat, setBeat] = useState(false);

  useEffect(() => {
    const interval = 60000 / bpm;
    let current = 4;
    const tick = () => {
      setBeat(true);
      setTimeout(() => setBeat(false), 100);
      current--;
      if (current <= 0) {
        onDone();
        return;
      }
      setCount(current);
    };
    const id = setInterval(tick, interval);
    return () => clearInterval(id);
  }, [bpm, onDone]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <p className="text-xl text-purple-300 mb-6">Hazırlan...</p>
      <motion.div
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: beat ? 1.2 : 1, opacity: 1 }}
        className="text-9xl font-black text-white"
        style={{ textShadow: "0 0 40px rgba(168,85,247,0.8)" }}
      >
        {count}
      </motion.div>
      <p className="text-purple-300 mt-6">{bpm} BPM</p>
    </div>
  );
}

// ─── Game Canvas ──────────────────────────────────────────────────────────────

function GameCanvas({
  song,
  gameMode,
  laneMode,
  onFinish,
}: {
  song: OrchestraSong;
  gameMode: GameMode;
  laneMode: LaneMode;
  onFinish: (accuracy: number, perfect: number, good: number, miss: number) => void;
}) {
  const activeLanes = LANE_MODES[laneMode];
  const travelTime = getTravelTime(song.bpm);

  const patternRaw = gameMode === "kids" ? song.rhythmPatternKids : song.rhythmPatternOriginal;
  const pattern = (() => {
    try { return JSON.parse(patternRaw); } catch { return {}; }
  })();

  const notesRef = useRef<GameNote[]>(generateNotes(pattern, song.bpm, activeLanes));
  const startTimeRef = useRef<number>(performance.now());
  const rafRef = useRef<number>(0);
  const feedbackRef = useRef<HitFeedback[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const flashRef = useRef<Record<number, number>>({});
  const finishedRef = useRef(false);
  const scoreRef = useRef({ perfect: 0, good: 0, ok: 0, miss: 0, streak: 0 });

  const [score, setScore] = useState({ perfect: 0, good: 0, ok: 0, miss: 0, streak: 0 });

  const totalNotes = notesRef.current.length;
  const gameDuration = totalNotes > 0
    ? notesRef.current[notesRef.current.length - 1].hitTime + 2000
    : 30000;

  const handleLaneTap = useCallback((laneIdx: number) => {
    const now = performance.now() - startTimeRef.current;
    const notes = notesRef.current;
    let bestNote: GameNote | null = null;
    let bestDelta = Infinity;

    for (const note of notes) {
      if (note.lane !== laneIdx) continue;
      if (note.state !== "pending") continue;
      const delta = Math.abs(note.hitTime - now);
      if (delta < bestDelta && delta <= HIT_OK * 1.5) {
        bestDelta = delta;
        bestNote = note;
      }
    }

    let result: HitResult = "miss";
    if (bestNote) {
      const dt = bestNote.hitTime - now;
      if (Math.abs(dt) <= HIT_PERFECT) result = "perfect";
      else if (Math.abs(dt) <= HIT_GOOD) result = "good";
      else if (Math.abs(dt) <= HIT_OK) result = "ok";
      else if (dt > 0) result = "early";
      else result = "late";

      bestNote.state = result;
      flashRef.current[laneIdx] = performance.now();

      scoreRef.current = {
        perfect: scoreRef.current.perfect + (result === "perfect" ? 1 : 0),
        good: scoreRef.current.good + (result === "good" || result === "ok" ? 1 : 0),
        ok: scoreRef.current.ok,
        miss: scoreRef.current.miss,
        streak: result === "miss" ? 0 : scoreRef.current.streak + 1,
      };
      setScore({ ...scoreRef.current });

      feedbackRef.current.push({
        id: Math.random().toString(),
        lane: laneIdx,
        result,
        ts: performance.now(),
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const drawFrame = (timestamp: number) => {
      if (finishedRef.current) return;

      const elapsed = timestamp - startTimeRef.current;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      const laneW = w / activeLanes.length;
      const hitLineY = h * 0.80;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "#0f0a1a";
      ctx.fillRect(0, 0, w, h);

      // Lane backgrounds
      activeLanes.forEach((laneIdx, col) => {
        const x = col * laneW;
        const lane = LANES[laneIdx];
        const isFlashing = flashRef.current[laneIdx] && (timestamp - flashRef.current[laneIdx]) < 150;

        // Lane bg
        const grad = ctx.createLinearGradient(x, 0, x + laneW, 0);
        grad.addColorStop(0, isFlashing ? lane.color + "44" : "#ffffff08");
        grad.addColorStop(1, isFlashing ? lane.color + "22" : "#ffffff03");
        ctx.fillStyle = grad;
        ctx.fillRect(x, 0, laneW, h);

        // Lane divider
        if (col > 0) {
          ctx.strokeStyle = "#ffffff15";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }

        // Hit zone line
        const glowIntensity = isFlashing ? 1 : 0.5;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = isFlashing ? 20 : 10;
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = isFlashing ? 4 : 2;
        ctx.globalAlpha = glowIntensity;
        ctx.beginPath();
        ctx.moveTo(x + 6, hitLineY);
        ctx.lineTo(x + laneW - 6, hitLineY);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Lane header
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(lane.emoji, x + laneW / 2, 30);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#aaaacc";
        ctx.fillText(lane.tr, x + laneW / 2, 48);
      });

      // Draw notes
      notesRef.current.forEach(note => {
        if (!activeLanes.includes(note.lane)) return;
        if (note.state !== "pending" && note.state !== "miss") return;

        const col = activeLanes.indexOf(note.lane);
        const lane = LANES[note.lane];
        const x = col * laneW;

        const spawnTime = note.hitTime - travelTime;
        const progress = (elapsed - spawnTime) / travelTime;
        if (progress < 0 || progress > 1.1) return;

        const noteY = progress * hitLineY;
        const nW = laneW - 16;
        const nH = note.type === "quarter" ? 40 : 24;
        const nX = x + 8;

        // Auto-miss detection
        if (progress > 1.05 && note.state === "pending") {
          note.state = "miss";
          scoreRef.current = { ...scoreRef.current, miss: scoreRef.current.miss + 1, streak: 0 };
          setScore({ ...scoreRef.current });
          feedbackRef.current.push({ id: Math.random().toString(), lane: note.lane, result: "miss", ts: timestamp });
        }

        // Draw cube
        const alpha = note.state === "miss" ? 0.3 : 1;
        ctx.globalAlpha = alpha;

        const grad = ctx.createLinearGradient(nX, noteY - nH, nX + nW, noteY);
        grad.addColorStop(0, lane.color + "ff");
        grad.addColorStop(1, lane.color + "99");
        ctx.fillStyle = grad;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 12;

        const radius = 6;
        ctx.beginPath();
        ctx.roundRect(nX, noteY - nH, nW, nH, radius);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#ffffff40";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Draw hit feedback
      const now = timestamp;
      feedbackRef.current = feedbackRef.current.filter(fb => now - fb.ts < 700);
      feedbackRef.current.forEach(fb => {
        if (!activeLanes.includes(fb.lane)) return;
        const col = activeLanes.indexOf(fb.lane);
        const x = col * laneW;
        const age = (now - fb.ts) / 700;
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = getHitColor(fb.result);
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(getHitLabel(fb.result), x + laneW / 2, hitLineY - 30 - age * 40);
        ctx.globalAlpha = 1;
      });

      // Check game done
      if (elapsed >= gameDuration && !finishedRef.current) {
        finishedRef.current = true;
        const s = scoreRef.current;
        const allMissed = notesRef.current.filter(n => n.state === "pending" || n.state === "miss").length;
        const total = s.perfect + s.good + s.miss + allMissed;
        const hits = s.perfect + s.good;
        const accuracy = total > 0 ? Math.round((hits / total) * 100) : 0;
        onFinish(accuracy, s.perfect, s.good, s.miss + allMissed);
        return;
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);

    // Keyboard support
    const onKey = (e: KeyboardEvent) => {
      const idx = LANE_KEYS.indexOf(e.key.toLowerCase());
      if (idx >= 0 && activeLanes.includes(idx)) {
        handleLaneTap(idx);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ userSelect: "none" }}>
      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/60 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <span className="text-yellow-400 font-bold">⭐ {score.perfect}</span>
          <span className="text-green-400 font-bold">✓ {score.good}</span>
          <span className="text-red-400 font-bold">✗ {score.miss}</span>
        </div>
        <div className="text-white font-bold text-sm truncate max-w-[160px]">{song.name}</div>
        {score.streak >= 5 && (
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
            🔥 {score.streak}x
          </Badge>
        )}
      </div>

      {/* Audio player */}
      <audio
        ref={audioRef}
        src={`/api/orchestra/audio/${song.storedFilename}`}
        autoPlay
        className="hidden"
      />

      {/* Game canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full"
        style={{ touchAction: "none" }}
      />

      {/* Tap buttons */}
      <div className="flex h-20 bg-black/70">
        {activeLanes.map((laneIdx, col) => {
          const lane = LANES[laneIdx];
          return (
            <button
              key={laneIdx}
              className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-60 transition-opacity border-r border-white/10 last:border-0"
              style={{ background: lane.color + "15" }}
              onPointerDown={() => handleLaneTap(laneIdx)}
              data-testid={`btn-lane-${laneIdx}`}
            >
              <span className="text-2xl">{lane.emoji}</span>
              <span className="text-xs font-medium" style={{ color: lane.color }}>{lane.action}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────

function ResultsScreen({
  song,
  studentId,
  accuracy,
  perfect,
  good,
  miss,
  gameMode,
  laneMode,
  onReplay,
  onHome,
}: {
  song: OrchestraSong;
  studentId: string;
  accuracy: number;
  perfect: number;
  good: number;
  miss: number;
  gameMode: GameMode;
  laneMode: LaneMode;
  onReplay: () => void;
  onHome: () => void;
}) {
  const stars = getStarCount(accuracy);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/student/${studentId}/orchestra/progress`, {
        songId: song.id,
        mode: gameMode,
        laneMode,
        accuracy,
        perfectCount: perfect,
        goodCount: good,
        missCount: miss,
      }),
  });

  useEffect(() => {
    saveMutation.mutate();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring" }}
        className="text-center"
      >
        <Trophy size={64} className="text-yellow-400 mx-auto mb-4" />
        <h1 className="text-3xl font-black mb-1">Tebrikler!</h1>
        <p className="text-purple-300 mb-6">{song.name}</p>

        {/* Stars */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3].map(i => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: i <= stars ? 1 : 0.6 }}
              transition={{ delay: i * 0.2, type: "spring" }}
            >
              <Star
                size={56}
                className={i <= stars ? "text-yellow-400 fill-yellow-400" : "text-gray-600 fill-gray-600"}
              />
            </motion.div>
          ))}
        </div>

        {/* Accuracy */}
        <div className="text-6xl font-black mb-6" style={{ color: accuracy >= 90 ? "#fbbf24" : accuracy >= 70 ? "#34d399" : "#f87171" }}>
          %{accuracy}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 bg-white/10 rounded-2xl p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{perfect}</div>
            <div className="text-xs text-purple-300">Mükemmel</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">{good}</div>
            <div className="text-xs text-purple-300">İyi</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{miss}</div>
            <div className="text-xs text-purple-300">Kaçırıldı</div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={onReplay}
            className="flex-1 bg-purple-600 hover:bg-purple-700 border-0 py-3"
            data-testid="btn-replay"
          >
            🔄 Tekrar Oyna
          </Button>
          <Button
            onClick={onHome}
            variant="outline"
            className="flex-1 border-white/30 text-white hover:bg-white/10 py-3"
            data-testid="btn-home-results"
          >
            🏠 Ana Menü
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RhythmOrchestra() {
  const { student, studentLoading } = useAuth();
  const [, navigate] = useLocation();

  const [phase, setPhase] = useState<Phase>("select");
  const [selectedSong, setSelectedSong] = useState<OrchestraSong | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("kids");
  const [laneMode, setLaneMode] = useState<LaneMode>("dual");
  const [results, setResults] = useState<{ accuracy: number; perfect: number; good: number; miss: number } | null>(null);

  useEffect(() => {
    if (!studentLoading && !student) navigate("/student/login");
  }, [student, studentLoading, navigate]);

  const { data: songs = [], isLoading } = useQuery<OrchestraSong[]>({
    queryKey: ["/api/student", student?.student.id, "orchestra/songs"],
    queryFn: async () => {
      const r = await fetch(`/api/student/${student!.student.id}/orchestra/songs`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!student,
    staleTime: 0,
  });

  if (isLoading || studentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
        <div className="text-white text-xl animate-pulse">🎵 Yükleniyor...</div>
      </div>
    );
  }

  if (phase === "select") {
    return <SongSelect songs={songs} onSelect={s => { setSelectedSong(s); setPhase("mode"); }} />;
  }

  if (phase === "mode" && selectedSong) {
    return (
      <ModeSelect
        song={selectedSong}
        gameMode={gameMode}
        laneMode={laneMode}
        onGameMode={setGameMode}
        onLaneMode={setLaneMode}
        onStart={() => setPhase("countdown")}
        onBack={() => setPhase("select")}
      />
    );
  }

  if (phase === "countdown" && selectedSong) {
    return <Countdown bpm={selectedSong.bpm} onDone={() => setPhase("playing")} />;
  }

  if (phase === "playing" && selectedSong) {
    return (
      <GameCanvas
        song={selectedSong}
        gameMode={gameMode}
        laneMode={laneMode}
        onFinish={(accuracy, perfect, good, miss) => {
          setResults({ accuracy, perfect, good, miss });
          setPhase("results");
        }}
      />
    );
  }

  if (phase === "results" && selectedSong && results && student) {
    return (
      <ResultsScreen
        song={selectedSong}
        studentId={student.student.id}
        accuracy={results.accuracy}
        perfect={results.perfect}
        good={results.good}
        miss={results.miss}
        gameMode={gameMode}
        laneMode={laneMode}
        onReplay={() => setPhase("countdown")}
        onHome={() => navigate("/student/home")}
      />
    );
  }

  return null;
}
