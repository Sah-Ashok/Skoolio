# 🎓 Skoolio — Developer Documentation

> **Version:** 1.0 · **Stack:** Next.js + Express + PostgreSQL + Redis + Azure  
> **Last updated:** August 2026  
> **Audience:** Developers working on the Skoolio codebase

---

## Table of Contents

| # | Section |
|---|---|
| 1 | [Project Overview](#1-project-overview) |
| 2 | [Repository Structure](#2-repository-structure) |
| 3 | [Architecture](#3-architecture) |
| 4 | [Tech Stack](#4-tech-stack) |
| 5 | [Environment Setup](#5-environment-setup) |
| 6 | [Running the App Locally](#6-running-the-app-locally) |
| 7 | [Backend Deep Dive](#7-backend-deep-dive) |
| 8 | [Frontend Deep Dive](#8-frontend-deep-dive) |
| 9 | [Authentication & Roles](#9-authentication--roles) |
| 10 | [Key Shared Utilities](#10-key-shared-utilities) |
| 11 | [All API Routes](#11-all-api-routes) |
| 12 | [Module Reference](#12-module-reference) |
| 13 | [Database Quick Reference](#13-database-quick-reference) |
| 14 | [Critical Rules & Gotchas](#14-critical-rules--gotchas) |
| 15 | [Deployment](#15-deployment) |
| 16 | [Feature Status Tracker](#16-feature-status-tracker) |

---

## 1. Project Overview

**Skoolio** is a multi-tenant SaaS School Management System built for schools in Nepal and India. Each school is a fully isolated tenant. The system handles the full academic + administrative lifecycle:

```
Student Admission → Enrollment → Attendance → Exams → Results
                         ↓
             Fee Structures → Billing → Payments → PDF Receipts
                         ↓
              Transport + Hostel + Salary + Calendar + Notices
```

### User Portals

| Portal | URL Prefix | Who Uses It |
|---|---|---|
| **Admin Portal** | `/(admin)/` | School administrators |
| **Teacher Portal** | `/(teacher)/teacher/` | Faculty / Section coordinators |
| **Student Portal** | `/(student)/student/` | Enrolled students |
| **Super Admin Portal** | `/super-admin/` | Platform operators (Skoolio team) |
| **Landing Page** | `/` | Public marketing page |

---

## 2. Repository Structure

```
school-pos/
├── Backend/                    ← Express + TypeScript API server
│   ├── src/
│   │   ├── app.ts             ← Express app, all routes registered here
│   │   ├── server.ts          ← HTTP server entry point
│   │   ├── config/            ← DB, Redis, JWT, Blob, Currency configs
│   │   ├── Controllers/       ← HTTP handlers (thin, delegates to Service)
│   │   ├── Service/           ← Business logic layer
│   │   ├── Repositories/      ← SQL queries (raw pg, no ORM)
│   │   ├── Routes/            ← Express routers
│   │   ├── middlewares/       ← Auth, role, error, history, upload
│   │   ├── types/             ← TypeScript interfaces per module
│   │   ├── utils/             ← AppError, catchAsync, emailService, Azure
│   │   └── workers/           ← Worker threads (PDF receipt generation)
│   ├── migrations/            ← SQL migration files
│   ├── .env                   ← NOT in git — create manually
│   └── package.json
│
├── frontend/                   ← Next.js 14 App Router
│   ├── src/
│   │   ├── app/               ← Next.js pages (route groups)
│   │   │   ├── (admin)/       ← Admin pages
│   │   │   ├── (teacher)/     ← Teacher pages
│   │   │   ├── (student)/     ← Student pages
│   │   │   ├── (auth)/        ← Login / Register
│   │   │   ├── super-admin/   ← Super admin pages
│   │   │   ├── page.tsx       ← Landing page
│   │   │   └── layout.tsx     ← Root layout (metadata, JSON-LD)
│   │   ├── components/
│   │   │   ├── admin/         ← Admin-specific components
│   │   │   ├── teacher/       ← Teacher-specific components
│   │   │   ├── student/       ← Student-specific components
│   │   │   ├── super-admin/   ← Super admin components
│   │   │   └── shared/        ← Reusable components used across portals
│   │   ├── lib/               ← API client, hooks, BS/AD calendar, currency
│   │   ├── hooks/             ← useAcademicYear, useOnlineStatus
│   │   ├── store/             ← Redux Toolkit slices
│   │   └── types/             ← Shared TS types
│   └── package.json
│
├── nginx/
│   └── nginx.conf             ← Reverse proxy config
├── docker-compose.yml         ← Production stack
├── docker-compose.dev.yml     ← Dev stack
├── deploy.sh                  ← One-command deploy script
├── backup-db.sh               ← PostgreSQL backup script
├── migrate-db.sh              ← Run migrations script
├── schema.md                  ← Complete DB schema reference (source of truth)
├── documentation.md           ← This file
└── DEPLOY.md                  ← Azure VM deployment guide
```

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────┐
│                 Browser / Mobile                     │
│         (Admin · Teacher · Student portals)          │
└──────────────────────┬───────────────────────────────┘
                       │  HTTPS
┌──────────────────────▼───────────────────────────────┐
│                    Nginx                             │
│         /api/*  → backend:5001                       │
│         /*      → frontend:3000                      │
└──────┬───────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────┐
│   Next.js Frontend (port 3000)          │
│   App Router · CSS Modules · Redux      │
└─────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│   Express Backend (port 5001)            │
│   Controller → Service → Repository     │
│   JWT auth · Role middleware · Workers  │
└──────┬───────────────┬───────────────────┘
       │               │
┌──────▼──────┐  ┌─────▼──────┐   ┌────────────────────┐
│ PostgreSQL  │  │   Redis    │   │  Azure Blob Storage │
│ (Primary DB)│  │ (Sessions/ │   │  (Photos, Receipts, │
│             │  │  Cache)    │   │   Logos)            │
└─────────────┘  └────────────┘   └────────────────────┘
```

### Request Lifecycle

```
Frontend useApi() hook
  → fetch to /api/<route>
  → Nginx proxies to Express
  → authMiddleware verifies JWT cookie
  → restrictTo() checks role
  → Controller calls Service
  → Service calls Repository
  → Repository runs SQL via pg Pool
  → Response JSON back to frontend
```

### Data Isolation Model

Every table has a `school_id` column. Every query is scoped by `school_id` from the JWT:
- **Admin JWT:** `school_id = req.user.id` (school's own record id)
- **Teacher/Student JWT:** `school_id = req.user.school_id`

> ⚠️ **Never use `req.user.id` as `school_id` for teachers or students** — their `id` is their own record id, not the school.

---

## 4. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) | React Server Components + Client Components |
| Frontend styling | CSS Modules | Per-component `.module.css` files |
| State management | Redux Toolkit | `authSlice`, `academicYearSlice`, `toastSlice` |
| Backend framework | Express + TypeScript | Strict mode TS |
| Database | PostgreSQL | Raw `pg` pool — no ORM |
| Cache | Redis (Azure Managed) | TLS 1.2, port 18091 |
| File storage | Azure Blob Storage | Chunked upload for large files |
| Auth | JWT + HTTP-only cookies | `cookie-parser`, `bcrypt` |
| PDF generation | Worker threads | `receipt-pdf.worker.ts` via `workerRunner.ts` |
| Email | Nodemailer (SMTP) | Gmail app password |
| Deployment | Docker + Docker Compose | Nginx reverse proxy |
| CI/CD | `.github/workflows` | GitHub Actions |

---

## 5. Environment Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis (local or Azure)
- Git

### Backend `.env` (create at `Backend/.env`)

```env
PORT=5001
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=school_pos

# JWT
JWT_SECRET=a-very-long-random-secret-at-least-32-chars
JWT_EXPIRES_IN=10d

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=18091
REDIS_PASSWORD=your-redis-password
REDIS_DB=0

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=Skoolio <your@gmail.com>

# Azure Blob
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;
AZURE_STORAGE_ACCOUNT_NAME=skoolio
AZURE_LOGOS_CONTAINER=skoolio-logos
AZURE_PROFILES_CONTAINER=skoolio-profiles
AZURE_RECEIPTS_CONTAINER=school-receipts

# CORS
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env.local` (create at `frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5001
```

### Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE school_pos;"

# Run all migrations (in order)
psql -U postgres -d school_pos -f Backend/migrations/001_initial.sql
psql -U postgres -d school_pos -f Backend/migrations/002_...sql
# ... continue for all files in Backend/migrations/
```

---

## 6. Running the App Locally

### Backend

```bash
cd Backend
npm install
npm run dev       # uses nodemon + ts-node
# Runs on http://localhost:5001
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Next.js dev server with Turbopack
# Runs on http://localhost:3000
```

### With Docker (full stack)

```bash
# Development
docker compose -f docker-compose.dev.yml up --build

# Production
docker compose up -d --build
```

### Useful npm scripts

```bash
# Backend
npm run dev        # nodemon + ts-node (hot reload)
npm run build      # tsc compile
npm start          # run compiled JS

# Frontend  
npm run dev        # Next.js dev (Turbopack)
npm run build      # next build
npm start          # next start (production)
npm run lint       # ESLint
```

---

## 7. Backend Deep Dive

### Folder Pattern

Every feature follows the same 4-layer pattern:

```
Routes/auth.routes.ts          ← Express router, maps HTTP methods to controllers
Controllers/auth.controller.ts ← Thin handler: parse req, call service, send res
Service/auth.service.ts        ← All business logic, validation, orchestration
Repositories/auth.repository.ts← Raw SQL queries only, returns typed data
```

**Rule:** Controllers never write SQL. Repositories never contain business logic.

### Middleware Stack

```typescript
// Applied globally
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.use(globalHistoryMiddleware)  // logs all POST/PUT/PATCH/DELETE

// Applied per route
authMiddleware          // verifies JWT from HTTP-only cookie
restrictTo('admin')    // role-based access control
```

### Error Handling

- `AppError` class — throw `new AppError('message', statusCode)` anywhere
- `catchAsync(fn)` — wraps async route handlers, forwards errors to `errorHandler`
- Global `errorHandler` middleware sends structured JSON errors

```typescript
// Pattern used in every controller
export const getStudents = catchAsync(async (req, res) => {
  const school_id = req.user.id;   // admin
  const data = await studentService.getAll(school_id);
  sendResponse(res, 200, data);
});
```

### Response Format

```typescript
// Success
sendResponse(res, 200, { data: [...], total: 10 })
// → { status: 'success', data: [...], total: 10 }

// Error (via AppError)
new AppError('Student not found', 404)
// → { status: 'fail', message: 'Student not found' }
```

### Worker Threads (PDF Generation)

PDF receipt generation runs in a separate worker thread to avoid blocking the event loop:

```
fee.controller.ts
  → workerRunner.ts        // spins up a worker thread
  → tsWorkerBootstrap.js   // bootstraps ts-node inside the worker
  → workers/receipt-pdf.worker.ts  // generates PDF, uploads to Azure Blob
```

### Azure Blob Storage

```typescript
// utils/azureStorage.ts
getLogoBlob(school_id, filename)      // school logos
getProfileBlob(school_id, filename)   // student/teacher photos
getReceiptBlob(school_id, filename)   // PDF receipts
getPaymentScreenshotBlob(school_id, filename)  // online payment screenshots
```

Chunked upload endpoint: `POST /api/upload/chunk` — frontend splits files into 512 KB chunks.

### Currency Config

```typescript
// config/currencyConfig.ts
// Determines currency symbol based on school's country:
// Nepal  → 'रू' (NPR)
// India  → '₹'  (INR)
// Other  → 'रू' (default)
```

Frontend mirror: `lib/useCurrency.ts` — the `fmt()` function already prepends the symbol:
```typescript
const { fmt } = useCurrency();
fmt(9000)  // → 'रू9,000'   (Nepal school)

// ✅ Correct
<td>{fmt(amount)}</td>

// ❌ Wrong — produces double symbol like 'रू रू9,000'
<td>₹{fmt(amount)}</td>
```

---

## 8. Frontend Deep Dive

### Route Groups (Next.js App Router)

```
app/
├── (admin)/           ← Route group — no URL segment added
│   ├── layout.tsx     ← Admin sidebar + auth guard
│   ├── dashboard/
│   │   └── page.tsx   ← URL: /dashboard
│   └── students/
│       ├── page.tsx   ← URL: /students
│       └── profile/
│           └── page.tsx ← URL: /students/profile?id=123
│
├── (teacher)/
│   └── teacher/       ← teacher/ prefix IS in the URL
│       ├── dashboard/
│       │   └── page.tsx ← URL: /teacher/dashboard
│       └── attendance/
│           └── page.tsx ← URL: /teacher/attendance
│
├── (student)/
│   └── student/       ← student/ prefix IS in the URL
│       └── dashboard/
│           └── page.tsx ← URL: /student/dashboard
```

> ⚠️ **Critical rule:** New teacher/student pages must go inside `teacher/` or `student/` subfolders, not directly under the route group.

### Page vs Component Pattern

```
app/(admin)/students/profile/page.tsx   ← Thin page, just imports component
  ↓ imports
components/admin/students/StudentProfilePage.tsx  ← All UI logic here
```

Pages are thin wrappers:
```tsx
import StudentProfilePage from "@/components/admin/students/StudentProfilePage";
export default function Page() { return <StudentProfilePage />; }
```

### Data Fetching

**`useApi` hook** — declarative data fetching:
```typescript
const { data, loading, error } = useApi<Student[]>("/students", [dep1, dep2]);
```

**`apiRequest`** — imperative fetching (mutations, side-effecting calls):
```typescript
const result = await apiRequest<{ data: Fee[] }>(`/fees/collections/student/${id}`);
```

Both functions call the backend at `NEXT_PUBLIC_API_URL/api/...` and automatically include credentials (cookies).

### Redux Store

```
store/
├── authSlice.ts         ← user, role, school info after login
├── academicYearSlice.ts ← active academic year (loaded once at layout level)
└── toastSlice.ts        ← global toast notifications
```

**Academic year** is bootstrapped once per session in `AcademicYearBootstrap.tsx`, mounted in every role layout. Components read it via:
```typescript
const { activeYear, academicYearId } = useAcademicYear();
```

This avoids each component independently calling `/academic-years/active`.

### Shared Components

| Component | What it does |
|---|---|
| `AttendanceOverviewCard` | Full/yearly attendance widget with BS/AD support. Used in Teacher student detail AND Admin student profile |
| `DateInput` | Smart date picker — BS or AD mode, viewport-aware dropdown |
| `SharedCalendarView` | School calendar viewer — shared across admin, teacher, student |
| `OfflineGuard` | Wraps page content, shows offline screen when `/api/health` unreachable |
| `NoActiveYearGuard` | Blocks access to most pages if no active academic year is set |
| `ConnectionBanner` | Subtle top banner when connectivity issues detected |
| `Topbar` | Page header with title + subtitle |
| `Sidebar` | Role-aware navigation sidebar |
| `ToastNotification` | Global toast system (uses Redux `toastSlice`) |
| `Spinner` / `Loader` | Loading states |

### BS/AD Calendar

```typescript
// lib/bs-ad.ts
adToBS(date: Date)              // → { year, month, day }
bsToAD({ year, month, day })    // → Date
daysInBSMonth(year, month)      // → number
BS_MONTH_NAMES                  // ['Baishakh', 'Jestha', ...]

// lib/useDateFormat.ts
const { formatDate, isBS } = useDateFormat();
formatDate('2026-07-20')  // → '4 Shrawan 2083' or 'July 20, 2026'
```

The school's `country` field (set at registration) determines if BS or AD is shown throughout the UI. Nepal schools → BS everywhere.

### CSS Modules Pattern

```tsx
import styles from './students.module.css';
const s = (c: string) => styles[c] || c;  // helper for lookup
const cx = (...cs) => cs.filter(Boolean).join(' '); // combinator

<div className={s('card')}>
<div className={cx(s('badge'), s('badge-green'))}>
```

Brand colors: `#25343F` (dark slate bg), `#FF9B51` (orange accent).

---

## 9. Authentication & Roles

### JWT Payload Shapes

```typescript
// Admin / Super Admin
{
  id: number,           // school's own id (= school_id for queries)
  email: string,
  role: 'admin' | 'super_admin',
  school_name: string,
  school_code: string,
  logo: string | null,
  timezone: string,
  is_verified: boolean,
  is_account: 'active' | 'blocked'
}

// Teacher / Student
{
  id: number,           // teacher's or student's OWN record id
  email: string,
  role: 'faculty' | 'student',
  school_id: number,    // ← use this for DB queries, NOT id
  school_name: string,
  logo: string | null,
  timezone: string,
  is_account: 'active' | 'blocked'
}
```

### Resolving `school_id` in Controllers

```typescript
// Admin routes
const school_id = req.user.id;

// Teacher / Student routes
const school_id = req.user.school_id;
```

### Role Middleware

```typescript
// Protect a route for admins only
router.get('/students', authMiddleware, restrictTo('admin'), controller.getAll);

// Multiple roles
router.get('/calendar', authMiddleware, restrictTo('admin', 'faculty', 'student'), controller.get);
```

### Login Flows

| Login URL | Role | Endpoint |
|---|---|---|
| `/login` | Admin (tab 1) or Faculty (tab 2) | `POST /api/auth/login` |
| `/student-login` | Student | `POST /api/auth/student-login` |
| Super Admin | Built into `/login` with role detect | `POST /api/auth/login` |

All tokens stored as HTTP-only cookies — never in `localStorage`.

### Maintenance Mode

`platform_settings.maintenance_mode = true` → only `super_admin` can log in. All other login attempts are blocked in `auth.service.ts`.

---

## 10. Key Shared Utilities

### `useApi` (frontend/src/lib/useApi.ts)

```typescript
const { data, loading, error } = useApi<T>(url, deps?);
// - Automatically fetches on mount and when deps change
// - Empty url string = no fetch (use for conditional fetching)
// - Includes credentials (JWT cookie) automatically
```

### `apiRequest` (frontend/src/lib/api.ts)

```typescript
const data = await apiRequest<T>(path, options?);
// - Wraps fetch with credentials
// - Throws on non-2xx responses
// - Use for mutations (POST/PUT/PATCH/DELETE) inside event handlers
```

### `useCurrency` (frontend/src/lib/useCurrency.ts)

```typescript
const { symbol, fmt } = useCurrency();
// symbol → 'रू' or '₹'
// fmt(9000) → 'रू9,000'   (already includes symbol — never add ₹ prefix again)
```

### `useDateFormat` (frontend/src/lib/useDateFormat.ts)

```typescript
const { formatDate, isBS } = useDateFormat();
// formatDate('2026-07-20') → '4 Shrawan 2083'  (Nepal)
// formatDate('2026-07-20') → 'July 20, 2026'   (India/other)
// isBS → true/false based on school country
```

### `useAcademicYear` (frontend/src/hooks/useAcademicYear.ts)

```typescript
const { activeYear, academicYearId } = useAcademicYear();
// Reads from Redux store — bootstrapped once in layout
// Always prefer this over useApi('/academic-years/active')
```

### `useOnlineStatus` (frontend/src/hooks/useOnlineStatus.ts)

```typescript
// Pings /api/health every N seconds
// Powers the OfflineGuard and ConnectionBanner components
```

### `catchAsync` (Backend/src/utils/catchAsync.ts)

```typescript
export const catchAsync = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
// Wraps all async controllers — never need try/catch in controllers
```

---

## 11. All API Routes

All routes are prefixed with `/api`. The Express server runs at `:5001`, proxied through Nginx.

### Auth — `/api/auth`

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/login` | Public | Admin / faculty login |
| POST | `/student-login` | Public | Student login |
| POST | `/register` | Public | New school registration |
| POST | `/logout` | Any | Clear JWT cookie |
| POST | `/forgot-password` | Public | Send reset OTP |
| POST | `/reset-password` | Public | Reset with OTP |
| GET | `/me` | Any auth | Get current user info |

### Academic Years — `/api/academic-years`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All years for school |
| GET | `/active` | Any auth | Currently active year |
| POST | `/` | Admin | Create new year |
| PUT | `/:id` | Admin | Update year |
| DELETE | `/:id` | Admin | Delete year |
| PUT | `/:id/status` | Admin | Change status |

### Classes — `/api/classes`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All classes (`?academic_year_id=` required) |
| GET | `/:id` | Admin | Single class with sections |
| POST | `/` | Admin | Create class |
| PUT | `/:id` | Admin | Update class |
| DELETE | `/:id` | Admin | Delete class |
| POST | `/:classId/subjects` | Admin | Assign subject to class |
| GET | `/:classId/subjects` | Admin, Faculty | Subjects for class |
| DELETE | `/:classId/subjects/:subjectId` | Admin | Remove subject |
| POST | `/:classId/subject-teachers` | Admin | Assign teacher to subject |
| GET | `/:classId/subject-teachers` | Admin, Faculty | Teachers per subject |
| POST | `/sections` | Admin | Add section |
| GET | `/sections/all` | Admin, Faculty | All sections |
| PUT | `/sections/:id` | Admin | Update section |
| DELETE | `/sections/:id` | Admin | Delete section |
| GET | `/sections/:id/students` | Admin, Faculty | Students in section |
| GET | `/subjects` | Admin, Faculty | All school subjects |
| POST | `/subjects` | Admin | Create subject |
| PUT | `/subjects/:id` | Admin | Update subject |
| DELETE | `/subjects/:id` | Admin | Delete subject |

### Students — `/api/students`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All students (paginated) |
| GET | `/enrolled` | Admin | Enrolled students with class info |
| GET | `/:id` | Admin, Faculty, Student | Student profile |
| POST | `/` | Admin | Create student |
| PUT | `/:id` | Admin | Update student |
| DELETE | `/:id` | Admin | Delete student |
| GET | `/:id/enrollments` | Admin, Faculty | All enrollments for student |
| GET | `/enrollments` | Admin, Faculty | Enrollments (query params filter) |
| POST | `/enrollments` | Admin | Enroll student |
| PUT | `/enrollments/:id` | Admin | Update enrollment |
| DELETE | `/enrollments/:id` | Admin | Remove enrollment |

### Teachers — `/api/teachers`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All teachers |
| GET | `/me` | Faculty | Own teacher profile |
| GET | `/:id` | Admin | Teacher by id |
| POST | `/` | Admin | Create teacher |
| PUT | `/:id` | Admin | Update teacher |
| DELETE | `/:id` | Admin | Delete teacher |
| GET | `/sections` | Faculty | My assigned sections |
| GET | `/students` | Faculty | Students in my sections |
| PUT | `/me/password` | Faculty | Change own password |

### Attendance — `/api/attendance`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/section/:id/monthly` | Admin, Faculty | Monthly records for section |
| GET | `/section/:id/summary` | Admin | Section summary stats |
| POST | `/` | Faculty | Mark attendance |
| PUT | `/:id` | Faculty | Edit attendance record |
| GET | `/student/:id/monthly` | Admin, Faculty | Monthly records for student |
| GET | `/student/:id/summary` | Admin, Faculty | Yearly summary for student |
| GET | `/me/monthly` | Student | Own monthly records |
| GET | `/me/summary` | Student | Own yearly summary |
| GET | `/admin/overview` | Admin | All sections overview |
| GET | `/working-days` (via calendar) | Any auth | Working days in date range |

### Fees — `/api/fees`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/structures` | Admin | All fee structures |
| POST | `/structures` | Admin | Create fee structure |
| PUT | `/structures/:id` | Admin | Update fee structure |
| DELETE | `/structures/:id` | Admin | Delete fee structure |
| GET | `/collections` | Admin | All fee collections |
| GET | `/collections/student/:id` | Admin | Student's fee collections |
| POST | `/collections` | Admin | Generate fee bills |
| POST | `/transport/generate` | Admin | Generate transport fee bills |
| POST | `/hostel/generate` | Admin | Generate hostel fee bills |
| POST | `/payments` | Admin | Record a payment |
| GET | `/payments/student/:id` | Admin, Student | Student's payment history |
| GET | `/me/collections` | Student | Own fee collections |
| GET | `/receipts/:id` | Admin, Student | Download PDF receipt |
| GET | `/summary` | Admin | Fee summary stats |

### Exams — `/api/exams`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin, Faculty | All exams (`?academic_year_id=` required) |
| POST | `/` | Admin | Create exam |
| PUT | `/:id` | Admin | Update exam |
| DELETE | `/:id` | Admin | Delete exam |
| GET | `/:id/schedules` | Admin, Faculty | Exam schedules |
| POST | `/:id/schedules` | Admin | Add exam schedule |
| PUT | `/schedules/:id` | Admin | Update schedule |
| DELETE | `/schedules/:id` | Admin | Delete schedule |
| GET | `/:id/results` | Admin, Faculty | Results for exam |
| POST | `/results` | Admin, Faculty | Enter marks |
| PUT | `/results/:id` | Admin, Faculty | Update marks |
| PUT | `/:id/publish` | Admin | Publish results |
| GET | `/me/results` | Student | Own results |

### Calendar — `/api/calendar`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Any auth | Calendars for school |
| POST | `/` | Admin | Create calendar |
| PUT | `/:id` | Admin | Update calendar (legacy weekend) |
| GET | `/:id/events` | Any auth | Calendar events |
| POST | `/:id/events` | Admin | Add event |
| PUT | `/events/:id` | Admin | Update event |
| DELETE | `/events/:id` | Admin | Delete event |
| PUT | `/:calendarId/weekly-offs` | Admin | Set weekly offs (replace all) |
| GET | `/working-days` | Any auth | Count working days in date range |

### Transport — `/api/transport`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/vehicles` | Admin | All vehicles |
| POST | `/vehicles` | Admin | Add vehicle |
| PUT | `/vehicles/:id` | Admin | Update vehicle |
| DELETE | `/vehicles/:id` | Admin | Delete vehicle |
| GET | `/routes` | Admin | All routes |
| POST | `/routes` | Admin | Create route |
| PUT | `/routes/:id` | Admin | Update route |
| DELETE | `/routes/:id` | Admin | Delete route |
| GET | `/routes/:id/stops` | Admin | Stops for route |
| POST | `/stops` | Admin | Add stop |
| PUT | `/stops/:id` | Admin | Update stop |
| DELETE | `/stops/:id` | Admin | Delete stop |
| GET | `/students/:id` | Admin, Student | Student's transport assignment |
| POST | `/assignments` | Admin | Assign student to route |
| DELETE | `/assignments/:id` | Admin | Remove assignment |

### Hostel — `/api/hostel`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All hostels with occupancy |
| POST | `/` | Admin | Create hostel |
| PUT | `/:id` | Admin | Update hostel |
| DELETE | `/:id` | Admin | Delete hostel |
| GET | `/:hostelId/rooms` | Admin | Rooms in hostel |
| POST | `/rooms` | Admin | Add room |
| PUT | `/rooms/:id` | Admin | Update room |
| DELETE | `/rooms/:id` | Admin | Delete room |
| GET | `/students/:id` | Admin, Student | Student's hostel assignment |
| POST | `/assignments` | Admin | Assign student to room |
| PUT | `/assignments/:id` | Admin | Update assignment |

### Notices — `/api/notices`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | All notices |
| GET | `/student` | Student | Notices visible to student |
| POST | `/` | Admin, Faculty | Create notice |
| PUT | `/:id` | Admin, Faculty | Update own notice |
| DELETE | `/:id` | Admin, Faculty | Delete notice |

### Expenses — `/api/expenses`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/categories` | Admin | All expense categories |
| POST | `/categories` | Admin | Create category |
| PUT | `/categories/:id` | Admin | Update category |
| DELETE | `/categories/:id` | Admin | Delete category |
| GET | `/` | Admin | All expenses |
| GET | `/summary` | Admin | Expense summary by category |
| POST | `/` | Admin | Record expense |
| PUT | `/:id` | Admin | Update expense |
| DELETE | `/:id` | Admin | Delete expense |

### Staff/Salary — `/api/staff`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/salaries` | Admin | All salary records |
| POST | `/salaries` | Admin | Record salary payment |
| PUT | `/salaries/:id` | Admin | Update salary record |
| DELETE | `/salaries/:id` | Admin | Delete salary record |
| GET | `/salaries/teacher/:id` | Admin | Teacher's salary history |
| GET | `/me/salary` | Faculty | Own salary history |

### Payroll Policy — `/api/payroll-policy`

| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/` | Admin | Get school's payroll policy (or defaults) |
| PUT | `/` | Admin | Upsert payroll policy |

### Other Routes

| Prefix | Description |
|---|---|
| `/api/school` | School settings (logo, info, update) |
| `/api/dashboard` | Admin dashboard aggregate stats |
| `/api/subscriptions` | Super admin subscription management |
| `/api/platform` | Super admin platform settings |
| `/api/upload` | Chunked file upload endpoint |
| `/api/promotion` | Student promotion at year-end |
| `/api/history` | Activity log (global history middleware) |
| `/api/online-payments` | Manual bank transfer / eSewa / Khalti verification |
| `/api/feedback` | User feedback submissions |
| `/api/contact` | Landing page contact form |
| `/api/health` | `{ status: 'ok' }` — no auth, used by OfflineGuard |

---

## 12. Module Reference

### How to Add a New Module

1. **Types** — `Backend/src/types/mymodule.types.ts`
2. **Repository** — `Backend/src/Repositories/mymodule.repository.ts`
3. **Service** — `Backend/src/Service/mymodule.service.ts`
4. **Controller** — `Backend/src/Controllers/mymodule.controller.ts`
5. **Routes** — `Backend/src/Routes/mymodule.routes.ts`
6. **Register** — Import and `app.use('/api/mymodule', mymoduleRoutes)` in `app.ts`
7. **Frontend component** — `frontend/src/components/admin/mymodule/MyModulePage.tsx`
8. **Frontend page** — `frontend/src/app/(admin)/mymodule/page.tsx`
9. **Sidebar link** — Add to `components/shared/Sidebar.tsx`

### Attendance Module — Special Rules

```
✅ Only section coordinator can mark/edit
✅ Past dates only — never future
✅ Edit window: current month + previous month only
✅ Working days from school calendar (weekly offs + affect_attendance events)
✅ Admin sees read-only; students see own only
```

`AttendanceOverviewCard` is the **single shared component** for all attendance widgets — used in Teacher portal student detail AND Admin student profile. Do not create separate attendance widgets.

### Fee Module — Special Rules

```
✅ Receipt numbers (RCP-XXXX) generated atomically — never duplicate
✅ Transport/hostel fees use fee_structure_id = NULL + fee_type = 'transport'/'hostel'
✅ Scholarship discounts applied at billing time, not payment time
✅ PDF generation runs in a worker thread
✅ useCurrency() fmt() already includes symbol — never hardcode ₹ or रू prefix
```

### Academic Year — Scoping Rule

Every module that has year-sensitive data requires `academic_year_id` on GET requests. The frontend always reads this from the Redux store via `useAcademicYear()` and passes it as a query param.

### Subscription Gating

```
Free plan  → student/teacher creation blocked at cap (100 / 5)
           → Fee Management API endpoints return 403
Pro plan   → cap 300 students / 20 teachers + Full fees
Plus plan  → cap 1500 students / 40 teachers + All features
```

> ⚠️ **Never add new subscription gates without Abhi's approval.** Current gating is intentionally partial.

---

## 13. Database Quick Reference

> Full schema is in `schema.md` — always read that before writing SQL.

### Core Table Map

```
schools                      ← tenant root
  academic_years             ← year scoping
    classes                  ← year-scoped
      sections               ← coordinator_id → teachers
        student_enrollments  ← student + class + section + year
          attendance         ← per section per day
            attendance_details ← per student
          fee_collections    ← per student per fee
            fee_payments     ← payments against collections
          exam_results       ← per student per schedule
    fee_structures           ← fee definitions per class
    exams
      exam_schedules         ← per class per subject
    calendar_events          ← year-scoped events
  students                   ← school-level (not year)
  teachers                   ← school-level (not year)
  transport_routes           ← year-scoped
    transport_stops
      transport_assignments  ← student → stop
  hostels
    hostel_rooms
      hostel_assignments     ← student → room + year
  school_subscriptions
  platform_settings          ← single row, id=1
```

### Most Common Gotchas

| ❌ Wrong | ✅ Right |
|---|---|
| `req.user.id` as school_id for faculty | `req.user.school_id` |
| `event.start_date` on calendar events | `event.event_date` |
| `event.is_holiday` | `event.affects_attendance` |
| `event_type: 'vacation'` | `'holiday'` \| `'exam'` \| `'event'` \| `'early_closing'` |
| `month: 'June'` for salary | `month: 6` (integer 1–12, always AD) |
| `expense.status` | Doesn't exist — no approval workflow |
| `expense.voucher_number` | `expense.receipt_number` |
| `expense.paid_to` | `expense.vendor_name` |
| `expense.category?.name` | `expense.category_name` (flat alias) |
| `schedule.room_no` | `schedule.venue` |
| `exam_type: 'mock'` | `'unit_test'` \| `'mid_term'` \| `'final'` \| `'practice'` |
| `student.address` | Doesn't exist — use `city` + `state` + `country` |
| `/classes` without `academic_year_id` | Always pass `?academic_year_id=X` |
| `payment_method: 'upi'` | Not a valid enum anywhere |
| `payment_method: 'online'` for salary | Salary only: `cash` \| `bank_transfer` \| `cheque` |
| `PATCH /calendar/:id` for weekly offs | `PUT /calendar/:calendarId/weekly-offs` |
| Hardcoding `₹{fmt(amount)}` | Just `{fmt(amount)}` — symbol already included |
| `'Class Coordinator'` in UI text | Must be `'Section Coordinator'` |

---

## 14. Critical Rules & Gotchas

### Security — Always Enforce

```typescript
// school_id ALWAYS from JWT, never from request body
const school_id = req.user.id;           // admin
const school_id = req.user.school_id;    // teacher / student

// Never do this:
const school_id = req.body.school_id;    // ❌ security risk
const school_id = req.params.school_id; // ❌ security risk
```

### Route Collision — Static Before Dynamic

```typescript
// ✅ Correct — static route first
router.get('/sections/all', controller.getAllSections);
router.get('/sections/:id', controller.getSectionById);

// ❌ Wrong — /sections/all would match /:id with id='all'
router.get('/sections/:id', controller.getSectionById);
router.get('/sections/all', controller.getAllSections);
```

### Next.js Route Group Rule

```
// ✅ Teacher page
app/(teacher)/teacher/attendance/page.tsx  → URL: /teacher/attendance

// ❌ Wrong — missing teacher/ subfolder
app/(teacher)/attendance/page.tsx         → URL: /attendance (collides with admin)
```

### MCP / Dual Session Pattern

When working across chat (Claude.ai) and MCP (Claude Code) simultaneously:
- **Claude.ai chat** = Senior Project Manager role (architecture decisions, SQL design)
- **MCP session** = Senior Developer (implementation)
- Always re-read files fresh before editing — dual-session collision risk
- Prefer targeted edits (`patch_file`) over full rewrites
- MCP goes offline under heavy use — silent/empty tool responses signal restart needed
- Writing into Next.js parenthesized route groups via MCP is unreliable — use components directory + manual page stub

### AttendanceOverviewCard — Shared Component

```typescript
// This ONE component serves all attendance display needs
import AttendanceOverviewCard from '@/components/shared/AttendanceOverviewCard';

// Usage pattern (same in admin student profile AND teacher student detail)
<AttendanceOverviewCard
  activeYear={activeYear}
  summaryBaseUrl={`/attendance/student/${id}/summary`}
  monthlyUrl={(year, month) =>
    `/attendance/student/${id}/monthly?year=${year}&month=${month}&academic_year_id=${activeYear.id}`
  }
/>
```

Do **not** create custom attendance donut/chart components — always use this shared one.

### useCurrency — Never Double-Prefix

```typescript
const { fmt } = useCurrency();

// fmt() already includes the symbol:
fmt(9000)  // → 'रू9,000' or '₹9,000'

// ✅
<td>{fmt(amount)}</td>
<span>Fee Due {fmt(pending)}</span>

// ❌ Produces 'रूरू9,000' or '₹₹9,000'
<td>₹{fmt(amount)}</td>
<span>Fee Due ₹{fmt(pending)}</span>
```

---

## 15. Deployment

> Full step-by-step guide in `DEPLOY.md`

### Production Stack

```bash
# Build and start all services
docker compose up -d --build

# Check service health
docker compose ps

# View logs
docker compose logs -f backend

# Deploy new code
git pull && ./deploy.sh
```

### Services in Docker Compose

| Service | Port | Description |
|---|---|---|
| `nginx` | 80, 443 | Reverse proxy, SSL termination |
| `frontend` | 3000 (internal) | Next.js app |
| `backend` | 5001 (internal) | Express API |

External Azure services (not in Docker): PostgreSQL, Redis, Blob Storage.

### Deployment Checklist

```
□ Backend/.env is populated with production values
□ CORS_ORIGIN matches your domain
□ DB migrations have been run (migrate-db.sh)
□ Azure Blob containers exist (logos, profiles, receipts)
□ Redis TLS connection works (port 18091, rejectUnauthorized: false)
□ PostgreSQL firewall allows VM's IP
□ Nginx conf has correct server_name
□ SSL certs copied if using HTTPS
```

### Database Backup

```bash
# Manual backup
./backup-db.sh

# Run pending migrations
./migrate-db.sh
```

---

## 16. Feature Status Tracker

### ✅ Completed

| Feature | Notes |
|---|---|
| Multi-tenant school registration | Auto-generates school code |
| JWT auth (admin / teacher / student) | HTTP-only cookies, 3 separate login flows |
| Academic year management | Status lifecycle, active year scoping |
| Classes, sections, subjects | Section coordinator assignment |
| Student management + enrollment | Full profile, scholarship, photo upload |
| Attendance (teacher portal) | BS/AD aware, working day calc, section coordinator only |
| Attendance (admin view) | Read-only overview, per-student monthly calendar |
| Attendance (student portal) | Own monthly view with AttendanceOverviewCard |
| Exam management | Schedules, mark entry (teacher-scoped), grade auto-calc |
| Result publishing + student view | Published/draft lifecycle |
| Fee structures + billing | Multi-frequency, scholarship discounts |
| Fee payments + PDF receipts | Atomic receipt numbers, Azure Blob PDF storage |
| Transport management | Vehicles, routes, stops, assignments |
| Transport fee billing | `POST /fees/transport/generate` |
| Hostel management | Hostels, rooms, assignments, occupancy |
| Expense tracking | Categories, records, summary |
| Notice board | School-wide + section-specific, expiry |
| School calendar | Weekly offs (flexible patterns), events, attendance integration |
| Staff salary management | Monthly records, payroll policy |
| Student promotion | Year-end class promotion |
| Admin dashboard | Real-time aggregate stats |
| Teacher dashboard | Section-aware stats |
| Student dashboard | Personal stats (attendance donut, fees, notices) |
| Subscription plans | Free / Pro / Plus with gating |
| BS/AD date system | Full Nepal calendar support across all modules |
| Online payment requests | Bank transfer / eSewa / Khalti verification queue |
| Global offline detection | OfflineGuard + ConnectionBanner + /api/health |
| Global academic year Redux | AcademicYearBootstrap, useAcademicYear hook |
| NoActiveYearGuard | Blocks all role portals if no active year |
| Payroll policy | Per-school tax/PF/leave/half-day config |
| Landing page | Full redesign with SEO, JSON-LD, partners section |
| Admin student profile | AttendanceOverviewCard (shared), currency fix |

### 🔧 Known Gaps / Pending

| Feature | Priority | Notes |
|---|---|---|
| Hostel fee auto-billing | P2 | `POST /fees/hostel/generate` endpoint needed |
| Student online payment submission | P2 | Student-facing submission page not completed |
| Attendance admin summary endpoint | P3 | `GET /attendance/summary/admin` per-section stats |
| Super Admin — Offers tab | P3 | Missing in super admin subscription UI |
| Landing page school images | P3 | 5 image generation prompts provided, need real assets |
| Partners section real data | P4 | Currently using dummy school names/logos |
| Working days from calendar (salary) | P5 | `payroll_policy.working_days_basis = 'calendar'` not yet wired |

---

*Built with ❤️ for schools in Nepal and India*  
*Skoolio v1.0 — School Management SaaS*
