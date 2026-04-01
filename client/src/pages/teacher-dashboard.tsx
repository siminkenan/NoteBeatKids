import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, teacherAuthHeader } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Users, Calendar, Trash2, LogOut, Copy, Music, BookOpen, QrCode, Circle, X, Key, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import ProtectedLogo from "@/components/protected-logo";
import metronomeImgPath from "@assets/metronome-logo.png";
import type { Class } from "@shared/schema";

const classSchema = z.object({
  name: z.string().min(1, "Sınıf adı gerekli"),
  maxStudents: z.coerce.number().min(1, "En az 1 olmalı"),
  expiresAt: z.string().optional(),
});
type ClassForm = z.infer<typeof classSchema>;

export default function TeacherDashboard() {
  const [, navigate] = useLocation();
  const { teacher, setTeacher, logoutTeacher, authLoading } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrClass, setQrClass] = useState<Class | null>(null);
  const [addCodesClass, setAddCodesClass] = useState<Class | null>(null);
  const [addCodesCount, setAddCodesCount] = useState(1);

  useEffect(() => {
    if (authLoading) return;
    if (!teacher) {
      // Fallback: try server session + token in case auth context didn't catch it
      fetch(`${(import.meta.env.VITE_API_URL || "")}/api/auth/teacher/me`, {
        credentials: "include",
        headers: teacherAuthHeader(),
      })
        .then(r => r.ok ? r.json() : null)
        .then(t => { if (t) setTeacher(t); else navigate("/teacher/login"); });
    }
  }, [authLoading]);

  const { data: classes, isLoading } = useQuery<Class[]>({
    queryKey: ["/api/teacher/classes"],
    enabled: !!teacher,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: instData } = useQuery<{ id: string; name: string; maxStudents: number; maxTeachers: number }>({
    queryKey: ["/api/teacher/institution"],
    enabled: !!teacher,
    staleTime: 0,
    refetchOnMount: true,
  });

  const instMax = instData?.maxStudents ?? 10000000;

  const { data: onlineData } = useQuery<{ count: number }>({
    queryKey: ["/api/teacher/online-count"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/teacher/online-count`, {
        credentials: "include",
        headers: teacherAuthHeader(),
      });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    enabled: !!teacher,
    refetchInterval: 20000,
    staleTime: 0,
  });
  const onlineCount = onlineData?.count ?? 0;

  type OnlineStudent = { studentId: string; firstName: string; lastName: string; code: string; classId: string; className: string; lastSeenAt: string };
  const [onlineListOpen, setOnlineListOpen] = useState(false);
  const { data: onlineStudents, refetch: refetchOnlineList } = useQuery<OnlineStudent[]>({
    queryKey: ["/api/teacher/online-students"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/teacher/online-students`, {
        credentials: "include",
        headers: teacherAuthHeader(),
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!teacher && onlineListOpen,
    refetchInterval: onlineListOpen ? 20000 : false,
    staleTime: 0,
  });

  const form = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    defaultValues: { name: "", maxStudents: 30, expiresAt: "" },
  });

  useEffect(() => {
    if (instData) {
      const cur = form.getValues("maxStudents");
      if (cur > instMax) form.setValue("maxStudents", instMax);
    }
  }, [instMax]);

  const createClass = useMutation({
    mutationFn: async (data: ClassForm) => {
      const res = await apiRequest("POST", "/api/teacher/classes", {
        ...data,
        teacherId: teacher?.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Sınıf oluşturuldu!", description: "Sınıf kodunu öğrencilerinizle paylaşın." });
    },
    onError: (e: any) => {
      let msg = e.message ?? "Bilinmeyen hata";
      try { msg = JSON.parse(msg.replace(/^\d+: /, "")).message ?? msg; } catch {}
      toast({ title: "Hata", description: msg, variant: "destructive" });
    },
  });

  const deleteClass = useMutation({
    mutationFn: async (classId: string) => {
      await apiRequest("DELETE", `/api/teacher/classes/${classId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes"] });
      toast({ title: "Sınıf silindi" });
    },
  });

  type ClassCodesData = { class: Class; codes: Array<{ id: string; code: string; slotNumber: number; studentId: string | null }> };

  const { data: addCodesData, isLoading: addCodesLoading } = useQuery<ClassCodesData>({
    queryKey: ["/api/teacher/classes", addCodesClass?.id, "student-codes"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/teacher/classes/${addCodesClass!.id}/student-codes`, {
        credentials: "include",
        headers: teacherAuthHeader(),
      });
      if (!res.ok) throw new Error("Yüklenemedi");
      return res.json();
    },
    enabled: !!addCodesClass,
  });

  const { data: stockData } = useQuery<{ max: number; used: number; remaining: number }>({
    queryKey: ["/api/teacher/institution/student-stock"],
    queryFn: async () => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/teacher/institution/student-stock`, {
        credentials: "include",
        headers: teacherAuthHeader(),
      });
      if (!res.ok) throw new Error("Stok bilgisi alınamadı");
      return res.json();
    },
    enabled: !!addCodesClass,
  });

  const addCodesMutation = useMutation({
    mutationFn: async ({ classId, count }: { classId: string; count: number }) => {
      const res = await fetch(`${(import.meta.env.VITE_API_URL || "")}/api/teacher/classes/${classId}/student-codes/add`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...teacherAuthHeader() },
        body: JSON.stringify({ count }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Kod eklenemedi");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/classes", addCodesClass?.id, "student-codes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/institution/student-stock"] });
      toast({ title: "Kodlar eklendi!", description: "Yeni öğrenci davet kodları oluşturuldu." });
      setAddCodesCount(1);
    },
    onError: (e: any) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Kopyalandı!", description: `Sınıf kodu ${code} panoya kopyalandı.` });
  };

  const handleLogout = async () => {
    await logoutTeacher();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProtectedLogo className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-extrabold text-lg text-foreground leading-tight">NoteBeat Kids</h1>
              <p className="text-xs text-muted-foreground font-semibold">Öğretmen Paneli</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Online student count badge */}
            <button
              className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 hover:bg-green-100 transition-colors"
              title="Çevrimiçi öğrencileri göster"
              data-testid="badge-online-count"
              onClick={() => { setOnlineListOpen(true); refetchOnlineList(); }}
            >
              <Circle className={`w-2.5 h-2.5 fill-current ${onlineCount > 0 ? "text-green-500 animate-pulse" : "text-gray-300"}`} />
              <span className="text-sm font-bold text-green-700">{onlineCount}</span>
              <span className="text-xs text-green-600 hidden sm:inline">çevrimiçi</span>
            </button>
            <div className="hidden sm:block text-right">
              <p className="font-bold text-sm text-foreground">{teacher?.name}</p>
              <p className="text-xs text-muted-foreground">{teacher?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 rounded-xl" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl font-extrabold text-foreground">
            Hoş geldin, {teacher?.name?.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground font-semibold mt-1">Müzik sınıflarınızı aşağıdan yönetin</p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Toplam Sınıf", value: classes?.length ?? 0, icon: <BookOpen className="w-6 h-6" />, color: "text-blue-500", bg: "bg-blue-50" },
            { label: "Toplam Öğrenci", value: classes?.reduce((a, c) => a + (c.maxStudents || 0), 0) ?? 0, icon: <Users className="w-6 h-6" />, color: "text-purple-500", bg: "bg-purple-50" },
            { label: "Aktif Sınıf", value: classes?.filter(c => !c.expiresAt || new Date(c.expiresAt) > new Date()).length ?? 0, icon: <Music className="w-6 h-6" />, color: "text-green-500", bg: "bg-green-50" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="rounded-2xl">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>{stat.icon}</div>
                  <div>
                    <div className="text-2xl font-extrabold text-foreground" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground font-semibold">{stat.label}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* QR Code Dialog */}
        <Dialog open={!!qrClass} onOpenChange={open => !open && setQrClass(null)}>
          <DialogContent className="rounded-2xl max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold">QR Kodu</DialogTitle>
            </DialogHeader>
            {qrClass && (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="bg-white p-4 rounded-2xl shadow-inner border">
                  <QRCodeSVG
                    value={qrClass.classCode}
                    size={200}
                    level="H"
                    includeMargin={false}
                    data-testid={`qr-code-${qrClass.id}`}
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-extrabold text-lg text-foreground">{qrClass.name}</p>
                  <p className="font-mono text-2xl font-extrabold text-primary tracking-widest">{qrClass.classCode}</p>
                  <p className="text-sm text-muted-foreground font-semibold">Öğrenciler bu kodu tarayarak katılabilir</p>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl font-bold w-full"
                  onClick={() => copyCode(qrClass.classCode)}
                  data-testid="button-copy-qr-code"
                >
                  <Copy className="w-4 h-4" />
                  Kodu Kopyala
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tools */}
        <div className="mb-8">
          <h3 className="text-xl font-extrabold text-foreground mb-4">Araçlar</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              data-testid="button-metronome"
              className="flex items-center gap-4 p-4 rounded-2xl shadow-md flex-1 text-left"
              style={{
                background: "linear-gradient(135deg, #c084fc 0%, #818cf8 100%)",
                border: "3px solid rgba(255,255,255,0.4)",
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/metronome")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                <img src={metronomeImgPath} alt="Metronom" className="w-full h-full object-contain drop-shadow-lg" />
              </div>
              <div>
                <p className="text-white font-extrabold text-lg leading-tight">Metronom</p>
                <p className="text-white/80 text-sm font-semibold">Sınıfta tempo aracı</p>
              </div>
            </motion.button>

            <motion.button
              data-testid="button-orchestra-panel"
              className="flex items-center gap-4 p-4 rounded-2xl shadow-md flex-1 text-left"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
                border: "3px solid rgba(255,255,255,0.4)",
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/teacher/orchestra")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-white/20 rounded-2xl">
                <span className="text-4xl">🎬</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-lg leading-tight">Maestro</p>
                <p className="text-white/80 text-sm font-semibold">Video & fotoğraf ödev yükle</p>
              </div>
            </motion.button>

            <motion.button
              data-testid="button-leaderboard"
              className="flex items-center gap-4 p-4 rounded-2xl shadow-md flex-1 text-left"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
                border: "3px solid rgba(255,255,255,0.4)",
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/leaderboard")}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-white/20 rounded-2xl">
                <span className="text-4xl">🏆</span>
              </div>
              <div>
                <p className="text-white font-extrabold text-lg leading-tight">Liderlik Tablosu</p>
                <p className="text-white/80 text-sm font-semibold">Öğrenci sıralamalarını gör</p>
              </div>
            </motion.button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-foreground">Sınıflarım</h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl font-bold" data-testid="button-create-class">
                <Plus className="w-4 h-4" />
                Sınıf Oluştur
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-extrabold">Yeni Sınıf Oluştur</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => createClass.mutate(d))} className="space-y-4 pt-2">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Sınıf Adı</FormLabel>
                      <FormControl><Input {...field} placeholder="ör. 2A Müzik Sınıfı" className="rounded-xl" data-testid="input-class-name" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="maxStudents" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">
                        Maksimum Öğrenci
                        {instData && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">(Kurum limiti: {instMax})</span>
                        )}
                      </FormLabel>
                      <FormControl><Input {...field} type="number" min={1} max={instMax} className="rounded-xl" data-testid="input-max-students" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="expiresAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Son Kullanma Tarihi (isteğe bağlı)</FormLabel>
                      <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-expires-at" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" disabled={createClass.isPending} className="w-full rounded-xl font-bold" data-testid="button-submit-class">
                    {createClass.isPending ? "Oluşturuluyor..." : "Sınıf Oluştur"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-44 rounded-2xl bg-white animate-pulse" />
            ))}
          </div>
        ) : classes?.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="py-16 text-center">
              <Music className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-extrabold text-muted-foreground mb-2">Henüz sınıf yok</h3>
              <p className="text-muted-foreground mb-4 font-semibold">Başlamak için ilk sınıfınızı oluşturun!</p>
              <Button onClick={() => setDialogOpen(true)} className="rounded-xl font-bold">Sınıf Oluştur</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes?.map((cls, i) => {
              const expired = cls.expiresAt && new Date(cls.expiresAt) < new Date();
              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className="rounded-2xl hover-elevate cursor-pointer" data-testid={`card-class-${cls.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg font-extrabold leading-tight">{cls.name}</CardTitle>
                        <Badge variant={expired ? "destructive" : "default"} className="shrink-0">
                          {expired ? "Süresi Doldu" : "Aktif"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between bg-primary/5 rounded-xl p-3">
                        <div>
                          <p className="text-xs text-muted-foreground font-bold">Sınıf Kodu</p>
                          <p className="font-mono text-2xl font-extrabold text-primary tracking-widest" data-testid={`text-class-code-${cls.id}`}>{cls.classCode}</p>
                        </div>
                        <button
                          onClick={() => copyCode(cls.classCode)}
                          className="p-2 rounded-xl bg-primary/10 text-primary cursor-pointer"
                          data-testid={`button-copy-code-${cls.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-semibold">Maks {cls.maxStudents}</span>
                        </div>
                        {cls.expiresAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="font-semibold">{new Date(cls.expiresAt).toLocaleDateString("tr-TR")}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 rounded-xl font-bold"
                          onClick={() => navigate(`/teacher/class/${cls.id}`)}
                          data-testid={`button-view-class-${cls.id}`}
                        >
                          <Users className="w-3.5 h-3.5 mr-1.5" />
                          Öğrencileri Gör
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          onClick={() => { setAddCodesClass(cls); setAddCodesCount(1); }}
                          data-testid={`button-add-codes-${cls.id}`}
                          title="Ek Kod Ekle"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-primary"
                          onClick={() => setQrClass(cls)}
                          data-testid={`button-show-qr-${cls.id}`}
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl text-destructive"
                          onClick={() => deleteClass.mutate(cls.id)}
                          data-testid={`button-delete-class-${cls.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Ek Kod Ekle Dialog */}
      <Dialog open={!!addCodesClass} onOpenChange={(open) => { if (!open) setAddCodesClass(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-extrabold flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Ek Kod Ekle
              {addCodesClass && <span className="text-sm font-semibold text-muted-foreground ml-1">— {addCodesClass.name}</span>}
            </DialogTitle>
          </DialogHeader>

          {(addCodesLoading || !stockData) ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Yükleniyor...</div>
          ) : addCodesData ? (() => {
            const classUsed = addCodesData.codes.length;
            const classMax = addCodesData.class.maxStudents;
            const classAvailable = classMax - classUsed;
            const instRemaining = stockData.remaining;
            // Eklenebilir: sınıf kapasitesi ve kurum stoğunun minimumu
            const available = Math.min(classAvailable, instRemaining);
            const stockExhausted = instRemaining <= 0;
            const classFullNoStock = !stockExhausted && classAvailable <= 0;

            return stockExhausted ? (
              <div className="py-4 space-y-3">
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <Lock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-700">Kurum öğrenci stoğu doldu</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Kurumunuza ait toplam {stockData.max} öğrenci kontenjanı kullanılmıştır.
                      Daha fazla kod üretmek için yöneticinizden kapasite artırmasını isteyin.
                    </p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Kurum Toplam Stoğu</span>
                    <span className="font-bold text-foreground">{stockData.used} / {stockData.max}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
            ) : classFullNoStock ? (
              <div className="py-4 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4">
                <Lock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">Bu sınıfın kapasitesi dolu ({classUsed}/{classMax})</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sınıf kapasitesini artırmak için yöneticinize başvurun. Kurum stoğunuz hâlâ mevcut ({instRemaining} kalan).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {/* Kurum stoğu özeti */}
                <div className="bg-indigo-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">Kurum Öğrenci Stoğu</p>
                      <p className="text-lg font-extrabold text-indigo-700">{stockData.used} / {stockData.max}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground font-bold">Stoktan Eklenebilir</p>
                      <p className="text-lg font-extrabold text-green-600">+{instRemaining}</p>
                    </div>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (stockData.used / stockData.max) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bu sınıfta {classUsed}/{classMax} kod mevcut · Bu işlemde en fazla <span className="font-bold text-indigo-600">{available}</span> kod eklenebilir
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Kaç kod eklensin?</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-indigo-200"
                      onClick={() => setAddCodesCount(v => Math.max(1, v - 1))}
                      disabled={addCodesCount <= 1 || addCodesMutation.isPending}
                      data-testid="button-dashboard-add-count-minus"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={available}
                      value={addCodesCount}
                      onChange={e => {
                        const v = Math.max(1, Math.min(available, Number(e.target.value) || 1));
                        setAddCodesCount(v);
                      }}
                      className="h-9 w-20 text-center font-bold rounded-lg border-indigo-200"
                      data-testid="input-dashboard-add-code-count"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-indigo-200"
                      onClick={() => setAddCodesCount(v => Math.min(available, v + 1))}
                      disabled={addCodesCount >= available || addCodesMutation.isPending}
                      data-testid="button-dashboard-add-count-plus"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      className="flex-1 h-9 rounded-lg gap-1.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      disabled={addCodesMutation.isPending || available <= 0}
                      onClick={() => addCodesMutation.mutate({ classId: addCodesClass!.id, count: addCodesCount })}
                      data-testid="button-dashboard-add-codes"
                    >
                      <Plus className="w-4 h-4" />
                      {addCodesMutation.isPending ? "Ekleniyor..." : `${addCodesCount} Kod Ekle`}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </DialogContent>
      </Dialog>

      {/* Online Students Dialog */}
      <Dialog open={onlineListOpen} onOpenChange={setOnlineListOpen}>
        <DialogContent className="rounded-2xl max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-extrabold flex items-center gap-2">
              <Circle className={`w-3 h-3 fill-current ${onlineCount > 0 ? "text-green-500" : "text-gray-300"}`} />
              Çevrimiçi Öğrenciler
              <span className="bg-green-100 text-green-700 text-sm font-bold px-2 py-0.5 rounded-full">
                {onlineStudents?.length ?? onlineCount}
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground">Son 40 saniyede aktif olan öğrenciler • Her 20 saniyede güncellenir</p>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 mt-2 space-y-2 pr-1" data-testid="list-teacher-online-students">
            {(onlineStudents?.length ?? 0) === 0 ? (
              <div className="text-center py-10">
                <Circle className="w-10 h-10 text-gray-200 fill-current mx-auto mb-3" />
                <p className="text-muted-foreground font-semibold">Şu an çevrimiçi öğrenci yok.</p>
                <p className="text-xs text-muted-foreground mt-1">Öğrenciler oyun oynarken burada görünür.</p>
              </div>
            ) : (
              onlineStudents?.map((s, i) => (
                <div
                  key={s.studentId}
                  className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5"
                  data-testid={`item-teacher-online-${s.studentId}`}
                >
                  <Circle className="w-2.5 h-2.5 fill-current text-green-500 flex-shrink-0 animate-pulse" />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-sm text-foreground">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.className}</p>
                  </div>
                  <code className="text-xs font-bold bg-white border border-green-200 text-indigo-600 px-2 py-1 rounded-lg flex-shrink-0">
                    {s.code}
                  </code>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end mt-3 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 font-bold"
              onClick={() => refetchOnlineList()}
              data-testid="button-refresh-online-list"
            >
              <Circle className="w-3 h-3" />
              Yenile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
