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
import { ArrowLeft, Lock, Mail, Shield } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre gerekli"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { setAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/admin/login", data);
      const admin = await result.json();
      setAdmin(admin);
      navigate("/admin/dashboard");
    } catch (e: any) {
      toast({
        title: "Erişim reddedildi",
        description: e.message || "Geçersiz kimlik bilgileri",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
      <motion.div
        className="w-full max-w-md z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-slate-400 mb-6 cursor-pointer font-bold"
          data-testid="button-back-home"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana Sayfaya Dön
        </button>

        <Card className="shadow-2xl border-slate-700 rounded-3xl bg-slate-800">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-extrabold text-white">Sistem Yöneticisi</CardTitle>
            <CardDescription className="text-slate-400">
              Kısıtlı erişim — yalnızca yetkili personel
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-slate-300">E-posta</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input {...field} type="email" placeholder="admin@notebeatkids.com" className="pl-10 rounded-xl h-12 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" data-testid="input-email" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold text-slate-300">Şifre</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <Input {...field} type="password" placeholder="••••••••" className="pl-10 rounded-xl h-12 bg-slate-700 border-slate-600 text-white" data-testid="input-password" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-lg font-extrabold mt-2" data-testid="button-submit-login">
                  {loading ? "Doğrulanıyor..." : "Yönetici Paneline Gir"}
                </Button>
              </form>
            </Form>

            <div className="mt-4 p-4 bg-slate-700/50 rounded-xl text-sm text-slate-400">
              <p className="font-bold text-slate-300 mb-1">Demo bilgileri:</p>
              <p>E-posta: <span className="font-mono text-slate-200">admin@notebeatkids.com</span></p>
              <p>Şifre: <span className="font-mono text-slate-200">admin123</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
