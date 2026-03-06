# NoteBeat Kids — replit.md

## Overview

NoteBeat Kids is a web-based interactive music education platform aimed at elementary school students (ages 6–10). It teaches rhythm reading and musical note recognition through gamified activities. The app has three distinct user roles — **Admin**, **Teacher**, and **Student** — each with different dashboards and permissions. The home screen presents large, child-friendly role-selection buttons to direct users to the appropriate login flow.

Core features include:
- **Rhythm Game**: Students tap along to rhythm patterns rendered via VexFlow music notation
- **Note Detective**: Students identify musical notes displayed on a staff
- **Level Map**: A visual progression map showing unlocked/completed levels and stars earned
- **Teacher Dashboard**: Class management, student roster, QR code generation for class join codes, and progress charts
- **Admin Dashboard**: Institution management, per-slot individual teacher codes (QR + copy), teacher creation, license/subscription management, and platform-wide stats

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side router)
- **State / Data Fetching**: TanStack React Query (`@tanstack/react-query`) for server state; React Context (`AuthProvider` in `client/src/lib/auth.tsx`) for session state
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives + Tailwind CSS
- **Forms**: React Hook Form + Zod validation via `@hookform/resolvers`
- **Animation**: Framer Motion for page transitions and floating decorations
- **Music Notation Rendering**: VexFlow — renders staves, notes, beams, and time signatures to SVG inside `VexFlowRenderer` component (`client/src/components/vexflow-renderer.tsx`)
- **Audio**: Web Audio API (browser native) used inside the rhythm game for the metronome engine
- **Charts**: Recharts (`BarChart`) used in the class detail page for student progress visualization
- **QR Codes**: `qrcode.react` for generating class join QR codes; `html5-qrcode` for scanning them in the student login flow
- **Font**: Nunito / Nunito Sans (Google Fonts), loaded via `<link>` in `index.html`

**Path Aliases**:
- `@/` → `client/src/`
- `@shared/` → `shared/`
- `@assets/` → `attached_assets/`

### Backend

- **Runtime**: Node.js with Express (TypeScript, run via `tsx`)
- **Session Management**: `express-session` with an in-memory store (development); `connect-pg-simple` is available as a dependency for persisting sessions to Postgres in production
- **Auth Strategy**: Session-based authentication (not JWT). After a successful login, `req.session` stores `adminId` or `teacherId`. Students use `localStorage` for their lightweight session (`notebeat_student_session` key).
- **Password Hashing**: `bcryptjs`
- **API Structure**: REST endpoints registered in `server/routes.ts`, all prefixed with `/api/`:
  - `/api/auth/admin/*` — admin login/logout/me
  - `/api/auth/teacher/*` — teacher login/logout/me
  - `/api/student/*` — student login, progress read/write
  - `/api/teacher/*` — class CRUD, class detail/progress
  - `/api/admin/*` — institution CRUD, teacher CRUD, stats
- **Dev Server Integration**: In development, Vite runs as middleware inside the Express server (`server/vite.ts`); in production, pre-built static files are served from `dist/public/`
- **Build**: Custom build script (`script/build.ts`) runs Vite for the client and esbuild for the server, outputting a single `dist/index.cjs`

### Data Layer

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (connection via `DATABASE_URL` environment variable)
- **Schema** (`shared/schema.ts`): Five tables
  - `admins` — platform superadmin accounts (email + bcrypt password)
  - `institutions` — schools/orgs with license dates, teacher/student limits
  - `teachers` — belong to an institution; email + bcrypt password
  - `classes` — belong to a teacher; have a unique 6-char `classCode`, optional expiry, max student cap
  - `students` — belong to a class; no password (identified by first name + last name + class code)
  - `student_progress` — tracks per-student progress per app type (`rhythm` or `notes`): level, stars, correct/wrong counts, time spent
- **Validation**: Drizzle-Zod (`drizzle-zod`) generates Zod schemas from Drizzle table definitions
- **Migrations**: Drizzle Kit (`drizzle-kit push` / `migrations/` directory)
- **Storage abstraction**: `server/storage.ts` exports an `IStorage` interface and a concrete implementation that wraps all DB queries, keeping routes clean

### Authentication & Authorization

| Role    | Auth Mechanism                        | Session Storage        |
|---------|---------------------------------------|------------------------|
| Admin   | Email + bcrypt password               | Server session         |
| Teacher | Email + bcrypt password               | Server session         |
| Student | First name + Last name + Class code   | `localStorage` (client)|

Protected routes check session on the server; client pages re-fetch `/api/auth/*/me` on mount to restore state after page reload.

---

## External Dependencies

| Dependency | Purpose |
|---|---|
| **PostgreSQL** | Primary relational database (requires `DATABASE_URL` env var) |
| **VexFlow** | Music notation rendering (staves, notes, beams) to SVG |
| **Framer Motion** | UI animations and transitions |
| **Recharts** | Bar charts for student progress in teacher dashboard |
| **qrcode.react** | Generates QR codes for class join links |
| **html5-qrcode** | Camera-based QR code scanner on student login page |
| **Google Fonts** (CDN) | Nunito / Nunito Sans font families loaded in `index.html` |
| **Radix UI** | Headless accessible component primitives (full suite) |
| **TanStack React Query** | Server state management and caching |
| **Zod** | Runtime schema validation (forms + API) |
| **bcryptjs** | Password hashing (admin and teacher accounts) |
| **express-session** | Server-side session handling |
| **connect-pg-simple** | (Available) PostgreSQL-backed session store for production |
| **Drizzle ORM + drizzle-kit** | Type-safe database queries and schema migrations |
| **Replit Vite plugins** | `@replit/vite-plugin-runtime-error-modal`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner` (dev only) |

### Environment Variables Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Secret for signing express-session cookies (falls back to a hardcoded dev default) |