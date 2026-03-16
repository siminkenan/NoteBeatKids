import { Switch, Route, useLocation } from "wouter";
import { useState, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import AmbientSound from "@/components/ambient-sound";
import Mascot from "@/components/mascot";

// Eagerly loaded — shown immediately on first visit
import Home from "@/pages/home";
import IntroSplash from "@/components/intro-splash";
import NotFound from "@/pages/not-found";

// Lazily loaded — only fetched when the user navigates there
const TeacherLogin      = lazy(() => import("@/pages/teacher-login"));
const TeacherDashboard  = lazy(() => import("@/pages/teacher-dashboard"));
const ClassDetail       = lazy(() => import("@/pages/class-detail"));
const StudentLogin      = lazy(() => import("@/pages/student-login"));
const StudentHome       = lazy(() => import("@/pages/student-home"));
const RhythmGame        = lazy(() => import("@/pages/rhythm-game"));
const NoteDetective     = lazy(() => import("@/pages/note-detective"));
const LevelMap          = lazy(() => import("@/pages/level-map"));
const AdminLogin        = lazy(() => import("@/pages/admin-login"));
const AdminDashboard    = lazy(() => import("@/pages/admin-dashboard"));
const Metronome         = lazy(() => import("@/pages/metronome"));
const RhythmOrchestra   = lazy(() => import("@/pages/rhythm-orchestra"));
const TeacherOrchestra  = lazy(() => import("@/pages/teacher-orchestra"));
const DrumKit           = lazy(() => import("@/pages/drum-kit"));
const MelodyEcho        = lazy(() => import("@/pages/melody-echo"));

const INTRO_KEY = "notebeat_intro_v3";
const MASCOT_PATHS = ["/"];
const AMBIENT_PATHS = ["/", "/teacher"];

function useAmbientActive() {
  const [location] = useLocation();
  return AMBIENT_PATHS.some(p => location === p || location.startsWith(p + "/"));
}

function useMascotActive() {
  const [location] = useLocation();
  return MASCOT_PATHS.includes(location);
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-950 via-indigo-950 to-blue-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
        <p className="text-purple-300 text-sm font-medium animate-pulse">Yükleniyor…</p>
      </div>
    </div>
  );
}

function Router() {
  const ambientActive = useAmbientActive();
  const mascotActive = useMascotActive();
  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/teacher/login" component={TeacherLogin} />
          <Route path="/teacher/dashboard" component={TeacherDashboard} />
          <Route path="/teacher/class/:classId" component={ClassDetail} />
          <Route path="/teacher/orchestra" component={TeacherOrchestra} />
          <Route path="/student/login" component={StudentLogin} />
          <Route path="/student/home" component={StudentHome} />
          <Route path="/student/rhythm" component={RhythmGame} />
          <Route path="/student/notes" component={NoteDetective} />
          <Route path="/student/map" component={LevelMap} />
          <Route path="/student/orchestra" component={RhythmOrchestra} />
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/metronome" component={Metronome} />
          <Route path="/student/drum" component={DrumKit} />
          <Route path="/student/melody" component={MelodyEcho} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <AmbientSound active={ambientActive} />
      {mascotActive && <Mascot storeKey="mascot_pos_home" />}
    </>
  );
}

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !localStorage.getItem(INTRO_KEY);
    } catch {
      return false;
    }
  });

  const handleIntroDone = () => {
    try { localStorage.setItem(INTRO_KEY, "1"); } catch {}
    setShowIntro(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
          {showIntro && <IntroSplash onDone={handleIntroDone} />}
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
