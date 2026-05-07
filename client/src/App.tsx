import { Switch, Route, useLocation } from "wouter";
import { useState, useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import { useLiteMode } from "./lib/liteMode";
import AmbientSound from "@/components/ambient-sound";

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
const Leaderboard       = lazy(() => import("@/pages/leaderboard"));

// Sayfa parçalarını arka planda önceden yükler.
// Lite Mode'da (zayıf cihaz) ağır sayfalar (VexFlow içeren) atlanır;
// yalnızca hafif UI sayfaları önceden yüklenir.
function usePrefetchRoutes() {
  const isLite = useLiteMode();

  useEffect(() => {
    // Her cihazda önceden yüklenir — hafif sayfalar
    const lightPages = [
      () => import("@/pages/teacher-login"),
      () => import("@/pages/student-login"),
      () => import("@/pages/student-home"),
      () => import("@/pages/level-map"),
      () => import("@/pages/admin-login"),
    ];

    // Sadece normal cihazlarda önceden yüklenir — ağır sayfalar
    const heavyPages = [
      () => import("@/pages/teacher-dashboard"),
      () => import("@/pages/class-detail"),
      () => import("@/pages/rhythm-game"),      // VexFlow içerir
      () => import("@/pages/note-detective"),    // VexFlow içerir
      () => import("@/pages/admin-dashboard"),
      () => import("@/pages/metronome"),
      () => import("@/pages/rhythm-orchestra"),
      () => import("@/pages/teacher-orchestra"),
      () => import("@/pages/drum-kit"),
      () => import("@/pages/melody-echo"),
      () => import("@/pages/leaderboard"),
    ];

    // Hafif sayfalar: 600 ms sonra
    const t1 = setTimeout(() => {
      lightPages.forEach(fn => fn());
    }, 600);

    // Ağır sayfalar: Lite Mode'da yüklenmez; normal cihazlarda 2500 ms sonra
    const t2 = !isLite
      ? setTimeout(() => { heavyPages.forEach(fn => fn()); }, 2500)
      : null;

    return () => {
      clearTimeout(t1);
      if (t2 !== null) clearTimeout(t2);
    };
  }, [isLite]);
}

const AMBIENT_PATHS = ["/", "/teacher", "/admin"];

function useAmbientActive() {
  const [location] = useLocation();
  return AMBIENT_PATHS.some(p => location === p || location.startsWith(p + "/"));
}

// Sayfa parçası yüklenirken gösterilir — sadece çok yavaş bağlantılarda görünür
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f0c29" }}>
      <div className="w-8 h-8 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
    </div>
  );
}

function Router() {
  const ambientActive = useAmbientActive();
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
          <Route path="/leaderboard" component={Leaderboard} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
      <AmbientSound active={ambientActive} />
    </>
  );
}

function App() {
  const [showIntro, setShowIntro] = useState(true);
  usePrefetchRoutes();

  const handleIntroDone = () => {
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
