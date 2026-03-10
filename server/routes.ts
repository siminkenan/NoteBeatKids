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

  // Teacher auth — ad + soyad + kurum kodu
  app.post("/api/auth/teacher/login", async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, teacherCode } = req.body;
      if (!firstName?.trim() || !lastName?.trim() || !teacherCode?.trim()) {
        return res.status(400).json({ message: "Ad, soyad ve öğretmen kodu gereklidir." });
      }
      const codeRecord = await storage.findTeacherCodeByValue(teacherCode.trim().toUpperCase());
      if (!codeRecord) return res.status(404).json({ message: "Geçersiz kod. Yöneticinizden aldığınız kodu kontrol edin." });

      const institution = await storage.getInstitution(codeRecord.institutionId);
      if (!institution) return res.status(404).json({ message: "Kurum bulunamadı." });
      if (new Date(institution.licenseEnd) < new Date()) return res.status(403).json({ message: "Kurumun abonelik süresi dolmuş. Yöneticinizle iletişime geçin." });

      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      if (codeRecord.teacherId) {
        // Code is already linked — verify name matches
        const existingTeacher = await storage.getTeacher(codeRecord.teacherId);
        if (!existingTeacher) return res.status(500).json({ message: "Öğretmen kaydı bulunamadı." });
        if (existingTeacher.name.toLowerCase() !== fullName.toLowerCase()) {
          return res.status(403).json({ message: `Bu kod "${existingTeacher.name}" adına kayıtlıdır. Lütfen kayıt sırasında girdiğiniz adı kullanın.` });
        }
        (req.session as any).teacherId = existingTeacher.id;
        const { password: _, ...safe } = existingTeacher;
        return res.json({ ...safe, role: "teacher" });
      }

      // Code is unused — register new teacher
      const teacher = await storage.createTeacherByCode({ name: fullName, institutionId: institution.id });
      await storage.linkTeacherToCode(codeRecord.id, teacher.id);
      (req.session as any).teacherId = teacher.id;
      const { password: _, ...safeTeacher } = teacher;
      res.json({ ...safeTeacher, role: "teacher" });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Public endpoint to verify an individual teacher code
  app.get("/api/institution/by-teacher-code/:code", async (req: Request, res: Response) => {
    const codeRecord = await storage.findTeacherCodeByValue(req.params.code.toUpperCase());
    if (!codeRecord) return res.status(404).json({ message: "Geçersiz kod" });
    const inst = await storage.getInstitution(codeRecord.institutionId);
    if (!inst) return res.status(404).json({ message: "Kurum bulunamadı" });
    const status = codeRecord.teacherId ? "used" : "available";
    res.json({ id: inst.id, name: inst.name, isActive: inst.isActive, codeStatus: status });
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
      const { firstName, lastName, classCode, studentCode } = req.body;

      let cls: Awaited<ReturnType<typeof storage.getClassByCode>> | undefined;

      let resolvedStudentCode: string | null = null;

      if (studentCode) {
        // Individual student code flow
        const codeRecord = await storage.findStudentCodeByValue(studentCode.trim().toUpperCase());
        if (!codeRecord) return res.status(404).json({ message: "Geçersiz öğrenci kodu. Öğretmeninizden aldığınız kodu kontrol edin." });
        cls = await storage.getClass(codeRecord.classId);
        resolvedStudentCode = codeRecord.code;
      } else {
        // Legacy class code flow
        cls = await storage.getClassByCode(classCode);
      }

      if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı. Kodu kontrol edin." });
      if (cls.expiresAt && new Date(cls.expiresAt) < new Date()) {
        return res.status(403).json({ message: "Bu sınıfın süresi dolmuş." });
      }
      let student = await storage.findStudent(cls.id, firstName, lastName);
      if (!student) {
        const studentCount = (await storage.getStudentsByClass(cls.id)).length;
        if (studentCount >= cls.maxStudents) {
          return res.status(403).json({ message: "Sınıf kapasitesi dolu." });
        }
        student = await storage.createStudent({ classId: cls.id, firstName, lastName });
      }
      // Link individual code to student (idempotent)
      if (resolvedStudentCode) {
        await storage.linkStudentToStudentCode(resolvedStudentCode, student.id);
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
      const body = {
        ...req.body,
        teacherId,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      };
      const parsed = insertClassSchema.parse(body);
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

  app.get("/api/teacher/classes/:classId/student-codes", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const cls = await storage.getClass(req.params.classId);
    if (!cls || cls.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });
    const codes = await storage.getStudentCodesByClass(req.params.classId);
    res.json({ class: cls, codes });
  });

  app.post("/api/teacher/classes/:classId/student-codes/generate", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const cls = await storage.getClass(req.params.classId);
    if (!cls || cls.teacherId !== teacherId) return res.status(403).json({ message: "Forbidden" });
    const existing = await storage.getStudentCodesByClass(req.params.classId);
    if (existing.length > 0) return res.json({ class: cls, codes: existing });
    const count = Math.min(cls.maxStudents, 200);
    const codes = await storage.generateStudentCodesForClass(req.params.classId, count);
    res.json({ class: cls, codes });
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

  // Helper: isActive is determined solely by licenseEnd date
  const computeInstitutionActive = (inst: { licenseEnd: Date | string }) =>
    new Date(inst.licenseEnd) >= new Date();

  app.get("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getInstitutions();
    // Auto-sync isActive based on licenseEnd and return computed value
    const updated = await Promise.all(list.map(async inst => {
      const active = computeInstitutionActive(inst);
      if (inst.isActive !== active) {
        await storage.updateInstitution(inst.id, { isActive: active });
      }
      return { ...inst, isActive: active };
    }));
    res.json(updated);
  });

  app.post("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = {
        ...req.body,
        licenseStart: req.body.licenseStart ? new Date(req.body.licenseStart) : undefined,
        licenseEnd: req.body.licenseEnd ? new Date(req.body.licenseEnd) : undefined,
        maxTeachers: req.body.maxTeachers !== undefined ? Number(req.body.maxTeachers) : 10000,
        maxStudents: req.body.maxStudents !== undefined ? Number(req.body.maxStudents) : 10000000,
        isActive: true, // Always start active; auto-managed by licenseEnd
      };
      const parsed = insertInstitutionSchema.parse(body);
      const inst = await storage.createInstitution(parsed);
      res.json({ ...inst, isActive: computeInstitutionActive(inst) });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/institutions/:id", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const current = await storage.getInstitution(req.params.id);
    if (!current) return res.status(404).json({ message: "Institution not found" });
    const wasExpired = new Date(current.licenseEnd) < new Date();
    const newLicenseEnd = req.body.licenseEnd ? new Date(req.body.licenseEnd) : null;
    const isRenewal = wasExpired && newLicenseEnd && newLicenseEnd > new Date();
    if (isRenewal) {
      await storage.resetInstitutionQuota(req.params.id);
    }
    // Auto-compute isActive from effective licenseEnd
    const effectiveLicenseEnd = newLicenseEnd ?? new Date(current.licenseEnd);
    const effectiveIsActive = effectiveLicenseEnd >= new Date();
    const inst = await storage.updateInstitution(req.params.id, { ...req.body, isActive: effectiveIsActive });
    res.json({ ...inst, isActive: effectiveIsActive, quotaReset: isRenewal });
  });

  app.post("/api/admin/institutions/:id/reset-quota", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    await storage.resetInstitutionQuota(req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/admin/institutions/:id", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.getInstitution(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    await storage.deleteInstitution(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/admin/institutions/:id/details", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.getInstitution(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    const details = await storage.getInstitutionDetails(req.params.id);
    const effectiveInst = { ...inst, isActive: computeInstitutionActive(inst) };
    res.json({ institution: effectiveInst, ...details });
  });

  app.get("/api/admin/institutions/:id/teacher-codes", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const codes = await storage.getTeacherCodesByInstitution(req.params.id);
    res.json(codes);
  });

  app.post("/api/admin/institutions/:id/teacher-codes/generate", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.getInstitution(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    const count = Math.min(Number(req.body.count) || 1, 100);
    const existingCodes = await storage.getTeacherCodesByInstitution(req.params.id);
    const maxSlot = existingCodes.reduce((m, c) => Math.max(m, c.slotNumber), 0);
    const newCodes = await storage.generateTeacherCodesForInstitution(req.params.id, count, maxSlot + 1);
    res.json(newCodes);
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
      if (req.body.institutionId) {
        const institution = await storage.getInstitution(req.body.institutionId);
        if (institution) {
          const existingTeachers = await storage.getTeachersByInstitution(req.body.institutionId);
          if (existingTeachers.length >= institution.maxTeachers) {
            return res.status(403).json({ message: `Bu kurum maksimum öğretmen sınırına (${institution.maxTeachers}) ulaşmış.` });
          }
        }
      }
      const teacher = await storage.createTeacher(req.body);
      const { password: _, ...safe } = teacher;
      res.json(safe);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Admin: list all classes
  app.get("/api/admin/classes", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getAllClasses();
    res.json(list);
  });

  // Admin: delete any class
  app.delete("/api/admin/classes/:classId", async (req: Request, res: Response) => {
    const adminId = (req.session as any).adminId;
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const cls = await storage.getClass(req.params.classId);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    await storage.deleteClass(req.params.classId);
    res.json({ ok: true });
  });

  // Class public info (for students to verify)
  app.get("/api/class/:code", async (req: Request, res: Response) => {
    const cls = await storage.getClassByCode(req.params.code);
    if (!cls) return res.status(404).json({ message: "Class not found" });
    res.json({ id: cls.id, name: cls.name, classCode: cls.classCode });
  });

  return httpServer;
}
