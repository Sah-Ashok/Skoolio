# SchoolPOS — Billing System Audit (July 2026)
> Last audited by Claude after reading all source files. Ground truth — do not edit manually.

---

## STATUS KEY
- ✅ FIXED — code confirms it is working
- ⚠️ PARTIAL — code exists but has a bug or gap
- ❌ MISSING — nothing implemented yet

---

## Issue 1 — CollectFeePage loads ALL students upfront
**Status: ✅ FIXED**

`CollectFeePage.tsx` now uses a debounced search:
```ts
apiRequest(`/students/search?q=${encodeURIComponent(query)}`)
```
Students are only fetched when the user types ≥2 characters. Pre-loading a specific student from a URL param (`?student_id=X`) calls `/students/:id` — a single-row fetch, not the full list. No bulk fetch of all students anywhere in the file.

---

## Issue 2 — FeeRecordsPage broken payments modal URL
**Status: ✅ FIXED**

`FeeRecordsPage.tsx` → `PaymentsModal` uses the `useApi` hook:
```ts
const { data: payments, loading } = useApi<any[]>(
  collection ? `/fees/payments/collection/${collection.id}` : ""
);
```
No hardcoded `{process.env.BackendUrl}` string literal anywhere. The route is correct and matches `GET /fees/payments/collection/:id` in `fee.routes.ts`.

---

## Issue 3 — No pre-selected student from Records → Collect
**Status: ✅ FIXED**

`FeeRecordsPage.tsx` — the "Collect" button in the table now passes `student_id`:
```tsx
<Link href={`/fees/collect?student_id=${col.student_id}`}>Collect</Link>
```
`CollectFeePage.tsx` reads that param on load:
```ts
const initialId = searchParams.get("student_id");
const { data: preloaded } = useApi<any>(initialId ? `/students/${initialId}` : "");
useEffect(() => {
  if (preloaded && !selectedStudent) {
    setSelectedStudent(preloaded);
    setQuery(preloaded.full_name || "");
  }
}, [preloaded]);
```
Student is auto-selected and their pending fees load immediately.

**Remaining gap:** The "Collect" link in `FeesPage.tsx` → Pending Payments table still goes to `/fees/collect` with **no** `student_id`:
```tsx
<Link href="/fees/collect">Collect</Link>   // ← BUG: student_id not passed
```
Fix: change to `href={`/fees/collect?student_id=${col.student_id}`}`.

---

## Issue 4 — Student portal shows all years' fees (no academic_year_id filter)
**Status: ✅ FIXED**

`StudentFeesPage.tsx` calls `/fees/me/collections` and `/fees/me/payments`. In the backend, `getMyFeeCollections` controller reads the JWT (`req.user.school_id` + `req.user.id` as student_id) and calls `getStudentFeeCollectionsService`. That service calls `getFeeCollectionsByStudent`, which accepts an optional `academic_year_id`.

**Remaining gap:** The frontend calls `/fees/me/collections` with **no** `?academic_year_id=` param, and the controller does not pass `academic_year_id` to the service either. Students still see all years' fees mixed together. To fully fix:
1. Backend: extract `academic_year_id` from query in `getMyFeeCollections` and pass it to service.
2. Frontend: pass `?academic_year_id=<active_year_id>` (can read from a context or from student's JWT-decoded payload if it carries the active year).

---

## Issue 5 — Yearly billing never auto-generated
**Status: ✅ FIXED (with a minor dead-code note)**

`generateMonthlyFeeBillsService` now handles `frequency = 'yearly'` and `'one_time'`:
```ts
if (s.frequency === 'yearly' || s.frequency === 'one_time') {
  const existingAny = await getYearlyFeeForAcademicYear(...);
  if (existingAny) { skipped++; continue; }
}
```
Yearly fees are generated once per academic year regardless of which billing month is triggered. Idempotency is enforced via `getYearlyFeeForAcademicYear`. The `isFirstMonth` variable in the service file is dead code (the comment is correct — the actual check is the `existingAny` guard), but it does not affect correctness.

---

## Issue 6 — No UI for one-time / misc fees (dress, books, ID card)
**Status: ✅ FIXED**

`CollectFeePage.tsx` has a full "Add One-Time / Misc Fee" inline form:
- Fields: fee_name, amount, due_date, discount (optional)
- Calls `POST /fees/collections/misc`
- Route is registered and controller (`createMiscFeeCollection`) is wired to `createMiscFeeCollectionService`
- Form appears after selecting a student; dismissed with "Cancel"

---

## Issue 7 — No bulk collect (admin must do 4 transactions for 4 pending fees)
**Status: ❌ MISSING**

No bulk payment UI exists anywhere. `CollectFeePage.tsx` allows selecting one fee at a time from a dropdown. There is no "select all pending" or "pay all" button. The backend `createFeePaymentAtomic` also handles one `collection_id` per call.

**What needs to be built:**
- Frontend: checkboxes on pending fee rows + "Pay All Selected" button that fires requests in sequence (or a new batch endpoint).
- Backend (optional but cleaner): `POST /fees/payments/bulk` accepting `[{collection_id, paid_amount}]` and running them in one transaction.

---

## Issue 8 — Fee structures not per-section (only per-class)
**Status: ❌ MISSING**

`fee_structures` table has `class_id` but no `section_id`. `getFeeStructuresByClass` filters only by `class_id`. There is no way for Section A (Science) and Section B (Commerce) of the same class to have different fee structures.

**What needs to be built:**
- DB migration: `ALTER TABLE fee_structures ADD COLUMN section_id INTEGER REFERENCES sections(id) DEFAULT NULL;`
- Repository: update `getFeeStructuresByClass` to filter by `section_id` when provided.
- `generateMonthlyFeeBillsService`: look up the student's `section_id` from their enrollment and match it against structures.
- Frontend `AddFeeStructurePage.tsx`: add optional section picker (only shows sections belonging to the selected class).
- Frontend `FeeStructuresPage.tsx`: group by class+section, not just class.

---

## Issue 9 — No fine / due-date enforcement UI
**Status: ❌ MISSING**

`fine_amount` and `fine_reason` columns exist on `fee_collections`. `updateFeeCollection` (PATCH `/fees/collections/:id`) can write them. But:
- No UI anywhere to add a fine to an overdue collection.
- No auto-fine logic (no cron job, no trigger).

**What needs to be built:**
- Frontend `FeeRecordsPage.tsx`: add "Add Fine" button on overdue rows → modal with `fine_amount` + `fine_reason` fields that calls `PATCH /fees/collections/:id`.
- Auto-fine (optional, advanced): a backend worker/cron that runs nightly, finds overdue unpaid collections where `fine_amount = 0`, and sets `fine_amount` per the school's late fee rule. Requires a `late_fee_per_day` or similar config field (not yet in schema).

---

## Issue 10 — CollectFeePage duplicates the Transport Bills panel
**Status: ✅ FIXED**

`CollectFeePage.tsx` has **no** "Generate Transport Bills" panel. The transport/hostel/academic bill generation panel lives only in `FeesPage.tsx` (the Overview page) under the "Generate Monthly Bills" section. No duplication.

---

## Summary Table

| # | Issue | Status | File(s) to fix |
|---|-------|--------|----------------|
| 1 | CollectFeePage loads all students | ✅ Fixed | — |
| 2 | FeeRecordsPage broken modal URL | ✅ Fixed | — |
| 3 | No pre-selected student Records→Collect | ⚠️ Partial | `FeesPage.tsx` line ~320 (Pending table Collect link) |
| 4 | Student portal shows all years' fees | ⚠️ Partial | `fee.controller.ts` `getMyFeeCollections`, `StudentFeesPage.tsx` |
| 5 | Yearly billing missing | ✅ Fixed | — |
| 6 | No misc/one-time fee UI | ✅ Fixed | — |
| 7 | No bulk collect | ❌ Missing | New UI in `CollectFeePage.tsx` + optional backend endpoint |
| 8 | Fee structures not per-section | ❌ Missing | DB migration + repository + service + 2 frontend pages |
| 9 | No fine/due-date enforcement UI | ❌ Missing | `FeeRecordsPage.tsx` "Add Fine" modal + optional cron |
| 10 | Duplicate Transport Bills panel | ✅ Fixed | — |

---

## Remaining work — priority order

### P1 — Quick fixes (< 1 hour each)

**3b. Fix `FeesPage.tsx` Pending table Collect link**
File: `frontend/src/components/admin/fees/FeesPage.tsx`
Find the pending table's Collect button (~line 320):
```tsx
<Link className={...} href="/fees/collect">Collect</Link>
```
Change to:
```tsx
<Link className={...} href={`/fees/collect?student_id=${col.student_id}`}>Collect</Link>
```

**4b. Fix student portal academic year filter**
File: `Backend/src/Controllers/fee.controller.ts` — `getMyFeeCollections` handler.
Add:
```ts
const { academic_year_id } = req.query;
// pass Number(academic_year_id) || undefined to getStudentFeeCollectionsService
```
File: `frontend/src/components/student/StudentFeesPage.tsx`
Change API call from `/fees/me/collections` to `/fees/me/collections?academic_year_id=${activeAcademicYearId}`.
(Need to inject `useAcademicYear` hook or read from student's context.)

### P2 — Bulk collect UI (half day)

Add a "Pay Selected" feature to `CollectFeePage.tsx`:
- Checkbox column in the "All fees this year" table (pending rows only)
- "Pay All Selected" button shows a confirm modal with total amount
- Fires individual `POST /fees/payments` calls in sequence; shows one toast per success/failure
- Refetches collections on completion

Optionally add `POST /fees/payments/bulk` to the backend for atomicity.

### P3 — Add Fine UI (half day)

In `FeeRecordsPage.tsx`:
- Add "Add Fine" button on overdue rows (status !== 'paid', due_date < today)
- Modal: `fine_amount` (number input) + `fine_reason` (text input)
- Calls `PATCH /fees/collections/:id` with `{ fine_amount, fine_reason }`
- Updates the row in-place via refetch

### P4 — Per-section fee structures (1–2 days, schema change)

See Issue 8 above for full breakdown. Requires DB migration first.

---

## Architecture notes (for future reference)

- **Fee flow:** fee_structure → (batch generate) → fee_collection → (admin collects) → fee_payment
- **Transport/Hostel fees** bypass fee_structures entirely; they use `fee_structure_id = NULL` and `fee_type = 'transport'/'hostel'`
- **Misc/one-time fees** also use `fee_structure_id = NULL`, `fee_type = 'academic'`
- **Idempotency:** `generateMonthlyFeeBillsService` is safe to run multiple times — `getAcademicFeeForPeriod` / `getYearlyFeeForAcademicYear` guards prevent duplicates
- **Receipt numbering:** atomic (`FOR UPDATE` lock on last receipt row), format `RCP-000001`
- **Student portal:** uses `/fees/me/collections` and `/fees/me/payments` — separate from admin endpoints
- **Scholarship discounts:** auto-applied during batch bill generation from `student_enrollments.scholarship_percent`
