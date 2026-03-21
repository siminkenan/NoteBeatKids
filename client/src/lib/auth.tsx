import { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
}

const AuthContext = createContext<AuthContextType | null>(null);

const STUDENT_KEY = "notebeat_student_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<TeacherUser | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [student, setStudentState] = useState<StudentSession | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STUDENT_KEY);
    if (stored) {
      try {
        setStudentState(JSON.parse(stored));
      } catch {}
    }
    setStudentLoading(false);
  }, []);

  const setStudent = (s: StudentSession | null) => {
    if (s) {
      localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
    } else {
      localStorage.removeItem(STUDENT_KEY);
    }
    setStudentState(s);
  };

  const logoutTeacher = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/teacher/logout`, { method: "POST", credentials: "include" });
    setTeacher(null);
  };

  const logoutAdmin = async () => {
    await fetch(`${import.meta.env.VITE_API_URL}/api/auth/admin/logout`, { method: "POST", credentials: "include" });
    setAdmin(null);
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