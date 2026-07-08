# SchoolPOS (Skoolio) — Project Coordination Notes

> Last updated: July 2026 — Skoolio Project Manager
> **Every model must read this file at the start of every session.**
> Read `schema.md` for full table structures, enum values, and common gotchas.

---

## ⚠️ Critical rule for all models

**Always read a file fresh immediately before editing it.**
Two Claude sessions (claude.ai chat + Claude Code/MCP) edit this codebase simultaneously.
Files change underneath you without warning. A chat-session edit to `auth.service.ts` was
already silently overwritten once and had to be redone. So:

- Never trust session memory about what a file contains. Re-read it.
- If a file looks different from what you expect, something else touched it. Re-derive from what's actually there.
- Prefer small targeted edits over full-file rewrites to minimise collision risk.
- When in doubt, ask Ashok before rewriting.
- Use `filesystem:write_file` (not `create_file`) — `create_file` writes to sandboxed container only, NOT to the project.

---

## Team on this project

### Skoolio Project Manager (claude.ai chat session)
**Role**: Senior PM — designs features, writes SQL with Ashok, makes all architectural
decisions, audits frontend/backend contracts, maintains `claude.md` + `schema.md`,
coordinates between all models. Does NOT implement code directly in the filesystem.
No model should override PM decisions without Ashok's explicit approval.

### Skoolio Bug Hunter (Claude Code / MCP session)
**Role**: Senior Backend Developer — implements features, fixes bugs, wires routes, builds
and fixes frontend pages, maintains TypeScript correctness, writes migration files.
Read `claude.md` at the start of every session. Re-read files fresh before every edit.
Prefer targeted surgical edits. Never add subscription gates or expand feature scope
without Ashok's explicit approval.

### Skoolio Frontend Developer (Antigravity / other session)
**Role**: Frontend Developer — designs and implements UI, wires frontend to backend APIs.
Read `claude.md` before every session. Read files fresh before editing.

**House style (Frontend Developer):**
- Admin read-only pages: `fa-chart-*` icons in sidebar, not `fa-user-check`
- Modals: always `onClick={e => e.stopPropagation()}` on inner container
- New admin pages: inline `style={}` (no new `.module.css` files)
- `useApi` for mount/dep-triggered data; direct `apiRequest()` in try/catch for mutations
- `useMutation` now re-throws on error — always wrap `await execute(...)` in try/catch
- Faculty JWT: `req.user.id` = teacher DB id, `req.user.school_id` = school — never mix

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
- **File Storage**: Azure Blob Storage — account name `skoolio` (see P1 below for full spec).

### JWT payload shapes — CRITICAL
```
Admin/Super Admin: { id (= school_id), email, role, school_name, ... }
Faculty/Student:   { id (= own record id), school_id, email, role, school_name, ... }
```
**Never use `req.user.id` as school_id for faculty/student — it is their own record id.**

### Route ordering rule (Express)
Static segments MUST come before dynamic `/:param` in the same router.
Violating this causes silent wrong-route matches with no error.

### Next.js route group rule
`(admin)`, `(teacher)`, `(student)` are URL-transparent (invisible in URL).
**All teacher pages: `(teacher)/teacher/` → URL: `/teacher/*`**
**All student pages: `(student)/student/` → URL: `/student/*`**

---

## Pending DB migrations — RUN THESE IN ORDER

All migration files in `Backend/`. Run each once against your PostgreSQL DB.

```
1. migration_attendance_index.sql         ← performance index on attendance_details
2. migration_platform_settings.sql        ← platform config table (single row)
3. migration_2fa_otp.sql                  ← OTP table for 2FA
4. migration_net_salary.sql               ← net_salary GENERATED column on teacher_salaries
5. migration_scholarship.sql              ← scholarship_type/percent/remarks on students
6. migration_transport_fee_collection.sql ← fee_type column + unique index on fee_collections
7. migration_salary_deductions.sql        ← tax_amount/provident_fund/other_deduction on teacher_salaries
8. migration_billing_start_rule.sql       ← billing_start_rule on fee_structures (WRITE THIS FILE)
```

**Migration 8 not yet written to disk — write this file:**
```sql
-- Backend/migration_billing_start_rule.sql
ALTER TABLE fee_structures
  ADD COLUMN IF NOT EXISTS billing_start_rule VARCHAR(20) NOT NULL DEFAULT 'next_month';
-- Valid values: 'next_month' | 'skip_two_months' | 'academic_year'
-- 'next_month'      = first bill is the month after admission month (default, most common)
-- 'skip_two_months' = first bill is 2 months after admission (buffer for late joiners)
-- 'academic_year'   = bill from academic year start regardless of admission date
```

Also run `migration_class_subject_teachers.sql` at project root if not already done.

---

## What is fully built and working

### Backend modules (all registered in `app.ts`)
```
/api/auth              login (admin/teacher/student), 2FA OTP, forgot-password, /auth/me
/api/academic-years    CRUD — GET /active accessible to faculty + student
/api/classes           CRUD + sections + subjects + class_subject_teachers
/api/teachers          CRUD + salary (with deduction breakdown) + me/sections + me/salary
/api/students          CRUD + enrollments + scholarship + subscription cap enforcement
/api/fees              structures, collections, payments, transport auto-billing, monthly bill gen
/api/attendance        mark (faculty/coordinator) + admin summary + student self-service
/api/exams             CRUD + schedules + results + grade scales + publish flow
/api/expenses          CRUD + categories + summary
/api/calendar          school_calendars + weekly_offs + events + working days
/api/subscriptions     Free/Pro/Plus + grace-period auto-downgrade + feature gating
/api/platform          maintenance mode + platform name/email (single-row settings)
/api/transport         vehicles + routes + stops + assignments + bill generation
/api/hostel            hostels + rooms + assignments + bill generation
/api/school            settings + change password + super-admin 2FA toggle + block/unblock
```

### Frontend — all pages built and wired to real APIs
**Admin**: Dashboard, Students (list/add wizard/profile/edit+scholarship), Teachers
(list/add/profile/edit), Classes, Sections, Subjects, Academic Years, Calendar,
Attendance (read-only summary), Fee Management (structures/collect/records/generate monthly),
Expenses, Faculty Salary (list/pay with deduction breakdown), Exams & Results,
Transport, Hostel, My Subscription, Upgrade Plan, Settings.

**Teacher**: Dashboard, Profile, Attendance Overview, Mark Attendance (coordinator-only),
Results Entry (assigned subjects only), My Salary.

**Student**: Dashboard, Profile, My Attendance, My Results, My Fees.

**Super Admin**: Dashboard, Schools (block/unblock + 2FA toggle), Subscriptions (plan editor),
Settings (maintenance mode, platform name, support email).

---

## 🔴 P1 — HIGHEST PRIORITY: Azure Blob Storage for image uploads

**DESIGNED BY PM. NOT YET BUILT. Build this before anything else.**

### Azure details
- Storage account name: `skoolio`
- Containers to create (both with **Blob-level public read access**):
  - `skoolio-logos` — school logos
  - `skoolio-profiles` — teacher and student photos

### Environment variables (add to `Backend/.env`)
```
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=skoolio;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT_NAME=skoolio
AZURE_LOGOS_CONTAINER=skoolio-logos
AZURE_PROFILES_CONTAINER=skoolio-profiles
```

### Blob URL pattern
```
School logo:   https://skoolio.blob.core.windows.net/skoolio-logos/{school_id}.{ext}
Teacher photo: https://skoolio.blob.core.windows.net/skoolio-profiles/teachers/{school_id}/{teacher_id}.{ext}
Student photo: https://skoolio.blob.core.windows.net/skoolio-profiles/students/{school_id}/{student_id}.{ext}
```
Uploading overwrites the same blob — no orphaned files accumulate.
Store only the full URL in the DB column (`schools.logo`, `teachers.photo`, `students.photo`).

### What to build

**Step 1 — Install packages:**
```bash
cd Backend && npm install @azure/storage-blob multer @types/multer
```

**Step 2 — Create `Backend/src/utils/azureStorage.ts`:**
```ts
import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!
);

export const uploadToAzure = async (
  containerName: string,
  blobName: string,       // e.g. "teachers/42/7.jpg"
  buffer: Buffer,
  mimeType: string
): Promise<string> => {
  const container = blobServiceClient.getContainerClient(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType }
  });
  return blockBlob.url;
};

export const deleteFromAzure = async (
  containerName: string,
  blobName: string
): Promise<void> => {
  const container = blobServiceClient.getContainerClient(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.deleteIfExists();
};

export const getLogoBlob   = (school_id: number, ext: string) => `${school_id}.${ext}`;
export const getTeacherBlob = (school_id: number, teacher_id: number, ext: string) => `teachers/${school_id}/${teacher_id}.${ext}`;
export const getStudentBlob = (school_id: number, student_id: number, ext: string) => `students/${school_id}/${student_id}.${ext}`;
```

**Step 3 — Create `Backend/src/Controllers/upload.controller.ts`:**
Three endpoints, one per upload type:
- `POST /upload/logo` — admin only, uploads to `skoolio-logos`, updates `schools.logo`
- `POST /upload/teacher-photo/:id` — admin only, uploads to `skoolio-profiles`, updates `teachers.photo`
- `POST /upload/student-photo/:id` — admin only, uploads to `skoolio-profiles`, updates `students.photo`

Each endpoint:
1. Accepts `multipart/form-data` via `multer` (memory storage, 2MB limit, images only)
2. Validates file type: `image/jpeg`, `image/png`, `image/webp` only
3. Derives blob name from IDs (no random UUIDs — deterministic overwrites)
4. Uploads to Azure via `uploadToAzure`
5. Updates the relevant DB column with the returned URL
6. Returns `{ url: '...' }` to the frontend

**Step 4 — Create `Backend/src/Routes/upload.routes.ts`:**
```ts
router.use(protect, restrictTo('admin', 'super_admin'));
router.post('/logo',                multerMiddleware, uploadLogo);
router.post('/teacher-photo/:id',   multerMiddleware, uploadTeacherPhoto);
router.post('/student-photo/:id',   multerMiddleware, uploadStudentPhoto);
```
Register in `app.ts` as `/api/upload`.

**Step 5 — Frontend wiring:**
- School Settings page: file input → `POST /upload/logo` → update logo preview + Redux user.logo
- Add/Edit Teacher form: file input → `POST /upload/teacher-photo/:id` → show preview
- Add/Edit Student form: file input → `POST /upload/student-photo/:id` → show preview
- Display: everywhere a photo/logo is shown, use `<img src={photo || defaultAvatar} />`
- File input UX: show current photo as preview, click to change, show upload progress

---

## 🔴 P2 — Monthly fee billing redesign

**DESIGNED BY PM. NOT YET BUILT. Build after P1.**

### Billing start rule (already in migration 8 above)
| Value | First bill month |
|---|---|
| `next_month` | Month after admission month — **default** |
| `skip_two_months` | 2 months after admission month |
| `academic_year` | Academic year start month regardless of admission |

### Mid-month rule (applies to ALL rules)
```
Generating bills for current month:
  Student admitted day ≤ 15 → include this month
  Student admitted day > 15 → skip this month, start next
```

### Bill generation logic
- Admin clicks "Generate Monthly Bills" → generates current month ONLY
- Idempotent — skips students who already have a bill for this month
- Applies `billing_start_rule` to skip ineligible students
- Applies `scholarship_percent`: `net = amount × (1 - pct/100)`
- Creates `fee_collections` rows with `fee_type = 'academic'`
- Never generates future months

### What to build
1. `billing_start_rule` dropdown in fee structure add/edit form
2. `generateMonthlyFeeBillsService` in `fee.service.ts` with rules above
3. `POST /fees/monthly/generate` with `{ academic_year_id, billing_month: 'YYYY-MM' }`
4. "Generate Monthly Bills" button in Fee Management with month picker

---

## 🔴 P3 — Scholarship not applied to fees

**Schema exists. Logic missing. Build after P1 and P2.**

`students.scholarship_percent` exists in DB but is never used. Needs:
- Applied in `generateMonthlyFeeBillsService` (auto-discount on bill creation)
- Applied in `CollectFeePage` (show discounted amount before collecting)
- Displayed on student profile page (type, percent, remarks)
- Displayed in Add Student wizard Step 2 fee assignment

---

## 🔴 P4 — Miscellaneous / Store items fee

**No backend changes needed. Frontend only.**

Schools need to bill for dress, tie, belt, books etc.
Already supported via `fee_structures.frequency = 'one_time'`.
Just needs clear UI: add a "Store / Miscellaneous Item" option in the fee structure form
that sets `frequency = 'one_time'` and lets admin enter any custom name.

---

## 🟠 P5 — Attendance register N+1 API pattern

`TeacherAttendanceOverviewPage` makes 22+ sequential `GET /attendance/:id` calls per month.
`getSectionRegister` already exists in `attendance.repository.ts`.

What to build:
- `getSectionRegisterService` in `attendance.service.ts`
- `getSectionRegister` controller + `GET /attendance/section/:sectionId/register` route
- Frontend: replace N+1 pattern with single register call, remove `detailCache` state

---

## 🟠 P6 — Revenue undercount in super-admin subscriptions

`getAllSchoolsWithSubscriptions` uses `DISTINCT ON (school_id)` — only latest row per school.
Fix: `SUM(amount_paid)` across all rows per school, not just the latest one.

---

## 🟡 P7 — Stale `.bak` files in teacher route group

`(teacher)/attendance/page.tsx.bak` and `(teacher)/attendance/class/page.tsx.bak` still
exist on disk. Duplicates of correct files under `(teacher)/teacher/attendance/`.
Safe to delete — don't affect builds but clutter the repo.

---

## 🔵 Future features (approved, not yet scheduled)

| ID | Feature | Notes |
|---|---|---|
| F1 | Student promotion workflow | Approved, deferred |
| F2 | OTP rate limiting | Do NOT add without Ashok go-ahead |
| F3 | Teacher 2FA | Do NOT add without Ashok go-ahead |
| F4 | Email on subscription activation | Deferred — SMTP not confirmed |
| F5 | Grace period cron job | Deferred |
| F6 | Online payment gateway | Deferred — eSewa / Khalti / Stripe |

---

## Subscription gates — do not add more without Ashok's approval

| Gate | Where enforced |
|---|---|
| Student creation at cap | `assertCanAddStudent` in `student.service.ts` |
| Teacher creation at cap | `assertCanAddTeacher` in `teacher.service.ts` |
| Fee management on Free | `assertFeeManagementEnabled` in `fee.service.ts` |

Everything else (attendance, fee collection, exams, viewing, editing) is unrestricted.

---

## House style — all models must follow

- Controllers pull `school_id` from JWT only — never from `req.body` or `req.params`
- Salary payment methods: `cash | bank_transfer | cheque` only — no `online`, no `upi`
- Fee/expense payment methods: `cash | bank_transfer | cheque | online`
- PostgreSQL dates need `::text` casts in SELECT/RETURNING — timezone shift otherwise
- `net_salary` on `teacher_salaries` is `GENERATED ALWAYS AS` — never write or compute in JS
- `useApi` on frontend unwraps `res.data` automatically
- `useMutation` re-throws on error — always wrap `await execute(...)` in try/catch
- See `schema.md` "Common mistakes / gotchas" for the full list of known field-name traps
