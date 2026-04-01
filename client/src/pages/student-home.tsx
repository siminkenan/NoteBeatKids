import { useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import ProtectedLogo from "@/components/protected-logo";
import metronomeImgPath from "@assets/metronome-logo.png";
import melodyLogoPath from "@assets/ChatGPT_Image_13_Mar_2026_23_21_37_1773433578533.png";
import type { StudentProgress } from "@shared/schema";

export default function StudentHome() {
  const [, navigate] = useLocation();
  const { student, logoutStudent, studentLoading } = useAuth();

  useEffect(() => {
    if (!studentLoading && !student) {
      navigate("/student/login");
    }
  }, [student, studentLoading, navigate]);

  const { data: progress } = useQuery<StudentProgress[]>({
    queryKey: ["/api/student", student?.student.id, "progress"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/student/${student!.student.id}/progress`, { credentials: "include" });
      return res.json();
    },
    enabled: !!student,
    staleTime: 0,
    refetchOnMount: true,
    refetchInterval: 40000,
  });

  const rhythmProgress = progress?.find(p => p.appType === "rhythm");
  const notesProgress = progress?.find(p => p.appType === "notes");

  if (studentLoading || !student) return null;

  const totalStars = progress?.reduce((sum, p) => sum + (p.starsEarned ?? 0), 0) ?? 0;
  const notesBadge = notesProgress?.notesBadge as "bronze" | "silver" | "gold" | null | undefined;

  const BADGE_INFO = {
    bronze: { emoji: "🥉", label: "Bronz Rozet", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
    silver: { emoji: "🥈", label: "Gümüş Rozet", color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
    gold:   { emoji: "🥇", label: "Altın Rozet",  color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  };

  return (
    <div className="min-h-screen relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #a8edea 0%, #fed6e3 50%, #ffecd2 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none select-none">
        {["⭐", "🎵", "🎶", "🌟", "✨"].map((emoji, i) => (
          <motion.span
            key={i}
            className="absolute text-2xl"
            style={{ left: `${8 + i * 18}%`, top: `${5 + (i % 3) * 20}%` }}
            animate={{ y: [0, -15, 0], rotate: [-10, 10, -10] }}
            transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          >
            {emoji}
          </motion.span>
        ))}
      </div>

      <div className="relative z-10 max-w-lg md:max-w-5xl mx-auto px-4 py-6 flex flex-col min-h-screen">
        {/* Üst bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ProtectedLogo className="w-12 h-12 object-contain" />
            <div>
              <h1 className="font-extrabold text-lg text-gray-800 leading-tight">
                Merhaba, {student.student.firstName}!
              </h1>
              <p className="text-sm text-gray-600 font-semibold">{student.class.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-yellow-100 rounded-full px-3 py-1.5 shadow-sm">
              <span className="text-yellow-500 text-lg">⭐</span>
              <span className="font-extrabold text-yellow-700 text-sm" data-testid="text-total-stars">{totalStars}</span>
            </div>
            <button
              onClick={() => { logoutStudent(); navigate("/"); }}
              className="text-xs text-gray-500 font-bold cursor-pointer"
              data-testid="button-logout"
            >
              Çıkış
            </button>
          </div>
        </div>

        {/* İstatistik bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Ritim Seviyesi", value: rhythmProgress?.level ?? 1, color: "#f97316", icon: "🥁" },
            { label: "Nota Seviyesi", value: notesProgress?.level ?? 1, color: "#8b5cf6", icon: "🎵" },
            { label: "Toplam Yıldız", value: totalStars, color: "#f59e0b", icon: "⭐" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="bg-white/80 backdrop-blur rounded-2xl p-3 text-center shadow-md"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <span className="text-xl block mb-1">{stat.icon}</span>
              <div className="text-xl font-extrabold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="text-xs text-gray-500 font-bold">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Rozetler */}
        {notesBadge && BADGE_INFO[notesBadge] && (
          <motion.div
            className="bg-white/80 backdrop-blur rounded-2xl p-3 shadow-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2 text-center">Nota Dedektifi Rozetleri</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {(["bronze", "silver", "gold"] as const).map((tier) => {
                const info = BADGE_INFO[tier];
                const earned = tier === "bronze"
                  ? ["bronze","silver","gold"].includes(notesBadge ?? "")
                  : tier === "silver"
                  ? ["silver","gold"].includes(notesBadge ?? "")
                  : notesBadge === "gold";
                return (
                  <div
                    key={tier}
                    data-testid={`badge-${tier}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all ${
                      earned
                        ? `${info.bg} ${info.border} ${info.color}`
                        : "bg-gray-100 border-gray-200 text-gray-300 opacity-50"
                    }`}
                  >
                    <span className={earned ? "" : "grayscale"}>{info.emoji}</span>
                    <span>{info.label}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Oyun butonları — sıra: Metronom, Nota Dedektifi, Ritmi Yakala, Melodi Taklit, Davul Seti, İlerleme Haritam, Maestro */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 items-start">

          {/* 1. Metronom */}
          <motion.button
            data-testid="button-metronome"
            className="w-full p-5 rounded-3xl shadow-lg cursor-pointer text-left flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #c084fc 0%, #818cf8 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/metronome")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-16 h-16 flex items-center justify-center flex-shrink-0">
              <img src={metronomeImgPath} alt="Metronom" className="w-full h-full object-contain drop-shadow-lg" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Metronom</h2>
              <p className="text-white/85 font-semibold text-sm">Ritim için tempo ayarla!</p>
            </div>
          </motion.button>

          {/* 2. Nota Dedektifi */}
          <motion.button
            data-testid="button-notes-game"
            className="w-full p-6 rounded-3xl shadow-xl cursor-pointer text-left flex items-center gap-5"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #6366f1 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(139, 92, 246, 0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/notes")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-20 h-20 bg-white/25 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-5xl">🔍</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Nota Dedektifi</h2>
              <p className="text-white/85 font-bold text-sm mt-1">Portedeki müzik notalarını tanı!</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-white/25 rounded-full px-3 py-1 text-xs text-white font-extrabold">
                  Seviye {notesProgress?.level ?? 1}
                </div>
                <div className="text-white/80 text-xs font-bold">
                  {notesProgress?.starsEarned ?? 0} yıldız kazanıldı
                </div>
              </div>
            </div>
          </motion.button>

          {/* 3. Ritmi Yakala */}
          <motion.button
            data-testid="button-rhythm-game"
            className="w-full p-6 rounded-3xl shadow-xl cursor-pointer text-left flex items-center gap-5"
            style={{
              background: "linear-gradient(135deg, #ff9a56 0%, #ff6348 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(255, 100, 50, 0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/rhythm")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="w-20 h-20 bg-white/25 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-5xl">🥁</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Ritmi Yakala</h2>
              <p className="text-white/85 font-bold text-sm mt-1">Ritme eşlik et! Ritim kalıbını eşleştir.</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-white/25 rounded-full px-3 py-1 text-xs text-white font-extrabold">
                  Seviye {rhythmProgress?.level ?? 1}
                </div>
                <div className="text-white/80 text-xs font-bold">
                  {rhythmProgress?.starsEarned ?? 0} yıldız kazanıldı
                </div>
              </div>
            </div>
          </motion.button>

          {/* 4. Melodi Taklit Oyunu */}
          <motion.button
            data-testid="button-melody-echo"
            className="w-full p-6 rounded-3xl shadow-xl cursor-pointer text-left flex items-center gap-5"
            style={{
              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(240,147,251,0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/melody")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src={melodyLogoPath} alt="Melodi Taklit Oyunu"
                className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Melodi Taklit Oyunu</h2>
              <p className="text-white/85 font-bold text-sm mt-1">Melodiyi dinle ve piyano tuşlarıyla tekrarla!</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-white/25 rounded-full px-3 py-1 text-xs text-white font-extrabold">
                  4 Bölüm · 100 Melodi
                </div>
                <div className="text-white/80 text-xs font-bold">🎹 Kulak Eğitimi</div>
              </div>
            </div>
          </motion.button>

          {/* 5. Davul Seti */}
          <motion.button
            data-testid="button-drum-kit"
            className="w-full p-5 rounded-3xl shadow-lg cursor-pointer text-left flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #1e3a5f 0%, #0f2027 100%)",
              border: "3px solid rgba(255,255,255,0.25)",
            }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(30,58,95,0.5)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/drum")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
          >
            <div className="w-14 h-14 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🥁</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Davul Seti</h2>
              <p className="text-white/85 font-semibold text-sm">Gerçekçi davul seti — dokun, çal!</p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="bg-white/20 rounded-full px-2.5 py-0.5 text-xs text-white font-extrabold">
                  Web Audio API
                </div>
                <div className="text-white/60 text-xs font-bold">Çok dokunuşlu</div>
              </div>
            </div>
          </motion.button>

          {/* 6. İlerleme Haritası */}
          <motion.button
            data-testid="button-level-map"
            className="w-full p-5 rounded-3xl shadow-lg cursor-pointer text-left flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/map")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-14 h-14 bg-white/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🗺️</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">İlerleme Haritam</h2>
              <p className="text-white/85 font-semibold text-sm">Öğrenme yolculuğunu gör!</p>
            </div>
          </motion.button>

          {/* 7. Maestro */}
          <motion.button
            data-testid="button-maestro-game"
            className="w-full p-6 rounded-3xl shadow-xl cursor-pointer text-left flex items-center gap-5"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03, boxShadow: "0 20px 40px rgba(124, 58, 237, 0.4)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/student/orchestra")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 }}
          >
            <div className="w-20 h-20 bg-white/25 rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-5xl">🎬</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Maestro</h2>
              <p className="text-white/85 font-bold text-sm mt-1">Öğretmen videoları & fotoğrafları izle!</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-white/25 rounded-full px-3 py-1 text-xs text-white font-extrabold">
                  Video &amp; Fotoğraf
                </div>
                <div className="text-white/80 text-xs font-bold">Öğretmen 🎬</div>
              </div>
            </div>
          </motion.button>

          {/* 8. Liderlik Tablosu */}
          <motion.button
            data-testid="button-leaderboard"
            className="w-full p-5 rounded-3xl shadow-lg cursor-pointer text-left flex items-center gap-4"
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
              border: "3px solid rgba(255,255,255,0.5)",
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/leaderboard")}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🏆</span>
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white">Liderlik Tablosu</h2>
              <p className="text-white/85 font-semibold text-sm">Okul sıralamasında yerinizi görün!</p>
            </div>
          </motion.button>

        </div>
      </div>
    </div>
  );
}
