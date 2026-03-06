import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Users, BookOpen, Clock, LogOut, Shield, CheckCircle, XCircle } from "lucide-react";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";
import type { Institution, Teacher } from "@shared/schema";

type AdminStats = {
  institutionCount: number;
  teacherCount: number;
  studentCount: number;
  totalExercisesCompleted: number;
  totalTimeSpentSeconds: number;
};

const institutionSchema = z.object({
  name: z.string().min(1, "Kurum adı gerekli"),
  licenseStart: z.string().min(1, "Başlangıç tarihi gerekli"),
  licenseEnd: z.string().min(1, "Bitiş tarihi gerekli"),
  maxTeachers: z.coerce.number().min(1, "En az 1").max(500).default(10),
  maxStudents: z.coerce.number().min(1, "En az 1").max(10000).default(200),
});
type InstitutionForm = z.infer<typeof institutionSchema>;

const teacherSchema = z.object({
  name: z.string().min(1, "Ad gerekli"),
  email: z.string().email("Geçerli e-posta gerekli"),
  password: z.string().min(6, "En az 6 karakter"),
  institutionId: z.string().optional(),
});
type TeacherForm = z.infer<typeof teacherSchema>;

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}s ${m}d`;
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { admin, setAdmin, logoutAdmin } = useAuth();
  const { toast } = useToast();
  const [instDialogOpen, setInstDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);

  useEffect(() => {
    if (!admin) {
      fetch("/api/auth/admin/me")
        .then(r => r.ok ? r.json() : null)
        .then(a => { if (a) setAdmin(a); else navigate("/admin/login"); });
    }
  }, []);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!admin,
  });

  const { data: institutions } = useQuery<Institution[]>({
    queryKey: ["/api/admin/institutions"],
    enabled: !!admin,
  });

  const { data: teachers } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    enabled: !!admin,
  });

  const instForm = useForm<InstitutionForm>({
    resolver: zodResolver(institutionSchema),
    defaultValues: { name: "", licenseStart: "", licenseEnd: "", maxTeachers: 10, maxStudents: 200 },
  });

  const teacherForm = useForm<TeacherForm>({
    resolver: zodResolver(teacherSchema),
    defaultValues: { name: "", email: "", password: "", institutionId: "" },
  });

  const createInstitution = useMutation({
    mutationFn: async (data: InstitutionForm) => {
      const res = await apiRequest("POST", "/api/admin/institutions", {
        ...data,
        licenseStart: new Date(data.licenseStart),
        licenseEnd: new Date(data.licenseEnd),
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setInstDialogOpen(false);
      instForm.reset();
      toast({ title: "Kurum oluşturuldu!" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const createTeacher = useMutation({
    mutationFn: async (data: TeacherForm) => {
      const res = await apiRequest("POST", "/api/admin/teachers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teachers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setTeacherDialogOpen(false);
      teacherForm.reset();
      toast({ title: "Öğretmen oluşturuldu!" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const toggleInstitution = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/institutions/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutions"] });
      toast({ title: "Güncellendi!" });
    },
  });

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/");
  };

  const isLicenseActive = (inst: Institution) => {
    return inst.isActive &&
      new Date(inst.licenseStart) <= new Date() &&
      new Date(inst.licenseEnd) >= new Date();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="NoteBeat Kids" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="font-extrabold text-base leading-tight">NoteBeat Kids</h1>
              <p className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Yönetici Paneli
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-300 text-sm font-semibold hidden sm:block">{admin?.name}</p>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 rounded-xl bg-transparent border-slate-600 text-slate-300" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Kurumlar", value: stats?.institutionCount ?? 0, icon: <Building2 className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Öğretmenler", value: stats?.teacherCount ?? 0, icon: <Users className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Öğrenciler", value: stats?.studentCount ?? 0, icon: <BookOpen className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
            { label: "Tamamlanan Alıştırma", value: stats?.totalExercisesCompleted ?? 0, icon: <CheckCircle className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Toplam Süre", value: formatTime(stats?.totalTimeSpentSeconds ?? 0), icon: <Clock className="w-5 h-5" />, color: "text-teal-600", bg: "bg-teal-50" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="rounded-2xl">
                <CardContent className="p-4">
                  <div className={`${stat.bg} ${stat.color} p-2.5 rounded-xl w-fit mb-2`}>{stat.icon}</div>
                  <div className="text-2xl font-extrabold text-foreground" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-semibold">{stat.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Tabs defaultValue="institutions">
          <TabsList className="mb-6 rounded-xl bg-white border">
            <TabsTrigger value="institutions" className="rounded-lg font-bold">Kurumlar</TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-lg font-bold">Öğretmenler</TabsTrigger>
          </TabsList>

          <TabsContent value="institutions">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold">Kurumlar</h3>
              <Dialog open={instDialogOpen} onOpenChange={setInstDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl font-bold" data-testid="button-create-institution">
                    <Plus className="w-4 h-4" />
                    Kurum Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold">Kurum Ekle</DialogTitle>
                  </DialogHeader>
                  <Form {...instForm}>
                    <form onSubmit={instForm.handleSubmit(d => createInstitution.mutate(d))} className="space-y-4 pt-2">
                      <FormField control={instForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Kurum Adı</FormLabel>
                          <FormControl><Input {...field} placeholder="Güneş İlkokulu" className="rounded-xl" data-testid="input-institution-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={instForm.control} name="licenseStart" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Lisans Başlangıcı</FormLabel>
                            <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-license-start" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={instForm.control} name="licenseEnd" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Lisans Bitişi</FormLabel>
                            <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-license-end" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={instForm.control} name="maxTeachers" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Maks. Öğretmen</FormLabel>
                            <FormControl><Input {...field} type="number" min={1} max={500} className="rounded-xl" data-testid="input-max-teachers" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={instForm.control} name="maxStudents" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Maks. Öğrenci</FormLabel>
                            <FormControl><Input {...field} type="number" min={1} max={10000} className="rounded-xl" data-testid="input-max-students" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" disabled={createInstitution.isPending} className="w-full rounded-xl font-bold" data-testid="button-submit-institution">
                        {createInstitution.isPending ? "Oluşturuluyor..." : "Kurum Oluştur"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {institutions?.map((inst, i) => {
                const active = isLicenseActive(inst);
                const expired = new Date(inst.licenseEnd) < new Date();
                return (
                  <motion.div key={inst.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="rounded-2xl" data-testid={`card-institution-${inst.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </div>
                          <Badge variant={active ? "default" : expired ? "destructive" : "secondary"} className="shrink-0">
                            {active ? "Aktif" : expired ? "Süresi Doldu" : "Pasif"}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-extrabold mt-2">{inst.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="text-sm text-muted-foreground font-semibold">
                          <p>Başlangıç: {new Date(inst.licenseStart).toLocaleDateString("tr-TR")}</p>
                          <p>Bitiş: {new Date(inst.licenseEnd).toLocaleDateString("tr-TR")}</p>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-lg">
                            Maks. Öğretmen: {(inst as any).maxTeachers ?? 10}
                          </span>
                          <span className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded-lg">
                            Maks. Öğrenci: {(inst as any).maxStudents ?? 200}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-full rounded-xl font-bold gap-2 ${active ? "text-red-500" : "text-green-600"}`}
                          onClick={() => toggleInstitution.mutate({ id: inst.id, isActive: !inst.isActive })}
                          data-testid={`button-toggle-institution-${inst.id}`}
                        >
                          {active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {active ? "Devre Dışı Bırak" : "Etkinleştir"}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="teachers">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold">Öğretmenler</h3>
              <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl font-bold" data-testid="button-create-teacher">
                    <Plus className="w-4 h-4" />
                    Öğretmen Ekle
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold">Öğretmen Ekle</DialogTitle>
                  </DialogHeader>
                  <Form {...teacherForm}>
                    <form onSubmit={teacherForm.handleSubmit(d => createTeacher.mutate(d))} className="space-y-4 pt-2">
                      <FormField control={teacherForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Ad Soyad</FormLabel>
                          <FormControl><Input {...field} placeholder="Ayşe Öztürk" className="rounded-xl" data-testid="input-teacher-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">E-posta</FormLabel>
                          <FormControl><Input {...field} type="email" placeholder="ogretmen@okul.edu.tr" className="rounded-xl" data-testid="input-teacher-email" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Şifre</FormLabel>
                          <FormControl><Input {...field} type="password" placeholder="En az 6 karakter" className="rounded-xl" data-testid="input-teacher-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="institutionId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Kurum (isteğe bağlı)</FormLabel>
                          <FormControl>
                            <select {...field} className="w-full h-10 rounded-xl border border-input px-3 text-sm font-semibold bg-background" data-testid="select-institution">
                              <option value="">Kurum yok</option>
                              {institutions?.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" disabled={createTeacher.isPending} className="w-full rounded-xl font-bold" data-testid="button-submit-teacher">
                        {createTeacher.isPending ? "Oluşturuluyor..." : "Öğretmen Oluştur"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teachers?.map((teacher, i) => (
                <motion.div key={teacher.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Card className="rounded-2xl" data-testid={`card-teacher-${teacher.id}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-lg font-extrabold text-primary flex-shrink-0">
                        {teacher.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-foreground truncate">{teacher.name}</p>
                        <p className="text-xs text-muted-foreground font-semibold truncate">{teacher.email}</p>
                        {teacher.institutionId && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {institutions?.find(i => i.id === teacher.institutionId)?.name ?? "Kurum"}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
