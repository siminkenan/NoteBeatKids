import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Trash2, Play, Video, Image, BarChart2, Eye } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { MaestroResource } from "@shared/schema";

const MAX_DURATION = 197; // 3 dk 17 sn
const MAX_VIDEOS = 3;
const MAX_VIDEO_BYTES = 45 * 1024 * 1024; // 45 MB deployment proxy limit

function fmtSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

type WatchRow = {
  resourceId: string;
  resourceTitle: string;
  studentId: string;
  studentName: string;
  watchedSeconds: number;
  completed: boolean;
  durationSeconds: number;
};

// Helper: fetch with session cookie always included
function authFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, credentials: "include" });
}

export default function TeacherOrchestra() {
  const { teacher } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<"videos" | "photos" | "report">("videos");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsImage, setPreviewIsImage] = useState(false);

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoTitle, setPhotoTitle] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: resources = [], isLoading } = useQuery<MaestroResource[]>({
    queryKey: ["/api/teacher/maestro/resources"],
    queryFn: () => authFetch("/api/teacher/maestro/resources").then(r => r.json()),
    enabled: !!teacher,
    staleTime: 0,
  });

  const { data: watchReport = [] } = useQuery<WatchRow[]>({
    queryKey: ["/api/teacher/maestro/watch-report"],
    queryFn: () => authFetch("/api/teacher/maestro/watch-report").then(r => r.json()),
    enabled: !!teacher && tab === "report",
    staleTime: 0,
  });

  const videos = resources.filter(r => r.type === "video");
  const photos = resources.filter(r => r.type === "photo");

  // ── Video file selection ──────────────────────────────────────────────────
  // Set the file immediately so the button becomes enabled.
  // Duration is fetched asynchronously; server validates it too.
  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size before anything else
    if (file.size > MAX_VIDEO_BYTES) {
      toast({
        title: `Video çok büyük (${(file.size / 1024 / 1024).toFixed(0)}MB). Maksimum 45MB olmalı.`,
        variant: "destructive",
      });
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    // Immediately make the file available
    setVideoFile(file);
    setVideoTitle(file.name.replace(/\.[^.]+$/, ""));
    setVideoDuration(null); // unknown until metadata loads

    // Async: try to read duration via a hidden video element
    try {
      const objectUrl = URL.createObjectURL(file);
      const vid = document.createElement("video");
      vid.preload = "metadata";
      vid.onloadedmetadata = () => {
        URL.revokeObjectURL(objectUrl);
        const dur = Math.round(vid.duration) || 0;
        setVideoDuration(dur);
        if (dur > MAX_DURATION) {
          toast({
            title: `Video çok uzun (${fmtSeconds(dur)}). Maksimum 3:17 (${MAX_DURATION}sn) olmalı.`,
            variant: "destructive",
          });
          setVideoFile(null);
          setVideoTitle("");
          setVideoDuration(null);
          if (videoInputRef.current) videoInputRef.current.value = "";
        }
      };
      vid.onerror = () => URL.revokeObjectURL(objectUrl);
      vid.src = objectUrl;
    } catch {
      // If metadata reading fails, server-side will validate duration
    }
  }

  // ── Video upload ──────────────────────────────────────────────────────────
  async function uploadVideo() {
    if (!videoFile) return;

    // If we have duration info and it's too long, block here
    if (videoDuration !== null && videoDuration > MAX_DURATION) {
      toast({ title: `Video çok uzun. Maksimum 3:17 (${MAX_DURATION}sn).`, variant: "destructive" });
      return;
    }

    if (videos.length >= MAX_VIDEOS) {
      toast({ title: "3 video limitine ulaştınız. Önce bir video silin.", variant: "destructive" });
      return;
    }

    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("title", (videoTitle || videoFile.name.replace(/\.[^.]+$/, "")).trim());
      fd.append("durationSeconds", String(videoDuration ?? 0));

      const r = await authFetch("/api/teacher/maestro/videos", { method: "POST", body: fd });

      if (r.status === 401) {
        toast({ title: "Oturum sona erdi. Lütfen tekrar giriş yapın.", variant: "destructive" });
        navigate("/teacher/login");
        return;
      }

      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "Video yüklenemedi" }));
        throw new Error(err.message || "Video yüklenemedi");
      }

      const newResource: MaestroResource = await r.json();
      qc.setQueryData<MaestroResource[]>(
        ["/api/teacher/maestro/resources"],
        (old = []) => [...old, newResource]
      );
      toast({ title: "Video yüklendi!" });
      setVideoFile(null);
      setVideoTitle("");
      setVideoDuration(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: err.message || "Yükleme hatası", variant: "destructive" });
    } finally {
      setVideoUploading(false);
    }
  }

  // ── Photo file selection ──────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  async function uploadPhoto() {
    if (!photoFile) return;
    setPhotoUploading(true);
    try {
      const fd = new FormData();
      fd.append("photo", photoFile);
      fd.append("title", (photoTitle || photoFile.name.replace(/\.[^.]+$/, "")).trim());

      const r = await authFetch("/api/teacher/maestro/photos", { method: "POST", body: fd });

      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "Yükleme başarısız" }));
        throw new Error(err.message || "Yükleme başarısız");
      }

      const newResource: MaestroResource = await r.json();
      qc.setQueryData<MaestroResource[]>(
        ["/api/teacher/maestro/resources"],
        (old = []) => [...old, newResource]
      );
      setTab("photos");
      toast({ title: "Fotoğraf yüklendi!" });
      setPhotoFile(null);
      setPhotoTitle("");
      if (photoInputRef.current) photoInputRef.current.value = "";
    } catch (err: any) {
      toast({ title: err.message || "Yükleme hatası", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  }

  // ── Delete resource ───────────────────────────────────────────────────────
  async function deleteResource(id: string) {
    try {
      const r = await authFetch(`/api/teacher/maestro/resources/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Silme başarısız");
      qc.setQueryData<MaestroResource[]>(
        ["/api/teacher/maestro/resources"],
        (old = []) => old.filter(res => res.id !== id)
      );
      toast({ title: "Silindi" });
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    }
  }

  // ── Watch report grouping ─────────────────────────────────────────────────
  const reportByVideo: Record<string, { title: string; duration: number; students: WatchRow[] }> = {};
  watchReport.forEach(row => {
    if (!reportByVideo[row.resourceId]) {
      reportByVideo[row.resourceId] = { title: row.resourceTitle, duration: row.durationSeconds, students: [] };
    }
    reportByVideo[row.resourceId].students.push(row);
  });

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <button onClick={() => navigate("/teacher/dashboard")} className="text-white/60 hover:text-white cursor-pointer">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white">🎬 Maestro</h1>
          <p className="text-white/50 text-sm">Ödev yönetimi — video &amp; fotoğraf</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-6 pt-5">
        {([
          { key: "videos",  icon: <Video size={15} />,     label: "Videolar" },
          { key: "photos",  icon: <Image size={15} />,     label: "Fotoğraflar" },
          { key: "report",  icon: <BarChart2 size={15} />, label: "İzleme Raporu" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${
              tab === t.key ? "bg-purple-600 text-white shadow-lg" : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-5 max-w-4xl">

        {/* ── Videos tab ──────────────────────────────────────────────────── */}
        {tab === "videos" && (
          <div className="flex flex-col gap-5">
            {/* Upload card */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
              <p className="text-white font-extrabold mb-3 flex items-center gap-2">
                <Upload size={16} /> Video Yükle
                <span className="ml-auto text-xs text-white/50 font-normal">
                  {videos.length}/{MAX_VIDEOS} video · Max 3:17
                </span>
              </p>

              {/* Hidden file input */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoSelect}
                className="hidden"
                data-testid="input-video-file"
              />

              {/* Drop zone */}
              <div
                onClick={() => videos.length < MAX_VIDEOS && videoInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center mb-3 transition-all ${
                  videos.length >= MAX_VIDEOS
                    ? "border-white/10 opacity-40 cursor-not-allowed"
                    : "border-purple-400/50 hover:border-purple-400 cursor-pointer hover:bg-purple-500/5"
                }`}
                data-testid="dropzone-video"
              >
                {videoFile ? (
                  <div>
                    <p className="text-white font-bold text-sm truncate">{videoFile.name}</p>
                    <p className="text-white/60 text-xs mt-1">
                      {(videoFile.size / 1024 / 1024).toFixed(1)} MB
                      {videoDuration !== null ? ` · ${fmtSeconds(videoDuration)}` : " · süre okunuyor…"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <Video size={28} className="mx-auto mb-2 text-purple-400 opacity-60" />
                    <p className="text-white/50 text-sm">Tıkla veya video sürükle</p>
                    <p className="text-white/30 text-xs mt-1">Max 3 dakika 17 saniye</p>
                  </div>
                )}
              </div>

              {/* Title input */}
              {videoFile && (
                <input
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="Video başlığı (opsiyonel)"
                  className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm font-semibold border border-white/10 focus:outline-none mb-3"
                  data-testid="input-video-title"
                />
              )}

              <Button
                onClick={uploadVideo}
                disabled={!videoFile || videoUploading || videos.length >= MAX_VIDEOS}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-40"
                data-testid="button-upload-video"
              >
                {videoUploading ? "Yükleniyor…" : videos.length >= MAX_VIDEOS ? "Video limiti doldu" : "Videoyu Yükle"}
              </Button>
            </div>

            {/* Video list */}
            {isLoading ? (
              <p className="text-white/40 text-center py-8">Yükleniyor…</p>
            ) : videos.length === 0 ? (
              <p className="text-white/40 text-center py-8">Henüz video yok.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {videos.map(v => (
                  <div key={v.id} className="bg-white/10 rounded-2xl p-4 flex items-center gap-4 border border-white/10">
                    <div className="w-14 h-14 bg-purple-600/30 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Video size={24} className="text-purple-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{v.title || v.originalFilename}</p>
                      <p className="text-white/50 text-xs">
                        {v.durationSeconds > 0 ? fmtSeconds(v.durationSeconds) : "—"} ·{" "}
                        {(v.fileSize / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => { setPreviewUrl(`/api/maestro/file/${v.storedFilename}`); setPreviewIsImage(false); }}
                      className="text-purple-300 hover:text-white cursor-pointer p-2"
                      title="Önizle"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      onClick={() => deleteResource(v.id)}
                      className="text-red-400 hover:text-red-300 cursor-pointer p-2"
                      data-testid={`button-delete-video-${v.id}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Photos tab ──────────────────────────────────────────────────── */}
        {tab === "photos" && (
          <div className="flex flex-col gap-5">
            {/* Upload card */}
            <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
              <p className="text-white font-extrabold mb-3 flex items-center gap-2">
                <Upload size={16} /> Fotoğraf Yükle
              </p>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
                data-testid="input-photo-file"
              />

              <div
                onClick={() => photoInputRef.current?.click()}
                className="border-2 border-dashed border-blue-400/50 hover:border-blue-400 rounded-xl p-6 text-center mb-3 cursor-pointer transition-all hover:bg-blue-500/5"
                data-testid="dropzone-photo"
              >
                {photoFile ? (
                  <div>
                    <p className="text-white font-bold text-sm truncate">{photoFile.name}</p>
                    <p className="text-white/60 text-xs mt-1">{(photoFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div>
                    <Image size={28} className="mx-auto mb-2 text-blue-400 opacity-60" />
                    <p className="text-white/50 text-sm">Tıkla veya fotoğraf sürükle</p>
                  </div>
                )}
              </div>

              {photoFile && (
                <input
                  value={photoTitle}
                  onChange={e => setPhotoTitle(e.target.value)}
                  placeholder="Fotoğraf başlığı (opsiyonel)"
                  className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm font-semibold border border-white/10 focus:outline-none mb-3"
                  data-testid="input-photo-title"
                />
              )}

              <Button
                onClick={uploadPhoto}
                disabled={!photoFile || photoUploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-40"
                data-testid="button-upload-photo"
              >
                {photoUploading ? "Yükleniyor…" : "Fotoğrafı Yükle"}
              </Button>
            </div>

            {/* Photo grid */}
            {isLoading ? (
              <p className="text-white/40 text-center py-8">Yükleniyor…</p>
            ) : photos.length === 0 ? (
              <p className="text-white/40 text-center py-8">Henüz fotoğraf yok.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {photos.map(p => (
                  <div key={p.id} className="relative group rounded-2xl overflow-hidden bg-white/10 border border-white/10 aspect-square">
                    <img
                      src={`/api/maestro/file/${p.storedFilename}`}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 p-2">
                      <p className="text-white font-bold text-sm text-center line-clamp-2">{p.title}</p>
                      <button
                        onClick={() => { setPreviewUrl(`/api/maestro/file/${p.storedFilename}`); setPreviewIsImage(true); }}
                        className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer w-full"
                      >
                        Büyüt
                      </button>
                      <button
                        onClick={() => deleteResource(p.id)}
                        className="bg-red-500/80 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer w-full"
                        data-testid={`button-delete-photo-${p.id}`}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Watch Report tab ─────────────────────────────────────────────── */}
        {tab === "report" && (
          <div className="flex flex-col gap-5">
            {Object.keys(reportByVideo).length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <Eye size={40} className="mx-auto mb-3 opacity-50" />
                <p>Henüz izleme verisi yok.</p>
                <p className="text-xs mt-2">Öğrenciler videoları izledikçe burada görünür.</p>
              </div>
            ) : (
              Object.entries(reportByVideo).map(([rid, data]) => (
                <div key={rid} className="bg-white/10 rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <Video size={18} className="text-purple-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-extrabold truncate">{data.title}</p>
                      <p className="text-white/50 text-xs">Toplam süre: {fmtSeconds(data.duration)}</p>
                    </div>
                    <span className="text-xs text-purple-300 font-bold bg-purple-600/20 px-2 py-1 rounded-full flex-shrink-0">
                      {data.students.length} öğrenci
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.students.map(s => {
                      const pct = data.duration > 0 ? Math.min((s.watchedSeconds / data.duration) * 100, 100) : 0;
                      return (
                        <div key={s.studentId} className="flex items-center gap-3">
                          <p className="text-white/80 text-sm font-semibold w-32 flex-shrink-0 truncate">{s.studentName}</p>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${s.completed ? "bg-green-400" : "bg-purple-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-white/60 text-xs font-semibold w-20 text-right flex-shrink-0">
                            {fmtSeconds(s.watchedSeconds)}{s.completed ? " ✅" : ""}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Preview modal (video or photo) ──────────────────────────────────── */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreviewUrl(null)}
          >
            <motion.div
              className="max-w-3xl w-full"
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              onClick={e => e.stopPropagation()}
            >
              {previewIsImage ? (
                <img src={previewUrl} className="w-full rounded-2xl max-h-[75vh] object-contain" />
              ) : (
                <video src={previewUrl} controls autoPlay className="w-full rounded-2xl max-h-[70vh] bg-black" />
              )}
              <button
                onClick={() => setPreviewUrl(null)}
                className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white py-2.5 rounded-xl font-bold cursor-pointer transition-all"
              >
                Kapat
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
