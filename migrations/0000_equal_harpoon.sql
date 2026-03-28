CREATE TABLE "admins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text DEFAULT 'Admin' NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar NOT NULL,
	"name" text NOT NULL,
	"class_code" varchar(6) NOT NULL,
	"max_students" integer DEFAULT 30 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classes_class_code_unique" UNIQUE("class_code")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"license_start" timestamp NOT NULL,
	"license_end" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_teachers" integer DEFAULT 10000 NOT NULL,
	"max_students" integer DEFAULT 10000000 NOT NULL,
	"teacher_code" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_teacher_code_unique" UNIQUE("teacher_code")
);
--> statement-breakpoint
CREATE TABLE "maestro_resources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"file_data" text,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maestro_view_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"resource_id" varchar NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"monthly_stars" integer DEFAULT 0 NOT NULL,
	"monthly_badges_count" integer DEFAULT 0 NOT NULL,
	"last_reset_month" varchar(7) DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_stats_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "monthly_winners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" varchar NOT NULL,
	"month" varchar(7) NOT NULL,
	"student_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"class_code" varchar(6),
	"score" integer DEFAULT 0 NOT NULL,
	"rank" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orchestra_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"song_id" varchar NOT NULL,
	"mode" text DEFAULT 'original' NOT NULL,
	"lane_mode" text DEFAULT 'full' NOT NULL,
	"accuracy" integer DEFAULT 0 NOT NULL,
	"perfect_count" integer DEFAULT 0 NOT NULL,
	"good_count" integer DEFAULT 0 NOT NULL,
	"miss_count" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orchestra_songs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" varchar NOT NULL,
	"name" text NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"file_data" text,
	"bpm" integer DEFAULT 120 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"rhythm_pattern_original" text DEFAULT '{}' NOT NULL,
	"rhythm_pattern_kids" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sid" varchar NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL,
	CONSTRAINT "session_pkey" PRIMARY KEY("sid")
);
--> statement-breakpoint
CREATE TABLE "student_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"code" varchar(8) NOT NULL,
	"slot_number" integer NOT NULL,
	"student_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "student_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"app_type" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"stars_earned" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"wrong_answers" integer DEFAULT 0 NOT NULL,
	"time_spent_seconds" integer DEFAULT 0 NOT NULL,
	"notes_badge" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" varchar NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" varchar NOT NULL,
	"code" varchar(10) NOT NULL,
	"teacher_id" varchar,
	"slot_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" varchar,
	"name" text NOT NULL,
	"email" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maestro_resources" ADD CONSTRAINT "maestro_resources_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maestro_view_progress" ADD CONSTRAINT "maestro_view_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maestro_view_progress" ADD CONSTRAINT "maestro_view_progress_resource_id_maestro_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."maestro_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_stats" ADD CONSTRAINT "monthly_stats_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_winners" ADD CONSTRAINT "monthly_winners_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_winners" ADD CONSTRAINT "monthly_winners_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestra_progress" ADD CONSTRAINT "orchestra_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestra_progress" ADD CONSTRAINT "orchestra_progress_song_id_orchestra_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."orchestra_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orchestra_songs" ADD CONSTRAINT "orchestra_songs_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_codes" ADD CONSTRAINT "student_codes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_codes" ADD CONSTRAINT "student_codes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_progress" ADD CONSTRAINT "student_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_codes" ADD CONSTRAINT "teacher_codes_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_codes" ADD CONSTRAINT "teacher_codes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mvp_student_resource_idx" ON "maestro_view_progress" USING btree ("student_id","resource_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "session" USING btree ("expire");