import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, User, Hash, Building2 } from "lucide-react";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";
import { useQuery } from "@tanstack/react-query";

const loginSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  teacherCode: z.string().min(6, "Kurum kodu en az 6 karakter").toUpperCase(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function TeacherLogin() {
  const [, navigate] = useLocation();
  const { setTeacher } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [codePreview, setCodePreview] = useState("");

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

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/teacher/login", {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        teacherCode: data.teacherCode.trim().toUpperCase(),
      });
      const teacher = await result.json();
      setTeacher(teacher);
      navigate("/teacher/dashboard");
    } catch (e: any) {
      toast({
        title: "Giriş başarısız",
        description: e.message || "Bilgilerinizi kontrol edin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="NoteBeat Kids" className="w-20 h-20 object-contain" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-foreground">Öğretmen Girişi</CardTitle>
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
                      <FormLabel className="font-bold">Kurum Kodu</FormLabel>
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
