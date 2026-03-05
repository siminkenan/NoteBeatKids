import { Switch, Route, useLocation } from "wouter";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/teacher/login" component={TeacherLogin} />
      <Route path="/teacher/dashboard" component={TeacherDashboard} />
      <Route path="/teacher/class/:classId" component={ClassDetail} />
      <Route path="/student/login" component={StudentLogin} />
      <Route path="/student/home" component={StudentHome} />
      <Route path="/student/rhythm" component={RhythmGame} />
      <Route path="/student/notes" component={NoteDetective} />
      <Route path="/student/map" component={LevelMap} />
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
