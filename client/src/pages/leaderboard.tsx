import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, Trophy, Star, Award, Crown } from "lucide-react";

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  classCode: string;
  totalStars: number;
  totalBadges: number;
  totalScore: number;
  monthlyStars: number;
  monthlyBadges: number;
  monthlyScore: number;
};

type Winner = {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  classCode: string;
  score: number;
  rank: number;
  month: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];
const RANK_BG = [
  "from-yellow-400/30 to-yellow-200/10 border-yellow-400",
  "from-gray-300/30 to-gray-100/10 border-gray-300",
  "from-orange-400/30 to-orange-200/10 border-orange-400",
];

function formatMonth(m: string) {
  if (!m) return "";
  const [year, month] = m.split("-");
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const { student, teacher } = useAuth();
  const [tab, setTab] = useState<"school" | "class" | "monthly">("school");

  const apiBase = import.meta.env.VITE_API_URL || "";

  const { data, isLoading } = useQuery<{ entries: LeaderboardEntry[]; currentStudentId: string | null }>({
    queryKey: ["/api/leaderboard", tab],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/leaderboard?type=${tab}`, { credentials: "include" });
      if (!res.ok) throw new Error("Yüklenemedi");
      return res.json();
    },
    enabled: !!(student || teacher),
  });

  const { data: winners } = useQuery<Winner[]>({
    queryKey: ["/api/leaderboard/winners"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/leaderboard/winners`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!(student || teacher),
  });

  const entries = data?.entries ?? [];
  const currentStudentId = data?.currentStudentId ?? student?.student?.id ?? null;

  const tabs: { key: "school" | "class" | "monthly"; label: string; icon: string }[] = [
    { key: "school", label: "Okul", icon: "🏫" },
    { key: "class", label: "Sınıf", icon: "🎓" },
    { key: "monthly", label: "Bu Ay", icon: "📅" },
  ];

  const scoreKey = tab === "monthly" ? "monthlyScore" : "totalScore";
  const starsKey = tab === "monthly" ? "monthlyStars" : "totalStars";
  const badgesKey = tab === "monthly" ? "monthlyBadges" : "totalBadges";

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            data-testid="button-back"
            onClick={() => navigate(student ? "/student/home" : "/teacher/dashboard")}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Trophy size={28} className="text-yellow-400" />
            <h1 className="text-2xl font-extrabold text-white">Liderlik Tablosu</h1>
          </div>
        </div>

        {/* Geçen Ay Şampiyonları */}
        {winners && winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl p-4 border border-yellow-400/30"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(251,191,36,0.04) 100%)" }}
          >
            <p className="text-yellow-300 font-extrabold text-sm mb-3 flex items-center gap-2">
              <Crown size={16} /> {formatMonth(winners[0]?.month)} Şampiyonları
            </p>
            <div className="flex flex-col gap-2">
              {winners.map((w) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="text-lg">{MEDAL[w.rank - 1] ?? "🏅"}</span>
                  <div className="flex-1">
                    <span className="text-white font-bold text-sm">{w.firstName} {w.lastName}</span>
                    <span className="text-xs text-gray-400 ml-2">· {w.classCode}</span>
                  </div>
                  <span className="text-yellow-300 font-extrabold text-sm">{w.score} puan</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 bg-white/5 rounded-2xl p-1">
          {tabs.map(t => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                tab === t.key
                  ? "bg-purple-600 text-white shadow"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Skor açıklaması */}
        <p className="text-xs text-gray-500 text-center mb-4">
          Puan = Yıldız × 10 + Rozet × 50
        </p>

        {/* Entries */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Trophy size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Henüz skor yok</p>
            <p className="text-sm mt-1">Oyunlar oynandıkça sıralaması burada görünür</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry, idx) => {
              const isMe = entry.studentId === currentStudentId;
              const score = (entry as any)[scoreKey] as number;
              const stars = (entry as any)[starsKey] as number;
              const badges = (entry as any)[badgesKey] as number;
              const isTop3 = entry.rank <= 3;

              return (
                <motion.div
                  key={entry.studentId}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.5) }}
                  data-testid={`row-student-${entry.studentId}`}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                    isMe
                      ? "border-purple-400 bg-gradient-to-r from-purple-600/30 to-indigo-600/20"
                      : isTop3
                      ? `bg-gradient-to-r ${RANK_BG[entry.rank - 1]} border-opacity-40`
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {isTop3
                      ? <span className="text-xl">{MEDAL[entry.rank - 1]}</span>
                      : <span className="text-gray-400 font-bold text-sm">{entry.rank}</span>
                    }
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm truncate ${isMe ? "text-purple-200" : "text-white"}`}>
                        {entry.firstName} {entry.lastName}
                        {isMe && <span className="text-purple-300 text-xs ml-1">(Sen)</span>}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{entry.classCode}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-yellow-300">
                      <Star size={12} /> <span className="font-bold">{stars}</span>
                    </div>
                    {badges > 0 && (
                      <div className="flex items-center gap-1 text-xs text-amber-400">
                        <Award size={12} /> <span className="font-bold">{badges}</span>
                      </div>
                    )}
                    <div className={`font-extrabold text-sm ${isTop3 ? "text-yellow-300" : "text-gray-300"}`}>
                      {score}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
