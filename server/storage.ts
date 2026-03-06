import { eq, and, sql } from "drizzle-orm";
import { db } from "./db";
import {
  institutions, admins, teachers, classes, students, studentProgress,
  type Institution, type InsertInstitution,
  type Admin, type Teacher, type InsertTeacher,
  type Class, type InsertClass,
  type Student, type InsertStudent,
  type StudentProgress, type InsertProgress,
} from "@shared/schema";
import bcrypt from "bcryptjs";

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
  // Classes
  getAllClasses(): Promise<Array<Class & { teacherName: string; teacherEmail: string; institutionName: string | null; studentCount: number }>>;
  getClassesByTeacher(teacherId: string): Promise<Class[]>;
  getClass(id: string): Promise<Class | undefined>;
  getClassByCode(code: string): Promise<Class | undefined>;
  createClass(data: InsertClass & { classCode: string }): Promise<Class>;
  deleteClass(id: string): Promise<void>;
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
  getClassProgress(classId: string): Promise<Array<Student & { rhythmProgress?: StudentProgress; notesProgress?: StudentProgress }>>;
  // Reset institution quota (delete all students/classes for all teachers in institution)
  resetInstitutionQuota(institutionId: string): Promise<void>;
  // Stats
  getAdminStats(): Promise<{
    institutionCount: number;
    teacherCount: number;
    studentCount: number;
    totalExercisesCompleted: number;
    totalTimeSpentSeconds: number;
  }>;
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

  async createInstitution(data: InsertInstitution): Promise<Institution> {
    const result = await db.insert(institutions).values(data).returning();
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
    const hashed = await bcrypt.hash(data.password, 10);
    const result = await db.insert(teachers).values({ ...data, password: hashed }).returning();
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
    return result[0];
  }

  async deleteClass(id: string): Promise<void> {
    // Delete student progress and students first (FK constraints)
    const studentList = await this.getStudentsByClass(id);
    for (const student of studentList) {
      await db.delete(studentProgress).where(eq(studentProgress.studentId, student.id));
    }
    await db.delete(students).where(eq(students.classId, id));
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
    if (existing) {
      const updated = await db.update(studentProgress)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(studentProgress.id, existing.id))
        .returning();
      return updated[0];
    } else {
      const result = await db.insert(studentProgress).values({
        studentId,
        appType,
        level: data.level ?? 1,
        starsEarned: data.starsEarned ?? 0,
        correctAnswers: data.correctAnswers ?? 0,
        wrongAnswers: data.wrongAnswers ?? 0,
        timeSpentSeconds: data.timeSpentSeconds ?? 0,
      }).returning();
      return result[0];
    }
  }

  async getClassProgress(classId: string): Promise<Array<Student & { rhythmProgress?: StudentProgress; notesProgress?: StudentProgress }>> {
    const studentList = await this.getStudentsByClass(classId);
    const result = [];
    for (const student of studentList) {
      const progress = await this.getProgressByStudent(student.id);
      const rhythmProgress = progress.find(p => p.appType === 'rhythm');
      const notesProgress = progress.find(p => p.appType === 'notes');
      result.push({ ...student, rhythmProgress, notesProgress });
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

  async seedData(): Promise<void> {
    const existingAdmin = await this.getAdminByEmail("admin@notebeatkids.com");
    if (existingAdmin) return;

    const hashedPw = await bcrypt.hash("admin123", 10);
    await db.insert(admins).values({
      email: "admin@notebeatkids.com",
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
}

export const storage = new DatabaseStorage();
