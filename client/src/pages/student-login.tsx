import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
import { ArrowLeft } from "lucide-react";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

const loginSchema = z.object({
  firstName: z.string().min(1, "Ad gerekli"),
  lastName: z.string().min(1, "Soyad gerekli"),
  classCode: z.string().min(6, "Sınıf kodu 6 karakter olmalı").max(6).transform(v => v.toUpperCase()),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function StudentLogin() {
  const [, navigate] = useLocation();
  const { setStudent } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { firstName: "", lastName: "", classCode: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/student/login", data);
      const session = await result.json();
      setStudent(session);
      navigate("/student/home");
    } catch (e: any) {
      toast({
        title: "Giriş başarısız",
        description: e.message || "Adını ve sınıf kodunu kontrol et",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 40%, #fda085 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none select-none">
        {[...Array(6)].map((_, i) => (
          <motion.span
            key={i}
            className="absolute text-white/25 text-2xl"
            style={{ left: `${10 + i * 16}%`, top: `${15 + (i % 3) * 25}%` }}
            animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
          >
            ★
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

        <Card className="shadow-2xl border-0 rounded-3xl">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="NoteBeat Kids" className="w-20 h-20 object-contain" />
            </div>
            <CardTitle className="text-2xl font-extrabold">Öğrenci Girişi</CardTitle>
            <CardDescription className="text-base">
              Adını ve sınıf kodunu girerek oynamaya başla!
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
                          <Input
                            {...field}
                            placeholder="Ali"
                            className="rounded-xl h-12"
                            data-testid="input-first-name"
                          />
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
                  name="classCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Sınıf Kodu</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="SUN2A1"
                          className="rounded-xl h-14 text-center text-2xl font-mono font-extrabold tracking-widest uppercase"
                          maxLength={6}
                          onChange={e => field.onChange(e.target.value.toUpperCase())}
                          data-testid="input-class-code"
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground text-center">6 haneli sınıf kodu için öğretmenine sor</p>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-lg font-extrabold mt-2"
                  style={{ background: "linear-gradient(135deg, #f093fb, #f5576c)" }}
                  data-testid="button-submit-login"
                >
                  {loading ? "Katılınıyor..." : "Hadi Oynayalım!"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-muted rounded-xl text-sm text-muted-foreground">
              <p className="font-bold text-foreground mb-1">Demo için dene:</p>
              <p>Ad: <span className="font-bold text-foreground">Emma</span>, Soyad: <span className="font-bold text-foreground">Wilson</span></p>
              <p>Sınıf Kodu: <span className="font-mono font-bold text-foreground">SUN2A1</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
