import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Clock, CheckCircle, XCircle, Share2, Key, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Student, StudentProgress, StudentCode } from "@shared/schema";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

type StudentWithProgress = Student & {
  rhythmProgress?: StudentProgress;
  notesProgress?: StudentProgress;
};

type ClassDetailData = {
  class: { id: string; name: string; classCode: string; maxStudents: number };
  students: StudentWithProgress[];
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}d ${s}s`;
}

function accuracy(correct: number, wrong: number) {
  const total = correct + wrong;
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

function buildShareText(
  student: StudentWithProgress,
  className: string,
  rAcc: number,
  nAcc: number,
) {
  const totalStars = (student.rhythmProgress?.starsEarned ?? 0) + (student.notesProgress?.starsEarned ?? 0);
  const totalTime = formatTime(
    (student.rhythmProgress?.timeSpentSeconds ?? 0) + (student.notesProgress?.timeSpentSeconds ?? 0),
  );
  const starsRow = "⭐".repeat(Math.min(totalStars, 10));

  return [
    `🎵 NoteBeat Kids — Öğrenci Raporu`,
    `👤 ${student.firstName} ${student.lastName} (${className})`,
    ``,
    `🥁 Ritim  →  Seviye ${student.rhythmProgress?.level ?? 1}  |  ${rAcc}% doğruluk  |  ✅${student.rhythmProgress?.correctAnswers ?? 0} ❌${student.rhythmProgress?.wrongAnswers ?? 0}`,
    `🎵 Notalar →  Seviye ${student.notesProgress?.level ?? 1}  |  ${nAcc}% doğruluk  |  ✅${student.notesProgress?.correctAnswers ?? 0} ❌${student.notesProgress?.wrongAnswers ?? 0}`,
    ``,
    `${starsRow || "—"}  (${totalStars} yıldız)`,
    `⏱ Toplam süre: ${totalTime}`,
  ].join("\n");
}

export default function ClassDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/teacher/class/:classId");
  const { teacher, setTeacher } = useAuth();
  const { toast } = useToast();
  const classId = params?.classId;
  const [showCodes, setShowCodes] = useState(false);

  useEffect(() => {
    if (!teacher) {
      fetch("/api/auth/teacher/me")
        .then(r => r.ok ? r.json() : null)
        .then(t => { if (t) setTeacher(t); else navigate("/teacher/login"); });
    }
  }, []);

  const { data, isLoading } = useQuery<ClassDetailData>({
    queryKey: ["/api/teacher/classes", classId, "students"],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/classes/${classId}/students`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!classId && !!teacher,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: codesData } = useQuery<{ class: ClassDetailData["class"]; codes: StudentCode[] }>({
    queryKey: ["/api/teacher/classes", classId, "student-codes"],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/classes/${classId}/student-codes`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!classId && !!teacher,
    staleTime: 0,
    refetchOnMount: true,
  });

  const generateCodesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/teacher/classes/${classId}/student-codes/generate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes", classId, "student-codes"] });
      toast({ title: "Kodlar oluşturuldu!", description: "Öğrenci davet kodları hazır." });
    },
    onError: (e: any) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const chartData = data?.students.map(s => ({
    name: s.firstName,
    rhythmAccuracy: accuracy(s.rhythmProgress?.correctAnswers ?? 0, s.rhythmProgress?.wrongAnswers ?? 0),
    notesAccuracy: accuracy(s.notesProgress?.correctAnswers ?? 0, s.notesProgress?.wrongAnswers ?? 0),
  })) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/teacher/dashboard")} className="rounded-xl gap-1.5" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            Geri
          </Button>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="NoteBeat Kids" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="font-extrabold text-base text-foreground">{data?.class?.name ?? "Yükleniyor..."}</h1>
              <p className="text-xs text-muted-foreground font-semibold">Kod: <span className="font-mono font-extrabold text-primary">{data?.class?.classCode}</span></p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Öğrenciler", value: data?.students.length ?? 0, color: "text-blue-500", bg: "bg-blue-50", icon: "👥" },
                { label: "Ort. Ritim %", value: `${Math.round(chartData.reduce((a, c) => a + c.rhythmAccuracy, 0) / (chartData.length || 1))}%`, color: "text-orange-500", bg: "bg-orange-50", icon: "🥁" },
                { label: "Ort. Nota %", value: `${Math.round(chartData.reduce((a, c) => a + c.notesAccuracy, 0) / (chartData.length || 1))}%`, color: "text-purple-500", bg: "bg-purple-50", icon: "🎵" },
                { label: "Toplam Yıldız", value: data?.students.reduce((a, s) => a + (s.rhythmProgress?.starsEarned ?? 0) + (s.notesProgress?.starsEarned ?? 0), 0) ?? 0, color: "text-yellow-500", bg: "bg-yellow-50", icon: "⭐" },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <div className={`${stat.bg} rounded-xl py-2 px-3 mb-2 inline-block`}>
                        <span className="text-2xl">{stat.icon}</span>
                      </div>
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground font-semibold">{stat.label}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* ─── Öğrenci Davet Kodları: Mevcut sınıf için kod yok ─── */}
            {codesData && codesData.codes.length === 0 && (
              <Card className="rounded-2xl mb-6 border-2 border-dashed border-indigo-200">
                <CardContent className="py-6 text-center">
                  <Key className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
                  <p className="font-bold text-foreground mb-1">Öğrenci Davet Kodları Yok</p>
                  <p className="text-xs text-muted-foreground mb-4">Bu sınıf için henüz bireysel davet kodları oluşturulmamış.</p>
                  <Button
                    className="rounded-xl gap-2 font-bold"
                    style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}
                    onClick={() => generateCodesMutation.mutate()}
                    disabled={generateCodesMutation.isPending}
                    data-testid="button-generate-codes"
                  >
                    <Key className="w-4 h-4" />
                    {generateCodesMutation.isPending ? "Oluşturuluyor..." : `${data?.class.maxStudents ?? 30} Öğrenci Kodu Oluştur`}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ─── Öğrenci Davet Kodları ─── */}
            {codesData && codesData.codes.length > 0 && (
              <Card className="rounded-2xl mb-6 border-2 border-indigo-100">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-5 h-5 text-indigo-500" />
                      <CardTitle className="font-extrabold text-base">Öğrenci Davet Kodları</CardTitle>
                      <Badge variant="secondary" className="font-bold text-xs">
                        {codesData.codes.length} kod
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1.5 text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                        data-testid="button-copy-all-codes"
                        onClick={async () => {
                          const text = codesData.codes
                            .map(c => `Öğrenci ${c.slotNumber}: ${c.code}`)
                            .join("\n");
                          const header = `🎵 NoteBeat Kids — ${codesData.class.name}\nSınıf Kodu: ${codesData.class.classCode}\n\n${text}`;
                          await navigator.clipboard.writeText(header);
                          toast({ title: "Tüm kodlar kopyalandı!", description: `${codesData.codes.length} öğrenci kodu panoya kopyalandı.` });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Tümünü Kopyala
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl gap-1 text-xs font-bold"
                        onClick={() => setShowCodes(v => !v)}
                        data-testid="button-toggle-codes"
                      >
                        {showCodes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {showCodes ? "Gizle" : "Göster"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Her öğrenciye kendi kodunu paylaşın — 8 haneli bireysel kod ile giriş yapabilirler.
                  </p>
                </CardHeader>
                {showCodes && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
                      {codesData.codes.map((c) => {
                        const shareText = [
                          `🎵 NoteBeat Kids'e Hoş Geldiniz!`,
                          `📚 Sınıf: ${codesData.class.name}`,
                          `🔑 Kişisel Öğrenci Kodunuz: ${c.code}`,
                          ``,
                          `Giriş ekranında adınızı ve bu kodu girin.`,
                        ].join("\n");

                        const handleShareCode = async () => {
                          if (navigator.share) {
                            try {
                              await navigator.share({ title: "NoteBeat Kids — Öğrenci Kodu", text: shareText });
                            } catch {}
                          } else {
                            await navigator.clipboard.writeText(shareText);
                            toast({ title: `Kod ${c.slotNumber} kopyalandı!`, description: c.code });
                          }
                        };

                        return (
                          <motion.div
                            key={c.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: (c.slotNumber - 1) * 0.015 }}
                            className="bg-indigo-50 border border-indigo-100 rounded-xl p-2.5 flex flex-col items-center gap-1.5 group"
                            data-testid={`card-student-code-${c.slotNumber}`}
                          >
                            <span className="text-[10px] font-bold text-indigo-400">#{c.slotNumber}</span>
                            <span className="font-mono font-extrabold text-indigo-700 text-sm tracking-widest">
                              {c.code}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 rounded-lg text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 w-full gap-1 text-xs font-bold"
                              onClick={handleShareCode}
                              data-testid={`button-share-code-${c.slotNumber}`}
                            >
                              <Share2 className="w-3 h-3" />
                              Paylaş
                            </Button>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {chartData.length > 0 && (
              <Card className="rounded-2xl mb-6">
                <CardHeader><CardTitle className="font-extrabold">Öğrenci Doğruluk Özeti</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: "bold" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="rhythmAccuracy" fill="#f97316" name="Ritim" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="notesAccuracy" fill="#8b5cf6" name="Notalar" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <h3 className="text-xl font-extrabold mb-4">Öğrenci İlerlemesi</h3>
            {data?.students.length === 0 ? (
              <Card className="rounded-2xl"><CardContent className="py-12 text-center text-muted-foreground font-semibold">Bu sınıfta henüz öğrenci yok. Sınıf kodunu paylaşın!</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {data?.students.map((student, i) => {
                  const rAcc = accuracy(student.rhythmProgress?.correctAnswers ?? 0, student.rhythmProgress?.wrongAnswers ?? 0);
                  const nAcc = accuracy(student.notesProgress?.correctAnswers ?? 0, student.notesProgress?.wrongAnswers ?? 0);
                  const shareText = buildShareText(student, data.class.name, rAcc, nAcc);

                  const handleShare = async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({ title: `NoteBeat Kids — ${student.firstName} ${student.lastName}`, text: shareText });
                      } catch {}
                    } else {
                      await navigator.clipboard.writeText(shareText);
                      toast({ title: "Rapor kopyalandı!", description: `${student.firstName} ${student.lastName} performans özeti panoya kopyalandı.` });
                    }
                  };

                  return (
                    <motion.div key={student.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                      <Card className="rounded-2xl" data-testid={`card-student-${student.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xl font-extrabold text-primary">
                                {student.firstName[0]}{student.lastName[0]}
                              </div>
                              <div>
                                <p className="font-extrabold text-foreground">{student.firstName} {student.lastName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                  <span className="text-xs font-bold text-muted-foreground">{(student.rhythmProgress?.starsEarned ?? 0) + (student.notesProgress?.starsEarned ?? 0)} yıldız toplam</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-orange-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-orange-500 mb-1">Ritim</p>
                                <p className="font-extrabold text-orange-600">Seviye {student.rhythmProgress?.level ?? 1}</p>
                                <p className="text-xs text-muted-foreground font-semibold">{rAcc}% doğruluk</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-xs font-bold text-green-600">{student.rhythmProgress?.correctAnswers ?? 0}</span>
                                  <XCircle className="w-3 h-3 text-red-500" />
                                  <span className="text-xs font-bold text-red-500">{student.rhythmProgress?.wrongAnswers ?? 0}</span>
                                </div>
                              </div>
                              <div className="bg-purple-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-purple-500 mb-1">Notalar</p>
                                <p className="font-extrabold text-purple-600">Seviye {student.notesProgress?.level ?? 1}</p>
                                <p className="text-xs text-muted-foreground font-semibold">{nAcc}% doğruluk</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-xs font-bold text-green-600">{student.notesProgress?.correctAnswers ?? 0}</span>
                                  <XCircle className="w-3 h-3 text-red-500" />
                                  <span className="text-xs font-bold text-red-500">{student.notesProgress?.wrongAnswers ?? 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-center">
                              <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs font-bold text-muted-foreground">
                                {formatTime((student.rhythmProgress?.timeSpentSeconds ?? 0) + (student.notesProgress?.timeSpentSeconds ?? 0))}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl gap-1.5 text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 flex-shrink-0"
                              onClick={handleShare}
                              data-testid={`button-share-student-${student.id}`}
                              title="Performans raporunu paylaş"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              Paylaş
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
