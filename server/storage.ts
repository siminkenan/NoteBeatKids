import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db } from "./db";
import bcrypt from "bcryptjs";
import {
  institutions, admins, teachers, classes, students, studentProgress, teacherCodes, studentCodes,
  orchestraSongs, orchestraProgress, maestroResources, maestroViewProgress,
  monthlyStats, monthlyWinners,
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

export type LeaderboardEntry = {
  rank: number;
  studentId: string;
  firstName: string;
  lastName: string;
  classCode: string;
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
  getLeaderboard(institutionId: string, type: "class" | "school" | "monthly", classId?: string): Promise<LeaderboardEntry[]>;
  getLastMonthWinners(institutionId: string): Promise<MonthlyWinner[]>;
  incrementMonthlyStats(studentId: string, deltaStars: number, deltaBadges: number): Promise<void>;
  performMonthlyReset(institutionId: string): Promise<{ month: string; winners: MonthlyWinner[] }>;
  getInstitutionIdForStudent(studentId: string): Promise<string | null>;
  getClassIdForStudent(studentId: string): Promise<string | null>;
  // Seed
  seedData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const result = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
    return result[0];
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
    await this.generateTeacherCodesForInstitution(inst.id, count, 1);
    return inst;
  }

  async getInstitutionByTeacherCode(code: string): Promise<Institution | undefined> {
    const result = await db.select().from(institutions).where(eq(institutions.teacherCode, code.toUpperCase())).limit(1);
    return result[0];
  }

  async generateTeacherCodesForInstitution(institutionId: string, count: number, startSlot = 1): Promise<TeacherCode[]> {
    const rows = [];
    for (let i = 0; i < count; i++) {
      const code = await this.uniqueTeacherCode();
      rows.push({ institutionId, code, slotNumber: startSlot + i });
    }
    if (rows.length === 0) return [];
    const result = await db.insert(teacherCodes).values(rows).returning();
    return result;
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
    const result = await db.select().from(studentCodes).where(eq(studentCodes.code, code.toUpperCase())).limit(1);
    return result[0];
  }

  async linkStudentToStudentCode(code: string, studentId: string): Promise<void> {
    await db.update(studentCodes)
      .set({ studentId })
      .where(eq(studentCodes.code, code.toUpperCase()));
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
    const result = await db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
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
        teacherName: teachers.name,
        teacherEmail: teachers.email,
        institutionName: institutions.name,
      })
      .from(classes)
      .leftJoin(teachers, eq(classes.teacherId, teachers.id))
      .leftJoin(institutions, eq(teachers.institutionId, institutions.id))
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
    return db.select().from(classes).where(eq(classes.teacherId, teacherId)).orderBy(classes.createdAt);
  }

  async getClass(id: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
    return result[0];
  }

  async getClassByCode(code: string): Promise<Class | undefined> {
    const result = await db.select().from(classes).where(eq(classes.classCode, code.toUpperCase())).limit(1);
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
    // 1. Collect student IDs first
    const studentList = await this.getStudentsByClass(id);
    const studentIds = studentList.map(s => s.id);

    // 2. Bulk-delete all dependent rows in one query each (avoids FK violations)
    if (studentIds.length > 0) {
      await db.delete(maestroViewProgress).where(inArray(maestroViewProgress.studentId, studentIds));
      await db.delete(studentProgress).where(inArray(studentProgress.studentId, studentIds));
      await db.delete(orchestraProgress).where(inArray(orchestraProgress.studentId, studentIds));
    }

    // 3. Nullify studentId refs in student_codes (FK: student_codes.studentId → students.id)
    await db.update(studentCodes).set({ studentId: null }).where(eq(studentCodes.classId, id));
    // 4. Now safe to delete students
    await db.delete(students).where(eq(students.classId, id));
    // 5. Delete student_codes for the class
    await db.delete(studentCodes).where(eq(studentCodes.classId, id));
    // 6. Delete the class
    await db.delete(classes).where(eq(classes.id, id));
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

  async getProgressByStudent(studentId: string): Promise<StudentProgress[]> {
    return db.select().from(studentProgress).where(eq(studentProgress.studentId, studentId));
  }

  async getProgressByStudentAndType(studentId: string, appType: string): Promise<StudentProgress | undefined> {
    const result = await db.select().from(studentProgress).where(
      and(eq(studentProgress.studentId, studentId), eq(studentProgress.appType, appType))
    ).limit(1);
    return result[0];
  }

  async upsertProgress(studentId: string, appType: string, data: Partial<InsertProgress>): Promise<StudentProgress> {
    const existing = await this.getProgressByStudentAndType(studentId, appType);
    const oldStars = existing?.starsEarned ?? 0;
    const newStars = data.starsEarned ?? 0;
    const deltaStars = Math.max(0, newStars - oldStars);
    const oldHadBadge = !!existing?.notesBadge;
    const newHasBadge = !!data.notesBadge;
    const deltaBadges = (!oldHadBadge && newHasBadge) ? 1 : 0;

    let result: StudentProgress;
    if (existing) {
      const updated = await db.update(studentProgress)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(studentProgress.id, existing.id))
        .returning();
      result = updated[0];
    } else {
      const inserted = await db.insert(studentProgress).values({
        studentId,
        appType,
        level: data.level ?? 1,
        starsEarned: data.starsEarned ?? 0,
        correctAnswers: data.correctAnswers ?? 0,
        wrongAnswers: data.wrongAnswers ?? 0,
        timeSpentSeconds: data.timeSpentSeconds ?? 0,
        notesBadge: data.notesBadge ?? null,
      }).returning();
      result = inserted[0];
    }

    this.incrementMonthlyStats(studentId, deltaStars, deltaBadges).catch(() => {});
    return result;
  }

  async getClassProgress(classId: string): Promise<Array<Student & { rhythmProgress?: StudentProgress; notesProgress?: StudentProgress; drumProgress?: StudentProgress; melodyProgress?: StudentProgress }>> {
    const studentList = await this.getStudentsByClass(classId);
    const result = [];
    for (const student of studentList) {
      const progress = await this.getProgressByStudent(student.id);
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
    await this.resetInstitutionQuota(institutionId);
    const institutionTeachers = await this.getTeachersByInstitution(institutionId);
    for (const teacher of institutionTeachers) {
      // 1. Delete all classes (cascades: student progress, student codes, students)
      const teacherClasses = await this.getClassesByTeacher(teacher.id);
      for (const cls of teacherClasses) {
        await this.deleteClass(cls.id);
      }
      // 2. Delete orchestra progress for this teacher's songs
      const teacherSongs = await db
        .select({ id: orchestraSongs.id })
        .from(orchestraSongs)
        .where(eq(orchestraSongs.teacherId, teacher.id));
      for (const song of teacherSongs) {
        await db.delete(orchestraProgress).where(eq(orchestraProgress.songId, song.id));
      }
      // 3. Delete orchestra songs (FK: orchestra_songs.teacher_id → teachers.id)
      await db.delete(orchestraSongs).where(eq(orchestraSongs.teacherId, teacher.id));
      // 4. Delete maestro view progress & resources
      const teacherResources = await db
        .select({ id: maestroResources.id })
        .from(maestroResources)
        .where(eq(maestroResources.teacherId, teacher.id));
      for (const res of teacherResources) {
        await db.delete(maestroViewProgress).where(eq(maestroViewProgress.resourceId, res.id));
      }
      await db.delete(maestroResources).where(eq(maestroResources.teacherId, teacher.id));
    }
    // 5. Delete teacher invite codes
    await db.delete(teacherCodes).where(eq(teacherCodes.institutionId, institutionId));
    // 6. Delete teachers, then institution
    await db.delete(teachers).where(eq(teachers.institutionId, institutionId));
    await db.delete(institutions).where(eq(institutions.id, institutionId));
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
      result.push({ id: teacher.id, name: teacher.name, email: teacher.email, classes: classResults });
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
      .innerJoin(classes, eq(students.classId, classes.id))
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
        monthly_stars = CASE WHEN monthly_stats.last_reset_month = ${currentMonth}
                             THEN monthly_stats.monthly_stars + ${deltaStars}
                             ELSE ${deltaStars} END,
        monthly_badges_count = CASE WHEN monthly_stats.last_reset_month = ${currentMonth}
                                    THEN monthly_stats.monthly_badges_count + ${deltaBadges}
                                    ELSE ${deltaBadges} END,
        last_reset_month = ${currentMonth},
        updated_at = now()
    `);
  }

  async getLeaderboard(institutionId: string, type: "class" | "school" | "monthly", classId?: string): Promise<LeaderboardEntry[]> {
    const currentMonth = getCurrentMonth();
    const rows = await db.execute(sql`
      SELECT
        s.id AS student_id,
        s.first_name,
        s.last_name,
        c.class_code,
        COALESCE(SUM(sp.stars_earned), 0)::int AS total_stars,
        COUNT(CASE WHEN sp.notes_badge IS NOT NULL THEN 1 END)::int AS total_badges,
        COALESCE(ms.monthly_stars, 0)::int AS monthly_stars,
        COALESCE(ms.monthly_badges_count, 0)::int AS monthly_badges,
        ms.last_reset_month
      FROM students s
      JOIN classes c ON s.class_id = c.id
      JOIN teachers t ON c.teacher_id = t.id
      LEFT JOIN student_progress sp ON sp.student_id = s.id
      LEFT JOIN monthly_stats ms ON ms.student_id = s.id
      WHERE t.institution_id = ${institutionId}
        ${classId ? sql`AND c.id = ${classId}` : sql``}
      GROUP BY s.id, s.first_name, s.last_name, c.class_code, ms.monthly_stars, ms.monthly_badges_count, ms.last_reset_month
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
        classCode: row.class_code as string,
        totalStars,
        totalBadges,
        totalScore: totalStars * 10 + totalBadges * 50,
        monthlyStars,
        monthlyBadges,
        monthlyScore: monthlyStars * 10 + monthlyBadges * 50,
      };
    });

    const sortKey = type === "monthly" ? "monthlyStars" : "totalStars";
    entries.sort((a, b) => b[sortKey] - a[sortKey]);
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

  async seedData(): Promise<void> {
    const ADMIN_EMAIL = "admin@notebeatkids.com";
    const ADMIN_PASSWORD = "114344_Kenan";

    const existingAdmin = await this.getAdminByEmail(ADMIN_EMAIL);
    if (existingAdmin) {
      // Ensure password is always up-to-date
      const ok = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.password);
      if (!ok) {
        const hashedPw = await bcrypt.hash(ADMIN_PASSWORD, 10);
        await db.update(admins).set({ password: hashedPw }).where(eq(admins.email, ADMIN_EMAIL));
      }
      return;
    }

    const hashedPw = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.insert(admins).values({
      email: ADMIN_EMAIL,
      password: hashedPw,
      name: "System Admin",
    });

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
