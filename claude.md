# SchoolPOS (Skoolio) — Project Coordination Notes

> Last updated: July 2026 — Skoolio Bug Hunter
> **Every model must read this file at the start of every session.**
> Read `schema.md` for full table structures and enum values.

---

## ⚠️ Critical rule for all models

**Always read a file fresh immediately before editing it.**
Two Claude sessions (claude.ai + Claude Code/MCP) edit this codebase simultaneously.
Files change underneath you without warning. A chat-session edit to `auth.service.ts` was
already silently overwritten once — it had to be redone. So:

- Never trust session memory about what a file contains. Re-read it.
- If a file looks different from what you expect, something else touched it. Re-derive.
- Prefer small, targeted edits over full-file rewrites to minimise overwrite risk.
- When in doubt, ask Ashok before rewriting.

---

## Team

### Skoolio Bug Hunter (Claude Code / MCP session) ← YOU ARE THIS
**Role**: Senior Developer — implements features, fixes bugs, wires routes, builds/fixes
frontend pages, maintains TypeScript correctness, writes migrations.

Rules:
- Read `claude.md` at the start of every session.
- Re-read any file fresh immediately before editing it.
- Prefer targeted, surgical edits.
- Never override architectural decisions, add subscription gates, or expand feature scope
  without Ashok's explicit approval.
- Use `filesystem:write_file` (not `create_file`) to write files to the MCP filesystem.
  `create_file` writes to the sandboxed container — files there are NOT in the project.

### Skoolio Project Manager (claude.ai chat session)
**Role**: Senior PM — designs features, writes SQL with Ashok, makes architectural decisions,
audits frontend/backend, maintains `claude.md` + `schema.md`, coordinates between models.
Does not implement code directly in the filesystem.

### Skoolio Frontend Developer (Antigravity / other session)
**Role**: Frontend Developer — designs and implements UI, wires frontend to backend APIs.

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

### JWT payload shapes — CRITICAL
```
Admin/Super Admin: { id (= school_id), email, role, school_name, ... }
Faculty/Student:   { id (= own record id), school_id, email, role, school_name, ... }
```
**Never use `req.user.id` as school_id for faculty/student — it is their own record id.**
Use `req.user.school_id` instead.

### Route ordering rule (Express)
Static segments MUST come before dynamic `/:param` in the same router.
Violating this causes silent wrong-route matches.

### Next.js route group rule
`(admin)`, `(teacher)`, `(student)` are URL-transparent.
**All teacher pages live under `(teacher)/teacher/` → URL: `/teacher/*`**
**All student pages live under `(student)/student/` → URL: `/student/*`**

---

## Pending DB migrations — RUN THESE IN ORDER

All migration files are in `Backend/`. Run each once against your Postgres DB.

```
1. migration_attendance_index.sql       ← performance index on attendance_details
2. migration_platform_settings.sql      ← platform config table
3. migration_2fa_otp.sql                ← OTP table for 2FA
4. migration_net_salary.sql             ← net_salary GENERATED column on teacher_salaries
5. migration_scholarship.sql            ← scholarship_type/percent/remarks on students
6. migration_transport_fee_collection.sql ← fee_type column + unique index on fee_collections
7. migration_salary_deductions.sql      ← tax_amount/provident_fund/other_deduction on teacher_salaries
```

Also run `migration_class_subject_teachers.sql` at project root if not already done.

**Inline migration still needed (no file yet):**
```sql
-- Billing start rule on fee_structures
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS billing_start_rule VARCHAR(20) NOT NULL DEFAULT 'next_month';
-- Valid values: 'next_month' | 'skip_two_months' | 'academic_year'
```

---

## What is fully built and working

### Backend modules (all registered in `app.ts`)
```
/api/auth              login (admin/teacher/student), 2FA, forgot-password, /me
/api/academic-years    CRUD — GET /active now accessible to faculty + student
/api/classes           CRUD + sections + subjects + class_subject_teachers
/api/teachers          CRUD + salary (with deduction breakdown) + me/sections + me/salary
/api/students          CRUD + enrollments + scholarship + subscription cap enforcement
/api/fees              structures, collections, payments, transport auto-billing, monthly bill gen
/api/attendance        mark (faculty/coordinator) + admin summary + student self-service
/api/exams             CRUD + schedules + results + grade scales + publish flow
/api/expenses          CRUD + categories + summary
/api/calendar          school_calendars + weekly_offs + events + working days
/api/subscriptions     Free/Pro/Plus + grace-period auto-downgrade + feature gating
/api/platform          maintenance mode + platform name/email
/api/transport         vehicles + routes + stops + assignments
/api/hostel            hostels + rooms + assignments
/api/school            settings + change password + super-admin 2FA toggle + block/unblock
```

### Frontend pages

**Admin portal:**
- Dashboard, Students (list / add wizard / profile / edit with scholarship), Teachers (list / add / profile / edit)
- Classes, Sections, Subjects, Academic Years, Calendar, Attendance (read-only summary)
- Fee Management (structures / collect / records / generate monthly bills)
- Expenses, Faculty Salary (list / pay — with tax/PF/other deduction breakdown)
- Exams & Results, Transport, Hostel
- My Subscription, Upgrade Plan, Settings

**Teacher portal:**
- Dashboard, Profile
- Attendance Overview (`/teacher/attendance`) — month picker, past records, expandable student detail
- Mark Attendance (`/teacher/attendance/class`) — fixed to use `/students/enrollments` (faculty-accessible)
- Enter Results
- **My Salary** (`/teacher/salary`) — NEW: full salary slips with deduction breakdown (tax/PF/other)

**Student portal:** Dashboard, Profile, My Attendance, My Results, My Fees

**Super Admin portal:** Dashboard, Schools (block/unblock + 2FA toggle wired to real API), Subscriptions, Settings

---

## ✅ Completed this session (Skoolio Bug Hunter — July 2026)

| # | Issue | Status | Files changed |
|---|---|---|---|
| 1 | Calendar 404 + weekly-offs | Already fixed in code | — |
| 2 | Attendance route conflicts | Already fixed in code | — |
| 3 | Receipt number race condition | ✅ Fixed | `fee.repository.ts`, `fee.service.ts` |
| 4 | `net_salary` not persisted | ✅ Fixed | `teacher.repository.ts`, `teacher.service.ts`, `migration_net_salary.sql` |
| 5 | Subscription not transactional | ✅ Fixed | `subscription.repository.ts`, `subscription.service.ts` |
| 6 | Missing fee guard on payments | ✅ Fixed | `fee.service.ts` |
| 7 | Fee structure form invisible input | ✅ Fixed | `AddFeeStructurePage.tsx`, `fees.module.css` |
| 8 | Fee structure save silent fail | ✅ Fixed | `useApi.ts` (re-throw), `AddFeeStructurePage.tsx`, `FeeStructuresPage.tsx` |
| 9 | Add Student 400 Bad Request | ✅ Fixed | `AddStudentForm.tsx` (sanitize empty strings) |
| 10 | No scholarship field | ✅ Fixed | `student.types.ts`, `student.repository.ts`, `AddStudentForm.tsx`, `EditStudentPage.tsx`, `migration_scholarship.sql` |
| 11 | No Edit Student page | ✅ Fixed | `EditStudentPage.tsx` (new), route `[id]/edit/page.tsx` |
| 12 | Transport fee auto-billing | ✅ Built | `fee.repository.ts`, `fee.service.ts`, `migration_transport_fee_collection.sql` |
| 13 | Monthly bill generation | ✅ Built | `fee.service.ts`, `FeesPage.tsx` (Generate Monthly Bills panel) |
| 14 | Scholarship in billing + UI | ✅ Built | `fee.service.ts`, `CollectFeePage.tsx`, `StudentProfilePage.tsx` |
| 15 | SuperAdmin mock data | ✅ Fixed | `SuperAdminSchoolsPage.tsx`, block/unblock backend wired |
| 16 | Teacher Edit save bug | ✅ Fixed | `EditFacultyForm.tsx` |
| 17 | Faculty 403 on `/academic-years/active` | ✅ Fixed | `academic.routes.ts`, `academic.controller.ts` |
| 18 | Faculty 403 on `/teachers` (attendance page) | ✅ Fixed | `MarkClassAttendancePage.tsx` (conditional fetch) |
| 19 | Mark Attendance no students shown | ✅ Fixed | `TeacherMarkAttendancePage.tsx` (switched to `/students/enrollments`) |
| 20 | Teacher Attendance Overview 404 | ✅ Fixed | `TeacherAttendanceOverviewPage.tsx` (new), route import corrected |
| 21 | Teacher salary — no page existed | ✅ Built | `TeacherSalaryPage.tsx` (new), `/teacher/salary/page.tsx`, Sidebar updated |
| 22 | Salary deduction breakdown | ✅ Built | `teacher.types.ts`, `teacher.repository.ts`, `PaySalaryPage.tsx`, `migration_salary_deductions.sql` |
| 23 | Migration files not on disk | ✅ Fixed | All 7 migrations now written via `filesystem:write_file` |
| 24 | `/teacher/salary` route 404 | ✅ Fixed | `page.tsx` written via `filesystem:write_file` |

---

## 🟠 Pending — bugs still open

### P1. Attendance register N+1 API pattern
`TeacherAttendanceOverviewPage` makes 22+ sequential `GET /attendance/:id` calls per month.
`getSectionRegister` already exists in `attendance.repository.ts` — a single SQL query
returning the full month grid. Needs:
- `getSectionRegisterService` in `attendance.service.ts`
- `getSectionRegister` controller + `GET /attendance/section/:sectionId/register` route
- Frontend: replace N+1 with single register call, remove `detailCache` state

### P2. Revenue undercount in super-admin subscriptions
`getAllSchoolsWithSubscriptions` uses `DISTINCT ON` — only returns latest subscription row.
Fix: `SUM(amount_paid)` across all rows per school.

### P3. Add Student fee step shows "No fee structures" even when they exist
`AddStudentForm.tsx` Step 2 fetches fee structures by class — but the API call may be using
the wrong `class_id` param or the fetch fires before `activeYear` is loaded. Needs investigation.

### P4. `billing_start_rule` migration not yet in a file
Inline SQL above — should be written to `Backend/migration_billing_start_rule.sql`.

---

## 🔵 Pending — future features (approved, not yet scheduled)

| ID | Feature | Notes |
|---|---|---|
| F1 | Student promotion workflow | Approved, deferred |
| F2 | OTP rate limiting | Do NOT add without Ashok go-ahead |
| F3 | Teacher 2FA | Do NOT add without Ashok go-ahead |
| F4 | Email on subscription activation | Deferred — SMTP not confirmed |
| F5 | Grace period cron job | Deferred |
| F6 | Online payment gateway | Deferred (eSewa / Khalti / Stripe) |

---

## Subscription gates — do not add more without approval

| Gate | Where enforced |
|---|---|
| Student cap | `assertCanAddStudent` in `student.service.ts` |
| Teacher cap | `assertCanAddTeacher` in `teacher.service.ts` |
| Fee management | `assertFeeManagementEnabled` in `fee.service.ts` |

---

## House style — all models must follow

- Controllers pull `school_id` from JWT only — never from `req.body` or `req.params`
- Salary payment methods: `cash | bank_transfer | cheque` only — **no `online`, no `upi`**
- Fee/expense payment methods: `cash | bank_transfer | cheque | online`
- PostgreSQL dates need `::text` casts in SELECT/RETURNING — or they come back timezone-shifted
- `net_salary` on `teacher_salaries` is `GENERATED ALWAYS AS` — never write or compute in JS
- `useApi` on frontend unwraps `res.data` automatically
- `useMutation` now re-throws on error — always wrap `await execute(...)` in try/catch
- Use `filesystem:write_file` to write new files — `create_file` goes to sandboxed container only
- See `schema.md` "Common mistakes / gotchas" for known field-name traps
