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
import { Music, ArrowLeft, Lock, Mail } from "lucide-react";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function TeacherLogin() {
  const [, navigate] = useLocation();
  const { setTeacher } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const result = await apiRequest("POST", "/api/auth/teacher/login", data);
      const teacher = await result.json();
      setTeacher(teacher);
      navigate("/teacher/dashboard");
    } catch (e: any) {
      toast({
        title: "Login failed",
        description: e.message || "Invalid email or password",
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
      {/* Floating music notes */}
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
          Back to Home
        </button>

        <Card className="shadow-2xl border-0 rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2 pt-8 px-8">
            <div className="flex justify-center mb-4">
              <img src={logoPath} alt="NoteBeat Kids" className="w-20 h-20 object-contain" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-foreground">Teacher Login</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Sign in to manage your classes
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
                      <FormLabel className="font-bold">Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="email"
                            placeholder="teacher@school.edu"
                            className="pl-10 rounded-xl h-12"
                            data-testid="input-email"
                          />
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
                      <FormLabel className="font-bold">Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            {...field}
                            type="password"
                            placeholder="••••••••"
                            className="pl-10 rounded-xl h-12"
                            data-testid="input-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-lg font-extrabold mt-2"
                  data-testid="button-submit-login"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-muted rounded-xl text-sm text-muted-foreground">
              <p className="font-bold text-foreground mb-1">Demo credentials:</p>
              <p>Email: <span className="font-mono text-foreground">sarah@sunshine.edu</span></p>
              <p>Password: <span className="font-mono text-foreground">teacher123</span></p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
