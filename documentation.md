# Skoolio — School Management System
### Complete Product Documentation

---

## Table of Contents

1. [What is Skoolio?](#1-what-is-skoolio)
2. [Why Should Your School Use Skoolio?](#2-why-should-your-school-use-skoolio)
3. [Who Is It For?](#3-who-is-it-for)
4. [System Architecture Overview](#4-system-architecture-overview)
5. [Modules & Features](#5-modules--features)
   - [5.1 School & Authentication](#51-school--authentication)
   - [5.2 Academic Years](#52-academic-years)
   - [5.3 Classes & Sections](#53-classes--sections)
   - [5.4 Subjects & Teachers](#54-subjects--teachers)
   - [5.5 Student Management](#55-student-management)
   - [5.6 Student Enrollment](#56-student-enrollment)
   - [5.7 Attendance Management](#57-attendance-management)
   - [5.8 Exam & Results](#58-exam--results)
   - [5.9 Fee Management](#59-fee-management)
   - [5.10 Transport Management](#510-transport-management)
   - [5.11 Hostel Management](#511-hostel-management)
   - [5.12 Expense Tracking](#512-expense-tracking)
   - [5.13 Notice Board](#513-notice-board)
   - [5.14 School Calendar](#514-school-calendar)
   - [5.15 Staff Salary Management](#515-staff-salary-management)
   - [5.16 Student Promotion](#516-student-promotion)
   - [5.17 Dashboard & Analytics](#517-dashboard--analytics)
   - [5.18 Subscription Plans](#518-subscription-plans)
6. [User Roles & Access Control](#6-user-roles--access-control)
7. [Data Privacy & Security](#7-data-privacy--security)
8. [Tech Stack](#8-tech-stack)
9. [Subscription Plans Summary](#9-subscription-plans-summary)

---

## 1. What is Skoolio?

**Skoolio** is a full-stack cloud-based School Management System (SMS) built specifically for schools in Nepal and India. It digitises and centralises every administrative and academic operation a school runs — from admitting students and managing classes, to collecting fees, running hostel and transport services, tracking attendance, and publishing exam results.

Everything is accessible from a single web portal. No paperwork. No spreadsheets. No data loss.

---

## 2. Why Should Your School Use Skoolio?

### 🗂️ Replace Paper-Based Records
Most schools still rely on physical registers, handwritten ledgers, and spreadsheets scattered across departments. Skoolio replaces all of this with a structured digital system where every record is stored, searchable, and retrievable in seconds.

### 💸 Stop Revenue Leakage on Fees
Untracked payments, missing receipts, and inconsistent ledgers cause schools to lose revenue they've already earned. Skoolio enforces every fee collection through structured fee structures, real-time payment tracking, automated billing, and PDF receipt generation — so every rupee is accounted for.

### 🚌 Manage Transport & Hostel in One Place
Schools running transport or hostel services often manage them in complete isolation from fee collection. Skoolio integrates transport and hostel assignments directly into the fee system — when a student is assigned to a route or room, their monthly bills are automatically generated.

### 📊 Get Real Visibility
Admins get a live dashboard showing fee collection rates, attendance trends, class-wise occupancy, transport summaries, hostel occupancy, and expense breakdowns — without having to manually compile any report.

### 🎓 Empower Teachers Without Overcomplicating Things
Section coordinators can mark, edit, and submit attendance for their sections. Subject teachers can enter exam results for their own subjects only. Boundaries are enforced automatically — teachers cannot touch data outside their scope.

### 🧾 Automated Receipt Generation
Every fee payment generates a numbered PDF receipt (`RCP-XXXX`) that can be downloaded and shared with parents. Receipt numbers are generated atomically — no duplicates, no gaps.

### 📱 Works on Any Device
The frontend is built as a responsive web application. Admins, teachers, and students can access it from desktop, tablet, or mobile without needing to install anything.

### 🔒 School-Isolated Data
Every school is a completely isolated tenant. One school's data is never accessible from another school's account. All queries are scoped by `school_id` enforced at the database level.

### 🚀 Scales With Your School
Whether you have 100 students or 1,500, Skoolio handles it through tiered subscription plans. Upgrade when you grow — your data stays intact.

---

## 3. Who Is It For?

| User Type | Portal Access | What They Do |
|---|---|---|
| **School Admin** | Admin Portal | Full control over all modules |
| **Super Admin** | Platform Admin | Manages schools, subscriptions, platform settings |
| **Faculty / Teacher** | Faculty Portal | Marks attendance, enters results, views class data |
| **Student** | Student Portal | Views own profile, fees, attendance, results |

---

## 4. System Architecture Overview

```
┌─────────────────────────────────────────────────┐
│               Frontend (Next.js)                │
│  Admin Portal · Faculty Portal · Student Portal │
└────────────────────┬────────────────────────────┘
                     │ REST API (HTTP/JSON)
┌────────────────────▼────────────────────────────┐
│              Backend (Node.js + Express)         │
│         TypeScript · JWT Auth · Middleware       │
└────┬──────────────────────┬──────────────────────┘
     │                      │
┌────▼──────┐         ┌─────▼──────┐
│PostgreSQL │         │ Redis Cloud│
│(Primary   │         │(Session /  │
│ Database) │         │ Cache)     │
└───────────┘         └────────────┘
                            │
                    ┌───────▼────────┐
                    │  Azure Blob    │
                    │  Storage       │
                    │  (Photos/Files)│
                    └────────────────┘
```

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** Next.js (React) + CSS Modules
- **Database:** PostgreSQL (multi-tenant, school-scoped)
- **Cache / Sessions:** Redis Cloud
- **File Storage:** Azure Blob Storage (student/teacher photos, logos, receipts)
- **Authentication:** JWT (HTTP-only cookies)
- **Deployment:** Nodemon (dev), ts-node

---

## 5. Modules & Features

---

### 5.1 School & Authentication

**What it manages:**
Every school registers as a tenant with its own account. Authentication is handled with JWTs stored in HTTP-only cookies, meaning tokens never touch the browser's JavaScript layer.

**Key features:**
- School registration with name, code, type, location, contact, logo
- Auto-generated school code (3-letter prefix + 4 digits)
- Separate login flows for Admin, Faculty, and Student
- Account statuses: `active` / `blocked`
- Email verification support
- Timezone configuration per school (e.g. `Asia/Kathmandu`)
- School logo upload via Azure Blob Storage

**School types supported:** Primary, Secondary, Higher Secondary

---

### 5.2 Academic Years

**What it manages:**
All school data is scoped under academic years. Every class, enrollment, fee, exam, attendance record, and transport/hostel assignment belongs to a specific academic year.

**Key features:**
- Create multiple academic years (e.g. `2081-82`, `2082-83`)
- Set start date and end date per year
- Mark one year as `active` at a time
- Status lifecycle: `upcoming` → `active` → `completed`
- The active year is automatically used as the default context across all modules

**Why it matters:**
When a new academic year starts, the school simply creates a new year and begins fresh enrollments, fee structures, and timetables — without losing any historical data.

---

### 5.3 Classes & Sections

**What it manages:**
The academic structure of the school — which classes exist, which sections they're divided into, and which teacher coordinates each section.

**Classes:**
- Create classes scoped to an academic year (e.g. `Class 10 - Science`)
- Assign room numbers
- Status: `active` / `inactive`
- Classes are always fetched with an `academic_year_id` — they do not carry over automatically

**Sections:**
- Each class can have multiple sections (e.g. `A`, `B`, `C`)
- Each section has a **Section Coordinator** — a teacher responsible for that section
- Coordinators are the only ones who can mark and submit attendance for their section
- Room number and student capacity (default 40) per section

---

### 5.4 Subjects & Teachers

**What it manages:**
The school's subject catalogue and the full faculty directory, including which teacher teaches which subject in which class for a given academic year.

**Subjects:**
- Create school-wide subjects (e.g. `Mathematics`, `Physics`, `Nepali`)
- Assign subjects to classes (`class_subjects`)
- Assign a specific teacher to each class-subject pair per academic year (`class_subject_teachers`)
- One teacher per subject per class per year — enforced uniquely at the database level

**Teachers:**
- Full teacher profile: name, email, phone, gender, date of birth, qualification, experience, join date, photo
- Status: `active` / `inactive`
- Teachers log in with their own credentials and access their own portal
- Photo upload via Azure Blob Storage with chunked upload support (up to 4 MB)
- Salary management is handled separately (see Section 5.15)

---

### 5.5 Student Management

**What it manages:**
The complete student directory for the school — personal records, guardian information, scholarship details, and photo.

**Student profile fields:**
- Full name, admission number (unique per school), gender, date of birth, blood group
- Email, phone, photo
- Nationality, religion, ethnicity
- City, state, country
- Previous school
- Admission date
- Disability flag and description
- Guardian name, phone, email, relation, occupation, address
- Status: `active` / `inactive` / `graduated` / `expelled` / `transferred`

**Scholarship support:**
- Scholarship type (merit, need-based, sports, staff child, government, custom)
- Percentage discount on fees (0–100%)
- Remarks / conditions

**Photo upload:**
- Chunked upload system — files are sliced into 512 KB chunks and uploaded sequentially
- Supports JPEG, PNG, WebP up to 4 MB
- Stored on Azure Blob Storage

**Student self-service:**
- Students can log in and view their own profile
- Students can view their own enrollments, fees, payments, attendance, and exam results

---

### 5.6 Student Enrollment

**What it manages:**
Connecting a student to a specific class and section for a specific academic year. Every student must be enrolled to participate in attendance, exams, and fee billing.

**Enrollment data:**
- Academic year, class, section
- Roll number
- Stream (Science / Commerce / Arts / Not Applicable)
- Exam registration fields: registration number, symbol number, exam roll number, board name
- Transport flag and pickup location
- Promotion status and target class

**Enrollment history:**
- A student can have multiple enrollment records across different years
- Each enrollment is its own row — full audit trail of the student's academic journey
- Admins can view all years a student has been enrolled

---

### 5.7 Attendance Management

**What it manages:**
Daily class attendance, tracked per section per day, with per-student detail records and a comprehensive reporting layer.

**How it works:**
- Only the **Section Coordinator** of a section can mark attendance for that section
- Attendance can only be marked for **past dates** — never future dates
- Attendance can only be **edited** within the current and previous month
- Once submitted, an attendance record is locked

**Attendance statuses:**
- `present` — student was present
- `absent` — student was absent
- `late` — student arrived late
- `leave` — student was on approved leave

**Admin visibility:**
- Admins see attendance data in read-only mode
- Class-wise and all-classes overview with current month and previous month summaries
- Per-student summary (total present, absent, late, leave, working days, attendance percentage)
- Monthly calendar view per student — see each day's status in a visual calendar grid

**Working days calculation:**
Working days are computed from the school calendar — weekends and holidays marked as `affects_attendance = true` are automatically excluded.

**Section teacher history:**
Full audit trail of which teacher was assigned as coordinator of each section across time.

---

### 5.8 Exam & Results

**What it manages:**
The complete examination lifecycle — creating exams, scheduling subject-wise exam dates and venues, entering marks, computing grades, and publishing results.

**Exam types:** `unit_test`, `mid_term`, `final`, `practice`

**Exam lifecycle:**
1. Admin creates an exam (e.g. `Mid-Term 2082`)
2. Admin creates exam schedules — which subject is examined on which date, with max marks, pass marks, and venue
3. Subject teachers enter marks for their own subjects only (enforced — a teacher cannot enter marks for a subject they don't teach in that class)
4. Admin publishes results when ready

**Grade computation:**
- Grades and GPA are auto-computed based on the school's custom Grade Scale
- Schools define their own grade boundaries (e.g. `A+ = 90–100 = 4.0 GPA`)
- `is_passed` is automatically determined against `pass_marks`
- Absent students are flagged with `is_absent = true` and `marks_obtained = null`

**Result access:**
- Admin and faculty can view all results
- Students can view only their own results after publishing

---

### 5.9 Fee Management

**What it manages:**
The complete fee lifecycle — defining what to charge, generating bills, collecting payments, and issuing receipts. Integrates with Transport and Hostel for unified billing.

**Fee Structures:**
- Define fee components per class per academic year (e.g. `Tuition Fee`, `Lab Fee`, `Sports Fee`)
- Frequency: `monthly`, `quarterly`, `half_yearly`, `yearly`, `one_time`
- Due date types: `fixed_day` (e.g. 15th of every month) or `admission_date`

**Fee Collections (Bills):**
- Generate monthly bills for all enrolled students in one action
- Individual fee collection for specific students
- Miscellaneous fee collection for ad-hoc charges
- Transport fee billing (auto-generates bills for all transport-assigned students)
- Hostel fee billing (generates monthly bills for hostel-assigned students)
- Scholarship discounts are applied automatically at the time of billing
- Each collection tracks: total amount, discount, fine, net amount, paid amount, remaining amount, status

**Fee Statuses:** `unpaid` → `partial` → `paid` → `waived`

**Fee Payments:**
- Record payments against outstanding collections
- Payment methods: `cash`, `bank_transfer`, `cheque`, `online`
- Every payment generates a unique receipt number (`RCP-XXXX`) atomically — no duplicates

**PDF Receipts:**
- Auto-generated PDF receipt for every payment
- Downloadable by admin and student
- Includes school logo, student details, amount breakdown, payment method, receipt number

**Student self-service:**
- Students can log in and view all their own fee collections and payment history

---

### 5.10 Transport Management

**What it manages:**
The school's vehicle fleet, routes, stops, student assignments, and transport fee integration.

**Vehicles:**
- Register vehicles with number, type (bus, van, minibus), capacity
- Driver details: name, phone, license
- Helper details: name, phone
- GPS tracking flag
- Status: `active` / `inactive` / `maintenance`

**Routes:**
- Create named routes per academic year (e.g. `Route 1 — Kathmandu Ring Road`)
- Assign one vehicle per route
- Status: `active` / `inactive`

**Stops:**
- Each route has multiple stops in order (`stop_order`)
- Each stop has a name, pick-up time, drop time, and **monthly fee**
- The monthly fee varies by stop — students closer to school may pay less than those farther away

**Student Assignments:**
- Assign a student to a specific route and stop for the academic year
- One student can only be on one route per year (enforced uniquely)
- Assignment includes start date, end date, and status

**Fee Integration:**
- Transport fee bills are automatically generated when `POST /fees/transport/generate` is called
- Monthly fee is taken from the assigned stop's `monthly_fee`
- Bills are idempotent — running the generator twice won't create duplicate bills

**Student profile integration:**
- The student profile page shows full transport details: route, vehicle, stop, pick-up and drop times, driver details, and monthly/annual fee breakdown

---

### 5.11 Hostel Management

**What it manages:**
School hostels, rooms, student room assignments, warden details, and hostel fee integration.

**Hostels:**
- Create multiple hostels per school (e.g. `Boys Hostel Block A`, `Girls Hostel`)
- Hostel types: `boys`, `girls`, `mixed`
- Total capacity
- Warden name, phone, and email

**Rooms:**
- Create rooms within each hostel
- Room number, floor, room type (`ac`, `non_ac`, `dormitory`)
- Capacity (number of beds), monthly fee
- Status: `available` / `full` / `maintenance`
- Room numbers are unique per hostel

**Student Assignments:**
- Assign a student to a hostel and specific room for the academic year
- One student can only be in one room per year (enforced uniquely)
- Assignment tracks joining date, leaving date, and status (`active` / `left` / `transferred`)

**Occupancy tracking:**
- Summary view shows total capacity vs. occupied beds across all hostels
- Per-hostel and per-room student lists

**Fee Integration:**
- Hostel fee bills are generated via `POST /fees/hostel/generate`
- Monthly fee is taken from the assigned room's `monthly_fee`

**Student profile integration:**
- The student profile page shows: hostel name, type, room number, floor, room type, bed capacity, warden details, and monthly/annual fee breakdown

---

### 5.12 Expense Tracking

**What it manages:**
All school expenditures — categorised, dated, and linked to the academic year for financial visibility.

**Expense categories:**
- Create custom categories (e.g. `Utilities`, `Maintenance`, `Stationery`, `Events`)
- Categories are school-specific

**Expense records:**
- Title, amount, date
- Category
- Payment method: `cash`, `bank_transfer`, `cheque`, `online`
- Receipt number (optional)
- Vendor name (optional)
- Attachment URL (optional)
- Description

**No approval workflow** — expenses are recorded as-is. There is no `status` column and no pending/approved flow.

**Dashboard integration:**
- Total expenses by category
- Expenses by academic year for budget tracking

---

### 5.13 Notice Board

**What it manages:**
School-wide and section-specific announcements from admin and faculty.

**Notice fields:**
- Title and content
- Author (admin or teacher — name is denormalised at creation time)
- Target: school-wide (visible to everyone) or section-specific (visible only to that section's coordinator and admin)
- Pin to top (`is_pinned`)
- Expiry date (notices can auto-expire)
- Status: `active` / `archived`

**Access rules:**
- Admin can create school-wide or section-specific notices, and edit/delete any notice
- Teachers can only post to sections where they are the Section Coordinator
- Teachers can only edit/delete their own notices
- Expired notices are flagged but remain in the system

---

### 5.14 School Calendar

**What it manages:**
The academic calendar for each year — weekends, public holidays, school events, and exam dates.

**Weekly offs:**
- Flexible weekly off configuration — not just "Saturday and Sunday"
- Supports patterns like `all Sundays`, `1st and 3rd Saturday`, etc.
- Configured as `(day_of_week, week_pattern)` pairs — replaces-all on update

**Calendar events:**
- Event types: `holiday`, `exam`, `event`, `early_closing`
- Set `affects_attendance = true` to mark a day as a non-working day
- Events can be school-wide or class-specific
- Exam events are auto-synced from the Exams module
- Multi-day events supported via start and end date

**Attendance integration:**
Working days in the attendance module are computed from the calendar — any day marked as a weekly off or as `affects_attendance = true` is excluded from the working day count.

---

### 5.15 Staff Salary Management

**What it manages:**
Monthly salary records for all teaching and non-teaching staff.

**Salary fields:**
- Teacher, academic year, month (1–12), year
- Basic salary, bonus, deduction
- Payment date and method (`cash`, `bank_transfer`, `cheque`)
- Status: `pending` / `paid` / `cancelled`
- Remarks

**Key rules:**
- Month is stored as an integer (1–12), not a string
- `online` and `upi` are not valid payment methods for salary — only `cash`, `bank_transfer`, `cheque`
- Salary records are per-teacher per-month — full history retained

---

### 5.16 Student Promotion

**What it manages:**
End-of-year student promotion from one class to the next academic year's class.

**How it works:**
- Admin selects students from a section and promotes them to a target class in the next academic year
- Promotion creates a new `student_enrollment` record for the upcoming year
- The original enrollment is flagged with `is_promoted = true` and `promoted_to_class_id`
- Students who are not promoted remain in their current status

---

### 5.17 Dashboard & Analytics

**What it manages:**
A real-time overview of the school's key metrics — visible to admin on login.

**Dashboard widgets:**
- Total students, teachers, classes, sections
- Fee collection summary — total billed, collected, outstanding
- Attendance overview — present rates by class
- Recent fee payments
- Upcoming exam schedules
- Recent notices
- Expense summary by category
- Transport and hostel occupancy counts
- Active academic year display

---

### 5.18 Subscription Plans

**What it manages:**
Access tiers that determine how many students and teachers a school can manage, and which modules are available.

| Plan | Students | Teachers | Fee Management | Price |
|---|---|---|---|---|
| **Free** | Up to 100 | Up to 5 | ❌ Not included | Free |
| **Pro** | Up to 300 | Up to 20 | ✅ Included | NPR/INR monthly or yearly |
| **Plus** | Up to 1,500 | Up to 40 | ✅ Included | NPR/INR monthly or yearly |

**Subscription rules:**
- Student and teacher creation is blocked when the plan cap is reached
- Fee Management is fully blocked on the Free plan
- After expiry: 10-day grace period with full access and a warning banner
- After grace period: automatically downgraded to Free
- Super Admin activates and manages subscriptions from the platform admin panel

---

## 6. User Roles & Access Control

| Action | Super Admin | School Admin | Faculty (Teacher) | Student |
|---|---|---|---|---|
| Manage schools | ✅ | ❌ | ❌ | ❌ |
| Manage subscriptions | ✅ | ❌ | ❌ | ❌ |
| Platform settings | ✅ | ❌ | ❌ | ❌ |
| Manage classes, sections | ❌ | ✅ | ❌ | ❌ |
| Manage students | ❌ | ✅ | ❌ | ❌ |
| View enrollments | ❌ | ✅ | ✅ | own only |
| Mark attendance | ❌ | ❌ | ✅ (own section only) | ❌ |
| View attendance | ❌ | ✅ (read-only) | ✅ (own section) | own only |
| Create exams | ❌ | ✅ | ❌ | ❌ |
| Enter exam results | ❌ | ✅ | ✅ (own subjects only) | ❌ |
| View exam results | ❌ | ✅ | ✅ | own only |
| Publish results | ❌ | ✅ | ❌ | ❌ |
| Fee structures | ❌ | ✅ | ❌ | ❌ |
| Fee collections & payments | ❌ | ✅ | ❌ | own only |
| Generate receipts | ❌ | ✅ | ❌ | own only |
| Transport management | ❌ | ✅ | ❌ | own only |
| Hostel management | ❌ | ✅ | ❌ | own only |
| Expense management | ❌ | ✅ | ❌ | ❌ |
| Notice board | ❌ | ✅ | ✅ (own sections) | ❌ |
| Calendar management | ❌ | ✅ | ❌ | ❌ |
| Salary management | ❌ | ✅ | ❌ | ❌ |
| Promote students | ❌ | ✅ | ❌ | ❌ |
| Upload photos | ❌ | ✅ | ❌ | ❌ |

---

## 7. Data Privacy & Security

- **Tenant isolation:** Every database query is scoped by `school_id`. No cross-school data access is possible.
- **JWT authentication:** Tokens are stored in HTTP-only cookies — not accessible to browser JavaScript.
- **Password storage:** All passwords (school, teacher, student) are hashed with bcrypt before storage. Plain-text passwords are never stored.
- **Role-based access:** Every API endpoint enforces role checks via middleware (`restrictTo`). Roles: `admin`, `super_admin`, `faculty`, `student`.
- **File uploads:** All uploaded files (photos, logos, receipts) are stored on Azure Blob Storage — not on the server filesystem.
- **Chunked uploads:** Large files are uploaded in 512 KB chunks to avoid memory pressure and request size limits.
- **Attendance enforcement:** Teachers cannot mark attendance outside their assigned section or outside the allowed date window (no future dates, edit only within current + previous month).
- **Exam result enforcement:** Teachers can only enter or edit results for subjects they are assigned to teach in that class for that academic year.

---

## 8. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, CSS Modules |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL |
| Cache | Redis Cloud |
| File Storage | Azure Blob Storage |
| Authentication | JWT (HTTP-only cookies) |
| Process management | Nodemon + ts-node |
| Email | Custom email service (SMTP) |
| PDF generation | Receipt controller (server-side PDF) |
| Background jobs | Worker threads (tsWorkerBootstrap) |

---

## 9. Subscription Plans Summary

### Free Plan
Best for small schools getting started.
- Up to **100 students**, **5 teachers**
- Core modules: students, classes, attendance, exams, calendar, notices
- ❌ Fee Management not available
- Free forever

### Pro Plan
Best for growing schools that need financial management.
- Up to **300 students**, **20 teachers**
- All Free plan features
- ✅ Full Fee Management (structures, collections, payments, receipts)
- ✅ Transport billing integration
- ✅ Hostel billing integration
- Monthly or yearly billing in NPR / INR

### Plus Plan
Best for large schools or multi-section institutions.
- Up to **1,500 students**, **40 teachers**
- All Pro plan features
- Priority support
- Monthly or yearly billing in NPR / INR

---

*Documentation last updated: July 2026*
*System: Skoolio v1.0 — School Management System*
