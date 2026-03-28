import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, User, Hash, Building2, LogIn, UserCircle2, X } from "lucide-react";
import ProtectedLogo from "@/components/protected-logo";
import { useQuery } from "@tanstack/react-query";

const STORAGE_KEY = "notebeat_teacher_saved";

type SavedTeacher = { firstName: string; lastName: string; teacherCode: string };

const loginSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  teacherCode: z.string().min(6, "Kurum kodu en az 6 karakter").toUpperCase(),
});

type LoginForm = z.infer<typeof loginSchema>;

function getInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default function TeacherLogin() {
  const [, navigate] = useLocation();
  const { setTeacher } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedTeacher, setSavedTeacher] = useState<SavedTeacher | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: SavedTeacher = JSON.parse(raw);
        if (data.firstName && data.lastName && data.teacherCode) {
          setSavedTeacher(data);
          setRememberMe(true);
          form.reset({ firstName: data.firstName, lastName: data.lastName, teacherCode: data.teacherCode });
        }
      }
    } catch {}
  }, []);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { firstName: "", lastName: "", teacherCode: "" },
  });

  const watchedCode = form.watch("teacherCode");
  const previewCode = watchedCode?.trim().toUpperCase();

  const { data: instPreview } = useQuery<{ id: string; name: string; isActive: boolean } | null>({
    queryKey: ["/api/institution/by-teacher-code", previewCode],
    enabled: previewCode?.length >= 6,
    retry: false,
  });

  const doLogin = async (firstName: string, lastName: string, teacherCode: string, remember: boolean) => {
    const result = await apiRequest("POST", "/api/auth/teacher/login", {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      teacherCode: teacherCode.trim().toUpperCase(),
    });
    const teacher = await result.json();
    if (teacher.teacherToken) {
      localStorage.setItem("teacherToken", teacher.teacherToken);
    }
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), teacherCode: teacherCode.trim().toUpperCase() }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setTeacher(teacher);
    navigate("/teacher/dashboard");
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await doLogin(data.firstName, data.lastName, data.teacherCode, rememberMe);
    } catch (e: any) {
      toast({ title: "Giriş başarısız", description: e.message || "Bilgilerinizi kontrol edin", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onQuickLogin = async () => {
    if (!savedTeacher) return;
    setQuickLoading(true);
    try {
      await doLogin(savedTeacher.firstName, savedTeacher.lastName, savedTeacher.teacherCode, true);
    } catch (e: any) {
      toast({ title: "Giriş başarısız", description: e.message || "Kayıtlı bilgilerle giriş yapılamadı.", variant: "destructive" });
    } finally {
      setQuickLoading(false);
    }
  };

  const removeSaved = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedTeacher(null);
    setRememberMe(false);
    form.reset({ firstName: "", lastName: "", teacherCode: "" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #667eea 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none select-none">
        {["♩", "♪", "♫", "♬"].map((note, i) => (
          <motion.span
            key={i}
            className="absolute text-white/20 font-bold text-4xl"
            style={{ left: `${15 + i * 22}%`, top: `${10 + i * 20}%` }}
            animate={{ y: [0, -20, 0] }}
            transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}
          >
            {note}
          </motion.span>
        ))}
      </div>

      <motion.div
        className="w-full max-w-md z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-white/80 mb-6 cursor-pointer font-bold"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana Sayfaya Dön
        </button>

        {/* Quick Login Card */}
        <AnimatePresence>
          {savedTeacher && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.95 }}
              transition={{ duration: 0.35 }}
              className="mb-4"
            >
              <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl p-4 flex items-center gap-4 shadow-lg">
                <div className="w-12 h-12 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <span className="text-white font-extrabold text-lg">
                    {getInitials(savedTeacher.firstName, savedTeacher.lastName)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Kayıtlı Hesap</p>
                  <p className="text-white font-extrabold text-base truncate">
                    {savedTeacher.firstName} {savedTeacher.lastName}
                  </p>
                  <p className="text-white/60 text-xs font-mono tracking-widest">{savedTeacher.teacherCode}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={onQuickLogin}
                    disabled={quickLoading}
                    className="flex items-center gap-1.5 bg-white text-indigo-700 hover:bg-indigo-50 font-extrabold text-sm px-4 py-2 rounded-xl shadow transition-colors disabled:opacity-60"
                    data-testid="button-quick-login"
                  >
                    {quickLoading ? (
                      <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    Giriş Yap
                  </button>
                  <button
                    onClick={removeSaved}
                    className="text-white/60 hover:text-white transition-colors"
                    data-testid="button-remove-saved"
                    title="Kayıtlı hesabı sil"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <ProtectedLogo className="h-8 w-auto object-contain" />
              <CardTitle className="text-2xl font-extrabold text-foreground">Öğretmen Girişi</CardTitle>
            </div>
            <CardDescription className="text-base text-muted-foreground">
              Adınızı ve kurumunuzun kodunu girin
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">Ad</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              {...field}
                              placeholder="Ayşe"
                              className="pl-9 rounded-xl h-12"
                              data-testid="input-first-name"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-bold">Soyad</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="Yılmaz"
                            className="rounded-xl h-12"
                            data-testid="input-last-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="teacherCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Öğretmen Kodu</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            placeholder="ABCD1234"
                            className="pl-9 rounded-xl h-12 font-mono tracking-widest uppercase"
                            onChange={e => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-teacher-code"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {previewCode && previewCode.length >= 6 && instPreview && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200"
                    data-testid="preview-institution"
                  >
                    <Building2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-green-700">Kurum bulundu</p>
                      <p className="text-sm font-extrabold text-green-800">{instPreview.name}</p>
                    </div>
                  </motion.div>
                )}

                {/* Remember Me */}
                <div className="flex items-center gap-3 pt-1">
                  <Checkbox
                    id="rememberMe"
                    checked={rememberMe}
                    onCheckedChange={v => setRememberMe(!!v)}
                    data-testid="checkbox-remember-me"
                    className="rounded-md"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm font-semibold text-muted-foreground cursor-pointer select-none flex items-center gap-1.5"
                  >
                    <UserCircle2 className="w-4 h-4" />
                    Beni hatırla
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-lg font-extrabold mt-2"
                  data-testid="button-submit-login"
                >
                  {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
                </Button>
              </form>
            </Form>

            <div className="mt-5 p-3 bg-blue-50 rounded-xl text-sm">
              <p className="font-bold text-blue-800 mb-1">Nasıl giriş yapılır?</p>
              <p className="text-blue-700 text-xs">Kurum kodunuzu yöneticinizden alın (QR kod veya yazılı olarak). Adınız ve soyadınızla birlikte girin.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
