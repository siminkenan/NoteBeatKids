import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import { insertInstitutionSchema, insertClassSchema } from "@shared/schema";
import multer from "multer";
import crypto from "crypto";

// ── Admin token helpers (session OR Bearer token — works cross-domain for Render+Vercel) ──
const TOKEN_SECRET = process.env.SESSION_SECRET || "notebeat-kids-secret-2024";

function signAdminToken(adminId: string): string {
  const payload = Buffer.from(adminId).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string): string | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("base64url");
    if (sig !== expected) return null;
    return Buffer.from(payload, "base64url").toString();
  } catch {
    return null;
  }
}

function getAdminId(req: Request): string | null {
  // 1. Session (Replit same-origin)
  const sessionId = (req.session as any).adminId;
  if (sessionId) return sessionId;
  // 2. Bearer token (Render + Vercel cross-domain)
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return verifyAdminToken(auth.slice(7));
  }
  return null;
}

function getContentType(filename: string): string {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
    aac: "audio/aac", m4a: "audio/mp4",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp",
  };
  return map[ext] || "application/octet-stream";
}

function makeStoredFilename(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.originalname.match(/\.(mp3|wav|ogg|aac|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

const maestroUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("video/") || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only video and image files are allowed"));
    }
  },
});

function generateRhythmPattern(bpm: number) {
  const original = {
    kick:  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    clap:  [0,0,0,0,1,0,0,1,0,0,0,0,1,0,1,0],
    perc:  [1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0],
  };
  const kids = {
    kick:  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    hihat: [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    clap:  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    perc:  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  };
  return { original, kids };
}

function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health check (used by Render and load balancers)
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Admin auth
  app.post("/api/auth/admin/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const admin = await storage.getAdminByEmail(email);
      if (!admin) return res.status(401).json({ message: "Invalid credentials" });
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      (req.session as any).adminId = admin.id;
      const token = signAdminToken(String(admin.id));
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session error" });
        res.json({ id: admin.id, name: admin.name, email: admin.email, role: "admin", token });
      });
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/admin/logout", (req: Request, res: Response) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/admin/me", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
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
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Session error" });
          res.json({ ...safe, role: "teacher" });
        });
      }

      // Code is unused — register new teacher
      const teacher = await storage.createTeacherByCode({ name: fullName, institutionId: institution.id });
      await storage.linkTeacherToCode(codeRecord.id, teacher.id);
      (req.session as any).teacherId = teacher.id;
      const { password: _, ...safeTeacher } = teacher;
      req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Session error" });
        res.json({ ...safeTeacher, role: "teacher" });
      });
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
      const normalize = (s: string) => (s ?? "").trim().toLowerCase();

      if (studentCode) {
        // ── Individual student code flow ──────────────────────────────────
        const codeRecord = await storage.findStudentCodeByValue(studentCode.trim().toUpperCase());
        if (!codeRecord) return res.status(404).json({ message: "Geçersiz öğrenci kodu. Öğretmeninizden aldığınız kodu kontrol edin." });

        const cls = await storage.getClass(codeRecord.classId);
        if (!cls) return res.status(404).json({ message: "Sınıf bulunamadı." });
        if (cls.expiresAt && new Date(cls.expiresAt) < new Date()) {
          return res.status(403).json({ message: "Bu sınıfın süresi dolmuş." });
        }

        let student: Awaited<ReturnType<typeof storage.getStudent>>;

        if (codeRecord.studentId) {
          // Code already assigned to a student → must be a re-login, never create new
          student = await storage.getStudent(codeRecord.studentId);
          if (!student) return res.status(404).json({ message: "Öğrenci kaydı bulunamadı. Öğretmeninizle iletişime geçin." });

          // Verify the name matches (case-insensitive, trimmed)
          if (normalize(student.firstName) !== normalize(firstName) || normalize(student.lastName) !== normalize(lastName)) {
            return res.status(403).json({
              message: `Bu kod "${student.firstName} ${student.lastName}" adına kayıtlıdır. Lütfen kayıt sırasında kullandığınız adı girin.`,
            });
          }
        } else {
          // Code not yet claimed → first-time use
          // Check if a student with this exact name already exists in the class (edge case: prev class-code login)
          let existing = await storage.findStudent(cls.id, firstName, lastName);
          if (!existing) {
            const studentCount = (await storage.getStudentsByClass(cls.id)).length;
            if (studentCount >= cls.maxStudents) {
              return res.status(403).json({ message: "Sınıf kapasitesi dolu." });
            }
            existing = await storage.createStudent({ classId: cls.id, firstName, lastName });
          }
          // Lock the code exclusively to this student (one-time assignment)
          await storage.linkStudentToStudentCode(codeRecord.code, existing.id);
          student = existing;
        }

        (req.session as any).studentId = student!.id;
        req.session.save(() => {
          res.json({ student, class: { id: cls!.id, name: cls!.name, classCode: cls!.classCode } });
        });

      } else {
        // ── Legacy class code flow ────────────────────────────────────────
        const cls = await storage.getClassByCode(classCode);
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
        (req.session as any).studentId = student.id;
        req.session.save(() => {
          res.json({ student, class: { id: cls.id, name: cls.name, classCode: cls.classCode } });
        });
      }
    } catch (e) {
      console.error("Student login error:", e);
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

      // Drum kit: accumulate time and derive stars (1 star per 3 minutes)
      let finalData = { ...data };
      if (appType === "drum_kit") {
        const existing = await storage.getProgressByStudentAndType(req.params.studentId, "drum_kit");
        const prevTime = existing?.timeSpentSeconds ?? 0;
        const sessionTime = Number(data.timeSpentSeconds ?? 0);
        const totalTime = prevTime + sessionTime;
        const newStars = Math.floor(totalTime / 420); // 420s = 7 min per star
        finalData = { ...data, timeSpentSeconds: totalTime, starsEarned: newStars };
      }

      const progress = await storage.upsertProgress(req.params.studentId, appType, finalData);
      res.json(progress);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Teacher institution info
  app.get("/api/teacher/institution", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const teacher = await storage.getTeacher(teacherId);
    if (!teacher || !teacher.institutionId) return res.status(404).json({ message: "Kurum bulunamadı" });
    const inst = await storage.getInstitution(teacher.institutionId);
    if (!inst) return res.status(404).json({ message: "Kurum bulunamadı" });
    res.json({ id: inst.id, name: inst.name, maxStudents: inst.maxStudents, maxTeachers: inst.maxTeachers });
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
      const teacher = await storage.getTeacher(teacherId);
      let instMaxStudents = 10000000;
      if (teacher?.institutionId) {
        const inst = await storage.getInstitution(teacher.institutionId);
        if (inst?.maxStudents) instMaxStudents = inst.maxStudents;
      }
      const requestedMax = Number(req.body.maxStudents ?? 30);
      if (requestedMax > instMaxStudents) {
        return res.status(400).json({ message: `Maksimum öğrenci sayısı kurumun izin verdiği sınırı (${instMaxStudents}) aşamaz.` });
      }
      const body = {
        ...req.body,
        teacherId,
        maxStudents: requestedMax,
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
    const teacher = await storage.getTeacher(teacherId);
    let instMaxStudents = cls.maxStudents;
    if (teacher?.institutionId) {
      const inst = await storage.getInstitution(teacher.institutionId);
      if (inst?.maxStudents) instMaxStudents = Math.min(cls.maxStudents, inst.maxStudents);
    }
    const codes = await storage.generateStudentCodesForClass(req.params.classId, instMaxStudents);
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
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const stats = await storage.getAdminStats();
    res.json(stats);
  });

  // Helper: compute whether license date is still valid (never writes to DB)
  const isLicenseExpired = (inst: { licenseEnd: Date | string }) =>
    new Date(inst.licenseEnd) < new Date();

  app.get("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getInstitutions();
    // Return institutions with computed isExpired flag; isActive is admin-controlled only
    res.json(list.map(inst => ({ ...inst, isExpired: isLicenseExpired(inst) })));
  });

  app.post("/api/admin/institutions", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const body = {
        ...req.body,
        licenseStart: req.body.licenseStart ? new Date(req.body.licenseStart) : undefined,
        licenseEnd: req.body.licenseEnd ? new Date(req.body.licenseEnd) : undefined,
        maxTeachers: req.body.maxTeachers !== undefined ? Number(req.body.maxTeachers) : 10000,
        maxStudents: req.body.maxStudents !== undefined ? Number(req.body.maxStudents) : 10000000,
        isActive: true,
      };
      const parsed = insertInstitutionSchema.parse(body);
      const inst = await storage.createInstitution(parsed);
      res.json({ ...inst, isExpired: isLicenseExpired(inst) });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/admin/institutions/:id", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const current = await storage.getInstitution(req.params.id);
    if (!current) return res.status(404).json({ message: "Institution not found" });
    const wasExpired = isLicenseExpired(current);
    const newLicenseEnd = req.body.licenseEnd ? new Date(req.body.licenseEnd) : null;
    const isRenewal = wasExpired && newLicenseEnd && newLicenseEnd > new Date();
    if (isRenewal) {
      await storage.resetInstitutionQuota(req.params.id);
    }
    // Admin controls isActive directly; if a new future licenseEnd is provided, default isActive to true
    const updates: any = { ...req.body };
    if (newLicenseEnd) updates.licenseEnd = newLicenseEnd;
    if (isRenewal && updates.isActive === undefined) updates.isActive = true;
    const inst = await storage.updateInstitution(req.params.id, updates);
    res.json({ ...inst, isExpired: isLicenseExpired(inst), quotaReset: isRenewal });
  });

  app.post("/api/admin/institutions/:id/reset-quota", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    await storage.resetInstitutionQuota(req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/admin/institutions/:id", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.getInstitution(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    await storage.deleteInstitution(req.params.id);
    res.json({ ok: true });
  });

  app.get("/api/admin/institutions/:id/details", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const inst = await storage.getInstitution(req.params.id);
    if (!inst) return res.status(404).json({ message: "Institution not found" });
    const details = await storage.getInstitutionDetails(req.params.id);
    const effectiveInst = { ...inst, isExpired: isLicenseExpired(inst) };
    res.json({ institution: effectiveInst, ...details });
  });

  app.get("/api/admin/institutions/:id/teacher-codes", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const codes = await storage.getTeacherCodesByInstitution(req.params.id);
    res.json(codes);
  });

  app.post("/api/admin/institutions/:id/teacher-codes/generate", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
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
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getTeachers();
    res.json(list.map(({ password: _, ...t }) => t));
  });

  app.post("/api/admin/teachers", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
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
    const adminId = getAdminId(req);
    if (!adminId) return res.status(401).json({ message: "Not authenticated" });
    const list = await storage.getAllClasses();
    res.json(list);
  });

  // Admin: delete any class
  app.delete("/api/admin/classes/:classId", async (req: Request, res: Response) => {
    const adminId = getAdminId(req);
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

  // Serve uploaded audio files
  app.get("/api/orchestra/audio/:filename", async (req: Request, res: Response) => {
    const song = await storage.getOrchestraSongByStoredFilename(req.params.filename);
    if (!song || !song.fileData) return res.status(404).json({ message: "File not found" });
    const buf = Buffer.from(song.fileData, "base64");
    res.set("Content-Type", getContentType(song.originalFilename));
    res.set("Content-Length", String(buf.length));
    res.send(buf);
  });

  // Teacher: upload song
  app.post("/api/teacher/orchestra/songs", upload.single("audio"), async (req: Request, res: Response) => {
    try {
      const teacherId = (req.session as any).teacherId;
      if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
      if (!req.file) return res.status(400).json({ message: "No audio file provided" });

      const count = await storage.countOrchestraSongsByTeacher(teacherId);
      if (count >= 10) {
        return res.status(400).json({ message: "Song limit reached. Please delete an existing song to upload a new one." });
      }

      const name = (req.body.name || req.file.originalname).trim();
      const bpm = parseInt(req.body.bpm) || 120;
      const patterns = generateRhythmPattern(bpm);

      const song = await storage.createOrchestraSong({
        teacherId,
        name,
        originalFilename: req.file.originalname,
        storedFilename: makeStoredFilename(),
        fileData: req.file.buffer.toString("base64"),
        bpm,
        durationSeconds: parseInt(req.body.durationSeconds) || 0,
        rhythmPatternOriginal: JSON.stringify(patterns.original),
        rhythmPatternKids: JSON.stringify(patterns.kids),
      });

      res.json(song);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teacher: list songs
  app.get("/api/teacher/orchestra/songs", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const songs = await storage.getOrchestraSongsByTeacher(teacherId);
    res.json(songs);
  });

  // Teacher: delete song
  app.delete("/api/teacher/orchestra/songs/:id", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const song = await storage.getOrchestraSong(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });
    if (song.teacherId !== teacherId) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteOrchestraSong(req.params.id);
    res.json({ ok: true });
  });

  // Teacher: update song BPM (regenerate rhythm)
  app.patch("/api/teacher/orchestra/songs/:id", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const song = await storage.getOrchestraSong(req.params.id);
    if (!song) return res.status(404).json({ message: "Song not found" });
    if (song.teacherId !== teacherId) return res.status(403).json({ message: "Not authorized" });

    const bpm = parseInt(req.body.bpm) || song.bpm;
    const name = req.body.name || song.name;
    const patterns = generateRhythmPattern(bpm);

    const updated = await storage.updateOrchestraSong(req.params.id, {
      bpm,
      name,
      rhythmPatternOriginal: JSON.stringify(patterns.original),
      rhythmPatternKids: JSON.stringify(patterns.kids),
    });
    res.json(updated);
  });

  // Teacher: get orchestra performance data
  app.get("/api/teacher/orchestra/progress", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const data = await storage.getOrchestraProgressByTeacher(teacherId);
    res.json(data);
  });

  // Student: get songs available for their class (no server session — student passes their own ID)
  app.get("/api/student/:studentId/orchestra/songs", async (req: Request, res: Response) => {
    const student = await storage.getStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const songs = await storage.getOrchestraSongsByClass(student.classId);
    res.json(songs);
  });

  // Student: save orchestra game result
  app.post("/api/student/:studentId/orchestra/progress", async (req: Request, res: Response) => {
    const student = await storage.getStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const { songId, mode, laneMode, accuracy, perfectCount, goodCount, missCount } = req.body;
    if (!songId) return res.status(400).json({ message: "songId required" });

    const prog = await storage.createOrchestraProgress({
      studentId: req.params.studentId,
      songId,
      mode: mode || "original",
      laneMode: laneMode || "full",
      accuracy: Math.round(accuracy) || 0,
      perfectCount: perfectCount || 0,
      goodCount: goodCount || 0,
      missCount: missCount || 0,
    });
    res.json(prog);
  });

  // ── Maestro Routes ───────────────────────────────────────────────────────────

  // Serve Maestro files (video/photo) — with Range support for video streaming
  app.get("/api/maestro/file/:filename", async (req: Request, res: Response) => {
    const resource = await storage.getMaestroResourceByStoredFilename(req.params.filename);
    if (!resource || !resource.fileData) return res.status(404).json({ message: "File not found" });
    const buf = Buffer.from(resource.fileData, "base64");
    const contentType = getContentType(resource.originalFilename);
    const total = buf.length;

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.status(206);
      res.set("Content-Range", `bytes ${start}-${end}/${total}`);
      res.set("Accept-Ranges", "bytes");
      res.set("Content-Length", String(chunkSize));
      res.set("Content-Type", contentType);
      res.send(buf.subarray(start, end + 1));
    } else {
      res.set("Content-Type", contentType);
      res.set("Content-Length", String(total));
      res.set("Accept-Ranges", "bytes");
      res.send(buf);
    }
  });

  // Teacher: upload video (max 3, max 197s = 3m17s — duration validated client-side)
  app.post("/api/teacher/maestro/videos", maestroUpload.single("video"), async (req: Request, res: Response) => {
    try {
      const teacherId = (req.session as any).teacherId;
      console.log(`[video-upload] teacherId=${teacherId}, file=${req.file?.originalname}, size=${req.file?.size}`);
      if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
      if (!req.file) return res.status(400).json({ message: "No video file provided" });

      const count = await storage.countMaestroVideosByTeacher(teacherId);
      if (count >= 3) {
        return res.status(400).json({ message: "Video limiti doldu. Yeni video eklemek için mevcut bir videoyu silin." });
      }

      const durationSeconds = parseInt(req.body.durationSeconds) || 0;
      if (durationSeconds > 197) {
        return res.status(400).json({ message: "Video süresi 3:17 (197 sn) sınırını aşıyor." });
      }

      const resource = await storage.createMaestroResource({
        teacherId,
        type: "video",
        title: (req.body.title || req.file.originalname.replace(/\.[^.]+$/, "")).trim(),
        originalFilename: req.file.originalname,
        storedFilename: makeStoredFilename(),
        fileData: req.file.buffer.toString("base64"),
        durationSeconds,
        fileSize: req.file.size,
      });

      res.json(resource);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teacher: upload photo (no limit on count)
  app.post("/api/teacher/maestro/photos", maestroUpload.single("photo"), async (req: Request, res: Response) => {
    try {
      const teacherId = (req.session as any).teacherId;
      if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
      if (!req.file) return res.status(400).json({ message: "No photo file provided" });

      const resource = await storage.createMaestroResource({
        teacherId,
        type: "photo",
        title: (req.body.title || req.file.originalname.replace(/\.[^.]+$/, "")).trim(),
        originalFilename: req.file.originalname,
        storedFilename: makeStoredFilename(),
        fileData: req.file.buffer.toString("base64"),
        durationSeconds: 0,
        fileSize: req.file.size,
      });

      res.json(resource);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Teacher: list all resources
  app.get("/api/teacher/maestro/resources", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const resources = await storage.getMaestroResourcesByTeacher(teacherId);
    res.json(resources);
  });

  // Teacher: delete resource
  app.delete("/api/teacher/maestro/resources/:id", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const resource = await storage.getMaestroResource(req.params.id);
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    if (resource.teacherId !== teacherId) return res.status(403).json({ message: "Not authorized" });
    await storage.deleteMaestroResource(req.params.id);
    res.json({ ok: true });
  });

  // Teacher: watch report
  app.get("/api/teacher/maestro/watch-report", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    const data = await storage.getMaestroViewProgressByTeacher(teacherId);
    res.json(data);
  });

  // Student: get resources for their class
  app.get("/api/student/:studentId/maestro/resources", async (req: Request, res: Response) => {
    const student = await storage.getStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const resources = await storage.getMaestroResourcesByClass(student.classId);
    res.json(resources);
  });

  // Student: update watch progress
  app.post("/api/student/:studentId/maestro/progress", async (req: Request, res: Response) => {
    const student = await storage.getStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const { resourceId, watchedSeconds, completed } = req.body;
    if (!resourceId) return res.status(400).json({ message: "resourceId required" });
    const prog = await storage.upsertMaestroViewProgress(
      req.params.studentId, resourceId,
      Math.round(watchedSeconds) || 0,
      !!completed,
    );
    res.json(prog);
  });

  // Student: get own watch progress
  app.get("/api/student/:studentId/maestro/progress", async (req: Request, res: Response) => {
    const student = await storage.getStudent(req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });
    const prog = await storage.getMaestroViewProgressByStudent(req.params.studentId);
    res.json(prog);
  });

  // ── Leaderboard ────────────────────────────────────────────────────────────

  app.get("/api/leaderboard", async (req: Request, res: Response) => {
    const type = (req.query.type as string) ?? "school";
    // Session-based auth (new logins) OR query param fallback (localStorage-based student sessions)
    const sessionStudentId = (req.session as any).studentId;
    const qStudentId = req.query.studentId as string | undefined;
    const studentId = sessionStudentId || qStudentId;
    const teacherId = (req.session as any).teacherId;

    try {
      let institutionId: string | null = null;
      let classId: string | undefined;
      let currentStudentId: string | null = null;

      if (studentId) {
        currentStudentId = studentId;
        institutionId = await storage.getInstitutionIdForStudent(studentId);
        if (type === "class") {
          classId = (await storage.getClassIdForStudent(studentId)) ?? undefined;
        }
      } else if (teacherId) {
        const teacher = await storage.getTeacher(teacherId);
        institutionId = teacher?.institutionId ?? null;
        if (type === "class" && req.query.classId) {
          classId = req.query.classId as string;
        }
      } else {
        return res.status(401).json({ message: "Not authenticated" });
      }

      if (!institutionId) return res.status(404).json({ message: "Institution not found" });

      const entries = await storage.getLeaderboard(institutionId, type as any, classId);
      res.json({ entries, currentStudentId });
    } catch (e) {
      console.error("Leaderboard error:", e);
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/leaderboard/winners", async (req: Request, res: Response) => {
    const sessionStudentId = (req.session as any).studentId;
    const qStudentId = req.query.studentId as string | undefined;
    const studentId = sessionStudentId || qStudentId;
    const teacherId = (req.session as any).teacherId;

    try {
      let institutionId: string | null = null;
      if (studentId) {
        institutionId = await storage.getInstitutionIdForStudent(studentId);
      } else if (teacherId) {
        const teacher = await storage.getTeacher(teacherId);
        institutionId = teacher?.institutionId ?? null;
      } else {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (!institutionId) return res.json([]);
      const winners = await storage.getLastMonthWinners(institutionId);
      res.json(winners);
    } catch (e) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/teacher/leaderboard/reset", async (req: Request, res: Response) => {
    const teacherId = (req.session as any).teacherId;
    if (!teacherId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const teacher = await storage.getTeacher(teacherId);
      if (!teacher?.institutionId) return res.status(404).json({ message: "Institution not found" });
      const result = await storage.performMonthlyReset(teacher.institutionId);
      res.json(result);
    } catch (e) {
      console.error("Monthly reset error:", e);
      res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}
