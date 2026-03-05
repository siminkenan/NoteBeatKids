import { useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Star, Clock, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Student, StudentProgress } from "@shared/schema";
import logoPath from "@assets/WhatsApp_Image_2026-03-01_at_10.45.20-removebg-preview_(1)_1772727577713.png";

type StudentWithProgress = Student & {
  rhythmProgress?: StudentProgress;
  notesProgress?: StudentProgress;
};

type ClassDetailData = {
  class: { id: string; name: string; classCode: string; maxStudents: number };
  students: StudentWithProgress[];
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function accuracy(correct: number, wrong: number) {
  const total = correct + wrong;
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export default function ClassDetail() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/teacher/class/:classId");
  const { teacher, setTeacher } = useAuth();
  const classId = params?.classId;

  useEffect(() => {
    if (!teacher) {
      fetch("/api/auth/teacher/me")
        .then(r => r.ok ? r.json() : null)
        .then(t => { if (t) setTeacher(t); else navigate("/teacher/login"); });
    }
  }, []);

  const { data, isLoading } = useQuery<ClassDetailData>({
    queryKey: ["/api/teacher/classes", classId, "students"],
    queryFn: async () => {
      const res = await fetch(`/api/teacher/classes/${classId}/students`);
      return res.json();
    },
    enabled: !!classId && !!teacher,
  });

  const chartData = data?.students.map(s => ({
    name: s.firstName,
    rhythmAccuracy: accuracy(s.rhythmProgress?.correctAnswers ?? 0, s.rhythmProgress?.wrongAnswers ?? 0),
    notesAccuracy: accuracy(s.notesProgress?.correctAnswers ?? 0, s.notesProgress?.wrongAnswers ?? 0),
  })) ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/teacher/dashboard")} className="rounded-xl gap-1.5" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="NoteBeat Kids" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="font-extrabold text-base text-foreground">{data?.class?.name ?? "Loading..."}</h1>
              <p className="text-xs text-muted-foreground font-semibold">Code: <span className="font-mono font-extrabold text-primary">{data?.class?.classCode}</span></p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Students", value: data?.students.length ?? 0, color: "text-blue-500", bg: "bg-blue-50", icon: "👥" },
                { label: "Avg Rhythm %", value: `${Math.round(chartData.reduce((a, c) => a + c.rhythmAccuracy, 0) / (chartData.length || 1))}%`, color: "text-orange-500", bg: "bg-orange-50", icon: "🥁" },
                { label: "Avg Notes %", value: `${Math.round(chartData.reduce((a, c) => a + c.notesAccuracy, 0) / (chartData.length || 1))}%`, color: "text-purple-500", bg: "bg-purple-50", icon: "🎵" },
                { label: "Total Stars", value: data?.students.reduce((a, s) => a + (s.rhythmProgress?.starsEarned ?? 0) + (s.notesProgress?.starsEarned ?? 0), 0) ?? 0, color: "text-yellow-500", bg: "bg-yellow-50", icon: "⭐" },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4 text-center">
                      <div className={`${stat.bg} rounded-xl py-2 px-3 mb-2 inline-block`}>
                        <span className="text-2xl">{stat.icon}</span>
                      </div>
                      <div className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-muted-foreground font-semibold">{stat.label}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <Card className="rounded-2xl mb-6">
                <CardHeader><CardTitle className="font-extrabold">Student Accuracy Overview</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: "bold" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="rhythmAccuracy" fill="#f97316" name="Rhythm" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="notesAccuracy" fill="#8b5cf6" name="Notes" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Student list */}
            <h3 className="text-xl font-extrabold mb-4">Student Progress</h3>
            {data?.students.length === 0 ? (
              <Card className="rounded-2xl"><CardContent className="py-12 text-center text-muted-foreground font-semibold">No students in this class yet. Share the class code!</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {data?.students.map((student, i) => {
                  const rAcc = accuracy(student.rhythmProgress?.correctAnswers ?? 0, student.rhythmProgress?.wrongAnswers ?? 0);
                  const nAcc = accuracy(student.notesProgress?.correctAnswers ?? 0, student.notesProgress?.wrongAnswers ?? 0);
                  return (
                    <motion.div key={student.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                      <Card className="rounded-2xl" data-testid={`card-student-${student.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-xl font-extrabold text-primary">
                                {student.firstName[0]}{student.lastName[0]}
                              </div>
                              <div>
                                <p className="font-extrabold text-foreground">{student.firstName} {student.lastName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                  <span className="text-xs font-bold text-muted-foreground">{(student.rhythmProgress?.starsEarned ?? 0) + (student.notesProgress?.starsEarned ?? 0)} stars total</span>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-orange-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-orange-500 mb-1">Rhythm</p>
                                <p className="font-extrabold text-orange-600">Lvl {student.rhythmProgress?.level ?? 1}</p>
                                <p className="text-xs text-muted-foreground font-semibold">{rAcc}% accuracy</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-xs font-bold text-green-600">{student.rhythmProgress?.correctAnswers ?? 0}</span>
                                  <XCircle className="w-3 h-3 text-red-500" />
                                  <span className="text-xs font-bold text-red-500">{student.rhythmProgress?.wrongAnswers ?? 0}</span>
                                </div>
                              </div>
                              <div className="bg-purple-50 rounded-xl p-3 text-center">
                                <p className="text-xs font-bold text-purple-500 mb-1">Notes</p>
                                <p className="font-extrabold text-purple-600">Lvl {student.notesProgress?.level ?? 1}</p>
                                <p className="text-xs text-muted-foreground font-semibold">{nAcc}% accuracy</p>
                                <div className="flex items-center justify-center gap-1.5 mt-1">
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                  <span className="text-xs font-bold text-green-600">{student.notesProgress?.correctAnswers ?? 0}</span>
                                  <XCircle className="w-3 h-3 text-red-500" />
                                  <span className="text-xs font-bold text-red-500">{student.notesProgress?.wrongAnswers ?? 0}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-center">
                              <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                              <p className="text-xs font-bold text-muted-foreground">
                                {formatTime((student.rhythmProgress?.timeSpentSeconds ?? 0) + (student.notesProgress?.timeSpentSeconds ?? 0))}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
