import { Switch, Route, useLocation } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./lib/auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import TeacherLogin from "@/pages/teacher-login";
import TeacherDashboard from "@/pages/teacher-dashboard";
import ClassDetail from "@/pages/class-detail";
import StudentLogin from "@/pages/student-login";
import StudentHome from "@/pages/student-home";
import RhythmGame from "@/pages/rhythm-game";
import NoteDetective from "@/pages/note-detective";
import LevelMap from "@/pages/level-map";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import Metronome from "@/pages/metronome";
import RhythmOrchestra from "@/pages/rhythm-orchestra";
import TeacherOrchestra from "@/pages/teacher-orchestra";
import DrumKit from "@/pages/drum-kit";
import AmbientSound from "@/components/ambient-sound";
import MelodyEcho from "@/pages/melody-echo";
import IntroSplash from "@/components/intro-splash";

const INTRO_KEY = "notebeat_intro_v3";

// Pages where ambient background sound should be active
// Student section excluded — ambient sound conflicts with educational game audio
const AMBIENT_PATHS = ["/", "/teacher"];
function useAmbientActive() {
  const [location] = useLocation();
  return AMBIENT_PATHS.some(p => location === p || location.startsWith(p + "/"));
}

function Router() {
  const ambientActive = useAmbientActive();
  return (
    <>
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
      <AmbientSound active={ambientActive} />
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
