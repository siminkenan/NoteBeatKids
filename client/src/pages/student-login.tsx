import { useState, useEffect, useRef } from "react";
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
import { ArrowLeft, QrCode, X } from "lucide-react";
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
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerInitRef = useRef(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { firstName: "", lastName: "", classCode: "" },
  });

  useEffect(() => {
    if (showScanner && !scannerInitRef.current) {
      scannerInitRef.current = true;
      import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          false
        );
        scanner.render(
          (decodedText: string) => {
            const code = decodedText.trim().toUpperCase().slice(0, 6);
            form.setValue("classCode", code);
            scanner.clear().catch(() => {});
            setShowScanner(false);
            scannerInitRef.current = false;
            scannerRef.current = null;
            toast({ title: "QR Kodu Okundu!", description: `Sınıf kodu: ${code}` });
          },
          () => {}
        );
        scannerRef.current = scanner;
      });
    }
    return () => {
      if (!showScanner && scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
        scannerInitRef.current = false;
      }
    };
  }, [showScanner]);

  const closeScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    scannerInitRef.current = false;
    setShowScanner(false);
  };

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
                      <div className="flex gap-2">
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
                        <Button
                          type="button"
                          variant="outline"
                          className="h-14 w-14 rounded-xl shrink-0 text-primary border-primary/30"
                          onClick={() => setShowScanner(true)}
                          data-testid="button-open-scanner"
                        >
                          <QrCode className="w-6 h-6" />
                        </Button>
                      </div>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground text-center">
                        6 haneli sınıf kodu için öğretmenine sor ya da QR kodu tara
                      </p>
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

      {/* QR Scanner Overlay */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.8, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 40 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">QR Kodu Tara</h3>
                  <p className="text-sm text-muted-foreground font-semibold">Kamerayı QR koduna tut</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={closeScanner}
                  data-testid="button-close-scanner"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div id="qr-reader" className="w-full rounded-2xl overflow-hidden" data-testid="qr-reader-container" />
              <p className="text-xs text-center text-muted-foreground mt-3 font-semibold">
                Kamera izni gereklidir
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
