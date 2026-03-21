import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Star, Play } from "lucide-react";
import type { StudentProgress } from "@shared/schema";

const RHYTHM_LEVELS = [
  { id: 1, name: "Yarım & Dörtlük", emoji: "🥁", desc: "Temel notalar" },
  { id: 2, name: "Dörtlük Suslar", emoji: "🎵", desc: "Sessizlik ekle" },
  { id: 3, name: "Yarım Suslar", emoji: "🎶", desc: "Uzun duraklamalar" },
  { id: 4, name: "Sekizlik Notalar", emoji: "⚡", desc: "Hızlı notalar" },
  { id: 5, name: "Karışık Ritimler", emoji: "🌟", desc: "Hepsi bir arada" },
  { id: 6, name: "İleri Seviye", emoji: "🏆", desc: "Usta seviyesi" },
];

const NOTE_LEVELS = [
  { id: 1, name: "Do, Re, Mi", emoji: "🔍", desc: "İlk notalar" },
  { id: 2, name: "Fa, Sol ekle", emoji: "🎼", desc: "Daha fazla nota" },
  { id: 3, name: "Tam Gam", emoji: "🎹", desc: "Do'dan Si'ye" },
  { id: 4, name: "Tiz Notalar", emoji: "🚀", desc: "Üst porte" },
  { id: 5, name: "Karışık Notalar", emoji: "🌈", desc: "Tüm oktavlar" },
  { id: 6, name: "Uzman", emoji: "🏆", desc: "Yardımcı çizgiler" },
];

interface LevelNodeProps {
  level: { id: number; name: string; emoji: string; desc: string };
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  stars: number;
  index: number;
  color: string;
  onClick?: () => void;
}

function LevelNode({ level, unlocked, completed, current, stars, index, color, onClick }: LevelNodeProps) {
  const offset = index % 2 === 0 ? 0 : 60;
  const isClickable = unlocked && onClick;

  return (
    <motion.div
      className="flex items-center justify-center"
      style={{ marginLeft: offset }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
    >
      <div className="relative">
        {current && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: color, filter: "blur(12px)" }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div
          onClick={isClickable ? onClick : undefined}
          className={`relative w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg border-4 transition-all ${
            !unlocked ? "opacity-40 grayscale" : current ? "scale-110" : isClickable ? "cursor-pointer hover:scale-105 active:scale-95" : ""
          }`}
          style={{
            background: unlocked
              ? completed
                ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                : current
                  ? `linear-gradient(135deg, ${color}, ${color}cc)`
                  : "white"
              : "#e5e7eb",
            borderColor: unlocked ? (completed ? "#f59e0b" : color) : "#9ca3af",
          }}
          data-testid={unlocked ? `level-node-${level.id}` : undefined}
        >
          {!unlocked ? (
            <Lock className="w-8 h-8 text-gray-400" />
          ) : (
            <>
              <span className="text-3xl">{level.emoji}</span>
              <span className="text-xs font-extrabold text-center leading-tight px-1" style={{ color: completed ? "#92400e" : current ? "white" : "#374151" }}>
                Seviye {level.id}
              </span>
              {completed && (
                <Play className="w-3 h-3 mt-0.5" style={{ color: "#92400e" }} />
              )}
            </>
          )}
        </div>

        {unlocked && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {[1, 2, 3].map(s => (
              <Star
                key={s}
                className="w-3 h-3"
                fill={s <= stars ? "#f59e0b" : "none"}
                stroke={s <= stars ? "#f59e0b" : "#d1d5db"}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function LevelMap() {
  const [, navigate] = useLocation();
  const { student } = useAuth();

  useEffect(() => {
    if (!student) navigate("/student/login");
  }, [student]);

  const { data: progress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/student/${student!.student.id}/progress`, { credentials: "include" });
      return res.json();
    },
    enabled: !!student,
  });

  const rhythmProgress = progress?.find(p => p.appType === "rhythm");
  const notesProgress = progress?.find(p => p.appType === "notes");

  const rhythmLevel = rhythmProgress?.level ?? 1;
  const notesLevel = notesProgress?.level ?? 1;
  const totalStars = (rhythmProgress?.starsEarned ?? 0) + (notesProgress?.starsEarned ?? 0);

  if (!student) return null;

  return (
    <div className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #e0f2fe 0%, #bae6fd 40%, #7dd3fc 100%)" }}
    >
      <header className="bg-white/70 backdrop-blur border-b sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/student/home")} className="gap-1.5 rounded-xl font-bold">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <h1 className="font-extrabold text-xl text-sky-700">İlerleme Haritam</h1>
          <div className="flex items-center gap-1.5 bg-yellow-100 rounded-full px-3 py-1.5">
            <span className="text-yellow-500">⭐</span>
            <span className="font-extrabold text-yellow-700 text-sm">{totalStars}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-2xl font-extrabold text-sky-800">
            {student.student.firstName}'nin Yolculuğu
          </h2>
          <p className="text-sky-600 font-semibold">{student.class.name}</p>
        </motion.div>

        {/* Ritim Yolu */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}>
              🥁
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-orange-700">Ritmi Yakala</h3>
              <p className="text-sm text-orange-500 font-semibold">Seviye {rhythmLevel} • {rhythmProgress?.starsEarned ?? 0} yıldız</p>
            </div>
            <Button
              size="sm"
              className="ml-auto rounded-xl font-bold gap-1.5"
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none" }}
              onClick={() => navigate("/student/rhythm")}
              data-testid="button-play-rhythm"
            >
              <Play className="w-3.5 h-3.5" />
              Oyna
            </Button>
          </div>

          <div className="relative">
            <svg className="absolute left-0 top-0 w-full h-full pointer-events-none" style={{ overflow: "visible" }}>
              {RHYTHM_LEVELS.slice(0, -1).map((_, i) => {
                const x1 = 48 + (i % 2 === 0 ? 0 : 60);
                const x2 = 48 + ((i + 1) % 2 === 0 ? 0 : 60);
                const y1 = i * 80 + 48;
                const y2 = (i + 1) * 80 + 48;
                return (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={i + 1 < rhythmLevel ? "#f97316" : "#d1d5db"}
                    strokeWidth="4" strokeDasharray={i + 1 >= rhythmLevel ? "8,6" : "0"}
                  />
                );
              })}
            </svg>

            <div className="grid grid-cols-1 gap-4">
              {RHYTHM_LEVELS.map((lvl, i) => (
                <LevelNode
                  key={lvl.id}
                  level={lvl}
                  unlocked={lvl.id <= rhythmLevel}
                  completed={lvl.id < rhythmLevel}
                  current={lvl.id === rhythmLevel}
                  stars={lvl.id < rhythmLevel ? 3 : lvl.id === rhythmLevel ? Math.min(rhythmProgress?.starsEarned ?? 0, 3) : 0}
                  index={i}
                  color="#f97316"
                  onClick={lvl.id <= rhythmLevel ? () => navigate(`/student/rhythm?level=${lvl.id}`) : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border-t-2 border-dashed border-sky-300 my-8" />

        {/* Nota Yolu */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
              🔍
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-purple-700">Nota Dedektifi</h3>
              <p className="text-sm text-purple-500 font-semibold">Seviye {notesLevel} • {notesProgress?.starsEarned ?? 0} yıldız</p>
            </div>
            <Button
              size="sm"
              className="ml-auto rounded-xl font-bold gap-1.5"
              style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", border: "none" }}
              onClick={() => navigate("/student/notes")}
              data-testid="button-play-notes"
            >
              <Play className="w-3.5 h-3.5" />
              Oyna
            </Button>
          </div>

          <div className="relative">
            <div className="grid grid-cols-1 gap-4">
              {NOTE_LEVELS.map((lvl, i) => (
                <LevelNode
                  key={lvl.id}
                  level={lvl}
                  unlocked={lvl.id <= notesLevel}
                  completed={lvl.id < notesLevel}
                  current={lvl.id === notesLevel}
                  stars={lvl.id < notesLevel ? 3 : lvl.id === notesLevel ? Math.min(notesProgress?.starsEarned ?? 0, 3) : 0}
                  index={i}
                  color="#8b5cf6"
                  onClick={lvl.id <= notesLevel ? () => navigate(`/student/notes?level=${lvl.id}`) : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="h-16" />
      </main>
    </div>
  );
}
