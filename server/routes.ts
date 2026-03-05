import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { insertInstitutionSchema, insertClassSchema } from "@shared/schema";

function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Admin auth
  app.post("/api/auth/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const admin = await storage.getAdminByEmail(email);
      if (!admin) return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      (req.session as any).adminId = admin.id;
      res.json({ id: admin.id, name: admin.name, email: admin.email, role: "admin" });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/admin/logout", (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/admin/me", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const admin = await storage.getAdminByEmail("admin@notebeatkids.com");
    if (!admin) return res.status(401).json({ message: "Not found" });
    res.json({ id: admin.id, name: admin.name, email: admin.email, role: "admin" });
  });

  // Teacher auth
  app.post("/api/auth/teacher/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const teacher = await storage.getTeacherByEmail(email);
      if (!teacher) return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, teacher.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      (req.session as any).teacherId = teacher.id;
      const { password: _, ...safeTeacher } = teacher;
      res.json({ ...safeTeacher, role: "teacher" });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/teacher/logout", (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/teacher/me", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const teacher = await storage.getTeacher(teacherId);
    if (!teacher) return res.status(401).json({ message: "Not found" });
    const { password: _, ...safeTeacher } = teacher;
    res.json({ ...safeTeacher, role: "teacher" });
  });

  // Student login (no session, stored client-side)
  app.post("/api/auth/student/login", async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, classCode } = req.body;
      const cls = await storage.getClassByCode(classCode);
      if (!cls) return res.status(404).json({ message: "Class not found. Check the code." });
      if (cls.expiresAt && new Date(cls.expiresAt) < new Date()) {
        return res.status(403).json({ message: "This class has expired." });
      }
      let student = await storage.findStudent(cls.id, firstName, lastName);
      if (!student) {
        const studentCount = (await storage.getStudentsByClass(cls.id)).length;
        if (studentCount >= cls.maxStudents) {
          return res.status(403).json({ message: "This class is full." });
        }
        student = await storage.createStudent({ classId: cls.id, firstName, lastName });
      }
      res.json({ student, class: { id: cls.id, name: cls.name, classCode: cls.classCode } });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Student progress
  app.get("/api/student/:studentId/progress", async (req: Request, res: Response) => {
    const progress = await storage.getProgressByStudent(req.params.studentId);
    res.json(progress);
  });

  app.post("/api/student/:studentId/progress", async (req: Request, res: Response) => {
    try {
      const { appType, ...data } = req.body;
      const progress = await storage.upsertProgress(req.params.studentId, appType, data);
      res.json(progress);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Teacher classes
  app.get("/api/teacher/classes", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const classList = await storage.getClassesByTeacher(teacherId);
    res.json(classList);
  });

  app.post("/api/teacher/classes", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const parsed = insertClassSchema.parse({ ...req.body, teacherId });
      let classCode = generateClassCode();
      let attempts = 0;
      while (await storage.getClassByCode(classCode) && attempts < 10) {
        classCode = generateClassCode();
        attempts++;
      }
      const cls = await storage.createClass({ ...parsed, classCode });
      res.json(cls);
    } catch (e: any) {
      res.status(400).json({ message: e.message ?? "Invalid data" });
    }
  });

  app.delete("/api/teacher/classes/:classId", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const cls = await storage.getClass(req.params.classId);
    if (!cls || cls.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });
    await storage.deleteClass(req.params.classId);
    res.json({ ok: true });
  });

  app.get("/api/teacher/classes/:classId/students", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const cls = await storage.getClass(req.params.classId);
    if (!cls || cls.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });
    const data = await storage.getClassProgress(req.params.classId);
    res.json({ class: cls, students: data });
  });

  // Admin routes
  app.get("/api/admin/stats", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  app.get("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getInstitutions();
    res.json(list);
  });

  app.post("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const parsed = insertInstitutionSchema.parse(req.body);
      const inst = await storage.createInstitution(parsed);
      res.json(inst);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/institutions/:id", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.updateInstitution(req.params.id, req.body);
    res.json(inst);
  });

  app.get("/api/admin/teachers", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getTeachers();
    res.json(list.map(({ password: _, ...t }) => t));
  });

  app.post("/api/admin/teachers", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const teacher = await storage.createTeacher(req.body);
      const { password: _, ...safe } = teacher;
      res.json(safe);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Class public info (for students to verify)
  app.get("/api/class/:code", async (req: Request, res: Response) => {
    const cls = await storage.getClassByCode(req.params.code);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json({ id: cls.id, name: cls.name, classCode: cls.classCode });
  });

  return httpServer;
}
