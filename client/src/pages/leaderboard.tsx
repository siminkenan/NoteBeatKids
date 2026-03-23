import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, Trophy, Crown } from "lucide-react";

type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  classCode: string;
  totalStars: number;
  totalBadges: number;
  monthlyStars: number;
  monthlyBadges: number;
};

type Winner = {
  id: string;
  firstName: string;
  lastName: string;
  classCode: string;
  score: number;
  rank: number;
  month: string;
};

const MEDAL = ["🥇", "🥈", "🥉"];
const RANK_STYLE = [
  "from-yellow-400/25 to-yellow-200/5 border-yellow-400/50",
  "from-slate-300/20 to-slate-100/5 border-slate-300/40",
  "from-orange-400/20 to-orange-200/5 border-orange-400/40",
];

function formatMonth(m: string) {
  if (!m) return "";
  const [year, month] = m.split("-");
  const months = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

const TABS = [
  { key: "school"  as const, label: "Okul",  icon: "🏫" },
  { key: "class"   as const, label: "Sınıf", icon: "🎓" },
  { key: "monthly" as const, label: "Bu Ay", icon: "📅" },
];

const TAB_DESC: Record<string, string> = {
  school:  "Okuldaki tüm öğrenciler • Toplam ⭐",
  class:   "Sınıfındaki öğrenciler • Toplam ⭐",
  monthly: "Bu ay kazanılan ⭐ sıralaması",
};

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
    refetchInterval: 30000,
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
  const starsKey: keyof LeaderboardEntry = tab === "monthly" ? "monthlyStars" : "totalStars";

  const myEntry = entries.find(e => e.studentId === currentStudentId);

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
          <div>
            <div className="flex items-center gap-2">
              <Trophy size={24} className="text-yellow-400" />
              <h1 className="text-xl font-extrabold text-white">Liderlik Tablosu</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-8">{TAB_DESC[tab]}</p>
          </div>
        </div>

        {/* My rank banner (students only) */}
        {myEntry && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-2xl px-4 py-3 border border-purple-400/50 bg-gradient-to-r from-purple-600/25 to-indigo-600/15 flex items-center gap-3"
          >
            <span className="text-2xl">{myEntry.rank <= 3 ? MEDAL[myEntry.rank - 1] : `#${myEntry.rank}`}</span>
            <div className="flex-1">
              <p className="text-white font-extrabold text-sm">{myEntry.firstName} {myEntry.lastName} <span className="text-purple-300">(Sen)</span></p>
              <p className="text-xs text-gray-400">{myEntry.classCode}</p>
            </div>
            <div className="text-right">
              <p className="text-yellow-300 font-extrabold text-lg">⭐ {(myEntry as any)[starsKey]}</p>
              <p className="text-xs text-gray-400">yıldız</p>
            </div>
          </motion.div>
        )}

        {/* Geçen Ay Şampiyonları */}
        {winners && winners.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl p-4 border border-yellow-400/30"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(251,191,36,0.03) 100%)" }}
          >
            <p className="text-yellow-300 font-extrabold text-xs mb-3 flex items-center gap-1.5 uppercase tracking-widest">
              <Crown size={13} /> {formatMonth(winners[0]?.month)} Şampiyonları
            </p>
            <div className="flex flex-col gap-2">
              {winners.map((w) => (
                <div key={w.id} className="flex items-center gap-3">
                  <span className="text-base">{MEDAL[w.rank - 1] ?? "🏅"}</span>
                  <div className="flex-1">
                    <span className="text-white font-bold text-sm">{w.firstName} {w.lastName}</span>
                    <span className="text-xs text-gray-500 ml-2">· {w.classCode}</span>
                  </div>
                  <span className="text-yellow-300 font-extrabold text-sm">⭐ {w.score}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5 bg-white/5 rounded-2xl p-1">
          {TABS.map(t => (
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

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Trophy size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Henüz yıldız kazanılmadı</p>
            <p className="text-sm mt-1">Oyunlar oynandıkça sıralama burada görünür</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {entries.map((entry, idx) => {
              const isMe = entry.studentId === currentStudentId;
              const stars = (entry as any)[starsKey] as number;
              const isTop3 = entry.rank <= 3;

              return (
                <motion.div
                  key={entry.studentId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.035, 0.4) }}
                  data-testid={`row-student-${entry.studentId}`}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 border ${
                    isMe
                      ? "border-purple-400/70 bg-gradient-to-r from-purple-600/30 to-indigo-600/20"
                      : isTop3
                      ? `bg-gradient-to-r ${RANK_STYLE[entry.rank - 1]}`
                      : "border-white/8 bg-white/5"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center flex-shrink-0">
                    {isTop3
                      ? <span className="text-xl">{MEDAL[entry.rank - 1]}</span>
                      : <span className="text-gray-500 font-bold text-sm">{entry.rank}</span>
                    }
                  </div>

                  {/* Name + class */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate leading-tight ${isMe ? "text-purple-200" : "text-white"}`}>
                      {entry.firstName} {entry.lastName}
                      {isMe && <span className="text-purple-400 text-xs ml-1.5 font-semibold">(Sen)</span>}
                    </p>
                    <p className="text-xs text-gray-500">{entry.classCode}</p>
                  </div>

                  {/* Stars */}
                  <div className={`flex items-center gap-1 font-extrabold text-base flex-shrink-0 ${
                    isTop3 ? "text-yellow-300" : isMe ? "text-purple-200" : "text-gray-300"
                  }`}>
                    ⭐ <span>{stars}</span>
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
