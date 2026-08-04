# Skoolio — Developer Notes & Pending Work

> Last updated: 2026-08-02
> Stack: Next.js / TypeScript (frontend) · Node.js / Express / TypeScript (backend) · PostgreSQL

---

## ✅ Recently Completed

- Full production deployment to Azure Linux VM (Docker + Nginx)
- SSL/HTTPS deferred (see pending below)
- Teacher attendance register page redesign (all-dates columns, vertical holiday labels, first-student bug fixed)
- Fee module audit: waive reason bug, advance balance query, monthly billing `net_amount` fix, waive UI added to `CollectFeePage`, `FeesPage` `billingMonthLabel` AD fix, `totalPending` using `remaining_amount`
- `MonthlyBillingPage` waived-status fix + `net_amount` grouping
- `StudentFeeHistoryPage` — scholarship strip, yearly fee banner, fee structure tag, month-by-month pending timeline, fee breakdown by category, payment sub-rows with receipt links
- `AddFeeStructurePage` — scholarship policy selector (all / tuition_only / custom), billing start rule per fee head
- `fee_billing_policy` table + API created (GET/PUT `/api/fee-billing-policy`)

---

## 🔴 Critical Bugs (fix immediately)

### B1 · Transport & Hostel batch generators may double-bill across academic years
**Files:** `Backend/src/Repositories/transport.repository.ts` → `getAssignmentsByRoute`, `Backend/src/Repositories/hostel.repository.ts` → `getAssignmentsByHostel`
**Problem:** Neither function filters by `academic_year_id`. A student assigned to a route in AY 2080 and again in AY 2081 gets billed twice when batch billing runs.
**Fix:** Add `AND ta.academic_year_id = $3` (or similar) to both queries. Pass `academic_year_id` from the service callers in `fee.service.ts`.

### B2 · `autoAddTransportFee` / `autoAddHostelFee` only fires from manual academic fee creation
**Files:** `Backend/src/Service/fee.service.ts` → `createFeeCollectionService`
**Problem:** Auto-add is called only when an admin manually creates an academic fee collection for a student. Students who only have transport/hostel (no academic fee created manually) never get their transport/hostel fee auto-added.
**Fix:** Move auto-add to a dedicated trigger — either (a) call it inside `generateTransportBillsService` / `generateHostelBillsService` directly (already done for batch), or (b) call it on student enrollment creation in `student.service.ts`.

### B3 · `fee_billing_policy` is created but NOT integrated into `generateMonthlyFeeBillsService`
**Files:** `Backend/src/Service/fee.service.ts` → `generateMonthlyFeeBillsService`
**Problem:** The policy table (`billing_start_from`, `monthly_bill_window`) exists in DB and has an API, but `generateMonthlyFeeBillsService` ignores it entirely. The `billing_start_rule` per fee structure is used, but the school-level policy fields do nothing.
**Fix needed:**
1. At start of `generateMonthlyFeeBillsService`, call `getFeeBillingPolicy(school_id)`.
2. If `billing_start_from === 'join_date'`, use the student's actual enrollment/admission month as billing start instead of always comparing to academic year start.
3. If `monthly_bill_window === 'bill_past_due'`, loop from the student's billing-start month up to `billing_month`, generating a bill for each month that has no existing collection (catch-up billing).

### B4 · `fee_billing_policy` tab missing from Settings page
**Files:** `frontend/src/app/(admin)/settings/page.tsx`
**Problem:** `PayrollPolicyTab` exists and is wired up. A `FeeBillingPolicyTab` component needs to be created and added as a new tab.
**What the tab should contain:**
- `billing_start_from` radio: "Academic year start" vs "Student join date"
- `monthly_bill_window` radio: "Current month only" vs "Catch-up all past unbilled months"
- `overdue_grace_days` number input (0–90)
- Explanatory text for each option (use the exact DB column comments as copy)
- GET on load, PUT on save via `/api/fee-billing-policy`

### B5 · `StudentFeeHistoryPage` fetches ALL academic years — no year filter
**File:** `frontend/src/components/admin/fees/StudentFeeHistoryPage.tsx`
**Problem:** `apiRequest('/fees/collections/student/${studentId}')` and `apiRequest('/fees/payments/student/${studentId}')` have no `academic_year_id` param. A student in year 3 sees all bills from years 1, 2, and 3 mixed together. The timeline and totals are therefore wrong.
**Fix:** Add `?academic_year_id=${academicYearId}` to both fetch calls. Add a year-picker dropdown in the page header so admin can switch years.

### B6 · `effectivePaid` overcounts for partially-paid-then-waived fees
**File:** `frontend/src/components/admin/fees/StudentFeeHistoryPage.tsx`
**Problem:**
```ts
if (c.status === 'waived') return parseFloat(c.net_amount || c.total_amount || 0);
```
If a student paid Rs 200 of a Rs 500 bill, then admin waived the rest, `effectivePaid` returns 500 (full net_amount) instead of 200 (actual cash paid). This inflates `totalPaid` in the summary.
**Fix:**
```ts
if (c.status === 'waived') return parseFloat(c.paid_amount || 0) + parseFloat(c.remaining_amount === '0' ? (parseFloat(c.net_amount) - parseFloat(c.paid_amount)).toString() : '0');
// Simpler: effectivePaid = paid_amount + (waived_amount = net_amount - paid_amount if status=waived)
// Show them separately: "Rs 200 cash paid + Rs 300 waived" — don't add them into one "paid" total.
```
Recommended: split into `cashPaid` and `waivedAmt` in the all-time summary (already done per-row, needs to flow up to totals).

---

## 🟡 Incomplete Features (must be done before production use)

### F1 · One-time fees NOT auto-assigned on new student registration
**File:** `Backend/src/Service/student.service.ts` (enrollment creation path)
**Problem:** When a student is enrolled, `assignOneTimeFeesService` is not called. So new students don't get their one-time fees (admission fee, uniform deposit, etc.) auto-generated. This was noted as unresolved in prior sessions.
**Fix:** After creating the enrollment record, call `assignOneTimeFeesService` with the new student's `class_id`, `enrollment_id`, `scholarship_percent`, `scholarship_type`, and `admission_date`.

### F2 · Monthly billing page does not account for advance payments or scholarships in "Total Due"
**File:** `frontend/src/components/admin/fees/MonthlyBillingPage.tsx`
**Status:** `net_amount` grouping was fixed (replaces `total_amount`), but the "Total Due" column in the student list still doesn't show the advance-credit reduction applied at billing time.
**Fix:** The advance credit is already baked into `net_amount` when bills are generated (done in `fee.service.ts`). The display is now correct as long as `net_amount` is used — verify this end-to-end once B3 is fixed.

### F3 · Scholarship configurability — tuition-only vs all fee types
**File:** `AddFeeStructurePage.tsx` (frontend done), `fee.service.ts` `generateMonthlyFeeBillsService` (backend done per-structure)
**Status:** UI lets admin set per-head `scholarship_applies`. Backend respects it. But the school-level `billing_start_from` policy is still not read (see B3).
**Remaining work:** None after B3 is fixed. Mark complete once B3 is done.

### F4 · `FeeRecordsPage` uses `total_amount` instead of `net_amount` for display totals
**File:** `frontend/src/components/admin/fees/FeeRecordsPage.tsx`
**Problem:** Not audited in detail but likely mirrors the same `total_amount` vs `net_amount` bug seen in `MonthlyBillingPage` before it was fixed.
**Fix:** Audit and replace all `total_amount` aggregations with `net_amount` where computing what the student owes.

### F5 · `CollectFeePage` receipt/history link goes to fee history, not individual receipt
**File:** `frontend/src/components/admin/fees/CollectFeePage.tsx`
**Status:** Partially fixed — now links to fee history page for the student. Should ideally link to the specific receipt `/fees/receipt/:payment_id` but requires knowing the payment_id at that point. Acceptable as-is for now.

### F6 · No "Fee Billing Policy" frontend component exists yet
**Status:** Backend API is done. Frontend tab and component need to be created (see B4 above).
**Component to create:** `frontend/src/components/admin/settings/FeeBillingPolicyTab.tsx`
**Route to add:** New tab in `frontend/src/app/(admin)/settings/page.tsx` — type `Tab` needs `'fees'` added.

---

## 🟠 Production / DevOps Deferred

### D1 · SSL / HTTPS not configured
**Files:** `nginx/nginx.conf`, `docker-compose.yml`
**Steps:** Get domain, point DNS to Azure VM, run Certbot for Let's Encrypt, update nginx config to redirect HTTP → HTTPS and serve on 443.

### D2 · No watchdog / health alerts
**Problem:** If the backend or frontend container crashes, no alert is sent.
**Fix:** Set up a Telegram or email watchdog. Docker healthchecks are defined but alerts are not wired to any notification channel.

### D3 · No container memory limits set
**File:** `docker-compose.yml`
**Fix:** Add `mem_limit: 512m` (or appropriate) per service to prevent one container from starving the VM.

### D4 · Log rotation not configured
**Problem:** Docker logs will grow unbounded on the VM disk.
**Fix:** Add `logging.driver: json-file` with `max-size: 10m`, `max-file: "3"` to each service in `docker-compose.yml`.

---

## 🔵 Architecture / Design Decisions Pending

### A1 · Billing policy `bill_past_due` — catch-up billing UX
When `monthly_bill_window = 'bill_past_due'`, running "Generate Bills" for August should backfill Feb–Jul for a student who joined in February. The service needs to loop months. The frontend `MonthlyBillingPage` should warn admin before they generate: "This will create X catch-up bills for Y students."

### A2 · Yearly fee "confirmation" flow
Currently, yearly fees (e.g. Tuition Rs 40,000/yr) are billed in full at year start as a single collection. If the student pays monthly instalments toward it, the system shows partial payments. This is working but the `YearlyFeesBanner` in `StudentFeeHistoryPage` relies on `fee_name` containing "annual" or "yearly" as a fallback — this is fragile. Fix: use `frequency = 'yearly'` from the joined fee structure, not fee name substring matching.

### A3 · Transport/hostel academic year filter (relates to B1)
After fixing `getAssignmentsByRoute` and `getAssignmentsByHostel` to filter by AY, confirm that the hostel and transport assignment pages (`/hostel`, `/transport`) also pass `academic_year_id` correctly when listing students.

---

## 📋 Quick Reference — Key File Paths

| Area | Backend | Frontend |
|---|---|---|
| Fee billing core | `Backend/src/Service/fee.service.ts` | `frontend/src/components/admin/fees/` |
| Billing policy | `Backend/src/Service/fee_billing_policy.service.ts` | ⚠️ component missing (see F6) |
| Fee history | `Backend/src/Repositories/fee.repository.ts` | `StudentFeeHistoryPage.tsx` |
| Transport billing | `Backend/src/Repositories/transport.repository.ts` | — |
| Hostel billing | `Backend/src/Repositories/hostel.repository.ts` | — |
| Settings page | — | `frontend/src/app/(admin)/settings/page.tsx` |
| Migrations | `Backend/migrations/` | — |

---

## 🗄️ DB Migrations Already Run (do not re-run)

- `migration_fee_billing_policy.sql` — `fee_billing_policy` table, `scholarship_applies` + `billing_start_rule` columns on `fee_structures`
- `migration_fix_fee_idempotency_constraint_v3.sql` and `v4` — unique constraint on fee collections
- `migration_remove_late_fix_suspended.sql` — status ENUM cleanup
- `migration_payroll_policy.sql` — payroll policy table

## 🗄️ DB Migrations Still Needed

```sql
-- No new migrations required from today's audit.
-- All schema changes for fee_billing_policy are already in migration_fee_billing_policy.sql.
-- The waive fix (B-waive) uses fine_reason column which already exists.
```
