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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Users, BookOpen, Clock, LogOut, Shield, CheckCircle, XCircle, School, Trash2, Search, ChevronRight, QrCode, Copy, Pencil, CalendarClock, RotateCcw, Activity, AlertTriangle, Database, Wifi, RefreshCw, Server, Monitor, Smartphone, LockKeyhole, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import ProtectedLogo from "@/components/protected-logo";
import type { Institution, Teacher } from "@shared/schema";

type InstWithExpiry = Institution & { isExpired?: boolean };

type AdminClass = {
  id: string;
  name: string;
  teacherId: string;
  classCode: string;
  maxStudents: number;
  expiresAt: string | null;
  createdAt: string;
  teacherName: string;
  teacherEmail: string;
  institutionName: string | null;
  studentCount: number;
};

type DeletedClassInfo = {
  id: string;
  name: string;
  branchName: string;
  classCode: string;
  maxStudents: number;
  deletedAt: string;
  createdAt: string;
  teacherName: string;
  teacherEmail: string;
  institutionName: string | null;
  studentCount: number;
};

type AdminStats = {
  institutionCount: number;
  teacherCount: number;
  studentCount: number;
  totalExercisesCompleted: number;
  totalTimeSpentSeconds: number;
};

type InstStudent = {
  id: string; firstName: string; lastName: string;
  rhythmLevel: number; rhythmStars: number; rhythmCorrect: number; rhythmWrong: number;
  notesLevel: number; notesStars: number; notesCorrect: number; notesWrong: number;
  drumTimeSeconds: number;
  melodyCorrect: number; melodyWrong: number; melodyStars: number;
  totalCorrect: number; totalTimeSeconds: number;
};

type InstitutionDetails = {
  institution: Institution;
  teachers: Array<{
    id: string; name: string; email: string;
    classes: Array<{
      id: string; name: string; classCode: string; maxStudents: number; expiresAt: string | null;
      students: InstStudent[];
    }>;
  }>;
};



const institutionSchema = z.object({
  name: z.string().min(1, "Kurum adı gerekli"),
  licenseStart: z.string().min(1, "Başlangıç tarihi gerekli"),
  licenseEnd: z.string().min(1, "Bitiş tarihi gerekli"),
  maxTeachers: z.coerce.number().min(0, "En az 0 olmalı").max(10000, "En fazla 10000").default(10000),
  maxStudents: z.coerce.number().min(0, "En az 0 olmalı").max(10000000, "En fazla 10.000.000").default(10000000),
});
type InstitutionForm = z.infer<typeof institutionSchema>;

const editInstitutionSchema = z.object({
  name: z.string().min(1, "Kurum adı gerekli"),
  licenseEnd: z.string().min(1, "Bitiş tarihi gerekli"),
  maxTeachers: z.coerce.number().min(0).max(10000).default(10000),
  maxStudents: z.coerce.number().min(0).max(10000000).default(10000000),
});
type EditInstitutionForm = z.infer<typeof editInstitutionSchema>;

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

const INST_LS_KEY = "notebeat_admin_institutions_v1";

// localStorage is a DISPLAY PLACEHOLDER only — server is always authoritative.
// Never read from localStorage inside mutations. Only write when server responds.
function lsGetInstitutions(): InstWithExpiry[] {
  try { return JSON.parse(localStorage.getItem(INST_LS_KEY) || "[]"); } catch { return []; }
}
function lsSaveInstitutions(list: InstWithExpiry[]) {
  try { localStorage.setItem(INST_LS_KEY, JSON.stringify(list)); } catch {}
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
      {ok ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {label}
    </span>
  );
}

function SecurityPanel() {
  const { data: devices, isLoading: devicesLoading, refetch: refetchDevices } = useQuery<any[]>({
    queryKey: ["/api/admin/devices"],
  });
  const { data: logs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ["/api/admin/login-logs"],
  });
  const { toast } = useToast();
  const resetMutation = useMutation({
    mutationFn: async (deviceType: "desktop" | "mobile") =>
      (await (await fetch("/api/admin/devices/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${localStorage.getItem("adminToken") ?? ""}` },
        body: JSON.stringify({ deviceType }),
      })).json()),
    onSuccess: (data) => {
      toast({ title: "Cihaz sıfırlandı", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/devices"] });
    },
    onError: () => toast({ title: "Hata", description: "Cihaz sıfırlanamadı.", variant: "destructive" }),
  });

  const desktop = devices?.find((d: any) => d.deviceType === "desktop");
  const mobile  = devices?.find((d: any) => d.deviceType === "mobile");

  const failureLabel = (r: string | null) => {
    if (!r) return null;
    if (r === "wrong_password")     return "Yanlış şifre";
    if (r === "account_locked")     return "Hesap kilitli";
    if (r === "unauthorized_device") return "Yetkisiz cihaz";
    return r;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LockKeyhole className="w-5 h-5 text-indigo-600" />
        <h2 className="text-xl font-extrabold text-gray-800">Cihaz Güvenliği</h2>
        <Button size="sm" variant="outline" onClick={() => { refetchDevices(); refetchLogs(); }} className="ml-auto" data-testid="button-security-refresh">
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Yenile
        </Button>
      </div>

      {/* Yetkili cihazlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Masaüstü */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Monitor className="w-4 h-4 text-blue-500" /> Masaüstü / Laptop
              {desktop
                ? <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold rounded-full px-2 py-0.5">Kayıtlı</span>
                : <span className="ml-auto bg-gray-100 text-gray-500 text-xs font-bold rounded-full px-2 py-0.5">Kayıt yok</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {devicesLoading ? (
              <div className="text-xs text-gray-400">Yükleniyor...</div>
            ) : desktop ? (
              <>
                <div className="text-sm font-semibold text-gray-700">{desktop.deviceName ?? "Bilinmiyor"}</div>
                <div className="text-xs text-gray-500">Tarayıcı: {desktop.browser ?? "—"}</div>
                <div className="text-xs text-gray-500">İşletim Sistemi: {desktop.os ?? "—"}</div>
                <div className="text-xs text-gray-500">İlk Giriş: {new Date(desktop.firstLoginAt).toLocaleString("tr-TR")}</div>
                <div className="text-xs text-gray-500">Son Giriş: {new Date(desktop.lastLoginAt).toLocaleString("tr-TR")}</div>
                <Button
                  size="sm" variant="outline"
                  className="mt-2 text-red-600 border-red-200 hover:bg-red-50 w-full"
                  onClick={() => resetMutation.mutate("desktop")}
                  disabled={resetMutation.isPending}
                  data-testid="button-reset-desktop"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Bilgisayarı Değiştir
                </Button>
              </>
            ) : (
              <div className="text-xs text-gray-400 py-2">Henüz masaüstü cihaz kaydedilmemiş. İlk girişte otomatik kaydedilecek.</div>
            )}
          </CardContent>
        </Card>

        {/* Mobil */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-500" /> Mobil Telefon
              {mobile
                ? <span className="ml-auto bg-green-100 text-green-700 text-xs font-bold rounded-full px-2 py-0.5">Kayıtlı</span>
                : <span className="ml-auto bg-gray-100 text-gray-500 text-xs font-bold rounded-full px-2 py-0.5">Kayıt yok</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {devicesLoading ? (
              <div className="text-xs text-gray-400">Yükleniyor...</div>
            ) : mobile ? (
              <>
                <div className="text-sm font-semibold text-gray-700">{mobile.deviceName ?? "Bilinmiyor"}</div>
                <div className="text-xs text-gray-500">Tarayıcı: {mobile.browser ?? "—"}</div>
                <div className="text-xs text-gray-500">İşletim Sistemi: {mobile.os ?? "—"}</div>
                <div className="text-xs text-gray-500">İlk Giriş: {new Date(mobile.firstLoginAt).toLocaleString("tr-TR")}</div>
                <div className="text-xs text-gray-500">Son Giriş: {new Date(mobile.lastLoginAt).toLocaleString("tr-TR")}</div>
                <Button
                  size="sm" variant="outline"
                  className="mt-2 text-red-600 border-red-200 hover:bg-red-50 w-full"
                  onClick={() => resetMutation.mutate("mobile")}
                  disabled={resetMutation.isPending}
                  data-testid="button-reset-mobile"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Telefonu Değiştir
                </Button>
              </>
            ) : (
              <div className="text-xs text-gray-400 py-2">Henüz telefon kaydedilmemiş. İlk girişte otomatik kaydedilecek.</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Giriş Logları */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500" /> Son Giriş Kayıtları
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {logsLoading ? (
            <div className="text-xs text-gray-400">Yükleniyor...</div>
          ) : !logs || logs.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">Henüz kayıt yok</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.map((l: any) => (
                <div key={l.id} className={`border rounded-xl px-3 py-2 text-xs ${l.success ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {l.success
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className={`font-bold ${l.success ? "text-green-700" : "text-red-600"}`}>
                      {l.success ? "Başarılı" : "Başarısız"}
                    </span>
                    {!l.success && l.failureReason && (
                      <span className="bg-red-100 text-red-700 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                        {failureLabel(l.failureReason)}
                      </span>
                    )}
                    <span className="text-gray-400 ml-auto">{new Date(l.createdAt).toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="text-gray-500 mt-0.5 flex gap-2 flex-wrap">
                    {l.deviceType && <span>{l.deviceType === "mobile" ? "📱 Mobil" : "🖥️ Masaüstü"}</span>}
                    {l.browser && <span>{l.browser}</span>}
                    {l.os && <span>{l.os}</span>}
                    {l.ip && <span className="font-mono text-gray-400">{l.ip}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HealthPanel() {
  const { toast } = useToast();
  const { data: health, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30_000,
  });
  const { data: errors } = useQuery<any[]>({ queryKey: ["/api/admin/system-errors"] });

  const syncSchema = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/sync-schema"),
    onSuccess: (data: any) => {
      if (data.ok) {
        toast({ title: "✅ Schema senkronize edildi", description: "Tüm eksik kolonlar eklendi." });
      } else {
        const failed = data.results?.filter((r: any) => r.status === "error").map((r: any) => r.migration).join(", ");
        toast({ title: "⚠️ Kısmi hata", description: `Başarısız: ${failed}`, variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Hata", description: "Schema sync başarısız.", variant: "destructive" }),
  });

  if (isLoading) return <div className="text-center py-20 text-gray-400">Yükleniyor...</div>;
  if (!health) return <div className="text-center py-10 text-gray-400">Veri yok</div>;

  const overallColor = health.overall === "healthy" ? "text-green-600" : health.overall === "degraded" ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-600" />
          <h2 className="text-xl font-extrabold text-gray-800">Sistem Sağlığı</h2>
          <span className={`font-bold uppercase text-sm ${overallColor}`}>{health.overall}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => syncSchema.mutate()} disabled={syncSchema.isPending} data-testid="button-sync-schema" className="gap-1.5 text-xs border-orange-300 text-orange-700 hover:bg-orange-50">
            <Database className={`w-3.5 h-3.5 ${syncSchema.isPending ? "animate-pulse" : ""}`} />
            {syncSchema.isPending ? "Senkronize ediliyor..." : "DB Şemasını Senkronize Et"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-health-refresh">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Yenile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* PostgreSQL */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Database className="w-4 h-4 text-blue-500" /> PostgreSQL</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <StatusBadge ok={health.postgresql.status === "ok"} label={health.postgresql.status} />
            <div className="text-xs text-gray-500">Ping: {health.postgresql.pingMs ?? "—"}ms</div>
            <div className="text-xs text-gray-500">Pool: {health.postgresql.poolTotal} / idle {health.postgresql.poolIdle}</div>
          </CardContent>
        </Card>

        {/* Redis */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Wifi className="w-4 h-4 text-orange-500" /> Redis</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <StatusBadge ok={health.redis.status === "ok" || health.redis.status === "disabled"} label={health.redis.status} />
            {health.redis.memoryUsedMB != null && <div className="text-xs text-gray-500">Bellek: {health.redis.memoryUsedMB} MB</div>}
            {health.redis.hitRate != null && <div className="text-xs text-gray-500">Hit Rate: %{health.redis.hitRate}</div>}
          </CardContent>
        </Card>

        {/* Socket.IO */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Wifi className="w-4 h-4 text-green-500" /> Socket.IO</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="text-xs text-gray-500">Toplam: {health.socketio.totalSockets}</div>
            <div className="text-xs text-gray-500">Bağlı: {health.socketio.connectedSockets}</div>
            <div className="text-xs text-gray-500">Oda: {health.socketio.totalRooms}</div>
          </CardContent>
        </Card>

        {/* Sistem */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Server className="w-4 h-4 text-gray-500" /> Sistem</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="text-xs text-gray-500">Uptime: {Math.round(health.system.uptime / 60)}dk</div>
            <div className="text-xs text-gray-500">RSS: {health.system.rssMemoryMB} MB</div>
            <div className="text-xs text-gray-500">Heap: {health.system.heapUsedMB}/{health.system.heapTotalMB} MB</div>
          </CardContent>
        </Card>

        {/* API Metrikleri */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Activity className="w-4 h-4 text-purple-500" /> API</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="text-xs text-gray-500">Toplam: {health.api.totalRequests}</div>
            <div className="text-xs text-gray-500">Son 1s: {health.api.requestsLastHour}</div>
            <div className="text-xs text-gray-500">Ort: {health.api.avgResponseMs}ms</div>
            {health.api.slowestEndpoint && <div className="text-xs text-gray-400 truncate" title={health.api.slowestEndpoint.path}>Yavaş: {health.api.slowestEndpoint.avgMs}ms</div>}
          </CardContent>
        </Card>

        {/* Score Buffer */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Database className="w-4 h-4 text-teal-500" /> Skor Tamponu</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <div className="text-xs text-gray-500">Bekleyen: {health.scoreBuffer.pendingEntries}</div>
            <div className="text-xs text-gray-500">Dirty Kurum: {health.scoreBuffer.dirtyInstitutions}</div>
            {health.scoreBuffer.lastFlushSuccess != null && <StatusBadge ok={health.scoreBuffer.lastFlushSuccess} label={health.scoreBuffer.lastFlushSuccess ? "son flush: ok" : "son flush: hata"} />}
          </CardContent>
        </Card>

        {/* Integrity */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><Shield className="w-4 h-4 text-indigo-500" /> Bütünlük</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <StatusBadge ok={health.integrity.lastResult !== "failed" && health.integrity.lastResult !== "warnings"} label={health.integrity.lastResult ?? "bekleniyor"} />
            {health.integrity.warningCount > 0 && <div className="text-xs text-yellow-600 font-bold">{health.integrity.warningCount} uyarı</div>}
            <div className="text-xs text-gray-400">{health.integrity.lastCheckAt ? new Date(health.integrity.lastCheckAt).toLocaleTimeString("tr-TR") : "—"}</div>
          </CardContent>
        </Card>

        {/* Aylık Sıfırlama */}
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="pb-1 pt-3 px-4"><CardTitle className="text-sm font-bold flex items-center gap-1.5"><CalendarClock className="w-4 h-4 text-pink-500" /> Aylık Reset</CardTitle></CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            <StatusBadge ok={health.monthlyReset.lastResult !== "failed"} label={health.monthlyReset.lastResult ?? "bekleniyor"} />
            <div className="text-xs text-gray-400">{health.monthlyReset.lastRunAt ? new Date(health.monthlyReset.lastRunAt).toLocaleString("tr-TR") : "—"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Schema Uyarısı */}
      {health.schema && health.schema.ok === false && health.schema.missingColumns.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-red-400 bg-red-50 px-4 py-3" data-testid="alert-schema-missing">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-extrabold text-red-700">⚠️ Veritabanı Schema Hatası</p>
            <p className="text-xs text-red-600 mt-0.5">Aşağıdaki kritik sütunlar üretim veritabanında eksik. Sorgu hataları yaşanabilir!</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {health.schema.missingColumns.map((col: string) => (
                <span key={col} className="font-mono text-xs bg-red-100 text-red-800 rounded px-1.5 py-0.5 border border-red-300">{col}</span>
              ))}
            </div>
            {health.schema.checkedAt && (
              <p className="text-xs text-red-400 mt-1">Son kontrol: {new Date(health.schema.checkedAt).toLocaleString("tr-TR")}</p>
            )}
          </div>
        </div>
      )}
      {health.schema && health.schema.ok === true && (
        <div className="flex items-center gap-2 rounded-2xl border border-green-300 bg-green-50 px-4 py-2.5" data-testid="alert-schema-ok">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-xs font-bold text-green-700">Schema doğrulama: tüm kritik sütunlar mevcut</span>
          {health.schema.checkedAt && (
            <span className="text-xs text-green-400 ml-auto">{new Date(health.schema.checkedAt).toLocaleString("tr-TR")}</span>
          )}
        </div>
      )}

      {/* Sistem Hataları */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Son Sistem Hataları
            {errors && errors.length > 0 && <span className="bg-red-100 text-red-700 text-xs font-extrabold rounded-full px-1.5 py-0.5">{errors.length}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!errors || errors.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">Hata yok 🎉</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {errors.slice(-20).reverse().map((e: any) => (
                <div key={e.id} className="border rounded-xl px-3 py-2 bg-gray-50">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold uppercase ${e.severity === "critical" ? "text-red-600" : e.severity === "error" ? "text-orange-600" : "text-yellow-600"}`}>{e.severity}</span>
                    {e.route && <span className="text-xs text-gray-400">{e.route}</span>}
                    <span className="text-xs text-gray-300 ml-auto">{new Date(e.createdAt).toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="text-xs text-gray-700 font-medium">{e.message}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { admin, setAdmin, logoutAdmin, authLoading } = useAuth();
  const { toast } = useToast();
  const [instDialogOpen, setInstDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [classSearch, setClassSearch] = useState("");
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<InstWithExpiry | null>(null);

  // Snapshot from localStorage shown ONLY while server is loading (display placeholder)
  const [localInstitutions] = useState<InstWithExpiry[]>(lsGetInstitutions);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) {
      const adminToken = localStorage.getItem("adminToken");
      fetch(`${(import.meta.env.VITE_API_URL || "")}/api/auth/admin/me`, {
        credentials: "include",
        headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
      })
        .then(r => r.ok ? r.json() : null)
        .then(a => { if (a) setAdmin(a); else navigate("/admin/login"); });
    }
  }, [authLoading]);

  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!admin,
    refetchOnMount: true,
    staleTime: 0,
    retry: 3,
    retryDelay: 2000,
  });

  const {
    data: serverInstitutions,
    isLoading: instLoading,
    isError: instError,
    error: instQueryError,
    refetch: refetchInstitutions,
    isFetching: instFetching,
  } = useQuery<InstWithExpiry[]>({
    queryKey: ["/api/admin/institutions"],
    enabled: !!admin,
    refetchOnMount: true,
    staleTime: 0,
    // Exponential backoff — gives Render ~60s cold-start time:
    // 3s, 6s, 9s, 12s, 15s, 18s, 21s, 24s (total ~108s across 8 retries)
    retry: 8,
    retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 30000),
  });

  // Debug: log institutions query results
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const teacherToken = localStorage.getItem("teacherToken");
    if (serverInstitutions !== undefined) {
      console.log(`[AdminDashboard] Server returned ${serverInstitutions.length} institution(s):`, serverInstitutions.map(i => i.name));
      console.log(`[AdminDashboard] adminToken=${adminToken ? adminToken.slice(0,12)+"..." : "null"} teacherToken=${teacherToken ? "present (may conflict!)" : "null"}`);
    }
    if (instQueryError) {
      console.error(`[AdminDashboard] institutions fetch error:`, instQueryError);
    }
  }, [serverInstitutions, instQueryError]);

  // When server responds, save to localStorage (read-only from mutations perspective)
  useEffect(() => {
    if (serverInstitutions) {
      lsSaveInstitutions(serverInstitutions);
    }
  }, [serverInstitutions]);

  // Server is ALWAYS primary. localStorage placeholder shown only while server is loading.
  const institutions = serverInstitutions ?? localInstitutions;

  const { data: teachers } = useQuery<Teacher[]>({
    queryKey: ["/api/admin/teachers"],
    enabled: !!admin,
  });

  const { data: allClasses } = useQuery<AdminClass[]>({
    queryKey: ["/api/admin/classes"],
    enabled: !!admin,
  });

  const { data: deletedClasses, isLoading: deletedLoading } = useQuery<DeletedClassInfo[]>({
    queryKey: ["/api/admin/classes/deleted"],
    enabled: !!admin,
    staleTime: 0,
  });

  const restoreClass = useMutation({
    mutationFn: async (classId: string) => {
      const res = await apiRequest("POST", `/api/admin/classes/${classId}/restore`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes/deleted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      toast({ title: "Sınıf geri yüklendi!", description: "Sınıf ve tüm öğrenci verileri aktif hale getirildi." });
    },
    onError: () => {
      toast({ title: "Hata", description: "Sınıf geri yüklenemedi.", variant: "destructive" });
    },
  });

  const [editClassMaxOpen, setEditClassMaxOpen] = useState<{ id: string; name: string; current: number } | null>(null);
  const [newMaxStudents, setNewMaxStudents] = useState(30);

  const updateClassMax = useMutation({
    mutationFn: async ({ classId, maxStudents }: { classId: string; maxStudents: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/classes/${classId}/max-students`, { maxStudents });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      setEditClassMaxOpen(null);
      toast({ title: "Kapasite güncellendi!", description: "Öğretmen artık sınıfa ek kod ekleyebilir." });
    },
    onError: (e: any) => {
      toast({ title: "Hata", description: e.message, variant: "destructive" });
    },
  });

  const { data: institutionDetails, isLoading: detailsLoading } = useQuery<InstitutionDetails>({
    queryKey: ["/api/admin/institutions", selectedInstId, "details"],
    enabled: !!selectedInstId && detailOpen,
  });

  type TeacherCodeItem = { id: string; code: string; slotNumber: number; teacherId: string | null; teacherName: string | null };
  const { data: teacherCodeList, isLoading: codesLoading } = useQuery<TeacherCodeItem[]>({
    queryKey: ["/api/admin/institutions", selectedInstId, "teacher-codes"],
    enabled: !!selectedInstId && detailOpen,
  });

  const [addCodeCount, setAddCodeCount] = useState(1);
  const [codesSearchQuery, setCodesSearchQuery] = useState("");

  const generateMoreCodes = useMutation({
    mutationFn: async ({ instId, count }: { instId: string; count: number }) => {
      const res = await apiRequest("POST", `/api/admin/institutions/${instId}/teacher-codes/generate`, { count });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutions", selectedInstId, "teacher-codes"] });
      toast({ title: `${addCodeCount} yeni kod oluşturuldu!` });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const editInstitution = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditInstitutionForm }) => {
      const res = await apiRequest("PATCH", `/api/admin/institutions/${id}`, {
        ...data,
        licenseEnd: new Date(data.licenseEnd),
      });
      return res.json();
    },
    onSuccess: (resp, { id }) => {
      queryClient.setQueryData<InstWithExpiry[]>(["/api/admin/institutions"], (old) =>
        old ? old.map((inst) => inst.id === id ? { ...inst, ...resp } : inst) : old
      );
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      setEditingInst(null);
      if (resp?.quotaReset) {
        toast({ title: "Kurum Güncellendi", description: "Lisans uzatıldı, kontenjan sıfırlandı." });
      } else {
        toast({ title: "Kurum güncellendi!" });
      }
      setTimeout(() => refetchInstitutions(), 1500);
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const editForm = useForm<EditInstitutionForm>({
    resolver: zodResolver(editInstitutionSchema),
    defaultValues: { name: "", licenseEnd: "", maxTeachers: 10000, maxStudents: 10000000 },
  });

  const instForm = useForm<InstitutionForm>({
    resolver: zodResolver(institutionSchema),
    defaultValues: { name: "", licenseStart: "", licenseEnd: "", maxTeachers: 10000, maxStudents: 10000000 },
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
    onSuccess: (newInst) => {
      // Instant UI update — add new institution to current list
      queryClient.setQueryData<InstWithExpiry[]>(["/api/admin/institutions"], (old) =>
        old ? [...old, newInst] : [newInst]
      );
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      setInstDialogOpen(false);
      instForm.reset();
      toast({ title: "Kurum oluşturuldu!" });
      // Background sync with server after 1.5s (server already committed the record)
      setTimeout(() => refetchInstitutions(), 1500);
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const createTeacher = useMutation({
    mutationFn: async (data: TeacherForm) => {
      const res = await apiRequest("POST", "/api/admin/teachers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/admin/teachers"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
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
    onSuccess: (data, { id, isActive }) => {
      queryClient.setQueryData<InstWithExpiry[]>(["/api/admin/institutions"], (old) =>
        old ? old.map((inst) => inst.id === id ? { ...inst, isActive } : inst) : old
      );
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      if (data?.quotaReset) {
        toast({ title: "Abonelik Yenilendi", description: "Kontenjan sıfırlandı, tüm sınıf ve öğrenci verileri temizlendi." });
      } else {
        toast({ title: "Güncellendi!" });
      }
    },
  });

  const resetQuota = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/institutions/${id}/reset-quota`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Kontenjan Sıfırlandı", description: "Tüm sınıf ve öğrenci verileri temizlendi." });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    requireTyped?: boolean;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });
  const [confirmTyped, setConfirmTyped] = useState("");

  const deleteInstitution = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/institutions/${id}`, undefined);
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<InstWithExpiry[]>(["/api/admin/institutions"], (old) =>
        old ? old.filter((inst) => inst.id !== id) : old
      );
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/teachers"] });
      toast({ title: "Kurum silindi!", description: "Tüm öğretmen, sınıf ve öğrenci verileri kaldırıldı." });
      setTimeout(() => refetchInstitutions(), 1500);
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deleteClass = useMutation({
    mutationFn: async (classId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/classes/${classId}`, undefined);
      return res.json();
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Sınıf silindi!" });
    },
    onError: (e: any) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/");
  };

  const isLicenseActive = (inst: InstWithExpiry) => {
    return inst.isActive && !inst.isExpired;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ProtectedLogo className="w-8 h-8 object-contain" />
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
            <TabsTrigger value="health" className="rounded-lg font-bold flex items-center gap-1.5" data-testid="tab-health">
              <Activity className="w-3.5 h-3.5" /> Sağlık
            </TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg font-bold flex items-center gap-1.5" data-testid="tab-security">
              <LockKeyhole className="w-3.5 h-3.5" /> Güvenlik
            </TabsTrigger>
            <TabsTrigger value="deleted-classes" className="rounded-lg font-bold flex items-center gap-1.5" data-testid="tab-deleted-classes">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              Çöp Kutusu
              {(deletedClasses?.length ?? 0) > 0 && (
                <span className="ml-1 bg-red-100 text-red-700 text-xs font-extrabold rounded-full px-1.5 py-0.5 leading-none">
                  {deletedClasses!.length}
                </span>
              )}
            </TabsTrigger>
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
                            <FormLabel className="font-bold">Maks. Öğretmen (0–10.000)</FormLabel>
                            <FormControl><Input {...field} type="number" min={0} max={10000} className="rounded-xl" data-testid="input-max-teachers" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={instForm.control} name="maxStudents" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">Maks. Öğrenci (0–10.000.000)</FormLabel>
                            <FormControl><Input {...field} type="number" min={0} max={10000000} className="rounded-xl" data-testid="input-max-students" /></FormControl>
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

            {instLoading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground font-semibold gap-2">
                <span className="animate-spin">⏳</span> Kurumlar yükleniyor...
              </div>
            )}
            {instError && !instLoading && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <p className="text-red-500 font-bold">Kurumlar yüklenemedi.</p>
                <button
                  onClick={() => refetchInstitutions()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  Tekrar Dene
                </button>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {institutions?.map((inst, i) => {
                const active = isLicenseActive(inst);
                const expired = !!inst.isExpired;
                return (
                  <motion.div key={inst.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className={`rounded-2xl ${expired ? "border-red-200" : ""}`} data-testid={`card-institution-${inst.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 hover:bg-blue-200 transition-colors cursor-pointer"
                            onClick={() => { setSelectedInstId(inst.id); setDetailOpen(true); }}
                            data-testid={`button-inst-detail-${inst.id}`}
                            title="Detayları Görüntüle"
                          >
                            <Building2 className="w-5 h-5 text-blue-600" />
                          </button>
                          <Badge
                            variant={active ? "default" : expired ? "destructive" : "secondary"}
                            className="shrink-0"
                            data-testid={`badge-status-${inst.id}`}
                          >
                            {active ? "Aktif" : expired ? "Süresi Doldu" : "Pasif"}
                          </Badge>
                        </div>
                        <button
                          className="text-base font-extrabold mt-2 text-left hover:text-primary transition-colors w-full"
                          onClick={() => { setSelectedInstId(inst.id); setDetailOpen(true); }}
                          data-testid={`button-inst-name-${inst.id}`}
                        >
                          {inst.name}
                        </button>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="text-sm text-muted-foreground font-semibold">
                          <p>Başlangıç: {new Date(inst.licenseStart).toLocaleDateString("tr-TR")}</p>
                          <p className={expired ? "text-red-500 font-bold" : ""}>
                            Bitiş: {new Date(inst.licenseEnd).toLocaleDateString("tr-TR")}
                            {expired && " ⚠"}
                          </p>
                        </div>
                        <div className="flex gap-2 text-xs flex-wrap">
                          <span className="bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-lg">
                            Maks. Öğretmen: {(inst as any).maxTeachers ?? 10}
                          </span>
                          <span className="bg-green-50 text-green-700 font-bold px-2 py-1 rounded-lg">
                            Maks. Öğrenci: {(inst as any).maxStudents ?? 200}
                          </span>
                        </div>

                        <button
                          className="w-full flex items-center gap-2 p-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors text-left"
                          onClick={() => { setSelectedInstId(inst.id); setDetailOpen(true); setCodesSearchQuery(""); }}
                          data-testid={`button-view-codes-${inst.id}`}
                        >
                          <QrCode className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <span className="text-xs font-bold text-indigo-700">Öğretmen Kodlarını Görüntüle</span>
                          <ChevronRight className="w-3.5 h-3.5 text-indigo-400 ml-auto" />
                        </button>

                        <div className="flex gap-2 flex-wrap">
                          {/* Edit button — always visible */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold gap-1.5 text-blue-600 hover:bg-blue-50"
                            onClick={() => {
                              setEditingInst(inst);
                              editForm.reset({
                                name: inst.name,
                                licenseEnd: new Date(inst.licenseEnd).toISOString().split("T")[0],
                                maxTeachers: (inst as any).maxTeachers ?? 10000,
                                maxStudents: (inst as any).maxStudents ?? 10000000,
                              });
                            }}
                            data-testid={`button-edit-institution-${inst.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Düzenle
                          </Button>

                          {/* Toggle active/passive — only for non-expired institutions */}
                          {!expired && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={`flex-1 rounded-xl font-bold gap-1.5 ${active ? "text-orange-500 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`}
                              onClick={() => toggleInstitution.mutate({ id: inst.id, isActive: !inst.isActive })}
                              disabled={toggleInstitution.isPending}
                              data-testid={`button-toggle-institution-${inst.id}`}
                            >
                              {active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              {active ? "Devre Dışı" : "Etkinleştir"}
                            </Button>
                          )}

                          {/* For expired institutions: show Activate button that opens edit for date extension */}
                          {expired && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 rounded-xl font-bold gap-1.5 text-green-600 hover:bg-green-50"
                              onClick={() => {
                                setEditingInst(inst);
                                editForm.reset({
                                  name: inst.name,
                                  licenseEnd: "",
                                  maxTeachers: (inst as any).maxTeachers ?? 10000,
                                  maxStudents: (inst as any).maxStudents ?? 10000000,
                                });
                              }}
                              data-testid={`button-activate-expired-${inst.id}`}
                            >
                              <CalendarClock className="w-3.5 h-3.5" />
                              Etkinleştir
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl font-bold gap-1.5 text-red-500 hover:bg-red-50"
                            onClick={() => {
                              setConfirmTyped("");
                              setConfirmDialog({
                                open: true,
                                title: "Kurumu Sil",
                                description: `"${inst.name}" kurumu ve bağlı tüm öğretmen, sınıf ve öğrenciler kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
                                onConfirm: () => deleteInstitution.mutate(inst.id),
                                requireTyped: true,
                              });
                            }}
                            disabled={deleteInstitution.isPending}
                            data-testid={`button-delete-institution-${inst.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Sil
                          </Button>
                        </div>
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
          {/* Deleted Classes (Soft Delete Trash) */}
          <TabsContent value="deleted-classes">
            <div className="flex items-center gap-3 mb-5">
              <Trash2 className="w-5 h-5 text-red-500" />
              <h3 className="text-xl font-extrabold">Çöp Kutusu — Silinen Sınıflar</h3>
              <Badge variant="secondary" className="ml-auto text-xs font-bold">
                {deletedClasses?.length ?? 0} sınıf
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              Bu sınıflar yumuşak silindi — tüm öğrenci verileri, puanları ve ilerleme kayıtları korunmaktadır.
              Geri yükle butonu ile sınıfı tekrar aktif hale getirebilirsiniz.
            </p>
            {deletedLoading && (
              <p className="text-muted-foreground text-center py-8 font-semibold">Yükleniyor...</p>
            )}
            {!deletedLoading && (deletedClasses ?? []).length === 0 && (
              <div className="text-center py-12" data-testid="text-no-deleted-classes">
                <Trash2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-muted-foreground font-semibold">Çöp kutusunda sınıf yok.</p>
              </div>
            )}
            {!deletedLoading && (deletedClasses ?? []).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {deletedClasses!.map(cls => (
                  <motion.div key={cls.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    <Card className="rounded-2xl border border-red-200 bg-red-50/60 shadow-sm" data-testid={`card-deleted-class-${cls.id}`}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-extrabold text-slate-800 leading-tight">{cls.name}</p>
                            {cls.branchName && (
                              <p className="text-xs text-muted-foreground font-semibold">{cls.branchName}</p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs font-extrabold tracking-widest border-red-300 text-red-700 shrink-0">
                            {cls.classCode}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p><span className="font-semibold">Öğretmen:</span> {cls.teacherName}</p>
                          <p><span className="font-semibold">Kurum:</span> {cls.institutionName ?? "—"}</p>
                          <p><span className="font-semibold">Öğrenci:</span> {cls.studentCount} kayıt</p>
                          <p><span className="font-semibold">Silinme:</span> {new Date(cls.deletedAt).toLocaleString("tr-TR")}</p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full gap-2 rounded-xl font-bold bg-green-600 hover:bg-green-700 text-white mt-1"
                          onClick={() => restoreClass.mutate(cls.id)}
                          disabled={restoreClass.isPending}
                          data-testid={`button-restore-class-${cls.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Geri Yükle
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="health">
            <HealthPanel />
          </TabsContent>

          <TabsContent value="security">
            <SecurityPanel />
          </TabsContent>

        </Tabs>
      </main>

      {/* Edit class maxStudents dialog */}
      <Dialog open={!!editClassMaxOpen} onOpenChange={open => { if (!open) setEditClassMaxOpen(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-extrabold flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Sınıf Kapasitesini Düzenle
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{editClassMaxOpen?.name}</span> sınıfı için maksimum öğrenci sayısını ayarlayın.
              Bu değeri artırdığınızda öğretmen sınıfa ek kod ekleyebilir.
            </p>
            <div>
              <label className="text-sm font-bold block mb-1">Maksimum Öğrenci</label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={newMaxStudents}
                onChange={e => setNewMaxStudents(Number(e.target.value))}
                className="rounded-xl"
                data-testid="input-max-students"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setEditClassMaxOpen(null)}>İptal</Button>
              <Button
                className="rounded-xl font-bold"
                disabled={updateClassMax.isPending || newMaxStudents < 1}
                onClick={() => editClassMaxOpen && updateClassMax.mutate({ classId: editClassMaxOpen.id, maxStudents: newMaxStudents })}
                data-testid="button-save-max-students"
              >
                {updateClassMax.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kurum Düzenleme Dialog */}
      <Dialog open={!!editingInst} onOpenChange={open => { if (!open) setEditingInst(null); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-extrabold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-600" />
              Kurumu Düzenle
            </DialogTitle>
          </DialogHeader>
          {editingInst?.isExpired && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 font-semibold">
              <CalendarClock className="w-4 h-4 flex-shrink-0" />
              Lisans süresi dolmuş. Yeni bitiş tarihi girerek kurumu etkinleştirebilirsiniz.
            </div>
          )}
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(d => editInstitution.mutate({ id: editingInst!.id, data: d }))} className="space-y-4 pt-1">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Kurum Adı</FormLabel>
                  <FormControl><Input {...field} placeholder="Güneş İlkokulu" className="rounded-xl" data-testid="input-edit-institution-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="licenseEnd" render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold">Lisans Bitiş Tarihi</FormLabel>
                  <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-edit-license-end" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="maxTeachers" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Maks. Öğretmen</FormLabel>
                    <FormControl><Input {...field} type="number" min={0} max={10000} className="rounded-xl" data-testid="input-edit-max-teachers" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="maxStudents" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-bold">Maks. Öğrenci</FormLabel>
                    <FormControl><Input {...field} type="number" min={0} max={10000000} className="rounded-xl" data-testid="input-edit-max-students" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setEditingInst(null)}>
                  İptal
                </Button>
                <Button type="submit" disabled={editInstitution.isPending} className="flex-1 rounded-xl font-bold" data-testid="button-submit-edit-institution">
                  {editInstitution.isPending ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Kurum Detay Dialog */}
      <Dialog open={detailOpen} onOpenChange={open => { setDetailOpen(open); if (!open) setSelectedInstId(null); }}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-extrabold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              {institutionDetails?.institution.name ?? "Kurum Detayı"}
            </DialogTitle>
          </DialogHeader>

          {detailsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {institutionDetails && !detailsLoading && (
            <div className="space-y-4 pt-2">
              {/* Bireysel Öğretmen Kodları */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <QrCode className="w-4 h-4" />
                    Öğretmen Kodları
                    {teacherCodeList && (
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                        {teacherCodeList.filter(c => c.teacherId).length}/{teacherCodeList.length} kullanıldı
                      </span>
                    )}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Kod veya isim ara..."
                      value={codesSearchQuery}
                      onChange={e => setCodesSearchQuery(e.target.value)}
                      className="h-8 rounded-lg text-xs w-40"
                      data-testid="input-codes-search"
                    />
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={addCodeCount}
                        onChange={e => setAddCodeCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                        className="h-8 rounded-lg text-xs w-16"
                        data-testid="input-add-code-count"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg font-bold text-xs gap-1"
                        disabled={generateMoreCodes.isPending}
                        onClick={() => selectedInstId && generateMoreCodes.mutate({ instId: selectedInstId, count: addCodeCount })}
                        data-testid="button-generate-codes"
                      >
                        <Plus className="w-3 h-3" />
                        Kod Ekle
                      </Button>
                    </div>
                  </div>
                </div>

                {codesLoading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                    {(teacherCodeList ?? [])
                      .filter(c => {
                        if (!codesSearchQuery.trim()) return true;
                        const q = codesSearchQuery.toLowerCase();
                        return c.code.toLowerCase().includes(q) || (c.teacherName ?? "").toLowerCase().includes(q);
                      })
                      .map(tc => (
                        <div
                          key={tc.id}
                          className={`rounded-xl border p-2 flex flex-col items-center gap-1.5 text-center ${tc.teacherId ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}
                          data-testid={`card-teacher-code-${tc.id}`}
                        >
                          <div className="bg-white rounded-lg p-1 shadow-sm">
                            <QRCodeSVG value={tc.code} size={60} level="M" />
                          </div>
                          <code className="text-xs font-extrabold tracking-widest text-indigo-700 block" data-testid={`text-code-${tc.id}`}>
                            {tc.code}
                          </code>
                          {tc.teacherName ? (
                            <span className="text-xs font-bold text-green-700 truncate w-full" data-testid={`text-code-teacher-${tc.id}`}>
                              {tc.teacherName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground font-semibold">Öğretmen {tc.slotNumber}</span>
                          )}
                          <button
                            className="text-indigo-400 hover:text-indigo-700 transition-colors"
                            onClick={() => { navigator.clipboard.writeText(tc.code); toast({ title: "Kod kopyalandı!" }); }}
                            data-testid={`button-copy-code-${tc.id}`}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    {(teacherCodeList ?? []).length === 0 && (
                      <p className="text-center text-muted-foreground text-xs col-span-3 py-4">Henüz kod yok.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Özet */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold mb-0.5">Lisans</p>
                  <p className="font-bold">{new Date(institutionDetails.institution.licenseStart).toLocaleDateString("tr-TR")} — {new Date(institutionDetails.institution.licenseEnd).toLocaleDateString("tr-TR")}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold mb-0.5">Durum</p>
                  <Badge variant={institutionDetails.institution.isActive ? "default" : "destructive"}>
                    {institutionDetails.institution.isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </div>
                <div className="bg-purple-50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold mb-0.5">Öğretmen Sayısı</p>
                  <p className="font-extrabold text-purple-700">{institutionDetails.teachers.length} / {(institutionDetails.institution as any).maxTeachers}</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground font-semibold mb-0.5">Toplam Öğrenci</p>
                  <p className="font-extrabold text-green-700">
                    {institutionDetails.teachers.reduce((sum, t) => sum + t.classes.reduce((s, c) => s + c.students.length, 0), 0)}
                    {" / "}{(institutionDetails.institution as any).maxStudents}
                  </p>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          setConfirmDialog((prev) => ({ ...prev, open }));
          if (!open) setConfirmTyped("");
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-extrabold text-red-600">
              {confirmDialog.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDialog.requireTyped && (
            <div className="px-1 pb-1">
              <p className="text-xs font-bold text-red-600 mb-1.5">Onaylamak için aşağıya <span className="font-black">SİL</span> yazın:</p>
              <input
                className="w-full border-2 border-red-300 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-red-500"
                placeholder="SİL"
                value={confirmTyped}
                onChange={(e) => setConfirmTyped(e.target.value)}
                data-testid="input-confirm-delete-text"
                autoFocus
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl"
              data-testid="button-confirm-cancel"
              onClick={() => setConfirmTyped("")}
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="button-confirm-delete"
              disabled={confirmDialog.requireTyped ? confirmTyped.trim().toUpperCase() !== "SİL" : false}
              onClick={() => {
                if (confirmDialog.requireTyped && confirmTyped.trim().toUpperCase() !== "SİL") return;
                confirmDialog.onConfirm();
                setConfirmDialog((prev) => ({ ...prev, open: false }));
                setConfirmTyped("");
              }}
            >
              Evet, Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
