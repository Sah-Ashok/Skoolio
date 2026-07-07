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

**Teacher**: Dashboard, Profile, Attendance Overview, Mark Attendance, Results Entry.

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

## 🔴 Pending — critical (blocks real use)

### B1. Monthly fee billing redesign (DESIGNED, NOT YET BUILT)

**Decision made by PM (July 2026). Do not implement differently.**

Fee structures now have a `billing_start_rule` field (migration above):

| Value | Meaning |
|---|---|
| `next_month` | First bill = month after admission month. **Default for most schools.** |
| `skip_two_months` | First bill = 2 months after admission month (buffer for late joiners) |
| `academic_year` | Bill from academic year start regardless of admission date |

**Mid-month rule (applies to ALL rules when generating bills for current month):**
```
Student admitted on day ≤ 15 of the current month → include this month
Student admitted on day > 15 of the current month → skip this month, start next
```

**Bill generation flow (manual button, future cron):**
- Admin clicks "Generate Monthly Bills" for the current month only
- System skips students who already have a bill for this month (idempotent)
- Applies `billing_start_rule` to skip ineligible students
- Applies `scholarship_percent` discount automatically: `net = amount × (1 - pct/100)`
- Creates `fee_collections` rows with `fee_type = 'academic'`
- Never generates future months — current month only

**What needs to be built:**
1. `billing_start_rule` dropdown in fee structure add/edit form
   (options: "Next Month", "Skip Two Months", "From Academic Year Start")
2. `generateMonthlyFeeBillsService` in `fee.service.ts` implementing the rules above
3. `POST /fees/monthly/generate` endpoint with `{ academic_year_id, billing_month: 'YYYY-MM' }`
4. "Generate Monthly Bills" button in Fee Management page with month picker
5. Show correct estimated amount when creating fee structure:
   - `next_month`: show `months_remaining × amount` not full year
   - `academic_year`: show full year amount
   - Always factor in `scholarship_percent` if student has one

### B2. Scholarship not applied to fees
`students.scholarship_percent` exists in DB (migration above) but is never used anywhere.
Needs to be:
- Applied in `generateMonthlyFeeBillsService` (see B1 above)
- Applied when manually collecting a fee (show discounted amount in CollectFeePage)
- Displayed on student profile page (scholarship type, percent, remarks)
- Shown in AddStudentForm wizard's Step 2 fee assignment

### B3. Miscellaneous / store items fee
No dedicated "Store Items" fee type exists. Schools need to bill for dress, tie, belt etc.
These are one-time fees with a custom name.
**Solution**: already supported via `fee_structures.frequency = 'one_time'` — just needs a
clear UI path. Add a "Miscellaneous / Store Item" option in the fee structure form that sets
`frequency = 'one_time'` and lets admin enter any custom name (Dress, Tie, Belt, etc.).
No backend changes needed — just a frontend label and UX improvement.

---

## 🟡 Pending — medium (UX / maintenance)

### M1. Stale `.bak` files in teacher route group
`(teacher)/attendance/page.tsx.bak` and `(teacher)/attendance/class/page.tsx.bak` still
exist on disk. Exact duplicates of correct files under `(teacher)/teacher/attendance/`.
Delete them — they don't affect builds but clutter the repo.

### M2. Revenue stat undercounts in super-admin subscriptions
`getAllSchoolsWithSubscriptions` uses `DISTINCT ON (school_id)` — only returns latest
subscription row per school. Revenue sum only counts the most recent payment.
Fix: `SUM(amount_paid)` across all rows per school, not just the latest one.

---

## 🔵 Pending — future features (approved, not yet scheduled)

### F1. Student promotion workflow
No batch promotion at year-end. Admins manually re-enroll each student.
A "Promote Class" action (Class 9 → Class 10 for all active enrollments) would save
significant admin time. Approved by Ashok as future work.

### F2. Rate limiting on OTP endpoints
`POST /auth/forgot-password` and `POST /auth/verify-2fa` have no rate limiting.
Max 3 OTP requests per 15 min per email via Redis.
**Do not add without Ashok's go-ahead.**

### F3. 2FA for teachers
Currently admin-only. **Do not add without Ashok's go-ahead.**

### F4. Email notification on subscription activation
Deferred until SMTP/SES infrastructure is confirmed.

### F5. Grace period cron job
`resolveCurrentPlanStatus` is lazy — schools that never log in won't auto-downgrade
until next status check. Nightly cron job would fix timing accuracy. Deferred.

### F6. Online payment gateway
School admins will eventually be able to pay subscriptions online (eSewa, Khalti, Stripe).
Currently manual offline activation only. Deferred — payment gateway has setup costs.

---

## Subscription enforcement — intentionally limited scope

**Do not add more gates without Ashok's approval.** Deliberate retention-vs-revenue decision.

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
