import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { OrchestraSong, OrchestraProgress } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ArrowLeft, Upload, Trash2, Music, Play, Square, RefreshCw, Users, BarChart2,
} from "lucide-react";
import { motion } from "framer-motion";

type OrchestraProgressWithNames = OrchestraProgress & { studentName: string; songName: string };

const ACCURACY_COLORS: Record<string, string> = {
  "original": "#a855f7",
  "kids": "#22c55e",
};

export default function TeacherOrchestra() {
  const { teacher, teacherLoading } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<"songs" | "performance">("songs");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editBpmId, setEditBpmId] = useState<string | null>(null);
  const [editBpmValue, setEditBpmValue] = useState(120);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Upload form state
  const [uploadName, setUploadName] = useState("");
  const [uploadBpm, setUploadBpm] = useState(120);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: songs = [], isLoading: songsLoading } = useQuery<OrchestraSong[]>({
    queryKey: ["/api/teacher/orchestra/songs"],
    queryFn: async () => {
      const r = await fetch("/api/teacher/orchestra/songs");
      return r.json();
    },
    enabled: !!teacher,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: progress = [], isLoading: progressLoading } = useQuery<OrchestraProgressWithNames[]>({
    queryKey: ["/api/teacher/orchestra/progress"],
    queryFn: async () => {
      const r = await fetch("/api/teacher/orchestra/progress");
      return r.json();
    },
    enabled: !!teacher && tab === "performance",
    staleTime: 0,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("audio", uploadFile);
      formData.append("name", uploadName || uploadFile.name.replace(/\.[^.]+$/, ""));
      formData.append("bpm", String(uploadBpm));

      const r = await fetch("/api/teacher/orchestra/songs", { method: "POST", body: formData });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.message || "Upload failed");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher/orchestra/songs"] });
      setUploadName("");
      setUploadBpm(120);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Şarkı yüklendi!", description: "Ritim örüntüsü oluşturuldu." });
    },
    onError: (err: Error) => {
      toast({ title: "Hata", description: err.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/teacher/orchestra/songs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher/orchestra/songs"] });
      toast({ title: "Şarkı silindi" });
    },
    onError: () => toast({ title: "Hata", description: "Silinemedi", variant: "destructive" }),
  });

  // Update BPM mutation
  const updateBpmMutation = useMutation({
    mutationFn: ({ id, bpm }: { id: string; bpm: number }) =>
      apiRequest("PATCH", `/api/teacher/orchestra/songs/${id}`, { bpm }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/teacher/orchestra/songs"] });
      setEditBpmId(null);
      toast({ title: "BPM güncellendi", description: "Ritim örüntüsü yeniden oluşturuldu." });
    },
  });

  const handlePlay = (song: OrchestraSong) => {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = `/api/orchestra/audio/${song.storedFilename}`;
        audioRef.current.play();
      }
      setPlayingId(song.id);
    }
  };

  // Compute performance stats per song
  const songStats = songs.map(song => {
    const songProgress = progress.filter(p => p.songId === song.id);
    const avg = songProgress.length > 0
      ? Math.round(songProgress.reduce((s, p) => s + p.accuracy, 0) / songProgress.length)
      : 0;
    return { name: song.name.length > 12 ? song.name.slice(0, 12) + "…" : song.name, avgAccuracy: avg, plays: songProgress.length };
  }).filter(s => s.plays > 0);

  // Recent activity
  const recent = [...progress].sort((a, b) =>
    new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  ).slice(0, 20);

  if (teacherLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white animate-pulse">Yükleniyor...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} className="hidden" />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-slate-900/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/teacher/dashboard")} className="text-purple-300 hover:text-white transition-colors" data-testid="btn-back-dashboard">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">🎼 Ritim Orkestrası</h1>
          <p className="text-xs text-purple-300">Öğretmen Paneli</p>
        </div>
        <div className="flex gap-1 bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setTab("songs")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "songs" ? "bg-purple-600 text-white" : "text-purple-300 hover:text-white"}`}
            data-testid="tab-songs"
          >
            <Music size={14} className="inline mr-1" />Şarkılar
          </button>
          <button
            onClick={() => setTab("performance")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "performance" ? "bg-purple-600 text-white" : "text-purple-300 hover:text-white"}`}
            data-testid="tab-performance"
          >
            <BarChart2 size={14} className="inline mr-1" />Performans
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-4">

        {/* Songs Tab */}
        {tab === "songs" && (
          <>
            {/* Upload Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5"
            >
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Upload size={20} className="text-purple-400" />
                Yeni Şarkı Yükle
                <Badge className="ml-auto bg-purple-600/30 text-purple-200 border-purple-500/30">
                  {songs.length}/10
                </Badge>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-purple-300 mb-1 block">Şarkı Adı</label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={e => setUploadName(e.target.value)}
                    placeholder="Şarkı adını girin..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                    data-testid="input-song-name"
                  />
                </div>

                <div>
                  <label className="text-sm text-purple-300 mb-1 block">Tempo (BPM)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={40}
                      max={208}
                      value={uploadBpm}
                      onChange={e => setUploadBpm(Number(e.target.value))}
                      className="flex-1 accent-purple-500"
                      data-testid="slider-bpm"
                    />
                    <span className="text-purple-200 font-mono w-16 text-center bg-white/10 rounded-lg py-1">
                      {uploadBpm}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-purple-400 mt-1">
                    <span>Yavaş (40)</span><span>Hızlı (208)</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-purple-300 mb-1 block">Ses Dosyası (MP3 / WAV)</label>
                  <div
                    className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-audio"
                  >
                    {uploadFile ? (
                      <div>
                        <Music size={24} className="text-purple-400 mx-auto mb-2" />
                        <p className="text-white font-medium">{uploadFile.name}</p>
                        <p className="text-purple-300 text-sm">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <Upload size={24} className="text-purple-400 mx-auto mb-2" />
                        <p className="text-purple-200">Dosya seçmek için tıkla</p>
                        <p className="text-purple-400 text-sm mt-1">MP3, WAV – maks. 50MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg,.mp3,.wav,.ogg"
                    className="hidden"
                    onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                    data-testid="input-audio-file"
                  />
                </div>

                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || uploadMutation.isPending || songs.length >= 10}
                  className="w-full bg-purple-600 hover:bg-purple-700 border-0 py-3"
                  data-testid="btn-upload-song"
                >
                  {uploadMutation.isPending ? "Yükleniyor..." : "🎵 Şarkıyı Yükle"}
                </Button>

                {songs.length >= 10 && (
                  <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-lg p-2">
                    Şarkı limiti doldu. Yeni şarkı eklemek için mevcut bir şarkıyı silin.
                  </p>
                )}
              </div>
            </motion.div>

            {/* Song List */}
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Music size={18} className="text-purple-400" />
                Yüklenen Şarkılar
              </h2>
              {songsLoading ? (
                <div className="text-center py-8 text-purple-300 animate-pulse">Yükleniyor...</div>
              ) : songs.length === 0 ? (
                <div className="text-center py-12 text-purple-300">
                  <Music size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Henüz şarkı yüklenmedi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {songs.map(song => (
                    <motion.div
                      key={song.id}
                      layout
                      className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3"
                      data-testid={`song-card-${song.id}`}
                    >
                      <button
                        onClick={() => handlePlay(song)}
                        className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                        style={{ background: playingId === song.id ? "#a855f7" : "#ffffff20" }}
                        data-testid={`btn-play-${song.id}`}
                      >
                        {playingId === song.id ? <Square size={14} /> : <Play size={14} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{song.name}</p>
                        <p className="text-sm text-purple-300">{song.originalFilename}</p>

                        {editBpmId === song.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="range"
                              min={40}
                              max={208}
                              value={editBpmValue}
                              onChange={e => setEditBpmValue(Number(e.target.value))}
                              className="flex-1 accent-purple-500"
                              data-testid={`slider-edit-bpm-${song.id}`}
                            />
                            <span className="text-sm font-mono text-purple-200 w-12 text-center">{editBpmValue}</span>
                            <button
                              onClick={() => updateBpmMutation.mutate({ id: song.id, bpm: editBpmValue })}
                              className="text-xs bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded-lg"
                              data-testid={`btn-save-bpm-${song.id}`}
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={() => setEditBpmId(null)}
                              className="text-xs text-purple-400 hover:text-white"
                            >
                              İptal
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditBpmId(song.id); setEditBpmValue(song.bpm); }}
                            className="text-xs text-purple-400 hover:text-purple-200 flex items-center gap-1 mt-1"
                            data-testid={`btn-edit-bpm-${song.id}`}
                          >
                            <RefreshCw size={10} /> {song.bpm} BPM — Değiştir
                          </button>
                        )}
                      </div>

                      <Badge className="bg-purple-600/30 text-purple-200 border-purple-500/30 shrink-0">
                        {song.bpm} BPM
                      </Badge>

                      <button
                        onClick={() => {
                          if (confirm(`"${song.name}" silinsin mi?`)) deleteMutation.mutate(song.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-1 shrink-0"
                        data-testid={`btn-delete-${song.id}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Performance Tab */}
        {tab === "performance" && (
          <>
            {progressLoading ? (
              <div className="text-center py-12 text-purple-300 animate-pulse">Yükleniyor...</div>
            ) : progress.length === 0 ? (
              <div className="text-center py-16">
                <Users size={56} className="mx-auto mb-4 text-purple-400 opacity-40" />
                <p className="text-purple-300 text-lg font-medium">Henüz veri yok</p>
                <p className="text-purple-400 text-sm mt-1">Öğrenciler oyunu oynadıkça burada görünecek</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Oynanma", value: progress.length, color: "purple" },
                    { label: "Ort. Doğruluk", value: `%${Math.round(progress.reduce((s, p) => s + p.accuracy, 0) / progress.length)}`, color: "green" },
                    { label: "Mükemmel Hit", value: progress.reduce((s, p) => s + p.perfectCount, 0), color: "yellow" },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                      <div className="text-2xl font-black" style={{ color: stat.color === "purple" ? "#a855f7" : stat.color === "green" ? "#22c55e" : "#fbbf24" }}>
                        {stat.value}
                      </div>
                      <div className="text-xs text-purple-300 mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Chart: Accuracy per Song */}
                {songStats.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <h3 className="font-semibold mb-4 text-purple-200">Şarkıya Göre Ortalama Doğruluk</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={songStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" />
                        <XAxis dataKey="name" tick={{ fill: "#a0a0c0", fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#a0a0c0", fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ background: "#1e1535", border: "1px solid #ffffff20", borderRadius: 8, color: "#fff" }}
                          formatter={(v: number) => [`%${v}`, "Ort. Doğruluk"]}
                        />
                        <Bar dataKey="avgAccuracy" radius={[4, 4, 0, 0]}>
                          {songStats.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? "#a855f7" : "#3b82f6"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Recent Activity Table */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <h3 className="font-semibold mb-4 text-purple-200 flex items-center gap-2">
                    <Users size={16} /> Son Oynamalar
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-purple-400 border-b border-white/10">
                          <th className="text-left pb-2">Öğrenci</th>
                          <th className="text-left pb-2">Şarkı</th>
                          <th className="text-center pb-2">Mod</th>
                          <th className="text-center pb-2">Doğruluk</th>
                          <th className="text-center pb-2">⭐</th>
                          <th className="text-center pb-2">Miss</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recent.map(p => {
                          const stars = p.accuracy >= 90 ? 3 : p.accuracy >= 70 ? 2 : p.accuracy >= 50 ? 1 : 0;
                          return (
                            <tr key={p.id} className="border-b border-white/5 hover:bg-white/5" data-testid={`progress-row-${p.id}`}>
                              <td className="py-2 font-medium">{p.studentName}</td>
                              <td className="py-2 text-purple-300 truncate max-w-[100px]">{p.songName}</td>
                              <td className="py-2 text-center">
                                <Badge className={`text-xs ${p.mode === "kids" ? "bg-green-600/30 text-green-300 border-green-500/30" : "bg-purple-600/30 text-purple-300 border-purple-500/30"}`}>
                                  {p.mode === "kids" ? "Çocuk" : "Orijinal"}
                                </Badge>
                              </td>
                              <td className="py-2 text-center font-bold" style={{ color: p.accuracy >= 80 ? "#22c55e" : p.accuracy >= 60 ? "#fbbf24" : "#f87171" }}>
                                %{p.accuracy}
                              </td>
                              <td className="py-2 text-center">
                                {"⭐".repeat(stars) || "—"}
                              </td>
                              <td className="py-2 text-center text-red-400">{p.missCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
