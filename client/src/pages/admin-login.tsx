import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Shield, Lock, LogIn } from "lucide-react";
import ProtectedLogo from "@/components/protected-logo";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { setAdmin } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/admin/login", {
        email: "ovalikenan46@gmail.com",
        password,
      });
      const admin = await result.json();
      // Token'ı kaydet (Render+Vercel cross-domain için)
      if (admin.token) localStorage.setItem("adminToken", admin.token);
      setAdmin(admin);
      navigate("/admin/dashboard");
    } catch (e: any) {
      toast({
        title: "Erişim reddedildi",
        description: "Şifre hatalı. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-800 to-slate-900">
      <motion.div
        className="w-full max-w-sm z-10"
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
          <CardHeader className="text-center pb-4 pt-10 px-8">
            <div className="flex justify-center mb-5">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <ProtectedLogo className="w-24 h-24 object-contain drop-shadow-2xl" />
              </motion.div>
            </div>
            <CardTitle className="text-2xl font-extrabold text-white tracking-tight">
              NoteBeat Kids
            </CardTitle>
            <CardDescription className="text-slate-400 font-semibold mt-1 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Sistem Yönetici Paneli
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8 pb-10">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="font-bold text-slate-300 text-sm block">Şifre</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="pl-10 rounded-xl h-12 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                    autoFocus
                    data-testid="input-password"
                  />
                </div>
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full h-12 rounded-xl text-base font-extrabold gap-2 mt-2"
                  style={{
                    background: loading || !password
                      ? undefined
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  }}
                  data-testid="button-submit-login"
                >
                  {loading ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Doğrulanıyor...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Giriş Yap
                    </>
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
