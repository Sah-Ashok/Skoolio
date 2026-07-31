# SchoolPOS — Complete Database Schema Reference

> Last updated: July 2026.
> **Single source of truth** for all table structures, column names, and enum values.
> Read this file before writing any SQL query, repository function, or frontend API call.
> Any model working on this codebase must read this first — do not assume field names
> from memory or from older context.

---

## Naming conventions

- All table names: `snake_case` plural
- All column names: `snake_case`
- `school_id` appears on almost every table — always FK → `schools.id`
- `id` is always `SERIAL PRIMARY KEY`
- `created_at` / `updated_at` are `TIMESTAMP NOT NULL DEFAULT NOW()` unless noted
- Dates from PostgreSQL need `::text` cast in SELECT/RETURNING or timezone shifts occur

---

## ⚠️ Pending migrations (run before using these tables)

```sql
-- fee_collections is missing two columns added by the transport module
ALTER TABLE fee_collections ADD COLUMN fee_type VARCHAR(20) NOT NULL DEFAULT 'academic';
ALTER TABLE fee_collections ALTER COLUMN fee_structure_id DROP NOT NULL;
```

---

## ⚠️ Pending work / known gaps

1. **Attendance module — date/coordinator enforcement (in progress)**
   - Only section coordinator (`sections.coordinator_id`) can mark/edit attendance
   - Admin sees read-only section summary (current month present, prev month present, working days)
   - Date rules: can mark past dates only (never future), can edit only current + previous month
   - Working days = calendar_weekly_offs + calendar_events where affects_attendance = true
   - Backend enforcement (coordinator check, date validation) not yet fully wired

2. **Hostel fee auto-billing not wired into fee_collections (P4)**
   - `hostel_rooms.monthly_fee` is stored but never auto-creates a `fee_collections` row
   - Transport has `POST /fees/transport/generate` — hostel needs equivalent endpoint
   - Also needs a "Generate Monthly Bills" button on the Hostel admin page

3. **Attendance admin summary endpoint (not built)**
   - Need: `GET /attendance/summary/admin` returning per-section
     current_month_present, prev_month_present, working_days_current, working_days_prev

---

## Tables

---

### 1. schools

Primary tenant table. One row per school. `id` doubles as the school's JWT `id` (admin payload).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | admin JWT `id` field = this |
| school_name | VARCHAR | |
| school_code | VARCHAR | auto-generated: 3-letter prefix + 4 digits |
| city | VARCHAR | |
| state | VARCHAR | |
| country | VARCHAR | |
| pincode | VARCHAR | optional |
| phone | VARCHAR | |
| email | VARCHAR | UNIQUE |
| owner_full_name | VARCHAR | |
| password | VARCHAR | bcrypt hashed |
| logo | VARCHAR | optional, URL |
| established_year | INTEGER | optional |
| school_type | ENUM | `Primary` `Secondary` `Higher_Secondary` |
| role | ENUM | `admin` `super_admin` |
| is_account | ENUM | `active` `blocked` |
| is_verified | BOOLEAN | default false |
| timezone | VARCHAR | e.g. `Asia/Kathmandu` |
| subscription_id | INTEGER | optional FK, not enforced at query level |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 2. academic_years

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| year_name | VARCHAR | e.g. `2081-82` |
| start_date | DATE | `::text` cast in SELECT |
| end_date | DATE | `::text` cast in SELECT |
| status | ENUM | `upcoming` `active` `completed` |
| description | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 3. classes

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | **Always required on GET as query param** |
| name | VARCHAR | e.g. `Class 10` |
| stream | VARCHAR | optional, e.g. `Science - PCM` `Commerce` `Arts` — stored separately, not baked into name |
| status | ENUM | `active` `inactive` |
| description | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 4. sections

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| class_id | INTEGER FK → classes | |
| name | VARCHAR | e.g. `A` `B` |
| room_no | VARCHAR | optional |
| capacity | INTEGER | default 40 |
| coordinator_id | INTEGER FK → teachers | **Section coordinator** — one teacher per section, teacher can hold multiple sections |
| status | ENUM | `active` `inactive` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 5. subjects

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| name | VARCHAR | |
| code | VARCHAR | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 6. class_subjects

Which subjects belong to which class (no teacher here — teacher is in `class_subject_teachers`).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| class_id | INTEGER FK → classes | |
| subject_id | INTEGER FK → subjects | |
| created_at | TIMESTAMP | |

---

### 7. class_subject_teachers

Which teacher teaches which subject in which class, scoped per academic year.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| class_id | INTEGER FK → classes | |
| subject_id | INTEGER FK → subjects | |
| teacher_id | INTEGER FK → teachers | NOT NULL — required |
| academic_year_id | INTEGER FK → academic_years | required — scoped per year |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> UNIQUE on `(class_id, subject_id)` — one teacher per subject per class per year.
> Used in exam result entry to determine who can enter marks.
> Frontend teacher picker: present in `AddClassForm.tsx`. Backend guard: enforced in `exam.service.ts` (P1 ✅).

---

### 8. teachers

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | **NOT school_id** — teacher's own record id |
| school_id | INTEGER FK → schools | |
| full_name | VARCHAR | |
| email | VARCHAR | |
| phone | VARCHAR | |
| password | VARCHAR | bcrypt hashed |
| gender | ENUM | `male` `female` `other` |
| date_of_birth | DATE | optional, `::text` cast |
| city | VARCHAR | optional |
| state | VARCHAR | optional |
| country | VARCHAR | optional |
| qualification | VARCHAR | optional |
| experience_years | INTEGER | optional |
| join_date | DATE | `::text` cast |
| monthly_salary | DECIMAL(12,2) | optional — base monthly salary agreed at hiring; used as default when generating salary payments |
| status | ENUM | `active` `inactive` |
| photo | VARCHAR | optional, URL |
| role | VARCHAR | always `teacher` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 9. teacher_subjects

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| teacher_id | INTEGER FK → teachers | |
| subject_id | INTEGER FK → subjects | |
| created_at | TIMESTAMP | |

---

### 10. teacher_salaries

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| teacher_id | INTEGER FK → teachers | |
| basic_salary | DECIMAL | |
| bonus | DECIMAL | default 0 |
| deduction | DECIMAL | total = tax + pf + other_deduction (including attendance deduction) |
| tax_amount | DECIMAL | income tax / TDS |
| provident_fund | DECIMAL | EPF / PF contribution |
| other_deduction | DECIMAL | loan, advance, attendance-based deduction, etc. |
| deduction_remarks | TEXT | optional — notes on deductions |
| net_salary | DECIMAL | **GENERATED column** = basic_salary + bonus - deduction |
| month | INTEGER | **1–12 integer — always AD month — NOT a string like "June"** |
| year | INTEGER | **always AD year** e.g. 2025 — never store BS year |
| working_days | INTEGER | optional — total working days in month |
| present_days | DECIMAL | optional — effective present days (post absent/half-day calc) |
| absent_days | INTEGER | optional — absent days (salary deducted) |
| half_days | INTEGER | optional — half days (0.5× deduction each) |
| leave_days | INTEGER | optional — approved leave (not deducted) |
| per_day_salary | DECIMAL | optional — basic_salary / working_days |
| payment_date | DATE | optional |
| payment_method | ENUM | `cash` `bank_transfer` `cheque` — **no `online`, no `upi`** |
| status | ENUM | `paid` `pending` `cancelled` |
| paid_by | INTEGER FK → schools | optional |
| remarks | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 11. students

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | student's own record id |
| school_id | INTEGER FK → schools | |
| admission_number | VARCHAR | UNIQUE per school |
| full_name | VARCHAR | |
| email | VARCHAR | **optional** |
| phone | VARCHAR | optional |
| password | VARCHAR | bcrypt hashed |
| gender | ENUM | `male` `female` `other` |
| date_of_birth | DATE | `::text` cast |
| blood_group | VARCHAR | optional |
| photo | VARCHAR | optional, URL |
| nationality | VARCHAR | optional |
| religion | VARCHAR | optional |
| ethnicity | VARCHAR | optional |
| city | VARCHAR | optional |
| state | VARCHAR | optional |
| country | VARCHAR | optional |
| previous_school | VARCHAR | optional |
| admission_date | DATE | `::text` cast |
| disability | BOOLEAN | default false |
| disability_description | TEXT | optional |
| guardian_name | VARCHAR | required |
| guardian_phone | VARCHAR | required |
| guardian_email | VARCHAR | optional |
| guardian_relation | VARCHAR | required, e.g. `Father` |
| guardian_occupation | VARCHAR | optional |
| guardian_address | TEXT | optional |
| status | ENUM | `active` `inactive` `graduated` `expelled` `transferred` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **No `address` column** — use `city` / `state` / `country`.

---

### 12. student_enrollments

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| student_id | INTEGER FK → students | |
| academic_year_id | INTEGER FK → academic_years | |
| class_id | INTEGER FK → classes | |
| section_id | INTEGER FK → sections | |
| roll_number | VARCHAR | optional |
| stream | ENUM | `science` `commerce` `arts` `not_applicable` |
| registration_number | VARCHAR | optional |
| symbol_number | VARCHAR | optional |
| exam_roll_number | VARCHAR | optional |
| board_name | VARCHAR | optional |
| is_promoted | BOOLEAN | default false |
| promoted_to_class_id | INTEGER | optional FK → classes |
| transport_required | BOOLEAN | default false |
| transport_route | VARCHAR | optional |
| pickup_location | VARCHAR | optional |
| transport_fee | DECIMAL | optional |
| transport_fee_type | ENUM | `monthly` `six_monthly` `yearly` — optional |
| remarks | TEXT | optional |
| status | ENUM | `active` `inactive` `transferred` `graduated` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 13. fee_structures

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| class_id | INTEGER FK → classes | |
| fee_name | VARCHAR | |
| amount | DECIMAL | |
| frequency | ENUM | `monthly` `quarterly` `half_yearly` `yearly` `one_time` |
| due_date_type | ENUM | `fixed_day` `admission_date` — **NOT `fixed`** |
| due_day | INTEGER | optional, 1–31 |
| description | TEXT | optional |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 14. fee_collections

> ⚠️ Run pending migrations at top of this file before using this table.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| student_id | INTEGER FK → students | |
| enrollment_id | INTEGER FK → student_enrollments | |
| fee_structure_id | INTEGER FK → fee_structures | **nullable** — NULL for transport/hostel fees |
| academic_year_id | INTEGER FK → academic_years | |
| fee_name | VARCHAR | denormalised copy at time of collection |
| fee_type | VARCHAR | `academic` `transport` `hostel` — **added by migration** |
| due_date | DATE | |
| total_amount | DECIMAL | |
| discount_amount | DECIMAL | default 0 |
| discount_reason | TEXT | optional |
| fine_amount | DECIMAL | default 0 |
| fine_reason | TEXT | optional |
| net_amount | DECIMAL | total - discount + fine |
| paid_amount | DECIMAL | running total |
| remaining_amount | DECIMAL | net - paid |
| status | ENUM | `unpaid` `partial` `paid` `waived` |
| created_by | INTEGER FK → schools | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> Transport/hostel fees set `fee_structure_id = NULL` and `fee_type = 'transport'`/`'hostel'`.
> Academic fees set `fee_type = 'academic'`.
> Response from backend includes `full_name` and `admission_number` (joined from students).

---

### 15. fee_payments

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| collection_id | INTEGER FK → fee_collections | |
| student_id | INTEGER FK → students | |
| receipt_number | VARCHAR | auto-generated `RCP-XXXX`, uses atomic transaction |
| paid_amount | DECIMAL | |
| payment_date | DATE | |
| payment_method | ENUM | `cash` `bank_transfer` `cheque` `online` |
| transaction_id | VARCHAR | optional |
| remarks | TEXT | optional |
| collected_by | INTEGER FK → schools | |
| created_at | TIMESTAMP | |

---

### 16. school_calendars

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| weekend_type | ENUM | `sunday_only` `saturday_only` `saturday_sunday` — **legacy fallback only** |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> `weekend_type` is ignored when `calendar_weekly_offs` rows exist for this calendar.

---

### 17. calendar_weekly_offs

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| calendar_id | INTEGER FK → school_calendars | |
| school_id | INTEGER FK → schools | |
| day_of_week | SMALLINT | 0=Sunday … 6=Saturday |
| week_pattern | VARCHAR | `all` `1st` `2nd` `3rd` `4th` `5th` |
| created_at | TIMESTAMP | |

> UNIQUE on `(calendar_id, day_of_week, week_pattern)`.
> Always replace-all — never partial update.
> Endpoint: `PUT /calendar/:calendarId/weekly-offs` with `{ offs: [{day_of_week, week_pattern}] }`
> **NOT** `PATCH /calendar/:id` which updates the legacy `weekend_type`.

---

### 18. calendar_events

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| calendar_id | INTEGER FK → school_calendars | |
| academic_year_id | INTEGER FK → academic_years | |
| title | VARCHAR | |
| event_date | DATE | **NOT `start_date`** — `::text` cast |
| end_date | DATE | optional, multi-day events — `::text` cast |
| event_type | ENUM | `holiday` `exam` `event` `early_closing` — **NOT `vacation` or `working`** |
| affects_attendance | BOOLEAN | true = non-working day |
| class_id | INTEGER FK → classes | optional, null = school-wide |
| description | TEXT | optional |
| exam_id | INTEGER FK → exams | optional, auto-sync from exams module |
| created_by | INTEGER FK → schools | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 19. attendance

One row per class-section per day.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| class_id | INTEGER FK → classes | |
| section_id | INTEGER FK → sections | |
| date | DATE | |
| marked_by | INTEGER FK → teachers | teacher record id — **NOT school id** |
| total_present | INTEGER | cached count |
| total_absent | INTEGER | cached count |
| total_leave | INTEGER | cached count |
| status | ENUM | `draft` `submitted` |
| is_holiday | BOOLEAN | true = section suspended by teacher (no class that day, no per-student rows, auto-submitted) |
| remarks | TEXT | suspension reason or general notes |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **Only the section coordinator** (`sections.coordinator_id`) may mark/edit attendance.
> Date constraint: past dates only — never future. Edit window: current + previous month only.

---

### 20. attendance_details

One row per student per attendance record.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| attendance_id | INTEGER FK → attendance | |
| student_id | INTEGER FK → students | |
| enrollment_id | INTEGER FK → student_enrollments | required |
| status | ENUM | `present` `absent` `leave` |
| check_in_time | VARCHAR | optional |
| remarks | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 21. section_teacher_history

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| section_id | INTEGER FK → sections | |
| teacher_id | INTEGER FK → teachers | |
| academic_year_id | INTEGER FK → academic_years | |
| from_date | DATE | |
| to_date | DATE | optional, null = still current |
| reason | TEXT | optional |
| created_at | TIMESTAMP | |

---

### 22. exams

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | **always required on GET** |
| name | VARCHAR | |
| exam_type | ENUM | `unit_test` `mid_term` `final` `practice` — **NOT `standard` `practical` `mock`** |
| start_date | DATE | `::text` cast |
| end_date | DATE | `::text` cast |
| status | ENUM | `upcoming` `ongoing` `completed` |
| description | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 23. exam_schedules

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| exam_id | INTEGER FK → exams | |
| class_id | INTEGER FK → classes | |
| subject_id | INTEGER FK → subjects | |
| exam_date | DATE | `::text` cast |
| start_time | VARCHAR | optional, HH:MM |
| end_time | VARCHAR | optional |
| max_marks | INTEGER | **required** |
| pass_marks | INTEGER | **required** |
| weightage | DECIMAL | optional |
| venue | VARCHAR | optional — **NOT `room_no`** |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 24. exam_results

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| exam_id | INTEGER FK → exams | |
| schedule_id | INTEGER FK → exam_schedules | required |
| student_id | INTEGER FK → students | |
| enrollment_id | INTEGER FK → student_enrollments | required |
| subject_id | INTEGER FK → subjects | |
| marks_obtained | DECIMAL | null if absent |
| max_marks | INTEGER | required |
| pass_marks | INTEGER | required |
| percentage | DECIMAL | auto-computed |
| grade | VARCHAR | auto-computed |
| gpa | DECIMAL | auto-computed |
| is_passed | BOOLEAN | auto-computed |
| is_absent | BOOLEAN | default false |
| remarks | TEXT | optional |
| entered_by | INTEGER FK → teachers | optional |
| status | ENUM | `draft` `published` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 25. grade_scales

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| grade | VARCHAR | e.g. `A+` |
| min_percentage | DECIMAL | |
| max_percentage | DECIMAL | |
| gpa | DECIMAL | |
| description | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 26. expense_categories

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| name | VARCHAR | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 27. expenses

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| category_id | INTEGER FK → expense_categories | |
| title | VARCHAR | |
| amount | DECIMAL | |
| expense_date | DATE | |
| payment_method | ENUM | `cash` `bank_transfer` `cheque` `online` |
| receipt_number | VARCHAR | optional — **NOT `voucher_number`** |
| vendor_name | VARCHAR | optional — **NOT `paid_to`** |
| attachment_url | VARCHAR | optional |
| description | TEXT | optional |
| created_by | INTEGER FK → schools | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **No `status` column** — no approval workflow.
> API response: `category_name` is a flat alias — NOT a nested `category` object.

---

### 28. subscription_plans

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR UNIQUE | `Free` `Pro` `Plus` |
| max_students | INTEGER | NULL = unlimited |
| max_teachers | INTEGER | NULL = unlimited |
| fee_management_enabled | BOOLEAN | false on Free |
| price_npr_monthly | DECIMAL | 0 for Free |
| price_npr_yearly | DECIMAL | 0 for Free |
| price_inr_monthly | DECIMAL | 0 for Free |
| price_inr_yearly | DECIMAL | 0 for Free |
| is_active | BOOLEAN | |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> Seeded: Free (100 students / 5 teachers / no fees), Pro (300/20 / fees enabled), Plus (1500/40 / all enabled).

---

### 29. school_subscriptions

History of every subscription period per school.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| plan_id | INTEGER FK → subscription_plans | |
| billing_cycle | ENUM | `monthly` `yearly` `free` |
| amount_paid | DECIMAL | actual amount paid (may differ from plan price for promos) |
| currency | ENUM | `NPR` `INR` — optional for free |
| start_date | DATE | |
| end_date | DATE | NULL for Free |
| status | ENUM | `active` `expired` `grace_period` `cancelled` |
| payment_method | VARCHAR | free text: `esewa` `khalti` `bank_transfer` `cash` |
| payment_reference | VARCHAR | optional |
| activated_by | INTEGER FK → schools | super_admin who activated |
| notes | TEXT | optional |
| created_at | TIMESTAMP | |

> Current plan = most recent row `ORDER BY created_at DESC LIMIT 1`.
> Grace period: 10 days after expiry with full access + warning banner.
> After grace period: auto-downgraded to Free (new row inserted).
> Enforcement: student/teacher creation blocked at cap; Fee Management blocked on Free.

---

### 30. platform_settings

Single-row global table. Always exactly one row (id = 1).

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | always 1 |
| platform_name | VARCHAR | default `CampusPOS` |
| support_email | VARCHAR | default `support@campuspos.com` |
| maintenance_mode | BOOLEAN | true = only super_admin can log in |
| updated_at | TIMESTAMP | |
| updated_by | INTEGER FK → schools | super_admin who last updated |

---

### 31. transport_vehicles

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| vehicle_number | VARCHAR | |
| vehicle_type | ENUM | `bus` `van` `minibus` `other` |
| capacity | INTEGER | |
| driver_name | VARCHAR | |
| driver_phone | VARCHAR | optional |
| driver_license | VARCHAR | optional |
| helper_name | VARCHAR | optional |
| helper_phone | VARCHAR | optional |
| gps_tracking | BOOLEAN | default false |
| status | ENUM | `active` `inactive` `maintenance` |
| notes | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 32. transport_routes

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| academic_year_id | INTEGER FK → academic_years | |
| name | VARCHAR | e.g. `Route 1 — Kathmandu Ring Road` |
| description | TEXT | optional |
| vehicle_id | INTEGER FK → transport_vehicles | optional (one vehicle per route) |
| status | VARCHAR | `active` `inactive` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 33. transport_stops

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| route_id | INTEGER FK → transport_routes | |
| name | VARCHAR | e.g. `Koteshwor Stop` |
| pickup_time | VARCHAR | optional, HH:MM |
| drop_time | VARCHAR | optional, HH:MM |
| monthly_fee | DECIMAL | fee charged to students at this stop |
| stop_order | INTEGER | order along the route, 1 = first |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 34. transport_assignments

One row per student per academic year. One student = one route.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| student_id | INTEGER FK → students | |
| route_id | INTEGER FK → transport_routes | |
| stop_id | INTEGER FK → transport_stops | |
| academic_year_id | INTEGER FK → academic_years | |
| start_date | DATE | |
| end_date | DATE | optional |
| status | ENUM | `active` `inactive` |
| notes | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> UNIQUE on `(student_id, academic_year_id)`.
> Transport fee auto-bills to `fee_collections` when academic fee is collected (same month, idempotent).
> Batch billing: `POST /fees/transport/generate` with `{ academic_year_id, billing_month: 'YYYY-MM' }`.

---

### 35. hostels

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| name | VARCHAR | |
| hostel_type | ENUM | `boys` `girls` `mixed` |
| total_capacity | INTEGER | |
| warden_name | VARCHAR | optional |
| warden_phone | VARCHAR | optional |
| warden_email | VARCHAR | optional |
| address | TEXT | optional |
| status | VARCHAR | `active` `inactive` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

---

### 36. hostel_rooms

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| hostel_id | INTEGER FK → hostels | |
| room_number | VARCHAR | |
| floor | INTEGER | default 1 |
| room_type | ENUM | `ac` `non_ac` `dormitory` |
| capacity | INTEGER | default 2 (beds) |
| monthly_fee | DECIMAL | |
| status | VARCHAR | `available` `full` `maintenance` |
| notes | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> UNIQUE on `(hostel_id, room_number)`.

---

### 37. notices

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| created_by_role | VARCHAR | `admin` or `faculty` |
| created_by_id | INTEGER | school.id for admin, teachers.id for faculty |
| created_by_name | VARCHAR | denormalised display name at time of creation |
| title | VARCHAR | |
| content | TEXT | |
| target_type | VARCHAR | `section` or NULL (NULL = school-wide) |
| target_section_id | INTEGER FK → sections | optional; only when target_type = 'section' |
| is_pinned | BOOLEAN | default false — pinned notices sort to top |
| expires_at | DATE | optional — NULL = never expires |
| status | ENUM | `active` `archived` |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> **Visibility rules:**
> - `target_type IS NULL` → visible to everyone (school-wide, admin only)
> - `target_type = 'section'` → visible only to coordinator of that section + admin
> - Teachers can only post to sections where they are `sections.coordinator_id`
> - Teachers can only edit/delete their own notices; admin can edit/delete all
> - Expired notices (expires_at < today) still exist but are flagged; admin sees all

> **Joined fields returned by API:** `section_name`, `class_name`

> **Migration file:** `migration_notice_board.sql`

---

### 38. hostel_assignments

One row per student per academic year.

| Column | Type | Notes |
|---|---|---|
| id | SERIAL PK | |
| school_id | INTEGER FK → schools | |
| student_id | INTEGER FK → students | |
| hostel_id | INTEGER FK → hostels | |
| room_id | INTEGER FK → hostel_rooms | |
| academic_year_id | INTEGER FK → academic_years | |
| joining_date | DATE | |
| leaving_date | DATE | optional |
| status | ENUM | `active` `left` `transferred` |
| notes | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

> UNIQUE on `(student_id, academic_year_id)`.

---

## JWT payload shapes

**Admin / Super Admin** (`IJwtAdminPayload`):
```
{ id (= school_id), email, role, school_name, school_code, logo, timezone, is_verified, is_account }
```

**Faculty / Student** (`IJwtUserPayload`):
```
{ id (own record id), email, role, school_id, school_name, logo, timezone, is_account }
```

> Resolving school_id in controllers:
> - Admin: `school_id = req.user.id`
> - Faculty/Student: `school_id = req.user.school_id`
> Never use `req.user.id` as school_id for faculty/student — it's their own record id, not the school.

---

## Common mistakes / gotchas

| ❌ Wrong | ✅ Right |
|---|---|
| `ev.start_date` on calendar events | `ev.event_date` |
| `ev.applicable_to` | doesn't exist — use `ev.class_id` (null = school-wide) |
| `ev.is_holiday` | `ev.affects_attendance` |
| `event_type: 'vacation'` or `'working'` | `holiday` `exam` `event` `early_closing` only |
| `ex.term` on exams | doesn't exist — removed. use `ex.exam_type` |
| `exam_type: 'standard'` `'practical'` `'mock'` | `unit_test` `mid_term` `final` `practice` only |
| `sch.room_no` on exam schedules | `sch.venue` |
| `month: 'June'` on teacher salaries | `month: 6` (INTEGER 1–12) |
| `ex.category?.name` on expenses | `ex.category_name` (flat SQL alias) |
| `ex.status` on expenses | doesn't exist — no approval workflow |
| `summary?.categoryWise` on expenses | `summary?.by_category` |
| `ex.voucher_number` on expenses | `ex.receipt_number` |
| `ex.paid_to` on expenses | `ex.vendor_name` |
| `DELETE /fees/structures` with body `{id}` | `DELETE /fees/structures/:id` |
| `/classes` without `academic_year_id` | always pass `?academic_year_id=X` |
| `payment_method: 'upi'` anywhere | not a valid enum on any table |
| `payment_method: 'online'` on teacher salary | only `cash` `bank_transfer` `cheque` for salary |
| `student.address` | doesn't exist — use `city` + `state` + `country` |
| `en.academic_year?.year_name` | `en.academic_year_name` (flat alias) |
| `PATCH /calendar/:id` for weekly offs | `PUT /calendar/:calendarId/weekly-offs` with `{ offs: [{day_of_week, week_pattern}] }` |
| `fee_structure_id` required for transport fees | nullable since migration — transport fees use NULL |
| "Class Coordinator" label in UI | must be "Section Coordinator" |
| `req.user.id` as school_id for faculty/student | use `req.user.school_id` instead |



-- Migration: add scholarship fields
-- Run once against your database.

-- On the student record: scholarship type and percentage (applies school-wide)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS scholarship_type    VARCHAR(50)  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_percent DECIMAL(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scholarship_remarks TEXT         DEFAULT NULL;

-- scholarship_type examples: 'merit', 'need_based', 'sports', 'staff_child', 'government', 'custom'
-- scholarship_percent: 0.00 - 100.00 (percentage discount on fee)

COMMENT ON COLUMN students.scholarship_type    IS 'Type of scholarship awarded to student';
COMMENT ON COLUMN students.scholarship_percent IS 'Percentage fee discount from scholarship (0-100)';
COMMENT ON COLUMN students.scholarship_remarks IS 'Notes on scholarship terms or conditions';