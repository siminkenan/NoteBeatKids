import { eq, and, sql, desc, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcryptjs";
import { bufferScore, getBufferEntry, getBufferedByStudent, flushScoreBuffer } from "./scoreBuffer";
import { redis } from "./redis";

// ── Basit Redis cache yardımcıları (storage içinde kullanılır) ────────────────
const CACHE_TTL = 300; // 5 dakika

async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const v = await redis.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch { return null; }
}

async function cacheSet(key: string, value: unknown, ttl = CACHE_TTL): Promise<void> {
  if (!redis) return;
  try { await redis.set(key, JSON.stringify(value), "EX", ttl); } catch {}
}

async function cacheDel(...keys: string[]): Promise<void> {
  if (!redis || !keys.length) return;
  try { await redis.del(...keys); } catch {}
}
import {
  institutions, admins, teachers, classes, students, studentProgress, teacherCodes, studentCodes,
  orchestraSongs, orchestraProgress, maestroResources, maestroViewProgress,
  monthlyStats, monthlyWinners, auditLogs,
  type Institution, type InsertInstitution,
  type Admin, type Teacher, type InsertTeacher,
  type Class, type InsertClass,
  type Student, type InsertStudent,
  type StudentProgress, type InsertProgress,
  type TeacherCode, type StudentCode,
  type OrchestraSong, type OrchestraProgress,
  type MaestroResource, type MaestroViewProgress,
  type MonthlyWinner,
} from "@shared/schema";

export type DeletedClassInfo = {
  id: string;
  name: string;
  branchName: string;
  classCode: string;
  maxStudents: number;
  deletedAt: Date;
  createdAt: Date;
  teacherName: string;
  teacherEmail: string;
  institutionName: string | null;
  studentCount: number;
};

export type AuditLogData = {
  action: string;
  userType: string;
  userId?: string | null;
  institutionId?: string | null;
  teacherId?: string | null;
  classId?: string | null;
  studentId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  classCode: string;
  branchName: string;
  institutionName: string;
  totalStars: number;
  totalBadges: number;
  totalScore: number;
  monthlyStars: number;
  monthlyBadges: number;
  monthlyScore: number;
};

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getPreviousMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export interface IStorage {
  // Admin
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(data: { email: string; password: string }): Promise<Admin>;
  updateAdminPassword(id: string, hashedPassword: string): Promise<void>;
  // Institutions
  getInstitutions(): Promise<Institution[]>;
  getInstitution(id: string): Promise<Institution | undefined>;
  createInstitution(data: InsertInstitution): Promise<Institution>;
  updateInstitution(id: string, data: Partial<InsertInstitution>): Promise<Institution | undefined>;
  // Teachers
  getTeachers(): Promise<Teacher[]>;
  getTeachersByInstitution(institutionId: string): Promise<Teacher[]>;
  getTeacherByEmail(email: string): Promise<Teacher | undefined>;
  getTeacher(id: string): Promise<Teacher | undefined>;
  createTeacher(data: InsertTeacher): Promise<Teacher>;
  findTeacherByNameAndInstitution(name: string, institutionId: string): Promise<Teacher | undefined>;
  createTeacherByCode(data: { name: string; institutionId: string }): Promise<Teacher>;
  // Institution code lookup (legacy — kept for reference)
  getInstitutionByTeacherCode(code: string): Promise<Institution | undefined>;
  // Individual teacher codes
  generateTeacherCodesForInstitution(institutionId: string, count: number, startSlot?: number): Promise<TeacherCode[]>;
  getTeacherCodesByInstitution(institutionId: string): Promise<Array<TeacherCode & { teacherName: string | null }>>;
  findTeacherCodeByValue(code: string): Promise<(TeacherCode & { institutionId: string }) | undefined>;
  linkTeacherToCode(codeId: string, teacherId: string): Promise<void>;
  // Classes
  getAllClasses(): Promise<Array<Class & { teacherName: string; teacherEmail: string; institutionName: string | null; studentCount: number }>>;
  getClassesByTeacher(teacherId: string): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  getClassByCode(code: string): Promise<Class | undefined>;
  createClass(data: InsertClass & { classCode: string }): Promise<Class>;
  deleteClass(id: string): Promise<void>;
  restoreClass(id: string): Promise<void>;
  getDeletedClasses(institutionId?: string): Promise<DeletedClassInfo[]>;
  createAuditLog(data: AuditLogData): Promise<void>;
  // Student codes
  generateStudentCodesForClass(classId: string, count: number): Promise<StudentCode[]>;
  getStudentCodesByClass(classId: string): Promise<StudentCode[]>;
  findStudentCodeByValue(code: string): Promise<StudentCode | undefined>;
  linkStudentToStudentCode(code: string, studentId: string): Promise<void>;
  findStudentCodeByStudentId(studentId: string): Promise<StudentCode | undefined>;
  // Students
  getStudentsByClass(classId: string): Promise<Student[]>;
  getStudent(id: string): Promise<Student | undefined>;
  findStudent(classId: string, firstName: string, lastName: string): Promise<Student | undefined>;
  createStudent(data: InsertStudent): Promise<Student>;
  countStudents(): Promise<number>;
  getInstitutionStudentStock(institutionId: string): Promise<{ used: number; max: number; remaining: number }>;
  // Class management
  updateClassMaxStudents(classId: string, maxStudents: number): Promise<Class>;
  addStudentCodesToClass(classId: string, additionalCount: number): Promise<StudentCode[]>;
  // Progress
  getProgressByStudent(studentId: string): Promise<StudentProgress[]>;
  getProgressByStudentAndType(studentId: string, appType: string): Promise<StudentProgress | undefined>;
  upsertProgress(studentId: string, appType: string, data: Partial<InsertProgress>): Promise<StudentProgress>;
  getClassProgress(classId: string): Promise<Array<Student & { rhythmProgress?: StudentProgress; notesProgress?: StudentProgress; drumProgress?: StudentProgress; melodyProgress?: StudentProgress }>>;
  // Reset institution quota (delete all students/classes for all teachers in institution)
  resetInstitutionQuota(institutionId: string): Promise<void>;
  // Delete institution completely
  deleteInstitution(institutionId: string): Promise<void>;
  // Get full institution details (teachers + classes + students + progress)
  getInstitutionDetails(institutionId: string): Promise<{
    teachers: Array<{
      id: string; name: string; email: string;
      classes: Array<{
        id: string; name: string; classCode: string; maxStudents: number; expiresAt: string | null;
        students: Array<{
          id: string; firstName: string; lastName: string;
          rhythmLevel: number; rhythmStars: number;
          notesLevel: number; notesStars: number;
          totalCorrect: number; totalTimeSeconds: number;
        }>;
      }>;
    }>;
  }>;
  // Stats
  getAdminStats(): Promise<{
    institutionCount: number;
    teacherCount: number;
    studentCount: number;
    totalExercisesCompleted: number;
    totalTimeSpentSeconds: number;
  }>;
  // Orchestra Songs
  getOrchestraSongsByTeacher(teacherId: string): Promise<OrchestraSong[]>;
  getOrchestraSong(id: string): Promise<OrchestraSong | undefined>;
  getOrchestraSongByStoredFilename(storedFilename: string): Promise<OrchestraSong | undefined>;
  createOrchestraSong(data: Omit<OrchestraSong, "id" | "createdAt">): Promise<OrchestraSong>;
  updateOrchestraSong(id: string, data: Partial<OrchestraSong>): Promise<OrchestraSong | undefined>;
  deleteOrchestraSong(id: string): Promise<void>;
  countOrchestraSongsByTeacher(teacherId: string): Promise<number>;
  getOrchestraSongsByClass(classId: string): Promise<OrchestraSong[]>;
  // Orchestra Progress
  createOrchestraProgress(data: Omit<OrchestraProgress, "id" | "completedAt">): Promise<OrchestraProgress>;
  getOrchestraProgressByStudent(studentId: string): Promise<OrchestraProgress[]>;
  getOrchestraProgressByTeacher(teacherId: string): Promise<Array<OrchestraProgress & { studentName: string; songName: string }>>;
  // Maestro Resources
  createMaestroResource(data: Omit<MaestroResource, "id" | "createdAt">): Promise<MaestroResource>;
  getMaestroResourcesByTeacher(teacherId: string): Promise<MaestroResource[]>;
  getMaestroResourcesByClass(classId: string): Promise<MaestroResource[]>;
  getMaestroResource(id: string): Promise<MaestroResource | undefined>;
  getMaestroResourceByStoredFilename(storedFilename: string): Promise<MaestroResource | undefined>;
  deleteMaestroResource(id: string): Promise<void>;
  countMaestroVideosByTeacher(teacherId: string): Promise<number>;
  // Maestro View Progress
  upsertMaestroViewProgress(studentId: string, resourceId: string, watchedSeconds: number, completed: boolean): Promise<MaestroViewProgress>;
  getMaestroViewProgressByTeacher(teacherId: string): Promise<Array<{ resourceId: string; resourceTitle: string; studentId: string; studentName: string; watchedSeconds: number; completed: boolean; durationSeconds: number }>>;
  getMaestroViewProgressByStudent(studentId: string): Promise<MaestroViewProgress[]>;
  // Leaderboard
  getLeaderboard(institutionId: string, type: "class" | "school" | "monthly", classId?: string, teacherId?: string): Promise<LeaderboardEntry[]>;
  getLastMonthWinners(institutionId: string): Promise<MonthlyWinner[]>;
  incrementMonthlyStats(studentId: string, deltaStars: number, deltaBadges: number): Promise<void>;
  performMonthlyReset(institutionId: string): Promise<{ month: string; winners: MonthlyWinner[] }>;
  autoCheckMonthlyReset(): Promise<void>;
  getAllInstitutionIds(): Promise<string[]>;
  getInstitutionIdForStudent(studentId: string): Promise<string | null>;
  getClassIdForStudent(studentId: string): Promise<string | null>;
  flushPendingStars(): Promise<void>;
  // Seed
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    return result[0];
  }

  async createAdmin(data: { email: string; password: string }): Promise<Admin> {
    const result = await db.insert(admins).values({ email: data.email, password: data.password }).returning();
    return result[0];
  }

  async updateAdminPassword(id: string, hashedPassword: string): Promise<void> {
    await db.update(admins).set({ password: hashedPassword }).where(eq(admins.id, id));
  }

  async getInstitutions(): Promise<Institution[]> {
    return db.select().from(institutions).orderBy(institutions.createdAt);
  }

  async getInstitution(id: string): Promise<Institution | undefined> {
    const result = await db.select().from(institutions).where(eq(institutions.id, id)).limit(1);
    return result[0];
  }

  private generateCode(length = 8): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < length; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  private async uniqueTeacherCode(): Promise<string> {
    let code = this.generateCode(8);
    let attempts = 0;
    while (attempts < 20) {
      const existing = await db.select({ id: teacherCodes.id }).from(teacherCodes).where(eq(teacherCodes.code, code)).limit(1);
      if (existing.length === 0) return code;
      code = this.generateCode(8);
      attempts++;
    }
    return code;
  }

  async createInstitution(data: InsertInstitution): Promise<Institution> {
    const result = await db.insert(institutions).values(data).returning();
    const inst = result[0];
    // Generate individual teacher codes up to maxTeachers (capped at 500 for sanity)
    const count = Math.min(inst.maxTeachers, 500);
    // Fire teacher code generation in background — do NOT await so the HTTP response
    // returns immediately (prevents Render 30-second timeout on large counts).
    this.generateTeacherCodesForInstitution(inst.id, count, 1).catch((err) => {
      console.error("[createInstitution] teacher code generation failed:", err);
    });
    return inst;
  }

  async getInstitutionByTeacherCode(code: string): Promise<Institution | undefined> {
    const result = await db.select().from(institutions).where(eq(institutions.teacherCode, code.toUpperCase())).limit(1);
    return result[0];
  }

  async generateTeacherCodesForInstitution(institutionId: string, count: number, startSlot = 1): Promise<TeacherCode[]> {
    if (count === 0) return [];
    // Fetch all existing codes in ONE query (instead of 500 individual SELECTs)
    const existing = await db.select({ code: teacherCodes.code }).from(teacherCodes);
    const existingSet = new Set(existing.map((r) => r.code));

    // Generate unique codes in memory — 32^8 ≈ 1 trillion possibilities, collision rate negligible
    const rows = [];
    const used = new Set<string>(existingSet);
    for (let i = 0; i < count; i++) {
      let code = this.generateCode(8);
      let safety = 0;
      while (used.has(code) && safety < 100) { code = this.generateCode(8); safety++; }
      used.add(code);
      rows.push({ institutionId, code, slotNumber: startSlot + i });
    }

    // One batch INSERT instead of N individual inserts
    const insertResult = await db.insert(teacherCodes).values(rows).returning();
    return insertResult;
  }

  async getTeacherCodesByInstitution(institutionId: string): Promise<Array<TeacherCode & { teacherName: string | null }>> {
    const rows = await db
      .select({
        id: teacherCodes.id,
        institutionId: teacherCodes.institutionId,
        code: teacherCodes.code,
        teacherId: teacherCodes.teacherId,
        slotNumber: teacherCodes.slotNumber,
        createdAt: teacherCodes.createdAt,
        teacherName: teachers.name,
      })
      .from(teacherCodes)
      .leftJoin(teachers, eq(teacherCodes.teacherId, teachers.id))
      .where(eq(teacherCodes.institutionId, institutionId))
      .orderBy(teacherCodes.slotNumber);
    return rows.map(r => ({ ...r, teacherName: r.teacherName ?? null }));
  }

  async findTeacherCodeByValue(code: string): Promise<(TeacherCode & { institutionId: string }) | undefined> {
    const result = await db.select().from(teacherCodes).where(eq(teacherCodes.code, code.toUpperCase())).limit(1);
    return result[0] as any;
  }

  async linkTeacherToCode(codeId: string, teacherId: string): Promise<void> {
    await db.update(teacherCodes).set({ teacherId }).where(eq(teacherCodes.id, codeId));
  }

  private async uniqueStudentCode(): Promise<string> {
    let code = this.generateCode(8);
    let attempts = 0;
    while (attempts < 20) {
      const existing = await db.select({ id: studentCodes.id }).from(studentCodes).where(eq(studentCodes.code, code)).limit(1);
      if (existing.length === 0) return code;
      code = this.generateCode(8);
      attempts++;
    }
    return code;
  }

  async generateStudentCodesForClass(classId: string, count: number): Promise<StudentCode[]> {
    const rows = [];
    for (let i = 0; i < count; i++) {
      const code = await this.uniqueStudentCode();
      rows.push({ classId, code, slotNumber: i + 1 });
    }
    if (rows.length === 0) return [];
    const result = await db.insert(studentCodes).values(rows).returning();
    return result;
  }

  async getStudentCodesByClass(classId: string): Promise<StudentCode[]> {
    return db.select().from(studentCodes).where(eq(studentCodes.classId, classId)).orderBy(studentCodes.slotNumber);
  }

  async findStudentCodeByValue(code: string): Promise<StudentCode | undefined> {
    const key = `sc:${code.toUpperCase()}`;
    const cached = await cacheGet<StudentCode>(key);
    if (cached) return cached;
    const result = await db.select().from(studentCodes).where(eq(studentCodes.code, code.toUpperCase())).limit(1);
    if (result[0]) await cacheSet(key, result[0]);
    return result[0];
  }

  async linkStudentToStudentCode(code: string, studentId: string): Promise<void> {
    await db.update(studentCodes)
      .set({ studentId })
      .where(eq(studentCodes.code, code.toUpperCase()));
    // Cache'i güncelle: öğrenci atandıktan sonra eski kayıt geçersiz
    await cacheDel(`sc:${code.toUpperCase()}`);
  }

  async findStudentCodeByStudentId(studentId: string): Promise<StudentCode | undefined> {
    const result = await db.select().from(studentCodes).where(eq(studentCodes.studentId, studentId)).limit(1);
    return result[0];
  }

  async updateInstitution(id: string, data: Partial<InsertInstitution>): Promise<Institution | undefined> {
    const result = await db.update(institutions).set(data).where(eq(institutions.id, id)).returning();
    return result[0];
  }

  async getTeachers(): Promise<Teacher[]> {
    return db.select().from(teachers).orderBy(teachers.createdAt);
  }

  async getTeachersByInstitution(institutionId: string): Promise<Teacher[]> {
    return db.select().from(teachers).where(eq(teachers.institutionId, institutionId));
  }

  async getTeacherByEmail(email: string): Promise<Teacher | undefined> {
    const result = await db.select().from(teachers).where(eq(teachers.email, email)).limit(1);
    return result[0];
  }

  async getTeacher(id: string): Promise<Teacher | undefined> {
    const key = `teacher:${id}`;
    const cached = await cacheGet<Teacher>(key);
    if (cached) return cached;
    const result = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
    if (result[0]) await cacheSet(key, result[0]);
    return result[0];
  }

  async createTeacher(data: InsertTeacher): Promise<Teacher> {
    const hashed = data.password ? await bcrypt.hash(data.password, 10) : null;
    const result = await db.insert(teachers).values({ ...data, password: hashed }).returning();
    return result[0];
  }

  async findTeacherByNameAndInstitution(name: string, institutionId: string): Promise<Teacher | undefined> {
    const result = await db.select().from(teachers).where(
      and(eq(sql`LOWER(${teachers.name})`, name.toLowerCase()), eq(teachers.institutionId, institutionId))
    ).limit(1);
    return result[0];
  }

  async createTeacherByCode(data: { name: string; institutionId: string }): Promise<Teacher> {
    const result = await db.insert(teachers).values({ name: data.name, institutionId: data.institutionId }).returning();
    return result[0];
  }

  async getAllClasses(): Promise<Array<Class & { teacherName: string; teacherEmail: string; institutionName: string | null; studentCount: number }>> {
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        teacherId: classes.teacherId,
        classCode: classes.classCode,
        maxStudents: classes.maxStudents,
        expiresAt: classes.expiresAt,
        createdAt: classes.createdAt,
        deletedAt: classes.deletedAt,
        teacherName: teachers.name,
        teacherEmail: teachers.email,
        institutionName: institutions.name,
        branchName: classes.branchName,
      })
      .from(classes)
      .leftJoin(teachers, eq(classes.teacherId, teachers.id))
      .leftJoin(institutions, eq(teachers.institutionId, institutions.id))
      .where(isNull(classes.deletedAt))
      .orderBy(classes.createdAt);

    const counts = await db
      .select({ classId: students.classId, count: sql<number>`count(*)::int` })
      .from(students)
      .groupBy(students.classId);
    const countMap = Object.fromEntries(counts.map(r => [r.classId, r.count]));

    return rows.map(r => ({
      ...r,
      teacherName: r.teacherName ?? "—",
      teacherEmail: r.teacherEmail ?? "—",
      institutionName: r.institutionName ?? null,
      studentCount: countMap[r.id] ?? 0,
    }));
  }

  async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    return db.select().from(classes).where(and(eq(classes.teacherId, teacherId), isNull(classes.deletedAt))).orderBy(classes.createdAt);
  }

  async getClass(id: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(and(eq(classes.id, id), isNull(classes.deletedAt))).limit(1);
    return result[0];
  }

  async getClassByCode(code: string): Promise<Class | undefined> {
    const key = `cls:code:${code.toUpperCase()}`;
    const cached = await cacheGet<Class>(key);
    if (cached) {
      // Ensure the cached entry has not been soft-deleted
      if ((cached as any).deletedAt) { await cacheDel(key); return undefined; }
      return cached;
    }
    const result = await db.select().from(classes).where(and(eq(classes.classCode, code.toUpperCase()), isNull(classes.deletedAt))).limit(1);
    if (result[0]) await cacheSet(key, result[0]);
    return result[0];
  }

  async createClass(data: InsertClass & { classCode: string }): Promise<Class> {
    const result = await db.insert(classes).values(data).returning();
    const cls = result[0];
    const count = Math.min(cls.maxStudents, 200);
    await this.generateStudentCodesForClass(cls.id, count);
    return cls;
  }

  async deleteClass(id: string): Promise<void> {
    // Soft delete — only mark deleted_at, preserve ALL student data and progress
    const [deleted] = await db
      .update(classes)
      .set({ deletedAt: new Date() })
      .where(eq(classes.id, id))
      .returning({ classCode: classes.classCode });
    // Invalidate Redis cache for this class code
    if (deleted?.classCode) {
      await cacheDel(`cls:code:${deleted.classCode.toUpperCase()}`);
    }
  }

  async restoreClass(id: string): Promise<void> {
    // Restore soft-deleted class by clearing deleted_at
    const [restored] = await db
      .update(classes)
      .set({ deletedAt: null })
      .where(eq(classes.id, id))
      .returning({ classCode: classes.classCode });
    // Invalidate Redis cache so fresh DB read is forced
    if (restored?.classCode) {
      await cacheDel(`cls:code:${restored.classCode.toUpperCase()}`);
    }
  }

  async getDeletedClasses(institutionId?: string): Promise<DeletedClassInfo[]> {
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        branchName: classes.branchName,
        classCode: classes.classCode,
        maxStudents: classes.maxStudents,
        deletedAt: classes.deletedAt,
        createdAt: classes.createdAt,
        teacherName: teachers.name,
        teacherEmail: teachers.email,
        institutionName: institutions.name,
        institutionId: teachers.institutionId,
      })
      .from(classes)
      .leftJoin(teachers, eq(classes.teacherId, teachers.id))
      .leftJoin(institutions, eq(teachers.institutionId, institutions.id))
      .where(
        institutionId
          ? and(isNotNull(classes.deletedAt), eq(teachers.institutionId, institutionId))
          : isNotNull(classes.deletedAt)
      )
      .orderBy(desc(classes.deletedAt));

    const counts = await db
      .select({ classId: students.classId, count: sql<number>`count(*)::int` })
      .from(students)
      .groupBy(students.classId);
    const countMap = Object.fromEntries(counts.map(r => [r.classId, r.count]));

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      branchName: r.branchName,
      classCode: r.classCode,
      maxStudents: r.maxStudents,
      deletedAt: r.deletedAt!,
      createdAt: r.createdAt,
      teacherName: r.teacherName ?? "—",
      teacherEmail: r.teacherEmail ?? "—",
      institutionName: r.institutionName ?? null,
      studentCount: countMap[r.id] ?? 0,
    }));
  }

  async createAuditLog(data: AuditLogData): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        action: data.action,
        userType: data.userType,
        userId: data.userId ?? null,
        institutionId: data.institutionId ?? null,
        teacherId: data.teacherId ?? null,
        classId: data.classId ?? null,
        studentId: data.studentId ?? null,
        details: data.details ?? null,
        ipAddress: data.ipAddress ?? null,
      });
    } catch (e) {
      // Audit log failure must never break the main flow
      console.error("[AUDIT LOG] Write failed:", e);
    }
  }

  async getStudentsByClass(classId: string): Promise<Student[]> {
    return db.select().from(students).where(eq(students.classId, classId)).orderBy(students.firstName);
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return result[0];
  }

  async findStudent(classId: string, firstName: string, lastName: string): Promise<Student | undefined> {
    const result = await db.select().from(students).where(
      and(
        eq(students.classId, classId),
        eq(sql`LOWER(${students.firstName})`, firstName.toLowerCase()),
        eq(sql`LOWER(${students.lastName})`, lastName.toLowerCase())
      )
    ).limit(1);
    return result[0];
  }

  async createStudent(data: InsertStudent): Promise<Student> {
    const result = await db.insert(students).values(data).returning();
    return result[0];
  }

  async countStudents(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(students);
    return Number(result[0]?.count ?? 0);
  }

  async getInstitutionStudentStock(institutionId: string): Promise<{ used: number; max: number; remaining: number }> {
    const inst = await db.select({ maxStudents: institutions.maxStudents }).from(institutions).where(eq(institutions.id, institutionId));
    const max = inst[0]?.maxStudents ?? 0;
    const teacherRows = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.institutionId, institutionId));
    if (teacherRows.length === 0) return { used: 0, max, remaining: max };
    const teacherIds = teacherRows.map(t => t.id);
    const classRows = await db.select({ id: classes.id }).from(classes).where(inArray(classes.teacherId, teacherIds));
    if (classRows.length === 0) return { used: 0, max, remaining: max };
    const classIds = classRows.map(c => c.id);
    const result = await db.select({ count: sql<number>`count(*)` }).from(studentCodes).where(inArray(studentCodes.classId, classIds));
    const used = Number(result[0]?.count ?? 0);
    return { used, max, remaining: Math.max(0, max - used) };
  }

  async updateClassMaxStudents(classId: string, maxStudents: number): Promise<Class> {
    const [updated] = await db.update(classes).set({ maxStudents }).where(eq(classes.id, classId)).returning();
    return updated;
  }

  async addStudentCodesToClass(classId: string, additionalCount: number): Promise<StudentCode[]> {
    const existing = await db.select().from(studentCodes).where(eq(studentCodes.classId, classId)).orderBy(studentCodes.slotNumber);
    const maxSlot = existing.length > 0 ? existing.reduce((max, c) => Math.max(max, c.slotNumber), 0) : 0;
    const rows = [];
    for (let i = 0; i < additionalCount; i++) {
      const code = await this.uniqueStudentCode();
      rows.push({ classId, code, slotNumber: maxSlot + i + 1 });
    }
    if (rows.length === 0) return [];
    const result = await db.insert(studentCodes).values(rows).returning();
    return result;
  }

  async getProgressByStudentAndType(studentId: string, appType: string): Promise<StudentProgress | undefined> {
    // Önce tamponu kontrol et — DB'ye gitmeden tampondaki güncel veriyi döndür
    const buffered = getBufferEntry(studentId, appType);
    if (buffered) {
      const now = new Date();
      return {
        id: buffered.existingId ?? `buf_${studentId}:${appType}`,
        studentId,
        appType,
        level: buffered.data.level ?? 1,
        starsEarned: buffered.data.starsEarned ?? 0,
        correctAnswers: buffered.data.correctAnswers ?? 0,
        wrongAnswers: buffered.data.wrongAnswers ?? 0,
        timeSpentSeconds: buffered.data.timeSpentSeconds ?? 0,
        notesBadge: buffered.data.notesBadge ?? null,
        createdAt: now,
        updatedAt: now,
      } as StudentProgress;
    }
    // Tamponda yoksa DB'den oku
    const result = await db.select().from(studentProgress).where(
      and(eq(studentProgress.studentId, studentId), eq(studentProgress.appType, appType))
    ).limit(1);
    return result[0];
  }

  async getProgressByStudent(studentId: string): Promise<StudentProgress[]> {
    // DB'deki kayıtları al, ardından tamponda bekleyen güncel değerleri üzerine yaz
    const dbRows = await db.select().from(studentProgress).where(eq(studentProgress.studentId, studentId));
    const buffered = getBufferedByStudent(studentId);

    // DB kayıtlarını tampondaki güncel değerlerle birleştir
    const dbMap = new Map(dbRows.map(r => [`${r.studentId}:${r.appType}`, r]));
    for (const [key, entry] of Array.from(buffered.entries())) {
      const now = new Date();
      dbMap.set(key, {
        id: entry.existingId ?? `buf_${key}`,
        studentId: entry.studentId,
        appType: entry.appType,
        level: entry.data.level ?? 1,
        starsEarned: entry.data.starsEarned ?? 0,
        correctAnswers: entry.data.correctAnswers ?? 0,
        wrongAnswers: entry.data.wrongAnswers ?? 0,
        timeSpentSeconds: entry.data.timeSpentSeconds ?? 0,
        notesBadge: entry.data.notesBadge ?? null,
        createdAt: now,
        updatedAt: now,
      } as StudentProgress);
    }
    return Array.from(dbMap.values());
  }

  async upsertProgress(studentId: string, appType: string, data: Partial<InsertProgress>): Promise<StudentProgress> {
    // Tampondaki mevcut giriş
    const existingBuffer = getBufferEntry(studentId, appType);

    // DB'de zaten kayıt var mı? (Tampon boşsa DB'ye sor)
    const dbRecord = existingBuffer
      ? null
      : await db.select().from(studentProgress).where(
          and(eq(studentProgress.studentId, studentId), eq(studentProgress.appType, appType))
        ).limit(1).then(r => r[0] ?? null);

    // Puanı tampona yaz — DB'ye YAZMA
    const synthetic = bufferScore({
      studentId,
      appType,
      institutionId: null, // routes.ts'te zaten alınıyor
      newData: data as any,
      baselineRecord: dbRecord,
      existingBufferEntry: existingBuffer,
    });

    return synthetic;
  }

  async flushPendingStars(): Promise<void> {
    // pendingStars artık leaderboard'a yansıdı — sıfırla
    await db.update(students)
      .set({ pendingStars: 0 })
      .where(sql`pending_stars > 0`);
  }

  async getClassProgress(classId: string): Promise<Array<Student & { rhythmProgress?: StudentProgress; notesProgress?: StudentProgress; drumProgress?: StudentProgress; melodyProgress?: StudentProgress }>> {
    const studentList = await this.getStudentsByClass(classId);

    // Build set of studentIds that have an active code assignment
    const codeRows = await db
      .select({ studentId: studentCodes.studentId })
      .from(studentCodes)
      .where(and(eq(studentCodes.classId, classId), isNotNull(studentCodes.studentId)));
    const codedStudentIds = new Set(codeRows.map(r => r.studentId as string));

    const result = [];
    for (const student of studentList) {
      const progress = await this.getProgressByStudent(student.id);
      const hasProgress = progress.length > 0;
      const hasCode = codedStudentIds.has(student.id);

      // Only include students that either have a code assigned or have played at least once.
      // This filters out orphaned duplicate records created by the old multi-login bug.
      if (!hasCode && !hasProgress) continue;

      const rhythmProgress = progress.find(p => p.appType === 'rhythm');
      const notesProgress = progress.find(p => p.appType === 'notes');
      const drumProgress = progress.find(p => p.appType === 'drum_kit');
      const melodyProgress = progress.find(p => p.appType === 'melody');
      result.push({ ...student, rhythmProgress, notesProgress, drumProgress, melodyProgress });
    }
    return result;
  }

  async resetInstitutionQuota(institutionId: string): Promise<void> {
    const institutionTeachers = await this.getTeachersByInstitution(institutionId);
    for (const teacher of institutionTeachers) {
      const teacherClasses = await this.getClassesByTeacher(teacher.id);
      for (const cls of teacherClasses) {
        await this.deleteClass(cls.id);
      }
    }
  }

  async deleteInstitution(institutionId: string): Promise<void> {
    // Institution deletion is a HARD delete — all data is permanently removed.
    // We do NOT use deleteClass() (soft-delete) here: soft-deleted class rows
    // still hold FK references (classes.teacher_id → teachers.id) that block
    // teacher/institution deletion. We must physically remove all rows.
    //
    // Audit logs (STARTED/COMPLETED/FAILED) are written OUTSIDE the transaction
    // so they persist even if the transaction rolls back.

    // --- Pre-flight: collect IDs before opening the transaction ---
    const institutionTeachers = await this.getTeachersByInstitution(institutionId);
    const teacherIds = institutionTeachers.map(t => t.id);

    let allClasses: { id: string; classCode: string | null }[] = [];
    let classIds: string[] = [];
    let studentIds: string[] = [];

    if (teacherIds.length > 0) {
      // ALL classes for these teachers, including soft-deleted ones
      allClasses = await db
        .select({ id: classes.id, classCode: classes.classCode })
        .from(classes)
        .where(inArray(classes.teacherId, teacherIds));
      classIds = allClasses.map(c => c.id);

      if (classIds.length > 0) {
        const studentList = await db
          .select({ id: students.id })
          .from(students)
          .where(inArray(students.classId, classIds));
        studentIds = studentList.map(s => s.id);
      }
    }

    // --- Audit: STARTED (outside tx — always persists) ---
    await db.insert(auditLogs).values({
      action: "DELETE_INSTITUTION_STARTED",
      userType: "admin",
      institutionId,
      details: JSON.stringify({
        teacherCount: teacherIds.length,
        classCount: classIds.length,
        studentCount: studentIds.length,
      }),
    }).catch(e => console.error("[AUDIT] DELETE_INSTITUTION_STARTED failed:", e));

    try {
      await db.transaction(async (tx) => {
        if (teacherIds.length > 0) {
          if (classIds.length > 0) {
            // Step 1 — Hard-delete all student-dependent rows
            if (studentIds.length > 0) {
              await tx.delete(maestroViewProgress).where(inArray(maestroViewProgress.studentId, studentIds));
              await tx.delete(studentProgress).where(inArray(studentProgress.studentId, studentIds));
              await tx.delete(orchestraProgress).where(inArray(orchestraProgress.studentId, studentIds));
              await tx.delete(monthlyStats).where(inArray(monthlyStats.studentId, studentIds));
              await tx.delete(monthlyWinners).where(inArray(monthlyWinners.studentId, studentIds));
            }

            // Step 2 — Nullify student FK in student_codes, then delete students + codes
            await tx.update(studentCodes).set({ studentId: null }).where(inArray(studentCodes.classId, classIds));
            await tx.delete(students).where(inArray(students.classId, classIds));
            await tx.delete(studentCodes).where(inArray(studentCodes.classId, classIds));

            // Step 3 — Hard-delete classes (including soft-deleted)
            await tx.delete(classes).where(inArray(classes.id, classIds));
          }

          // Step 4 — Orchestra and maestro data per teacher
          for (const teacher of institutionTeachers) {
            const teacherSongs = await tx
              .select({ id: orchestraSongs.id })
              .from(orchestraSongs)
              .where(eq(orchestraSongs.teacherId, teacher.id));
            for (const song of teacherSongs) {
              await tx.delete(orchestraProgress).where(eq(orchestraProgress.songId, song.id));
            }
            await tx.delete(orchestraSongs).where(eq(orchestraSongs.teacherId, teacher.id));

            const teacherResources = await tx
              .select({ id: maestroResources.id })
              .from(maestroResources)
              .where(eq(maestroResources.teacherId, teacher.id));
            for (const res of teacherResources) {
              await tx.delete(maestroViewProgress).where(eq(maestroViewProgress.resourceId, res.id));
            }
            await tx.delete(maestroResources).where(eq(maestroResources.teacherId, teacher.id));
          }

          // Step 5 — Delete teachers
          await tx.delete(teachers).where(eq(teachers.institutionId, institutionId));
        }

        // Step 6 — Delete teacher invite codes, monthly winners, institution
        await tx.delete(teacherCodes).where(eq(teacherCodes.institutionId, institutionId));
        await tx.delete(monthlyWinners).where(eq(monthlyWinners.institutionId, institutionId));
        await tx.delete(institutions).where(eq(institutions.id, institutionId));
      });

      // Transaction committed — invalidate Redis cache (outside tx: Redis is not transactional)
      for (const cls of allClasses) {
        if (cls.classCode) await cacheDel(`cls:code:${cls.classCode.toUpperCase()}`);
      }

      // --- Audit: COMPLETED (outside tx — always persists) ---
      await db.insert(auditLogs).values({
        action: "DELETE_INSTITUTION_COMPLETED",
        userType: "admin",
        institutionId,
        details: JSON.stringify({
          teacherCount: teacherIds.length,
          classCount: classIds.length,
          studentCount: studentIds.length,
        }),
      }).catch(e => console.error("[AUDIT] DELETE_INSTITUTION_COMPLETED failed:", e));

    } catch (err) {
      // --- Audit: FAILED (outside tx — persists after rollback) ---
      await db.insert(auditLogs).values({
        action: "DELETE_INSTITUTION_FAILED",
        userType: "admin",
        institutionId,
        details: JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          teacherCount: teacherIds.length,
          classCount: classIds.length,
          studentCount: studentIds.length,
        }),
      }).catch(e => console.error("[AUDIT] DELETE_INSTITUTION_FAILED failed:", e));

      throw err; // Re-throw so the route handler returns 500
    }
  }

  async getInstitutionDetails(institutionId: string): Promise<{
    teachers: Array<{
      id: string; name: string; email: string;
      classes: Array<{
        id: string; name: string; classCode: string; maxStudents: number; expiresAt: string | null;
        students: Array<{
          id: string; firstName: string; lastName: string;
          rhythmLevel: number; rhythmStars: number;
          rhythmCorrect: number; rhythmWrong: number;
          notesLevel: number; notesStars: number;
          notesCorrect: number; notesWrong: number;
          drumTimeSeconds: number;
          melodyCorrect: number; melodyWrong: number; melodyStars: number;
          totalCorrect: number; totalTimeSeconds: number;
        }>;
      }>;
    }>;
  }> {
    const teacherList = await this.getTeachersByInstitution(institutionId);
    const result = [];
    for (const teacher of teacherList) {
      const classList = await this.getClassesByTeacher(teacher.id);
      const classResults = [];
      for (const cls of classList) {
        const progressList = await this.getClassProgress(cls.id);
        const studentRows = progressList.map(s => ({
          id: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          rhythmLevel: s.rhythmProgress?.level ?? 0,
          rhythmStars: s.rhythmProgress?.starsEarned ?? 0,
          rhythmCorrect: s.rhythmProgress?.correctAnswers ?? 0,
          rhythmWrong: s.rhythmProgress?.wrongAnswers ?? 0,
          notesLevel: s.notesProgress?.level ?? 0,
          notesStars: s.notesProgress?.starsEarned ?? 0,
          notesCorrect: s.notesProgress?.correctAnswers ?? 0,
          notesWrong: s.notesProgress?.wrongAnswers ?? 0,
          drumTimeSeconds: s.drumProgress?.timeSpentSeconds ?? 0,
          melodyCorrect: s.melodyProgress?.correctAnswers ?? 0,
          melodyWrong: s.melodyProgress?.wrongAnswers ?? 0,
          melodyStars: s.melodyProgress?.starsEarned ?? 0,
          totalCorrect: (s.rhythmProgress?.correctAnswers ?? 0) + (s.notesProgress?.correctAnswers ?? 0) + (s.melodyProgress?.correctAnswers ?? 0),
          totalTimeSeconds: (s.rhythmProgress?.timeSpentSeconds ?? 0) + (s.notesProgress?.timeSpentSeconds ?? 0) + (s.drumProgress?.timeSpentSeconds ?? 0) + (s.melodyProgress?.timeSpentSeconds ?? 0),
        }));
        classResults.push({
          id: cls.id,
          name: cls.name,
          classCode: cls.classCode,
          maxStudents: cls.maxStudents,
          expiresAt: cls.expiresAt ? cls.expiresAt.toISOString() : null,
          students: studentRows,
        });
      }
      result.push({ id: teacher.id, name: teacher.name, email: teacher.email ?? "", classes: classResults });
    }
    return { teachers: result };
  }

  async getAdminStats() {
    const [instCount, teacherCount, studentCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(institutions),
      db.select({ count: sql<number>`count(*)` }).from(teachers),
      db.select({ count: sql<number>`count(*)` }).from(students),
    ]);
    const progressStats = await db.select({
      totalCorrect: sql<number>`COALESCE(SUM(correct_answers), 0)`,
      totalTime: sql<number>`COALESCE(SUM(time_spent_seconds), 0)`,
    }).from(studentProgress);

    return {
      institutionCount: Number(instCount[0]?.count ?? 0),
      teacherCount: Number(teacherCount[0]?.count ?? 0),
      studentCount: Number(studentCount[0]?.count ?? 0),
      totalExercisesCompleted: Number(progressStats[0]?.totalCorrect ?? 0),
      totalTimeSpentSeconds: Number(progressStats[0]?.totalTime ?? 0),
    };
  }

  async getInstitutionIdForStudent(studentId: string): Promise<string | null> {
    const result = await db
      .select({ institutionId: teachers.institutionId })
      .from(students)
      .innerJoin(classes, and(eq(students.classId, classes.id), isNull(classes.deletedAt)))
      .innerJoin(teachers, eq(classes.teacherId, teachers.id))
      .where(eq(students.id, studentId))
      .limit(1);
    return result[0]?.institutionId ?? null;
  }

  async getClassIdForStudent(studentId: string): Promise<string | null> {
    const result = await db.select({ classId: students.classId }).from(students).where(eq(students.id, studentId)).limit(1);
    return result[0]?.classId ?? null;
  }

  async incrementMonthlyStats(studentId: string, deltaStars: number, deltaBadges: number): Promise<void> {
    if (deltaStars === 0 && deltaBadges === 0) return;
    const currentMonth = getCurrentMonth();
    await db.execute(sql`
      INSERT INTO monthly_stats (id, student_id, monthly_stars, monthly_badges_count, last_reset_month, updated_at)
      VALUES (gen_random_uuid(), ${studentId}, ${deltaStars}, ${deltaBadges}, ${currentMonth}, now())
      ON CONFLICT (student_id) DO UPDATE SET
        monthly_stars = LEAST(
          CASE WHEN monthly_stats.last_reset_month = ${currentMonth}
               THEN monthly_stats.monthly_stars + ${deltaStars}
               ELSE ${deltaStars} END,
          (SELECT COALESCE(SUM(stars_earned), 0) FROM student_progress WHERE student_id = ${studentId})
        ),
        monthly_badges_count = CASE WHEN monthly_stats.last_reset_month = ${currentMonth}
                                    THEN monthly_stats.monthly_badges_count + ${deltaBadges}
                                    ELSE ${deltaBadges} END,
        last_reset_month = ${currentMonth},
        updated_at = now()
    `);
  }

  async getLeaderboard(institutionId: string, type: "class" | "school" | "monthly", classId?: string, teacherId?: string): Promise<LeaderboardEntry[]> {
    const currentMonth = getCurrentMonth();
    const rows = await db.execute(sql`
      SELECT
        s.id AS student_id,
        s.first_name,
        s.last_name,
        c.name AS class_name,
        c.class_code,
        c.branch_name,
        i.name AS institution_name,
        COALESCE(SUM(sp.stars_earned), 0)::int AS total_stars,
        COUNT(CASE WHEN sp.notes_badge IS NOT NULL THEN 1 END)::int AS total_badges,
        LEAST(COALESCE(ms.monthly_stars, 0), COALESCE(SUM(sp.stars_earned), 0))::int AS monthly_stars,
        COALESCE(ms.monthly_badges_count, 0)::int AS monthly_badges,
        ms.last_reset_month
      FROM students s
      JOIN classes c ON s.class_id = c.id AND c.deleted_at IS NULL
      JOIN teachers t ON c.teacher_id = t.id
      JOIN institutions i ON t.institution_id = i.id
      LEFT JOIN student_progress sp ON sp.student_id = s.id
      LEFT JOIN monthly_stats ms ON ms.student_id = s.id
      WHERE t.institution_id = ${institutionId}
        ${classId ? sql`AND c.id = ${classId}` : sql``}
        ${teacherId ? sql`AND t.id = ${teacherId}` : sql``}
        AND EXISTS (SELECT 1 FROM student_codes sc WHERE sc.student_id = s.id)
      GROUP BY s.id, s.first_name, s.last_name, c.name, c.class_code, c.branch_name, i.name, ms.monthly_stars, ms.monthly_badges_count, ms.last_reset_month
    `);

    const entries = (rows.rows as any[]).map(row => {
      const totalStars = Number(row.total_stars);
      const totalBadges = Number(row.total_badges);
      const isSameMonth = row.last_reset_month === currentMonth;
      const monthlyStars = isSameMonth ? Number(row.monthly_stars) : 0;
      const monthlyBadges = isSameMonth ? Number(row.monthly_badges) : 0;
      return {
        rank: 0,
        studentId: row.student_id as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        className: (row.class_name as string) || "",
        classCode: row.class_code as string,
        branchName: (row.branch_name as string) || "",
        institutionName: row.institution_name as string,
        totalStars,
        totalBadges,
        totalScore: totalStars * 10 + totalBadges * 50,
        monthlyStars,
        monthlyBadges,
        monthlyScore: monthlyStars * 10 + monthlyBadges * 50,
      };
    });

    // Sort: primary = stars DESC, secondary = badges DESC (tiebreaker)
    if (type === "monthly") {
      entries.sort((a, b) => b.monthlyStars !== a.monthlyStars ? b.monthlyStars - a.monthlyStars : b.monthlyBadges - a.monthlyBadges);
    } else {
      entries.sort((a, b) => b.totalStars !== a.totalStars ? b.totalStars - a.totalStars : b.totalBadges - a.totalBadges);
    }
    entries.forEach((e, i) => { e.rank = i + 1; });
    return entries;
  }

  async getLastMonthWinners(institutionId: string): Promise<MonthlyWinner[]> {
    const prevMonth = getPreviousMonth();
    return db.select().from(monthlyWinners)
      .where(and(eq(monthlyWinners.institutionId, institutionId), eq(monthlyWinners.month, prevMonth)))
      .orderBy(monthlyWinners.rank);
  }

  async performMonthlyReset(institutionId: string): Promise<{ month: string; winners: MonthlyWinner[] }> {
    const currentMonth = getCurrentMonth();
    const leaderboard = await this.getLeaderboard(institutionId, "monthly");
    const top3 = leaderboard.filter(e => e.monthlyScore > 0).slice(0, 3);

    const savedWinners: MonthlyWinner[] = [];
    if (top3.length > 0) {
      await db.delete(monthlyWinners).where(
        and(eq(monthlyWinners.institutionId, institutionId), eq(monthlyWinners.month, currentMonth))
      );
      for (let i = 0; i < top3.length; i++) {
        const e = top3[i];
        const [w] = await db.insert(monthlyWinners).values({
          institutionId,
          month: currentMonth,
          studentId: e.studentId,
          firstName: e.firstName,
          lastName: e.lastName,
          classCode: e.classCode,
          score: e.monthlyStars,
          rank: i + 1,
        }).returning();
        savedWinners.push(w);
      }
    }

    const allStudentIds = leaderboard.map(e => e.studentId);
    if (allStudentIds.length > 0) {
      await db.update(monthlyStats).set({
        monthlyStars: 0,
        monthlyBadgesCount: 0,
        lastResetMonth: "",
        updatedAt: new Date(),
      }).where(inArray(monthlyStats.studentId, allStudentIds));
    }

    return { month: currentMonth, winners: savedWinners };
  }

  async getAllInstitutionIds(): Promise<string[]> {
    const rows = await db.execute(sql`SELECT id FROM institutions WHERE is_active = true`);
    return (rows.rows as any[]).map(r => r.id as string);
  }

  async autoCheckMonthlyReset(): Promise<void> {
    const prevMonth = getPreviousMonth();

    // Önceki aya ait monthly_stats olan öğrencileri kuruma göre grupla
    const statsRows = await db.execute(sql`
      SELECT
        ms.student_id,
        s.first_name,
        s.last_name,
        c.class_code,
        t.institution_id,
        ms.monthly_stars,
        ms.monthly_badges_count
      FROM monthly_stats ms
      JOIN students s ON s.id = ms.student_id
      JOIN classes c ON c.id = s.class_id
      JOIN teachers t ON t.id = c.teacher_id
      WHERE ms.last_reset_month = ${prevMonth}
        AND ms.monthly_stars > 0
      ORDER BY ms.monthly_stars DESC, ms.monthly_badges_count DESC
    `);

    if ((statsRows.rows as any[]).length === 0) return;

    // Kuruma göre grupla
    const byInstitution: Record<string, any[]> = {};
    for (const row of statsRows.rows as any[]) {
      const iid = row.institution_id as string;
      if (!byInstitution[iid]) byInstitution[iid] = [];
      byInstitution[iid].push(row);
    }

    for (const [institutionId, rows] of Object.entries(byInstitution)) {
      // Bu kurum için önceki ay zaten kaydedildiyse atla
      const alreadySaved = await db.execute(sql`
        SELECT 1 FROM monthly_winners WHERE institution_id = ${institutionId} AND month = ${prevMonth} LIMIT 1
      `);
      if ((alreadySaved.rows as any[]).length > 0) continue;

      const top3 = rows.slice(0, 3);
      for (let i = 0; i < top3.length; i++) {
        const e = top3[i];
        await db.insert(monthlyWinners).values({
          institutionId,
          month: prevMonth,
          studentId: e.student_id,
          firstName: e.first_name,
          lastName: e.last_name,
          classCode: e.class_code,
          score: Number(e.monthly_stars),
          rank: i + 1,
        });
      }
    }

    // Önceki aya ait monthly_stats sıfırla
    await db.execute(sql`
      UPDATE monthly_stats SET monthly_stars = 0, monthly_badges_count = 0, last_reset_month = '', updated_at = now()
      WHERE last_reset_month = ${prevMonth}
    `);
  }

  async seedData(): Promise<void> {
    // Admin ilk girişte otomatik oluşturuluyor, burada seed gerekmez.

    const [inst1] = await db.insert(institutions).values({
      name: "Sunshine Elementary School",
      licenseStart: new Date("2025-01-01"),
      licenseEnd: new Date("2026-12-31"),
      isActive: true,
    }).returning();

    const [inst2] = await db.insert(institutions).values({
      name: "Melody Primary Academy",
      licenseStart: new Date("2025-06-01"),
      licenseEnd: new Date("2027-05-31"),
      isActive: true,
    }).returning();

    const hashedTeacherPw = await bcrypt.hash("teacher123", 10);
    const [teacher1] = await db.insert(teachers).values({
      institutionId: inst1.id,
      name: "Ms. Sarah Johnson",
      email: "sarah@sunshine.edu",
      password: hashedTeacherPw,
    }).returning();

    const [teacher2] = await db.insert(teachers).values({
      institutionId: inst2.id,
      name: "Mr. David Park",
      email: "david@melody.edu",
      password: hashedTeacherPw,
    }).returning();

    const [class1] = await db.insert(classes).values({
      teacherId: teacher1.id,
      name: "Grade 2A Music",
      classCode: "SUN2A1",
      maxStudents: 25,
      expiresAt: new Date("2026-06-30"),
    }).returning();

    const [class2] = await db.insert(classes).values({
      teacherId: teacher1.id,
      name: "Grade 3B Music",
      classCode: "SUN3B1",
      maxStudents: 20,
      expiresAt: new Date("2026-06-30"),
    }).returning();

    const studentData = [
      { classId: class1.id, firstName: "Emma", lastName: "Wilson" },
      { classId: class1.id, firstName: "Liam", lastName: "Garcia" },
      { classId: class1.id, firstName: "Olivia", lastName: "Chen" },
      { classId: class1.id, firstName: "Noah", lastName: "Thompson" },
      { classId: class1.id, firstName: "Ava", lastName: "Martinez" },
      { classId: class2.id, firstName: "James", lastName: "Brown" },
      { classId: class2.id, firstName: "Sophia", lastName: "Davis" },
    ];

    const createdStudents = await db.insert(students).values(studentData).returning();

    for (const student of createdStudents) {
      await db.insert(studentProgress).values([
        {
          studentId: student.id,
          appType: "rhythm",
          level: Math.floor(Math.random() * 4) + 1,
          starsEarned: Math.floor(Math.random() * 10),
          correctAnswers: Math.floor(Math.random() * 50) + 10,
          wrongAnswers: Math.floor(Math.random() * 15),
          timeSpentSeconds: Math.floor(Math.random() * 3600) + 300,
        },
        {
          studentId: student.id,
          appType: "notes",
          level: Math.floor(Math.random() * 3) + 1,
          starsEarned: Math.floor(Math.random() * 8),
          correctAnswers: Math.floor(Math.random() * 40) + 5,
          wrongAnswers: Math.floor(Math.random() * 10),
          timeSpentSeconds: Math.floor(Math.random() * 2400) + 200,
        },
      ]);
    }
  }

  // Orchestra Songs
  async getOrchestraSongsByTeacher(teacherId: string): Promise<OrchestraSong[]> {
    return db.select().from(orchestraSongs)
      .where(eq(orchestraSongs.teacherId, teacherId))
      .orderBy(desc(orchestraSongs.createdAt));
  }

  async getOrchestraSong(id: string): Promise<OrchestraSong | undefined> {
    const result = await db.select().from(orchestraSongs).where(eq(orchestraSongs.id, id)).limit(1);
    return result[0];
  }

  async getOrchestraSongByStoredFilename(storedFilename: string): Promise<OrchestraSong | undefined> {
    const result = await db.select().from(orchestraSongs).where(eq(orchestraSongs.storedFilename, storedFilename)).limit(1);
    return result[0];
  }

  async createOrchestraSong(data: Omit<OrchestraSong, "id" | "createdAt">): Promise<OrchestraSong> {
    const [song] = await db.insert(orchestraSongs).values(data).returning();
    return song;
  }

  async updateOrchestraSong(id: string, data: Partial<OrchestraSong>): Promise<OrchestraSong | undefined> {
    const [song] = await db.update(orchestraSongs).set(data).where(eq(orchestraSongs.id, id)).returning();
    return song;
  }

  async deleteOrchestraSong(id: string): Promise<void> {
    await db.delete(orchestraProgress).where(eq(orchestraProgress.songId, id));
    await db.delete(orchestraSongs).where(eq(orchestraSongs.id, id));
  }

  async countOrchestraSongsByTeacher(teacherId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(orchestraSongs)
      .where(eq(orchestraSongs.teacherId, teacherId));
    return Number(result[0]?.count ?? 0);
  }

  async getOrchestraSongsByClass(classId: string): Promise<OrchestraSong[]> {
    const cls = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
    if (!cls[0]) return [];
    return this.getOrchestraSongsByTeacher(cls[0].teacherId);
  }

  // Orchestra Progress
  async createOrchestraProgress(data: Omit<OrchestraProgress, "id" | "completedAt">): Promise<OrchestraProgress> {
    const [progress] = await db.insert(orchestraProgress).values(data).returning();
    return progress;
  }

  async getOrchestraProgressByStudent(studentId: string): Promise<OrchestraProgress[]> {
    return db.select().from(orchestraProgress)
      .where(eq(orchestraProgress.studentId, studentId))
      .orderBy(desc(orchestraProgress.completedAt));
  }

  async getOrchestraProgressByTeacher(teacherId: string): Promise<Array<OrchestraProgress & { studentName: string; songName: string }>> {
    const teacherSongs = await db.select({ id: orchestraSongs.id }).from(orchestraSongs)
      .where(eq(orchestraSongs.teacherId, teacherId));
    if (teacherSongs.length === 0) return [];

    const rows = await db
      .select({
        id: orchestraProgress.id,
        studentId: orchestraProgress.studentId,
        songId: orchestraProgress.songId,
        mode: orchestraProgress.mode,
        laneMode: orchestraProgress.laneMode,
        accuracy: orchestraProgress.accuracy,
        perfectCount: orchestraProgress.perfectCount,
        goodCount: orchestraProgress.goodCount,
        missCount: orchestraProgress.missCount,
        completedAt: orchestraProgress.completedAt,
        studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`,
        songName: orchestraSongs.name,
      })
      .from(orchestraProgress)
      .innerJoin(students, eq(orchestraProgress.studentId, students.id))
      .innerJoin(orchestraSongs, eq(orchestraProgress.songId, orchestraSongs.id))
      .where(eq(orchestraSongs.teacherId, teacherId))
      .orderBy(desc(orchestraProgress.completedAt));

    return rows;
  }

  // ── Maestro Resources ──────────────────────────────────────────────────────
  async createMaestroResource(data: Omit<MaestroResource, "id" | "createdAt">): Promise<MaestroResource> {
    const [r] = await db.insert(maestroResources).values(data).returning();
    return r;
  }

  async getMaestroResourcesByTeacher(teacherId: string): Promise<MaestroResource[]> {
    const rows = await db.select({
      id: maestroResources.id,
      teacherId: maestroResources.teacherId,
      type: maestroResources.type,
      title: maestroResources.title,
      originalFilename: maestroResources.originalFilename,
      storedFilename: maestroResources.storedFilename,
      durationSeconds: maestroResources.durationSeconds,
      fileSize: maestroResources.fileSize,
      fileData: sql<null>`null`,
      createdAt: maestroResources.createdAt,
    }).from(maestroResources)
      .where(eq(maestroResources.teacherId, teacherId))
      .orderBy(maestroResources.createdAt);
    return rows as MaestroResource[];
  }

  async getMaestroResourcesByClass(classId: string): Promise<MaestroResource[]> {
    const cls = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
    if (!cls[0]) return [];
    return this.getMaestroResourcesByTeacher(cls[0].teacherId);
  }

  async getMaestroResource(id: string): Promise<MaestroResource | undefined> {
    const [r] = await db.select().from(maestroResources).where(eq(maestroResources.id, id)).limit(1);
    return r;
  }

  async getMaestroResourceByStoredFilename(storedFilename: string): Promise<MaestroResource | undefined> {
    const [r] = await db.select().from(maestroResources).where(eq(maestroResources.storedFilename, storedFilename)).limit(1);
    return r;
  }

  async deleteMaestroResource(id: string): Promise<void> {
    await db.delete(maestroViewProgress).where(eq(maestroViewProgress.resourceId, id));
    await db.delete(maestroResources).where(eq(maestroResources.id, id));
  }

  async countMaestroVideosByTeacher(teacherId: string): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)` })
      .from(maestroResources)
      .where(and(eq(maestroResources.teacherId, teacherId), eq(maestroResources.type, "video")));
    return Number(row?.count ?? 0);
  }

  // ── Maestro View Progress ──────────────────────────────────────────────────
  async upsertMaestroViewProgress(studentId: string, resourceId: string, watchedSeconds: number, completed: boolean): Promise<MaestroViewProgress> {
    const [row] = await db.insert(maestroViewProgress)
      .values({ studentId, resourceId, watchedSeconds, completed })
      .onConflictDoUpdate({
        target: [maestroViewProgress.studentId, maestroViewProgress.resourceId],
        set: {
          watchedSeconds: sql`greatest(excluded.watched_seconds, maestro_view_progress.watched_seconds)`,
          completed: sql`excluded.completed OR maestro_view_progress.completed`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getMaestroViewProgressByTeacher(teacherId: string): Promise<Array<{ resourceId: string; resourceTitle: string; studentId: string; studentName: string; watchedSeconds: number; completed: boolean; durationSeconds: number }>> {
    const rows = await db
      .select({
        resourceId: maestroResources.id,
        resourceTitle: maestroResources.title,
        durationSeconds: maestroResources.durationSeconds,
        studentId: students.id,
        studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`,
        watchedSeconds: maestroViewProgress.watchedSeconds,
        completed: maestroViewProgress.completed,
      })
      .from(maestroViewProgress)
      .innerJoin(maestroResources, eq(maestroViewProgress.resourceId, maestroResources.id))
      .innerJoin(students, eq(maestroViewProgress.studentId, students.id))
      .where(eq(maestroResources.teacherId, teacherId))
      .orderBy(maestroResources.createdAt, students.firstName);
    return rows;
  }

  async getMaestroViewProgressByStudent(studentId: string): Promise<MaestroViewProgress[]> {
    return db.select().from(maestroViewProgress)
      .where(eq(maestroViewProgress.studentId, studentId));
  }
}

export const storage = new DatabaseStorage();
