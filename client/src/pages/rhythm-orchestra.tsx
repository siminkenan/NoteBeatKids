import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Play, X, Image } from "lucide-react";
import type { MaestroResource, MaestroViewProgress } from "@shared/schema";

function fmtSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function RhythmOrchestra() {
  const [, navigate] = useLocation();
  const { student } = useAuth();
  const [activeVideo, setActiveVideo] = useState<MaestroResource | null>(null);
  const [activePhoto, setActivePhoto] = useState<MaestroResource | null>(null);
  const [tab, setTab] = useState<"videos" | "photos">("videos");
  const videoRef = useRef<HTMLVideoElement>(null);
  const watchedSecsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!student) navigate("/student/login");
  }, [student, navigate]);

  const studentId = student?.student.id;

  const { data: resources = [] } = useQuery<MaestroResource[]>({
    queryKey: ["/api/student", studentId, "maestro/resources"],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/api/student/${studentId}/maestro/resources`, { credentials: "include" }).then(r => r.json()),
    enabled: !!studentId,
    staleTime: 0,
  });

  const { data: myProgress = [], refetch: refetchProgress } = useQuery<MaestroViewProgress[]>({
    queryKey: ["/api/student", studentId, "maestro/progress"],
    queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/api/student/${studentId}/maestro/progress`, { credentials: "include" }).then(r => r.json()),
    enabled: !!studentId,
    staleTime: 0,
  });

  const videos = resources.filter(r => r.type === "video");
  const photos = resources.filter(r => r.type === "photo");

  const getProgress = (resourceId: string) =>
    myProgress.find(p => p.resourceId === resourceId);

  const saveProgress = useCallback(
    async (resourceId: string, watchedSeconds: number, completed: boolean) => {
      if (!studentId) return;
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/student/${studentId}/maestro/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ resourceId, watchedSeconds, completed }),
        });
        refetchProgress();
      } catch {}
    },
    [studentId, refetchProgress]
  );

  function handleTimeUpdate() {
    const v = videoRef.current;
    const vid = activeVideo;
    if (!v || !vid) return;
    const secs = Math.floor(v.currentTime);
    watchedSecsRef.current[vid.id] = Math.max(watchedSecsRef.current[vid.id] ?? 0, secs);
  }

  function handlePause() {
    const v = videoRef.current;
    const vid = activeVideo;
    if (!v || !vid) return;
    const watched = watchedSecsRef.current[vid.id] ?? 0;
    const completed = v.duration > 0 && v.currentTime / v.duration >= 0.9;
    saveProgress(vid.id, watched, completed);
  }

  function handleEnded() {
    const vid = activeVideo;
    if (!vid) return;
    const watched = watchedSecsRef.current[vid.id] ?? 0;
    saveProgress(vid.id, Math.max(watched, vid.durationSeconds), true);
  }

  function closeVideo() {
    const v = videoRef.current;
    const vid = activeVideo;
    if (v && vid) {
      v.pause();
      const watched = watchedSecsRef.current[vid.id] ?? 0;
      const completed = v.duration > 0 && v.currentTime / v.duration >= 0.9;
      saveProgress(vid.id, watched, completed);
    }
    setActiveVideo(null);
  }

  async function downloadPhoto(photo: MaestroResource) {
    try {
      const resp = await fetch(`${import.meta.env.VITE_API_URL}/api/maestro/file/${photo.storedFilename}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = photo.originalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }

  if (!student) return null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <button
          onClick={() => navigate("/student/home")}
          className="text-white/60 hover:text-white cursor-pointer"
          data-testid="button-back"
        >
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white">🎬 Maestro</h1>
          <p className="text-white/50 text-sm">
            {student.student.firstName} — öğretmen içerikleri
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-5 pt-5">
        <button
          onClick={() => setTab("videos")}
          data-testid="tab-videos"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${
            tab === "videos"
              ? "bg-purple-600 text-white shadow-lg"
              : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
        >
          🎬 Videolar
          <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
            {videos.length}
          </span>
        </button>
        <button
          onClick={() => setTab("photos")}
          data-testid="tab-photos"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${
            tab === "photos"
              ? "bg-blue-600 text-white shadow-lg"
              : "bg-white/10 text-white/60 hover:bg-white/20"
          }`}
        >
          📸 Fotoğraflar
          <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
            {photos.length}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-5 max-w-2xl">

        {/* ── Videos ─────────────────────────────────────────────────────── */}
        {tab === "videos" && (
          videos.length === 0 ? (
            <div className="text-center py-16 text-white/40">
              <p className="text-6xl mb-4">🎬</p>
              <p className="font-semibold">Öğretmeniniz henüz video eklememiş.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {videos.map(v => {
                const prog = getProgress(v.id);
                const pct =
                  v.durationSeconds > 0 && prog
                    ? Math.min((prog.watchedSeconds / v.durationSeconds) * 100, 100)
                    : 0;
                return (
                  <motion.div
                    key={v.id}
                    data-testid={`card-video-${v.id}`}
                    className="bg-white/10 rounded-2xl p-4 flex items-center gap-4 border border-white/10 cursor-pointer hover:bg-white/15 transition-all"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveVideo(v)}
                  >
                    {/* Thumbnail / play icon */}
                    <div className="w-16 h-16 bg-purple-700/40 rounded-xl flex items-center justify-center flex-shrink-0 relative">
                      <Play size={28} className="text-purple-300 ml-1" />
                      {prog?.completed && (
                        <span className="absolute -top-1 -right-1 text-lg">✅</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-extrabold truncate text-base">
                        {v.title || v.originalFilename}
                      </p>
                      <p className="text-white/50 text-xs mb-2">
                        Süre: {fmtSeconds(v.durationSeconds)}
                      </p>

                      {/* Progress bar */}
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            prog?.completed ? "bg-green-400" : "bg-purple-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-white/40 text-xs mt-1">
                        {prog
                          ? `${fmtSeconds(prog.watchedSeconds)} izlendi${prog.completed ? " · Tamamlandı ✅" : ""}`
                          : "Henüz izlenmedi"}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="text-white/30 text-xl flex-shrink-0">▶</div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}

        {/* ── Photos ─────────────────────────────────────────────────────── */}
        {tab === "photos" && (
          photos.length === 0 ? (
            <div className="text-center py-16 text-white/40">
              <Image size={56} className="mx-auto mb-4 opacity-30" />
              <p className="font-semibold">Öğretmeniniz henüz fotoğraf eklememiş.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {photos.map(p => (
                <div
                  key={p.id}
                  className="relative rounded-2xl overflow-hidden bg-white/10 aspect-square border border-white/10 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => setActivePhoto(p)}
                  data-testid={`card-photo-${p.id}`}
                >
                  <img
                    src={`/api/maestro/file/${p.storedFilename}`}
                    alt={p.title}
                    className="w-full h-full object-cover"
                    data-testid={`img-photo-${p.id}`}
                  />
                  {/* Bottom gradient with title + download */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-end justify-between">
                    <p className="text-white text-xs font-bold line-clamp-2 flex-1 mr-1">{p.title}</p>
                    <button
                      onClick={e => { e.stopPropagation(); downloadPhoto(p); }}
                      className="bg-blue-500/90 hover:bg-blue-500 text-white p-1.5 rounded-lg cursor-pointer flex-shrink-0"
                      data-testid={`button-download-photo-${p.id}`}
                      title="İndir"
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ── Video Player Modal ────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full max-w-2xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-extrabold text-lg truncate pr-4">
                  {activeVideo.title}
                </p>
                <button
                  onClick={closeVideo}
                  className="text-white/60 hover:text-white cursor-pointer p-1 flex-shrink-0"
                  data-testid="button-close-video"
                >
                  <X size={26} />
                </button>
              </div>

              <video
                ref={videoRef}
                src={`/api/maestro/file/${activeVideo.storedFilename}`}
                controls
                autoPlay
                className="w-full rounded-2xl bg-black max-h-[65vh]"
                onTimeUpdate={handleTimeUpdate}
                onPause={handlePause}
                onEnded={handleEnded}
                data-testid="video-player"
              />

              <button
                onClick={closeVideo}
                className="mt-3 w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold cursor-pointer transition-all"
              >
                Kapat
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Photo Fullscreen Modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePhoto(null)}
          >
            <div
              className="relative max-w-2xl w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-extrabold truncate pr-4">
                  {activePhoto.title}
                </p>
                <button
                  onClick={() => setActivePhoto(null)}
                  className="text-white/60 hover:text-white cursor-pointer flex-shrink-0"
                >
                  <X size={26} />
                </button>
              </div>

              <img
                src={`/api/maestro/file/${activePhoto.storedFilename}`}
                alt={activePhoto.title}
                className="w-full rounded-2xl max-h-[70vh] object-contain"
              />

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => downloadPhoto(activePhoto)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2 transition-all"
                  data-testid="button-download-active-photo"
                >
                  <Download size={16} /> İndir
                </button>
                <button
                  onClick={() => setActivePhoto(null)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-bold cursor-pointer transition-all"
                >
                  Kapat
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
