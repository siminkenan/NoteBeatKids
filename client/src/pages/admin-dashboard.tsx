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
  name: z.string().min(1, "Institution name is required"),
  licenseStart: z.string().min(1, "Start date required"),
  licenseEnd: z.string().min(1, "End date required"),
});
type InstitutionForm = z.infer<typeof institutionSchema>;

const teacherSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(6, "Min 6 characters"),
  institutionId: z.string().optional(),
});
type TeacherForm = z.infer<typeof teacherSchema>;

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
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
    defaultValues: { name: "", licenseStart: "", licenseEnd: "" },
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
      toast({ title: "Institution created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
      toast({ title: "Teacher created!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleInstitution = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/institutions/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/institutions"] });
      toast({ title: "Updated!" });
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
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="NoteBeat Kids" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="font-extrabold text-base leading-tight">NoteBeat Kids</h1>
              <p className="text-slate-400 text-xs font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Admin Panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-slate-300 text-sm font-semibold hidden sm:block">{admin?.name}</p>
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 rounded-xl bg-transparent border-slate-600 text-slate-300" data-testid="button-logout">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Institutions", value: stats?.institutionCount ?? 0, icon: <Building2 className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Teachers", value: stats?.teacherCount ?? 0, icon: <Users className="w-5 h-5" />, color: "text-purple-600", bg: "bg-purple-50" },
            { label: "Students", value: stats?.studentCount ?? 0, icon: <BookOpen className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-50" },
            { label: "Exercises Done", value: stats?.totalExercisesCompleted ?? 0, icon: <CheckCircle className="w-5 h-5" />, color: "text-orange-600", bg: "bg-orange-50" },
            { label: "Total Time", value: formatTime(stats?.totalTimeSpentSeconds ?? 0), icon: <Clock className="w-5 h-5" />, color: "text-teal-600", bg: "bg-teal-50" },
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
            <TabsTrigger value="institutions" className="rounded-lg font-bold">Institutions</TabsTrigger>
            <TabsTrigger value="teachers" className="rounded-lg font-bold">Teachers</TabsTrigger>
          </TabsList>

          <TabsContent value="institutions">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-extrabold">Institutions</h3>
              <Dialog open={instDialogOpen} onOpenChange={setInstDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl font-bold" data-testid="button-create-institution">
                    <Plus className="w-4 h-4" />
                    Add Institution
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold">Add Institution</DialogTitle>
                  </DialogHeader>
                  <Form {...instForm}>
                    <form onSubmit={instForm.handleSubmit(d => createInstitution.mutate(d))} className="space-y-4 pt-2">
                      <FormField control={instForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Institution Name</FormLabel>
                          <FormControl><Input {...field} placeholder="Sunshine Elementary School" className="rounded-xl" data-testid="input-institution-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField control={instForm.control} name="licenseStart" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">License Start</FormLabel>
                            <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-license-start" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={instForm.control} name="licenseEnd" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="font-bold">License End</FormLabel>
                            <FormControl><Input {...field} type="date" className="rounded-xl" data-testid="input-license-end" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" disabled={createInstitution.isPending} className="w-full rounded-xl font-bold" data-testid="button-submit-institution">
                        {createInstitution.isPending ? "Creating..." : "Create Institution"}
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
                            {active ? "Active" : expired ? "Expired" : "Inactive"}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-extrabold mt-2">{inst.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 pt-0">
                        <div className="text-sm text-muted-foreground font-semibold">
                          <p>Start: {new Date(inst.licenseStart).toLocaleDateString()}</p>
                          <p>End: {new Date(inst.licenseEnd).toLocaleDateString()}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`w-full rounded-xl font-bold gap-2 ${active ? "text-red-500" : "text-green-600"}`}
                          onClick={() => toggleInstitution.mutate({ id: inst.id, isActive: !inst.isActive })}
                          data-testid={`button-toggle-institution-${inst.id}`}
                        >
                          {active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          {active ? "Deactivate" : "Activate"}
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
              <h3 className="text-xl font-extrabold">Teachers</h3>
              <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 rounded-xl font-bold" data-testid="button-create-teacher">
                    <Plus className="w-4 h-4" />
                    Add Teacher
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-extrabold">Add Teacher</DialogTitle>
                  </DialogHeader>
                  <Form {...teacherForm}>
                    <form onSubmit={teacherForm.handleSubmit(d => createTeacher.mutate(d))} className="space-y-4 pt-2">
                      <FormField control={teacherForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Full Name</FormLabel>
                          <FormControl><Input {...field} placeholder="Ms. Sarah Johnson" className="rounded-xl" data-testid="input-teacher-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="email" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Email</FormLabel>
                          <FormControl><Input {...field} type="email" placeholder="teacher@school.edu" className="rounded-xl" data-testid="input-teacher-email" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Password</FormLabel>
                          <FormControl><Input {...field} type="password" placeholder="Min 6 characters" className="rounded-xl" data-testid="input-teacher-password" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={teacherForm.control} name="institutionId" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="font-bold">Institution (optional)</FormLabel>
                          <FormControl>
                            <select {...field} className="w-full h-10 rounded-xl border border-input px-3 text-sm font-semibold bg-background" data-testid="select-institution">
                              <option value="">No institution</option>
                              {institutions?.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" disabled={createTeacher.isPending} className="w-full rounded-xl font-bold" data-testid="button-submit-teacher">
                        {createTeacher.isPending ? "Creating..." : "Create Teacher"}
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
                        {teacher.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-foreground truncate">{teacher.name}</p>
                        <p className="text-xs text-muted-foreground font-semibold truncate">{teacher.email}</p>
                        {teacher.institutionId && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {institutions?.find(i => i.id === teacher.institutionId)?.name ?? "Institution"}
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
