import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const institutions = pgTable("institutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  licenseStart: timestamp("license_start").notNull(),
  licenseEnd: timestamp("license_end").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  maxTeachers: integer("max_teachers").notNull().default(2000),
  maxStudents: integer("max_students").notNull().default(6000),
  teacherCode: varchar("teacher_code", { length: 10 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull().default("Admin"),
});

export const teachers = pgTable("teachers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  institutionId: varchar("institution_id").references(() => institutions.id),
  name: text("name").notNull(),
  email: text("email").unique(),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classes = pgTable("classes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: varchar("teacher_id").references(() => teachers.id).notNull(),
  name: text("name").notNull(),
  classCode: varchar("class_code", { length: 6 }).notNull().unique(),
  maxStudents: integer("max_students").notNull().default(30),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").references(() => classes.id).notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentProgress = pgTable("student_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").references(() => students.id).notNull(),
  appType: text("app_type").notNull(),
  level: integer("level").notNull().default(1),
  starsEarned: integer("stars_earned").notNull().default(0),
  correctAnswers: integer("correct_answers").notNull().default(0),
  wrongAnswers: integer("wrong_answers").notNull().default(0),
  timeSpentSeconds: integer("time_spent_seconds").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teacherCodes = pgTable("teacher_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  institutionId: varchar("institution_id").references(() => institutions.id).notNull(),
  code: varchar("code", { length: 10 }).notNull().unique(),
  teacherId: varchar("teacher_id").references(() => teachers.id),
  slotNumber: integer("slot_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentCodes = pgTable("student_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  classId: varchar("class_id").references(() => classes.id).notNull(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  slotNumber: integer("slot_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstitutionSchema = createInsertSchema(institutions).omit({ id: true, createdAt: true });
export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true, createdAt: true }).extend({
  email: z.string().email().optional().nullable(),
  password: z.string().optional().nullable(),
});
export const insertClassSchema = createInsertSchema(classes).omit({ id: true, classCode: true, createdAt: true });
export const insertStudentSchema = createInsertSchema(students).omit({ id: true, createdAt: true });
export const insertProgressSchema = createInsertSchema(studentProgress).omit({ id: true, updatedAt: true });

export type Institution = typeof institutions.$inferSelect;
export type InsertInstitution = z.infer<typeof insertInstitutionSchema>;
export type Admin = typeof admins.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type InsertProgress = z.infer<typeof insertProgressSchema>;
export type TeacherCode = typeof teacherCodes.$inferSelect;
export type StudentCode = typeof studentCodes.$inferSelect;

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
