import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SingleNoteRenderer } from "@/components/vexflow-renderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import type { StudentProgress } from "@shared/schema";

// 10 consecutive correct answers → +3 stars
const CONSECUTIVE_REQUIRED = 10;

// Badge thresholds at level 6 completion
const BADGE_THRESHOLDS = { bronze: 30, silver: 50, gold: 60 };

// Total question targets per level (for progress display)
const LEVEL_QUESTIONS = [15, 30, 45, 15, 30, 55];

// Notes by level
const LEVEL_NOTES: Record<number, { vexKey: string; label: string; solfa: string }[]> = {
  1: [
    { vexKey: "c/4", label: "C", solfa: "Do" },
    { vexKey: "d/4", label: "D", solfa: "Re" },
    { vexKey: "e/4", label: "E", solfa: "Mi" },
  ],
  2: [
    { vexKey: "c/4", label: "C", solfa: "Do" },
    { vexKey: "d/4", label: "D", solfa: "Re" },
    { vexKey: "e/4", label: "E", solfa: "Mi" },
    { vexKey: "f/4", label: "F", solfa: "Fa" },
    { vexKey: "g/4", label: "G", solfa: "Sol" },
  ],
  3: [
    { vexKey: "c/4", label: "C", solfa: "Do" },
    { vexKey: "d/4", label: "D", solfa: "Re" },
    { vexKey: "e/4", label: "E", solfa: "Mi" },
    { vexKey: "f/4", label: "F", solfa: "Fa" },
    { vexKey: "g/4", label: "G", solfa: "Sol" },
    { vexKey: "a/4", label: "A", solfa: "La" },
    { vexKey: "b/4", label: "B", solfa: "Si" },
  ],
  4: [
    { vexKey: "c/5", label: "C", solfa: "Do" },
    { vexKey: "d/5", label: "D", solfa: "Re" },
    { vexKey: "e/5", label: "E", solfa: "Mi" },
  ],
  5: [
    { vexKey: "c/5", label: "C", solfa: "Do" },
    { vexKey: "d/5", label: "D", solfa: "Re" },
    { vexKey: "e/5", label: "E", solfa: "Mi" },
    { vexKey: "f/5", label: "F", solfa: "Fa" },
    { vexKey: "g/5", label: "G", solfa: "Sol" },
    { vexKey: "a/5", label: "A", solfa: "La" },
    { vexKey: "b/5", label: "B", solfa: "Si" },
  ],
  6: [
    { vexKey: "c/4", label: "C", solfa: "Do" },
    { vexKey: "d/4", label: "D", solfa: "Re" },
    { vexKey: "e/4", label: "E", solfa: "Mi" },
    { vexKey: "f/4", label: "F", solfa: "Fa" },
    { vexKey: "g/4", label: "G", solfa: "Sol" },
    { vexKey: "a/4", label: "A", solfa: "La" },
    { vexKey: "b/4", label: "B", solfa: "Si" },
    { vexKey: "c/5", label: "C", solfa: "Do" },
    { vexKey: "d/5", label: "D", solfa: "Re" },
    { vexKey: "e/5", label: "E", solfa: "Mi" },
    { vexKey: "f/5", label: "F", solfa: "Fa" },
    { vexKey: "g/5", label: "G", solfa: "Sol" },
  ],
};

const ALL_BUTTONS = [
  { label: "C", solfa: "Do" },
  { label: "D", solfa: "Re" },
  { label: "E", solfa: "Mi" },
  { label: "F", solfa: "Fa" },
  { label: "G", solfa: "Sol" },
  { label: "A", solfa: "La" },
  { label: "B", solfa: "Si" },
];

const BUTTON_GRADIENTS = [
  "linear-gradient(135deg, #f87171, #ef4444)",
  "linear-gradient(135deg, #fb923c, #f97316)",
  "linear-gradient(135deg, #facc15, #eab308)",
  "linear-gradient(135deg, #4ade80, #22c55e)",
  "linear-gradient(135deg, #2dd4bf, #14b8a6)",
  "linear-gradient(135deg, #60a5fa, #3b82f6)",
  "linear-gradient(135deg, #c084fc, #a855f7)",
];

export default function NoteDetective() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const qc = useQueryClient();

  const [level, setLevel] = useState(1);
  const [currentNote, setCurrentNote] = useState<{ vexKey: string; label: string; solfa: string } | null>(null);
  const [score, setScore] = useState({ correct: 0, wrong: 0 });
  const [totalStars, setTotalStars] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; message: string } | null>(null);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [answeredThisRound, setAnsweredThisRound] = useState(false);
  const [levelQuestions, setLevelQuestions] = useState(0);
  const [celebration, setCelebration] = useState<{ emoji: string; title: string; sub: string } | null>(null);
  const [notesBadge, setNotesBadge] = useState<"bronze" | "silver" | "gold" | null>(null); // best badge ever earned
  const [gameComplete, setGameComplete] = useState<{
    tier: "bronze" | "silver" | "gold" | null;
    stars: number;
    correct: number;
    wrong: number;
  } | null>(null);

  const sessionStartRef = useRef(Date.now());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const progressLoadedRef = useRef(false);
  const lastNoteRef = useRef<string | null>(null);

  const { data: progress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/student/${student!.student.id}/progress`, { credentials: "include" });
      return res.json();
    },
    enabled: !!student,
  });

  useEffect(() => {
    if (!student) { navigate("/student/login"); return; }
    if (progressLoadedRef.current) return;
    const notesProgress = progress?.find(p => p.appType === "notes");
    if (notesProgress || progress !== undefined) {
      progressLoadedRef.current = true;
      if (notesProgress) {
        // URL'den seviye parametresi varsa onu kullan (ilerleme haritasından gelen)
        const urlLevel = parseInt(new URLSearchParams(window.location.search).get("level") ?? "0", 10);
        setLevel(urlLevel > 0 ? Math.min(Math.max(urlLevel, 1), 6) : notesProgress.level);
        setScore({ correct: notesProgress.correctAnswers, wrong: notesProgress.wrongAnswers });
        setTotalStars(notesProgress.starsEarned);
        setNotesBadge(notesProgress.notesBadge as "bronze" | "silver" | "gold" | null);
      } else {
        const urlLevel = parseInt(new URLSearchParams(window.location.search).get("level") ?? "0", 10);
        if (urlLevel > 0) setLevel(Math.min(Math.max(urlLevel, 1), 6));
      }
      setConsecutiveCorrect(0);
    }
  }, [student, progress]);

  const playNote = useCallback((freq: number, correct: boolean) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = correct ? freq : 200;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (correct ? 0.5 : 0.3));
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + (correct ? 0.5 : 0.3));
    } catch {}
  }, []);

  const noteFrequencies: Record<string, number> = {
    "c/4": 261.63, "d/4": 293.66, "e/4": 329.63, "f/4": 349.23,
    "g/4": 392.0, "a/4": 440.0, "b/4": 493.88,
    "c/5": 523.25, "d/5": 587.33, "e/5": 659.25, "f/5": 698.46,
    "g/5": 783.99, "a/5": 880.0, "b/5": 987.77,
  };

  const pickRandomNote = useCallback((lvl: number) => {
    const notes = LEVEL_NOTES[Math.min(lvl, 6)] ?? LEVEL_NOTES[6];
    const candidates = notes.length > 1
      ? notes.filter(n => n.vexKey !== lastNoteRef.current)
      : notes;
    const note = candidates[Math.floor(Math.random() * candidates.length)];
    lastNoteRef.current = note.vexKey;
    setCurrentNote(note);
    setFeedback(null);
    setAnsweredThisRound(false);
  }, []);

  useEffect(() => {
    if (student) pickRandomNote(level);
  }, [level, student]);

  const handleAnswer = useCallback((label: string) => {
    if (!currentNote || answeredThisRound) return;
    setAnsweredThisRound(true);

    const correct = currentNote.label === label;
    const freq = noteFrequencies[currentNote.vexKey] ?? 440;
    playNote(freq, correct);

    const messages = correct
      ? ["Harika! 🌟", "Doğru! ⭐", "Mükemmel! 🎉", "Süper! 🎵"]
      : [`Cevap ${currentNote.label} (${currentNote.solfa}) idi!`, `Hata! O ${currentNote.label}`, `Tekrar dene! Cevap: ${currentNote.label}`];

    setFeedback({
      correct,
      message: messages[Math.floor(Math.random() * messages.length)],
    });

    const newCorrect = score.correct + (correct ? 1 : 0);
    const newWrong = score.wrong + (correct ? 0 : 1);
    const newConsecutive = correct ? consecutiveCorrect + 1 : 0;
    setConsecutiveCorrect(newConsecutive);
    setScore({ correct: newCorrect, wrong: newWrong });

    const newLevelQuestions = levelQuestions + 1;
    setLevelQuestions(newLevelQuestions);

    const levelTarget = LEVEL_QUESTIONS[level - 1] ?? 55;
    const completedByTarget = newLevelQuestions >= levelTarget;
    const streakBonus = newConsecutive >= CONSECUTIVE_REQUIRED && correct;

    let bonusStars = 0;

    // +3 for 10 consecutive correct answers
    if (streakBonus) {
      bonusStars += 3;
      setConsecutiveCorrect(0);
      if (!completedByTarget) {
        setCelebration({ emoji: "🔥", title: "Mükemmel Seri!", sub: "+3 Bonus Yıldız Kazandın ⭐⭐⭐" });
        setTimeout(() => setCelebration(null), 2500);
      }
    }

    // +2 for completing the level's question target
    if (completedByTarget) bonusStars += 2;

    const newStars = totalStars + bonusStars;
    setTotalStars(newStars);

    // Level up ONLY when question target is reached (levels 1-5)
    const shouldLevelUp = completedByTarget && level < 6;
    const newLevel = shouldLevelUp ? level + 1 : level;
    if (shouldLevelUp) {
      setLevel(newLevel);
      setLevelQuestions(0);
      if (!streakBonus) setConsecutiveCorrect(0);
      const sub = streakBonus
        ? "+3 Seri Bonusu & +2 Seviye Bonusu = +5 Yıldız 🌟"
        : "+2 Yıldız Kazandın ⭐⭐";
      setCelebration({ emoji: "🎉", title: "Seviye Tamamlandı!", sub });
      setTimeout(() => setCelebration(null), 2500);
    }

    // Level 6 final completion → compute badge tier
    if (completedByTarget && level === 6) {
      setConsecutiveCorrect(0);
      const tier: "bronze" | "silver" | "gold" | null =
        newStars >= BADGE_THRESHOLDS.gold ? "gold" :
        newStars >= BADGE_THRESHOLDS.silver ? "silver" :
        newStars >= BADGE_THRESHOLDS.bronze ? "bronze" : null;

      // Persist best badge ever (never downgrade)
      const badgeRank = { null: 0, bronze: 1, silver: 2, gold: 3 } as Record<string, number>;
      const bestBadge = (badgeRank[tier ?? "null"] ?? 0) >= (badgeRank[notesBadge ?? "null"] ?? 0) ? tier : notesBadge;
      setNotesBadge(bestBadge);

      setGameComplete({ tier, stars: newStars, correct: newCorrect, wrong: newWrong });
    }

    if (student) {
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const isLevel6Done = completedByTarget && level === 6;
      const tier: "bronze" | "silver" | "gold" | null = isLevel6Done
        ? (newStars >= BADGE_THRESHOLDS.gold ? "gold" :
           newStars >= BADGE_THRESHOLDS.silver ? "silver" :
           newStars >= BADGE_THRESHOLDS.bronze ? "bronze" : null)
        : undefined as unknown as null;
      const badgeRank = { null: 0, bronze: 1, silver: 2, gold: 3 } as Record<string, number>;
      const bestBadge = isLevel6Done
        ? ((badgeRank[tier ?? "null"] ?? 0) >= (badgeRank[notesBadge ?? "null"] ?? 0) ? tier : notesBadge)
        : notesBadge;

      apiRequest("POST", `/api/student/${student.student.id}/progress`, {
        appType: "notes",
        level: newLevel,
        starsEarned: newStars,
        correctAnswers: newCorrect,
        wrongAnswers: newWrong,
        timeSpentSeconds: elapsed,
        notesBadge: bestBadge,
      }).then(() => qc.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }));
    }

    const isLevel6Done = completedByTarget && level === 6;
    if (!isLevel6Done) {
      setTimeout(() => pickRandomNote(newLevel), shouldLevelUp ? 2600 : 1500);
    }
  }, [currentNote, answeredThisRound, score, consecutiveCorrect, totalStars, notesBadge, level, levelQuestions, student, qc, playNote, pickRandomNote]);

  // Reset to level 1 after level 6 — preserve notesBadge
  const handleReset = useCallback(() => {
    setGameComplete(null);
    setLevel(1);
    setLevelQuestions(0);
    setConsecutiveCorrect(0);
    setTotalStars(0);
    setScore({ correct: 0, wrong: 0 });
    lastNoteRef.current = null;
    if (student) {
      apiRequest("POST", `/api/student/${student.student.id}/progress`, {
        appType: "notes", level: 1, starsEarned: 0,
        correctAnswers: 0, wrongAnswers: 0, timeSpentSeconds: 0,
        notesBadge: notesBadge, // keep the best badge ever
      }).then(() => qc.invalidateQueries({ queryKey: ["/api/student", student.student.id, "progress"] }));
    }
    setTimeout(() => pickRandomNote(1), 300);
  }, [student, qc, pickRandomNote, notesBadge]);

  const accuracy = score.correct + score.wrong > 0
    ? Math.round((score.correct / (score.correct + score.wrong)) * 100)
    : 0;

  if (!student) return null;

  return (
    <div className="min-h-screen select-none"
      style={{ background: "linear-gradient(160deg, #f3e8ff 0%, #e0d7ff 50%, #ddd6fe 100%)" }}
    >
      {/* Game complete overlay: 3-tier badge or no badge */}
      <AnimatePresence>
        {gameComplete && (() => {
          const tierConfig = {
            gold:   { emoji: "🥇", color: "text-yellow-500", bg: "rgba(120,90,0,0.88)", label: "Altın Rozet", btnClass: "bg-yellow-500 hover:bg-yellow-600" },
            silver: { emoji: "🥈", color: "text-slate-400",  bg: "rgba(40,60,80,0.88)",  label: "Gümüş Rozet", btnClass: "bg-slate-500 hover:bg-slate-600" },
            bronze: { emoji: "🥉", color: "text-orange-600", bg: "rgba(80,40,10,0.88)", label: "Bronz Rozet", btnClass: "bg-orange-500 hover:bg-orange-600" },
          };
          const cfg = gameComplete.tier ? tierConfig[gameComplete.tier] : null;
          return (
            <motion.div
              className="fixed inset-0 z-[60] flex items-center justify-center px-4"
              style={{ background: cfg ? cfg.bg : "rgba(30,30,60,0.88)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                className="bg-white rounded-3xl px-8 py-8 shadow-2xl text-center max-w-sm w-full"
                initial={{ scale: 0.5, y: 60 }} animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                {cfg ? (
                  <>
                    <motion.p className="text-7xl mb-3"
                      animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.25, 1] }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    >{cfg.emoji}</motion.p>
                    <p className="text-3xl font-extrabold text-purple-700 mb-1">Tebrikler! 🎉</p>
                    <p className={`text-xl font-extrabold mb-4 ${cfg.color}`}>{cfg.label} Kazandın!</p>
                  </>
                ) : (
                  <>
                    <p className="text-6xl mb-3">😔</p>
                    <p className="text-2xl font-extrabold text-gray-700 mb-1">Rozet Kazanamadın</p>
                    <p className="text-sm text-muted-foreground mb-4">30 yıldız = Bronz, 50 = Gümüş, 60 = Altın</p>
                  </>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {[
                    { icon: "⭐", label: "Yıldız", value: gameComplete.stars },
                    { icon: "✅", label: "Doğru",  value: gameComplete.correct },
                    { icon: "❌", label: "Yanlış", value: gameComplete.wrong },
                  ].map((s, i) => (
                    <div key={i} className="bg-gray-50 rounded-2xl p-2">
                      <p className="text-xl">{s.icon}</p>
                      <p className="text-lg font-extrabold text-gray-700">{s.value}</p>
                      <p className="text-xs text-gray-400 font-bold">{s.label}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs font-semibold text-gray-400 mb-4">
                  Rozetler profilinde saklanır. Seviye 1'den başlıyorsun!
                </p>
                <Button
                  data-testid="button-restart-game"
                  className={`w-full rounded-2xl font-extrabold text-base py-5 text-white ${cfg ? cfg.btnClass : "bg-purple-600 hover:bg-purple-700"}`}
                  onClick={handleReset}
                >
                  Hadi Oynayalım! 🎮
                </Button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Level complete / streak celebration overlay */}
      <AnimatePresence>
        {celebration && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl px-10 py-8 shadow-2xl text-center"
              initial={{ scale: 0.5, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <p className="text-5xl mb-3">{celebration.emoji}</p>
              <p className="text-2xl font-extrabold text-purple-700">{celebration.title}</p>
              <p className="text-base font-bold text-yellow-500 mt-1">{celebration.sub}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/student/home")} className="gap-1.5 rounded-xl font-bold">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            <h1 className="font-extrabold text-lg text-purple-700">Nota Dedektifi</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-500">⭐</span>
            <span className="font-extrabold text-yellow-700 text-sm" data-testid="text-stars">{totalStars}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Seviye", value: level, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Doğru", value: score.correct, color: "text-green-600", bg: "bg-green-50" },
            { label: "Yanlış", value: score.wrong, color: "text-red-500", bg: "bg-red-50" },
            { label: "Doğruluk", value: `${accuracy}%`, color: "text-blue-600", bg: "bg-blue-50" },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} rounded-2xl p-3 text-center shadow-sm`}>
              <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground font-bold">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Level badge + progress */}
        <div className="text-center space-y-2">
          <Badge className="font-extrabold text-sm px-4 py-1.5 rounded-full bg-purple-600 text-white border-0">
            Seviye {level} — {LEVEL_NOTES[level]?.length ?? 12} nota
          </Badge>
          {/* Question progress bar */}
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs font-bold text-purple-400 w-12 text-right">{levelQuestions}</span>
            <div className="flex-1 h-2 bg-purple-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-purple-400 rounded-full"
                animate={{ width: `${Math.min((levelQuestions / (LEVEL_QUESTIONS[level - 1] ?? 55)) * 100, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs font-bold text-purple-400 w-12">{LEVEL_QUESTIONS[level - 1] ?? 55} soru</span>
          </div>
          {/* Consecutive correct streak → +3 stars at 10 */}
          <div className="flex items-center justify-center gap-1">
            <span className="text-xs font-bold text-orange-400 mr-1">🔥</span>
            {Array.from({ length: CONSECUTIVE_REQUIRED }).map((_, i) => (
              <motion.div
                key={i}
                className={`w-4 h-4 rounded-full border-2 ${
                  i < consecutiveCorrect
                    ? "bg-orange-400 border-orange-500"
                    : "bg-gray-100 border-gray-200"
                }`}
                animate={i < consecutiveCorrect ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              />
            ))}
            <span className="text-xs font-bold text-gray-400 ml-1">+3⭐</span>
          </div>
        </div>

        {/* Staff and note display */}
        <div className="bg-white rounded-3xl p-6 shadow-md">
          <p className="text-xs font-extrabold text-center text-muted-foreground uppercase tracking-widest mb-3">
            Bu nota hangisi?
          </p>
          <div className="flex justify-center">
            {currentNote && (
              <SingleNoteRenderer
                noteKey={currentNote.vexKey}
                width={220}
                height={130}
                scale={1.5}
              />
            )}
          </div>
        </div>

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              className={`rounded-2xl p-4 text-center`}
              style={{ background: feedback.correct ? "#dcfce7" : "#fee2e2" }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-3xl mb-1">{feedback.correct ? "🌟" : "🤔"}</p>
              <p className={`text-xl font-extrabold ${feedback.correct ? "text-green-600" : "text-red-500"}`}>
                {feedback.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Note buttons */}
        <div className="grid grid-cols-7 gap-2">
          {ALL_BUTTONS.map((btn, i) => {
            const isActive = LEVEL_NOTES[Math.min(level, 6)]?.some(n => n.label === btn.label);
            const isSelected = answeredThisRound && currentNote?.label === btn.label;
            return (
              <motion.button
                key={btn.label}
                data-testid={`button-note-${btn.label}`}
                className={`flex flex-col items-center py-4 rounded-2xl cursor-pointer font-extrabold text-white shadow-md transition-all ${
                  !isActive ? "opacity-30 cursor-not-allowed" : ""
                }`}
                style={{
                  background: isSelected
                    ? "linear-gradient(135deg, #22c55e, #16a34a)"
                    : BUTTON_GRADIENTS[i],
                }}
                whileHover={isActive ? { scale: 1.08, boxShadow: "0 8px 20px rgba(0,0,0,0.2)" } : {}}
                whileTap={isActive ? { scale: 0.93 } : {}}
                onClick={() => isActive && handleAnswer(btn.label)}
                disabled={!isActive || answeredThisRound}
              >
                <span className="text-xl font-black">{btn.label}</span>
                <span className="text-xs font-bold opacity-80">{btn.solfa}</span>
              </motion.button>
            );
          })}
        </div>

        {/* Note colors guide */}
        <div className="grid grid-cols-7 gap-2 text-center">
          {ALL_BUTTONS.map((btn) => (
            <div key={btn.label} className="text-xs text-muted-foreground font-bold">{btn.solfa}</div>
          ))}
        </div>
      </main>
    </div>
  );
}
