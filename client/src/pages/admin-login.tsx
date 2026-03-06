import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Shield, LogIn } from "lucide-react";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { setAdmin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/admin/login", {
        email: "admin@notebeatkids.com",
        password: "114344_Kenan",
      });
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
                <img
                  src={logoPath}
                  alt="NoteBeat Kids"
                  className="w-24 h-24 object-contain drop-shadow-2xl"
                />
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
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-14 rounded-2xl text-lg font-extrabold gap-3 mt-2"
                style={{
                  background: loading
                    ? undefined
                    : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                }}
                data-testid="button-submit-login"
              >
                {loading ? (
                  <>
                    <motion.div
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Yönetici Paneline Giriş
                  </>
                )}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
