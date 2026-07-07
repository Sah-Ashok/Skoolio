# SchoolPOS (Skoolio) — Project Coordination Notes

> Last updated: July 2026.
> **Every model must read this file at the start of every session.**
> Read  `schema.md` if needed for full table structures and enum values.

---

## ⚠️ Critical rule for all models

**Always read a file fresh immediately before editing it.**
Two Claude sessions (claude.ai + Claude Code/MCP) edit this codebase simultaneously. Files change
underneath you without warning. A chat-session edit to `auth.service.ts` was already silently
overwritten once — it had to be redone. So:

- Never trust session memory about what a file contains. Re-read it.
- If a file looks different from what you expect, something else touched it. Re-derive from what's there.
- Prefer small, targeted edits over full-file rewrites to minimize overwrite risk.
- When in doubt, ask Ashok before rewriting.

---

## Team on this project

### Skoolio Project Manager (claude.ai chat session)
**Role**: Senior Project Manager — designs features, writes SQL collaboratively with Ashok,
makes architectural decisions, audits frontend against backend contracts, maintains `claude.md`
and `schema.md`, coordinates between all models.

I do NOT implement code directly in the filesystem — I provide plans, SQL, and code via chat.
I own the architectural decisions, subscription gating rules, and feature scope boundaries.
No model should override my decisions without Ashok's explicit approval.

---

### Skoolio Bug Hunter (Claude Code / MCP session)
**Role**: Senior Backend Developer — implements features, fixes bugs, wires up routes, builds
and fixes frontend pages, maintains TypeScript correctness.

I read `claude.md` at the start of every session. I re-read any file fresh immediately before
editing it. I prefer targeted, surgical edits. I follow all house style rules set by the PM.
I never override architectural decisions, add subscription gates, or expand feature scope
without Ashok's explicit approval.

---

### Skoolio Frontend Developer (Antigravity — claude.ai / Gemini session)
**Role**: Frontend Developer — designs and implements all frontend UI, wires frontend to backend
APIs, handles backend wiring (service/controller/route) when bootstrapping new modules.

I read `claude.md` before every session. I read files fresh before editing. I never overwrite
without checking what's currently there. I follow all house-style rules.

**House style additions (Frontend Developer):**
- Admin read-only pages use `fa-chart-*` icons in sidebar, not `fa-user-check`
- Modals always have `onClick={e => e.stopPropagation()}` on inner container
- New admin component pages use inline `style={}` (no new `.module.css`)
- `useApi` for mount/dep-triggered data; direct `apiRequest()` in try/catch for mutations
- Faculty JWT: `req.user.id` = teacher DB id, `req.user.school_id` = school — never mix them

---

## Architecture

- **Backend**: `Backend/` — Node.js + Express + TypeScript, PostgreSQL via raw `pg` (no ORM).
  Layered: `Routes/` → `Controllers/` → `Service/` → `Repositories/`.
  Roles: `super_admin`, `admin` (school), `faculty` (teacher), `student`.
  Auth: JWT in httpOnly cookies. `/auth/me` bootstraps session on every page load/refresh.
- **Frontend**: `frontend/` — Next.js App Router, custom CSS Modules (no Tailwind).
  Route groups: `(admin)`, `(teacher)`, `(student)` + plain `super-admin/` folder.
- **Multi-tenant**: `school_id` scopes everything — always from JWT, never from request body.
- **State**: Redux Toolkit (`authSlice`, `toastSlice`).
- **Redis**: OTP store (ioredis). 2FA OTPs TTL=5min, forgot-password OTPs TTL=10min.

### JWT payload shapes — critical distinction
```
Admin/Super Admin: { id (= school_id), email, role, school_name, ... }
Faculty/Student:   { id (= own record id), school_id, email, role, school_name, ... }
```
**Never use `req.user.id` as school_id for faculty/student — it is their own record id.**
Use `req.user.school_id` instead.

### Route ordering rule (Express)
Static segments MUST come before dynamic `/:param` in the same router:
```
✅ router.get('/me/sections', ...)    before  router.get('/:id', ...)
✅ router.patch('/details/:id', ...)  before  router.patch('/:id', ...)
```
Violating this causes silent wrong-route matches with no error.

### Next.js route group rule
`(admin)`, `(teacher)`, `(student)` are URL-transparent. A file at `(teacher)/dashboard/page.tsx`
resolves to `/dashboard` — same URL as `(admin)/dashboard/page.tsx`. This WILL cause a build error.
**All teacher pages must live under `(teacher)/teacher/` → produces `/teacher/*` URLs.**
**All student pages must live under `(student)/student/` → produces `/student/*` URLs.**

---

## What is fully built and working

### Backend modules
All complete and registered in `app.ts`:
```
/api/auth              register, login (admin/teacher/student), 2FA OTP, forgot-password,
                       change-password, /auth/me bootstrap
/api/academic-years    full CRUD
/api/classes           CRUD + sections + subjects + class_subject_teachers
/api/teachers          CRUD + subject assignment + salary + coordinator sections
/api/students          CRUD + enrollments + subscription cap enforcement
/api/fees              structures, collections, payments, transport bill generation
/api/attendance        mark (faculty/coordinator only) + admin summary + student self-service
/api/exams             CRUD + schedules + results + grade scales + publish flow
/api/expenses          CRUD + categories + summary
/api/calendar          school_calendars + weekly_offs + events + working days calculation
/api/subscriptions     Free/Pro/Plus plans + grace-period auto-downgrade + feature gating
/api/platform          maintenance mode + platform name/email (single-row settings)
/api/transport         vehicles + routes + stops + assignments + transport bill generation
/api/hostel            hostels + rooms + assignments
/api/school            school settings + change password + 2FA toggle (per-school)
```

### Key self-service endpoints
```
GET /teachers/me/sections           → coordinator's own sections (faculty JWT)
GET /classes/me/subject-classes     → class_subject_teachers for this teacher (active year)
GET /attendance/me/summary          → student's own yearly attendance
GET /attendance/me/monthly          → student's own monthly breakdown
GET /students/me/profile            → student's own profile
GET /students/me/enrollments        → student's own enrollments
GET /fees/me/collections            → student's own fee collections
GET /fees/me/payments               → student's own payment history
GET /exams/me/results               → student's published results
GET /subscriptions/me/status        → school's current plan + usage
GET /subscriptions/me/history       → school's billing history
```

### Frontend — all pages built and wired to real APIs
**Admin**: Dashboard, Students (list/add wizard/profile), Teachers (list/add/profile),
Classes, Sections, Subjects, Academic Years, Calendar, Attendance (read-only summary),
Fee Management, Expenses, Salary, Exams & Results, Transport, Hostel,
My Subscription, Upgrade Plan, Settings (2FA, password, school info).

**Teacher**: Dashboard, Profile, Attendance Overview (coordinator sections only),
Mark Attendance (date-restricted, coordinator-only sections), Results Entry (assigned subjects only).

**Student**: Dashboard, Profile, My Attendance, My Results, My Fees.

**Super Admin**: Dashboard, Schools (list + activate/block/2FA toggle), Subscriptions
(plan editor), Settings (maintenance mode, platform name, support email).

### Mobile
Desktop: 260px fixed sidebar. Mobile (≤768px): sidebar hidden, fixed bottom nav.



## 🔴 Pending — critical (blocks real use)

**~~P1. Subject-teacher assignment UI missing~~** ✅ COMPLETED (July 2026) — with bug fix
Backend guard enforced in `exam.service.ts` via `isTeacherAssignedToSubjectInClass`. ✓
However Gemini's implementation had a **silent bug**: `AddClassForm.tsx` was sending
`teacher_id` to `POST /classes/assign-subject` but that endpoint ignores it — only
`class_id` and `subject_id` are read. The `class_subject_teachers` table was never
populated from the class creation form, so faculty always got 403 on exam results.
**Fix applied (Senior Dev)**: `AddClassForm.tsx` now makes two calls: first
`POST /classes/assign-subject` (creates `class_subjects` row), then
`POST /classes/assign-subject-teacher` (creates `class_subject_teachers` row).

**~~P2. Section coordinator label still says "Class Coordinator" in UI~~** ✅ COMPLETED (July 2026)
All UI labels audited and confirmed correct — `AddClassForm.tsx`, `SectionsPage.tsx`,
`ClassDetailPage.tsx`, and `ClassEditPage.tsx` all say "Section Coordinator" consistently.
No stale "Class Coordinator" strings remain in the codebase.

**~~P3. Transport/Hostel fee auto-billing not wired~~** ✅ COMPLETED (July 2026)
Added `POST /fees/hostel/generate` and `GET /fees/hostel/summary` endpoints mirroring transport.
Both `TransportPage.tsx` and `HostelPage.tsx` now have manual "Generate Bills" buttons and a month picker
in their Overview tabs to trigger batch creation of fee collections for active assignments.

**~~P4. Hostel fee not linked to fee_collections~~** ✅ COMPLETED (July 2026)
Similar to transport, hostel fees now automatically generate a `fee_collections` row when
academic fees are collected (via `autoAddHostelFee` in `fee.service.ts`), or when manually
triggered via the batch generation endpoint mentioned in P3.

---

## 🟠 Pending — serious (wrong behaviour)

**~~P5. `UpgradePlanPage` hardcodes 'Nepal' for pricing~~** ✅ COMPLETED (July 2026)
Fixed: `useAppSelector` now reads `state.auth.user?.country` from Redux and passes it to
`formatPrice`. Falls back to `'Nepal'` if country is null. Also added `country?: string`
to the `AuthUser` interface in `authSlice.ts`. The "Also available" line now dynamically
shows the opposite country's price (India ↔ Nepal).

**~~P6. CORS hardcoded to `localhost:3000`~~** ✅ COMPLETED (July 2026)
Fixed in `Backend/src/app.ts`: `origin: process.env.CORS_ORIGIN || 'http://localhost:3000'`.
Add `CORS_ORIGIN=https://your-domain.com` to Backend `.env` for staging/production.

**P7. `getMeService` triggers enrollment query on every `/auth/me` call**
For students, `/auth/me` joins all enrollments. Expensive as data grows. Should return a lighter
profile and lazy-load enrollments separately.

**~~P8. No DB index on `attendance_details(student_id, school_id)`~~** ✅ COMPLETED (July 2026)
Migration file created: `Backend/migration_attendance_index.sql`.
Run it once: `CREATE INDEX IF NOT EXISTS idx_attendance_details_student ON attendance_details(student_id, school_id);`

**~~P9. `sendOTPEmail` errors are swallowed~~** ✅ COMPLETED (July 2026)
Both the forgot-password flow and the 2FA login flow now `await sendOTPEmail(...)` inside
a try/catch. On mail server failure, an `AppError(503, 'Could not send ...')` is thrown so
the API returns a 503 instead of a false success. Changed in `Backend/src/Service/auth.service.ts`.

---

## 🟡 Pending — medium (UX / maintenance)

**P10. Stale `.bak` files in teacher route group**
`(teacher)/attendance/page.tsx.bak` and `(teacher)/attendance/class/page.tsx.bak` still exist
on disk. They are exact duplicates of the correct files under `(teacher)/teacher/attendance/`.
Delete them when safe — they don't affect builds but clutter the repo.

**P11. Revenue stat undercounts in super-admin subscriptions**
`getAllSchoolsWithSubscriptions` uses `DISTINCT ON (school_id)` — only the latest subscription
row per school is returned. Revenue sum only counts the most recent payment per school.
Fix: sum `amount_paid` across all rows per school, not just the latest.

---

## 🔵 Pending — future features (approved, not yet scheduled)

**F1. Student promotion workflow**
No batch promotion exists. At year-end, admins manually re-enroll each student.
A "Promote Class" action (Class 9 → Class 10 for all active enrollments) would save significant
admin time. Approved by Ashok as future work.

**F2. Rate limiting on OTP endpoints**
`POST /auth/forgot-password` and `POST /auth/verify-2fa` have no rate limiting.
Max 3 OTP requests per 15 min per email via Redis. **Do not add without Ashok's go-ahead.**

**F3. 2FA for teachers**
Currently 2FA is admin-only. **Do not add without Ashok's go-ahead.**

**F4. Email notification on subscription activation**
When super-admin activates a plan, the school admin has no notification.
Deferred until mail infrastructure (SMTP/SES) is confirmed.

**F5. Grace period cron job**
`resolveCurrentPlanStatus` is called lazily — a school that never logs in during their 10-day
grace period won't auto-downgrade until someone checks their status. A nightly cron job would
fix this for timing accuracy. Deferred — accepted gap for now.

---

## Subscription enforcement — intentionally limited scope

Only three things are gated by plan. **Do not add more gates without Ashok's approval.**
This is a deliberate retention-vs-revenue decision, not an oversight.

| Gate | Where enforced |
|---|---|
| Student creation blocked at `max_students` cap | `assertCanAddStudent` in `student.service.ts` |
| Teacher creation blocked at `max_teachers` cap | `assertCanAddTeacher` in `teacher.service.ts` |
| Fee structure creation blocked on Free plan | `assertFeeManagementEnabled` in `fee.service.ts` |

Everything else (attendance, fee collection, exams, viewing, editing) is unrestricted regardless
of plan status.

---

## House style — all models must follow

- Controllers pull `school_id` from JWT only — never from `req.body` or `req.params`
- Money enums are table-specific (salary: no `online`/`upi`; fees/expenses: `online` allowed)
- PostgreSQL dates need `::text` casts in SELECT/RETURNING — or they come back timezone-shifted
- `net_salary` on `teacher_salaries` is `GENERATED ALWAYS AS` — never write or compute it in code
- `useApi` unwraps `res.data` automatically on the frontend
- See `schema.md` "Common mistakes / gotchas" table for the full list of known field-name traps

---

---

## 👋 Senior Developer Introduction — Claude Sonnet 4.6 (claude.ai MCP session)

> Session started: July 2026. Role assumed: **Senior Developer**.

Hi team — I'm the Senior Developer session on this project, operating via the claude.ai interface
with full MCP filesystem access to the project root. Here's what I bring to the table and how I work:

### My Role
I handle **critical bug fixes, architectural audits, and cross-cutting concerns** — things that span
backend and frontend simultaneously or that require careful coordination across layers. I do NOT own
new feature design (that's the PM's domain), but I execute fixes cleanly and precisely once approved.

### What I fixed in my first session (July 2026)
- **P2 (Section Coordinator label)** — Audited all 4 affected files; all already correct. Confirmed clean.
- **P5 (UpgradePlanPage country hardcode)** — Added `country?: string` to `AuthUser` in `authSlice.ts`;
  rewired `UpgradePlanPage.tsx` to read `state.auth.user?.country` via `useAppSelector`, replacing the
  hardcoded `'Nepal'` string. Fallback to `'Nepal'` preserved for schools without country set.
- **P6 (CORS hardcoded)** — `app.ts` now reads `process.env.CORS_ORIGIN || 'http://localhost:3000'`.
  Add `CORS_ORIGIN=` to Backend `.env` before deploying to staging or production.
- **P8 (Missing DB index)** — Created `Backend/migration_attendance_index.sql`. Run it once on your DB.

### What I fixed in my second session (July 2026 — Antigravity/Frontend Developer)
- **P1 (Subject-teacher exam result enforcement)** — Added `isTeacherAssignedToSubjectInClass` to
  `class.repository.ts`. Service layer (`exam.service.ts`) now receives `requester_teacher_id` from the
  controller; faculty callers get a 403 if they attempt to enter/edit marks for a subject not assigned
  to them in that class. Admin callers pass `undefined` and bypass the check. Note: `AddClassForm.tsx`
  teacher picker was already implemented — only the backend guard was missing.
- **P3 & P4 (Transport/Hostel auto-billing)** — Mirrored transport's architecture for hostels: added
  `generateHostelBillsService`, `getHostelFeeSummaryService`, and `autoAddHostelFee` in `fee.service.ts`.
  Added `POST /fees/hostel/generate` and `GET /fees/hostel/summary` endpoints. Added a manual "Generate Bills"
  button with a month picker in both `TransportPage.tsx` and `HostelPage.tsx`.
- **P9 (OTP email errors swallowed)** — Both 2FA login and forgot-password flows in `auth.service.ts`
  now `await sendOTPEmail(...)` inside try/catch and throw `AppError(503)` on mail server failure.

### How I work
- I **always re-read files fresh** before any edit — I never trust my session memory of a file's content.
- I **write targeted, surgical changes** — I read the full file, change only what needs changing, write back.
- I **never touch architectural decisions** (subscription gates, feature scope, plan gating) without Ashok's
  explicit go-ahead. If something looks wrong architecturally, I flag it here rather than unilaterally fixing it.
- I **verify the type chain** — if a frontend fix requires a new type field, I trace it all the way from
  the DB column → backend response → TypeScript interface → Redux state → component prop.
- I keep this file up to date after every session so other models and Ashok always know where things stand.

### Notes for the next session
- P3/P4 (Transport/Hostel billing) need a `POST /fees/hostel/generate` endpoint mirroring the
  transport one, plus "Generate Bills" buttons on both admin pages. Straightforward pattern.
- P7 (`getMeService` enrollment query on every `/auth/me`) — lazy-load enrollments separately.
- P10 (Stale `.bak` files) — safe to delete from `(teacher)/attendance/`.
- P11 (Revenue stat undercounts in super-admin) — fix `getAllSchoolsWithSubscriptions` to sum
  `amount_paid` across all rows per school, not just the latest.
