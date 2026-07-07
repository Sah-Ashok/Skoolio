# SchoolPOS (Skoolio) — Project Coordination Notes

> Last updated: July 2026.
> **Every model must read this file at the start of every session.**
> Read `schema.md` for full table structures and enum values.

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

**What I fixed (July 2026 — Session 1):**
- CORS hardcoded → reads `process.env.CORS_ORIGIN || 'http://localhost:3000'`
- UpgradePlanPage hardcoded 'Nepal' → reads `state.auth.user?.country` from Redux
- Missing DB index on attendance_details → `Backend/migration_attendance_index.sql` (run once)
- OTP email errors swallowed → both 2FA and forgot-password now throw AppError(503) on mail failure

---

### Skoolio Frontend Developer (Antigravity — claude.ai / Gemini session)
**Role**: Frontend Developer — designs and implements all frontend UI, wires frontend to backend
APIs, handles backend wiring (service/controller/route) when bootstrapping new modules.

I read `claude.md` before every session. I read files fresh before editing. I never overwrite
without checking what's currently there. I follow all house-style rules.

**What I fixed (July 2026 — Session 2):**
- Subject-teacher exam result enforcement → `isTeacherAssignedToSubjectInClass` guard in
  `exam.service.ts`, faculty get 403 if subject not assigned to them in that class
- Transport/Hostel auto-billing → `POST /fees/hostel/generate`, `GET /fees/hostel/summary`,
  `autoAddHostelFee` in `fee.service.ts`, "Generate Bills" buttons in both admin pages
- `getMeService` expensive enrollment join → lighter `getStudentProfileService`, enrollment
  loaded lazily in dashboard/profile pages
- P9 OTP swallow fix (also in session 2)

**What I fixed (July 2026 — Session 3):**
- Teacher Attendance Overview (`/teacher/attendance`) was a simple card grid with no data.
  Completely rebuilt as a proper **attendance register**:
  - Month-navigable (← → nav, "Today" shortcut, respects academic year start boundary)
  - Rows = students in section; columns = every calendar day of the month
  - Each cell shows P / A / L / Lv pill — loaded from `GET /attendance/:id` detail cache
  - Weekend columns dimmed; today's column highlighted amber; dot indicator on days with records
  - Footer row: daily present/absent totals from header counts
  - Right-side year totals (P, A, L, Lv) + attendance % progress bar per student
  - Summary strip at top: students, days marked, present, absent, late+leave counts
  - Bottom quick-reference table: all records this month with status badge + Edit link
  - Section switcher (shows only coordinator's assigned sections)
  - Bug fixed: `(teacher)/teacher/attendance/page.tsx` was importing admin `AttendancePage`
    — corrected to import `TeacherAttendanceOverviewPage`

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
`(admin)`, `(teacher)`, `(student)` are URL-transparent — they don't add a URL segment.
**All teacher pages must live under `(teacher)/teacher/` → produces `/teacher/*` URLs.**
**All student pages must live under `(student)/student/` → produces `/student/*` URLs.**
A file at `(teacher)/dashboard/page.tsx` collides with `(admin)/dashboard/page.tsx` — build error.

---

## What is fully built and working

### Backend modules (all registered in `app.ts`)
```
/api/auth              login (admin/teacher/student), 2FA OTP, forgot-password, /auth/me
/api/academic-years    full CRUD
/api/classes           CRUD + sections + subjects + class_subject_teachers
/api/teachers          CRUD + salary + coordinator sections (GET /teachers/me/sections)
/api/students          CRUD + enrollments + subscription cap enforcement
/api/fees              structures, collections, payments, transport/hostel bill generation
/api/attendance        mark (faculty/coordinator only) + admin summary + student self-service
/api/exams             CRUD + schedules + results + grade scales + publish flow
/api/expenses          CRUD + categories + summary
/api/calendar          school_calendars + weekly_offs + events + working days
/api/subscriptions     Free/Pro/Plus + grace-period auto-downgrade + feature gating
/api/platform          maintenance mode + platform name/email
/api/transport         vehicles + routes + stops + assignments + bill generation
/api/hostel            hostels + rooms + assignments + bill generation
/api/school            school settings + change password + 2FA toggle
```

### Frontend — all pages built and wired to real APIs
**Admin**: Dashboard, Students (list/add wizard/profile), Teachers (list/add/profile),
Classes, Sections, Subjects, Academic Years, Calendar, Attendance (read-only summary),
Fee Management, Expenses, Salary, Exams & Results, Transport, Hostel,
My Subscription, Upgrade Plan, Settings.

**Teacher**: Dashboard, Profile, **Attendance Register** (rebuilt Session 3), Mark Attendance, Results Entry.

**Student**: Dashboard, Profile, My Attendance, My Results, My Fees.

**Super Admin**: Dashboard, Schools, Subscriptions (plan editor), Settings.

---

## ⚠️ Pending DB migrations — run these on your database

```sql
-- 1. Transport/hostel fee support (REQUIRED before testing transport/hostel fees)
ALTER TABLE fee_collections ADD COLUMN fee_type VARCHAR(20) NOT NULL DEFAULT 'academic';
ALTER TABLE fee_collections ALTER COLUMN fee_structure_id DROP NOT NULL;

-- 2. Scholarship fields on students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS scholarship_type    VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_percent DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_remarks TEXT         DEFAULT NULL;

-- 3. Billing start rule on fee structures (NEW — for monthly billing redesign)
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS billing_start_rule VARCHAR(20) NOT NULL DEFAULT 'next_month';
-- Valid values: 'next_month' | 'skip_two_months' | 'academic_year'

-- 4. Attendance index (performance)
CREATE INDEX IF NOT EXISTS idx_attendance_details_student
  ON attendance_details(student_id, school_id);
```

Also run `Backend/migration_net_salary.sql` and `migration_class_subject_teachers.sql`
at project root if not already done.

---

## ✅ Resolved — B1, B2, B3 (Skoolio Bug Hunter — July 2026)

### B1. Monthly fee billing — COMPLETE
- `billing_start_rule` column + migration in place
- `generateMonthlyFeeBillsService` implements `next_month` / `skip_two_months` / `academic_year` + mid-month day-15 rule
- `POST /fees/monthly/generate` endpoint wired
- "Generate Monthly Bills" panel in `FeesPage`
- `billing_start_rule` dropdown in `AddFeeStructurePage`

### B2. Scholarship not applied to fees — COMPLETE
- Applied in `generateMonthlyFeeBillsService` — discount from `scholarship_percent`
- Scholarship banner in `CollectFeePage`
- Scholarship card in `StudentProfilePage`

### B3. Miscellaneous / Store Items fee — COMPLETE
- "Miscellaneous / Store Item" shortcut in `AddFeeStructurePage` sets `frequency = 'one_time'`
- No backend changes needed

---

## 🟡 Pending — medium (UX / maintenance)

### M1. Stale `.bak` files in teacher route group
`(teacher)/attendance/page.tsx.bak` and `(teacher)/attendance/class/page.tsx.bak` still
exist on disk. Delete them — they don't affect builds but clutter the repo.

### M2. Revenue stat undercounts in super-admin subscriptions
`getAllSchoolsWithSubscriptions` uses `DISTINCT ON (school_id)` — only returns latest
subscription row per school. Fix: `SUM(amount_paid)` across all rows per school.

---

## 🔵 Pending — future features (approved, not yet scheduled)

### F1. Student promotion workflow — approved, deferred
### F2. Rate limiting on OTP endpoints — do not add without Ashok's go-ahead
### F3. 2FA for teachers — do not add without Ashok's go-ahead
### F4. Email notification on subscription activation — deferred (SMTP not confirmed)
### F5. Grace period cron job — deferred
### F6. Online payment gateway — deferred (eSewa/Khalti/Stripe)

---

## Subscription enforcement — intentionally limited scope

**Do not add more gates without Ashok's approval.**

| Gate | Where enforced |
|---|---|
| Student creation blocked at `max_students` cap | `assertCanAddStudent` in `student.service.ts` |
| Teacher creation blocked at `max_teachers` cap | `assertCanAddTeacher` in `teacher.service.ts` |
| Fee structure creation blocked on Free plan | `assertFeeManagementEnabled` in `fee.service.ts` |

Everything else (attendance, fee collection, exams, viewing, editing) is unrestricted.

---

## House style — all models must follow

- Controllers pull `school_id` from JWT only — never from `req.body` or `req.params`
- Money enums are table-specific:
  - Salary: `cash | bank_transfer | cheque` only — **no `online`, no `upi`**
  - Fees + expenses: `cash | bank_transfer | cheque | online`
- PostgreSQL dates need `::text` casts in SELECT/RETURNING — or they come back timezone-shifted
- `net_salary` on `teacher_salaries` is `GENERATED ALWAYS AS` — never write or compute in code
- `useApi` on frontend unwraps `res.data` automatically
- See `schema.md` "Common mistakes / gotchas" table for full list of known field-name traps



Attendance Register Scalability Fix
Problem: N+1 API Pattern
The current TeacherAttendanceOverviewPage makes:

GET /attendance/section/:id → returns all year's headers (up to 220+ rows)
For each day in the current month (e.g. 22 working days) → 22 × GET /attendance/:id — serial, blocking calls
At scale with 1,500 students across 12 sections and 20 schools:

330,000 detail rows/school/year, 6.6M/year across 20 schools
Loading one month = 23 sequential HTTP round-trips, each touching the DB
The Fix
getSectionRegister already exists in attendance.repository.ts — a single SQL query that:

Scopes to the requested year/month only
Returns one row per (student, day) pair with status
Computes year totals in the same query via a subquery — zero extra round-trips
Result: at most students × working_days rows (e.g. 40 × 22 = 880 rows, trivially fast)
Proposed Changes
Backend — Wire up the register endpoint
[MODIFY] Backend/src/Service/attendance.service.ts
Add getSectionRegisterService(section_id, school_id, academic_year_id, year, month, teacherId) that calls getSectionRegister from the repository.
Enforces coordinator check via assertCoordinator.
[MODIFY] Backend/src/Controllers/attendance.controller.ts
Add getSectionRegister controller: reads ?year=&month=&academic_year_id= from query, calls the new service.
[MODIFY] Backend/src/Routes/attendance.routes.ts
Add GET /attendance/section/:sectionId/register before the existing GET /attendance/section/:sectionId route (static before dynamic — already covered, but ours is more specific).
Frontend — Replace N+1 with single register API call
[MODIFY] frontend/src/components/admin/attendance/TeacherAttendanceOverviewPage.tsx
Remove detailCache state and the useEffect that fires 22 serial GET /attendance/:id calls.
Remove the separate student list fetch (/students/enrollments?...) — students now come from the register response.
Replace both with a single GET /attendance/section/:id/register?year=&month=&academic_year_id= call.
Parse the flat rows into:
students: deduplicated list of {student_id, full_name, admission_number}
dayMap[student_id][date]: status for the register grid
yearTotals[student_id]: directly from year_present, year_absent, year_late, year_leave, year_total on each row
Keep month navigation, summary strip, and records table unchanged (records table still uses header data from monthRecords via the existing section endpoint — or we switch it to derive from register data).
NOTE

The monthly records table at the bottom (dates + P/A counts + status + edit link) still needs header-level data (status: 'submitted'|'draft', total_present, etc.). We can derive daily totals from the register rows themselves (count per date) and drop the separate section fetch entirely — one API call serves the entire page.

Verification Plan
Manual Verification
Load the attendance register page — DevTools network tab should show exactly 1 API call (plus the sections and academic year calls, which are static).
Navigate to a different month — 1 new API call fires, registers instantly.
Change section — 1 new API call fires.
Year totals and month summary counts should match the existing data.
The "Mark Today's Attendance" button and edit links should be unaffected.
Open Questions
None. The SQL is already in place and tested by the Bug Hunter.