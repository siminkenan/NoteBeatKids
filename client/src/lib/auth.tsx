import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface TeacherUser {
  id: string;
  name: string;
  email: string;
  institutionId: string | null;
  role: "teacher";
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "admin";
}

interface StudentSession {
  student: { id: string; firstName: string; lastName: string; classId: string; createdAt: string };
  class: { id: string; name: string; classCode: string };
}

interface AuthContextType {
  teacher: TeacherUser | null;
  admin: AdminUser | null;
  student: StudentSession | null;
  setTeacher: (t: TeacherUser | null) => void;
  setAdmin: (a: AdminUser | null) => void;
  setStudent: (s: StudentSession | null) => void;
  logoutTeacher: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  logoutStudent: () => void;
  studentLoading: boolean;
  authLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STUDENT_KEY = "notebeat_student_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacherState] = useState<TeacherUser | null>(null);
  const [admin, setAdminState] = useState<AdminUser | null>(null);
  const [student, setStudentState] = useState<StudentSession | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 1. Restore student from localStorage immediately
    const stored = localStorage.getItem(STUDENT_KEY);
    if (stored) {
      try {
        setStudentState(JSON.parse(stored));
      } catch {}
    }
    setStudentLoading(false);

    // 2. Try to restore teacher/admin session from server
    async function restoreSession() {
      try {
        // Try teacher first
        const tRes = await fetch(`${API_BASE}/api/auth/teacher/me`, {
          credentials: "include",
        });
        if (tRes.ok) {
          const t = await tRes.json();
          setTeacherState(t);
          setAuthLoading(false);
          return;
        }
      } catch {}

      try {
        // Try admin
        const aRes = await fetch(`${API_BASE}/api/auth/admin/me`, {
          credentials: "include",
        });
        if (aRes.ok) {
          const a = await aRes.json();
          setAdminState(a);
        }
      } catch {}

      setAuthLoading(false);
    }

    restoreSession();
  }, []);

  const setTeacher = (t: TeacherUser | null) => {
    setTeacherState(t);
  };

  const setAdmin = (a: AdminUser | null) => {
    setAdminState(a);
  };

  const setStudent = (s: StudentSession | null) => {
    if (s) {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(STUDENT_KEY);
    }
    setStudentState(s);
  };

  const logoutTeacher = async () => {
    await fetch(`${API_BASE}/api/auth/teacher/logout`, { method: "POST", credentials: "include" });
    setTeacherState(null);
  };

  const logoutAdmin = async () => {
    await fetch(`${API_BASE}/api/auth/admin/logout`, { method: "POST", credentials: "include" });
    setAdminState(null);
  };

  const logoutStudent = () => {
    setStudent(null);
  };

  return (
    <AuthContext.Provider value={{
      teacher, admin, student,
      setTeacher, setAdmin, setStudent,
      logoutTeacher, logoutAdmin, logoutStudent,
      studentLoading,
      authLoading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
