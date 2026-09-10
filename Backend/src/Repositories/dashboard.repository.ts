import pool from '../config/db';
import { adToBS, bsToAD, bsToISO, BS_MONTH_NAMES } from '../utils/bs-ad';

/**
 * In-memory cache for dashboard summary: 3 minutes TTL (with auto-invalidation on data changes)
 * Eliminates round trips to remote Azure PostgreSQL on frequent tab navigation.
 */
interface DashboardCacheEntry {
  data: any;
  cachedAt: number;
}
const dashboardCache = new Map<string, DashboardCacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const schoolSettingsCache = new Map<number, { country: string; calendar_system: string }>();

export const invalidateDashboardCache = (school_id?: number) => {
  if (school_id) {
    for (const key of dashboardCache.keys()) {
      if (key.startsWith(`${school_id}_`) || key === String(school_id)) {
        dashboardCache.delete(key);
      }
    }
    schoolSettingsCache.delete(school_id);
  } else {
    dashboardCache.clear();
    schoolSettingsCache.clear();
  }
};

/**
 * Aggregated query for the admin dashboard.
 * Parallelized with Promise.all and cached for fast sub-second loads.
 */
export const getDashboardSummary = async (school_id: number, academic_year_id?: number) => {
  // Return cached result if within 3 minutes
  const cacheKey = `${school_id}_${academic_year_id || 'active'}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // ── 0. School Settings (Country, Calendar System, Currency) ─
  let school = schoolSettingsCache.get(school_id);
  if (!school) {
    const schoolRes = await pool.query(
      `SELECT country, calendar_system FROM schools WHERE id = $1`,
      [school_id]
    );
    const row = schoolRes.rows[0];
    school = {
      country: row?.country || 'Nepal',
      calendar_system: row?.calendar_system || 'BS',
    };
    schoolSettingsCache.set(school_id, school);
  }
  const isIndia = school?.country?.toLowerCase() === 'india';
  const isBS = school?.calendar_system === 'BS';
  const currency = isIndia ? 'INR' : 'NPR';
  const currencySymbol = isIndia ? '₹' : (isBS ? 'रू' : 'Rs.');

  const now = new Date();

  // Current month start & timeline setup (BS vs AD)
  let currentMonthStart: Date;
  let salaryYear: number;
  let salaryMonth: number;

  interface TimelineSlot {
    key: string;       // e.g. "2083-05" or "2026-09"
    label: string;     // e.g. "Bhadra" or "Sep"
  }
  const timeline: TimelineSlot[] = [];
  let timelineStartDate: Date;

  if (isBS) {
    const nowBS = adToBS(now);
    // Current BS month start in AD
    currentMonthStart = bsToAD({ year: nowBS.year, month: nowBS.month, day: 1 });

    // Mid-month AD mapping for teacher salaries (which store AD month/year for the 15th)
    const midBSinAD = bsToISO({ year: nowBS.year, month: nowBS.month, day: 15 });
    const [sY, sM] = midBSinAD.split('-').map(Number);
    salaryYear = sY;
    salaryMonth = sM;

    // 6-month continuous timeline ending at current BS month
    for (let i = 5; i >= 0; i--) {
      let m = nowBS.month - i;
      let y = nowBS.year;
      while (m < 1) {
        m += 12;
        y -= 1;
      }
      timeline.push({
        key: `${y}-${String(m).padStart(2, '0')}`,
        label: BS_MONTH_NAMES[m - 1],
      });
    }
    const [firstY, firstM] = timeline[0].key.split('-').map(Number);
    timelineStartDate = bsToAD({ year: firstY, month: firstM, day: 1 });
  } else {
    currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    salaryYear = now.getFullYear();
    salaryMonth = now.getMonth() + 1;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      timeline.push({
        key: `${y}-${String(m).padStart(2, '0')}`,
        label: monthNames[d.getMonth()],
      });
    }
    const [firstY, firstM] = timeline[0].key.split('-').map(Number);
    timelineStartDate = new Date(firstY, firstM - 1, 1);
  }

  // ── Run all 13 independent queries concurrently via Promise.all ─
  const [
    studentsRes,
    teachersRes,
    classRes,
    feeRes,
    expenseRes,
    expCatRes,
    salaryRes,
    feeMonthlyRes,
    admissionsRes,
    recentStudentsRes,
    recentExpensesRes,
    recentSalaryRes,
    noticesRes,
  ] = await Promise.all([
    // 1. Students
    pool.query(
      `SELECT
         COUNT(*)::int                                                 AS total_students,
         COUNT(*) FILTER (WHERE s.status = 'active')::int             AS active_students,
         COUNT(*) FILTER (
           WHERE COALESCE(s.admission_date::timestamp, s.created_at) >= $2
         )::int                                                        AS new_this_month
       FROM students s
       WHERE s.school_id = $1`,
      [school_id, currentMonthStart]
    ),

    // 2. Teachers
    pool.query(
      `SELECT
         COUNT(*)::int                                             AS total_teachers,
         COUNT(*) FILTER (WHERE t.status = 'active')::int         AS active_teachers
       FROM teachers t
       WHERE t.school_id = $1`,
      [school_id]
    ),

    // 3. Classes & Sections
    pool.query(
      `SELECT
         COUNT(DISTINCT c.id)::int  AS total_classes,
         COUNT(DISTINCT s.id)::int  AS total_sections
       FROM classes c
       LEFT JOIN sections s ON s.class_id = c.id AND s.school_id = $1
       WHERE c.school_id = $1 AND c.status = 'active'`,
      [school_id]
    ),

    // 4. Fee summary (academic year)
    pool.query(
      academic_year_id
        ? `SELECT
             COALESCE(SUM(fc.net_amount),       0)::numeric AS total_assigned,
             COALESCE(SUM(fc.paid_amount),      0)::numeric AS total_collected,
             COALESCE(SUM(fc.remaining_amount), 0)::numeric AS total_pending,
             COALESCE(SUM(CASE
               WHEN fc.status != 'paid' AND fc.due_date < CURRENT_DATE - INTERVAL '30 days'
               THEN fc.remaining_amount ELSE 0 END), 0)::numeric AS overdue_amount,
             COUNT(DISTINCT fc.student_id) FILTER (WHERE fc.status != 'paid' AND fc.status != 'waived' AND fc.remaining_amount > 0)::int AS pending_students,
             COUNT(*) FILTER (WHERE fc.status != 'paid' AND fc.status != 'waived' AND fc.remaining_amount > 0)::int AS pending_bills
           FROM fee_collections fc
           WHERE fc.school_id      = $1
             AND fc.academic_year_id = $2`
        : `SELECT
             COALESCE(SUM(fc.net_amount),       0)::numeric AS total_assigned,
             COALESCE(SUM(fc.paid_amount),      0)::numeric AS total_collected,
             COALESCE(SUM(fc.remaining_amount), 0)::numeric AS total_pending,
             COALESCE(SUM(CASE
               WHEN fc.status != 'paid' AND fc.due_date < CURRENT_DATE - INTERVAL '30 days'
               THEN fc.remaining_amount ELSE 0 END), 0)::numeric AS overdue_amount,
             COUNT(DISTINCT fc.student_id) FILTER (WHERE fc.status != 'paid' AND fc.status != 'waived' AND fc.remaining_amount > 0)::int AS pending_students,
             COUNT(*) FILTER (WHERE fc.status != 'paid' AND fc.status != 'waived' AND fc.remaining_amount > 0)::int AS pending_bills
           FROM fee_collections fc
           INNER JOIN academic_years ay
             ON ay.school_id = $1 AND ay.status = 'active'
           WHERE fc.school_id      = $1
             AND fc.academic_year_id = ay.id`,
      academic_year_id ? [school_id, academic_year_id] : [school_id]
    ),

    // 5. Expenses — current month
    pool.query(
      `SELECT
         COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
         COUNT(*)::int                        AS expense_count
       FROM expenses e
       WHERE e.school_id    = $1
         AND e.expense_date >= $2`,
      [school_id, currentMonthStart]
    ),

    // 6. Expense breakdown by category (current month)
    pool.query(
      `SELECT
         COALESCE(ec.name, 'Uncategorised')   AS name,
         COALESCE(SUM(e.amount), 0)::numeric  AS value
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.school_id    = $1
         AND e.expense_date >= $2
       GROUP BY ec.name
       ORDER BY value DESC
       LIMIT 6`,
      [school_id, currentMonthStart]
    ),

    // 7. Teacher salary — current month
    pool.query(
      `SELECT
         COUNT(*)::int                                                AS total_records,
         COUNT(*) FILTER (WHERE ts.status = 'paid')::int             AS paid_count,
         COALESCE(SUM(CASE WHEN ts.status = 'paid'
           THEN ts.basic_salary + ts.bonus - ts.deduction ELSE 0
         END), 0)::numeric AS paid_amount
       FROM teacher_salaries ts
       WHERE ts.school_id = $1
         AND ts.month     = $2
         AND ts.year      = $3`,
      [school_id, salaryMonth, salaryYear]
    ),

    // 8. Fee collection per day (last 6 months) — aggregated by day
    pool.query(
      `SELECT
         to_char(COALESCE(fc.due_date::timestamp, fc.created_at), 'YYYY-MM-DD') AS fee_date,
         COALESCE(SUM(fc.paid_amount),      0)::numeric AS collected,
         COALESCE(SUM(fc.remaining_amount), 0)::numeric AS pending
       FROM fee_collections fc
       WHERE fc.school_id  = $1
         AND COALESCE(fc.due_date::timestamp, fc.created_at) >= $2
       GROUP BY 1
       ORDER BY fee_date ASC`,
      [school_id, timelineStartDate]
    ),

    // 9. New student admissions per day (last 6 months) — aggregated by day
    pool.query(
      `SELECT
         to_char(COALESCE(s.admission_date::timestamp, s.created_at), 'YYYY-MM-DD') AS admission_date,
         COUNT(*)::int AS count
       FROM students s
       WHERE s.school_id  = $1
         AND COALESCE(s.admission_date::timestamp, s.created_at) >= $2
       GROUP BY 1
       ORDER BY admission_date ASC`,
      [school_id, timelineStartDate]
    ),

    // 10. Recent students (last 5 enrolled)
    pool.query(
      `SELECT
         s.id, s.full_name, s.email, s.status,
         se.roll_number,
         c.name   AS class_name,
         sec.name AS section_name
       FROM students s
       LEFT JOIN student_enrollments se
         ON  se.student_id = s.id
         AND se.school_id  = s.school_id
         AND se.status     = 'active'
       LEFT JOIN classes  c   ON c.id   = se.class_id
       LEFT JOIN sections sec ON sec.id = se.section_id
       WHERE s.school_id = $1
       ORDER BY COALESCE(s.admission_date::timestamp, s.created_at) DESC, s.id DESC
       LIMIT 5`,
      [school_id]
    ),

    // 11. Recent expenses (last 5)
    pool.query(
      `SELECT
         e.id, e.title, e.amount, e.expense_date::text, e.payment_method,
         ec.name AS category_name
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.category_id
       WHERE e.school_id = $1
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT 5`,
      [school_id]
    ),

    // 12. Recent teacher salary statuses (current month)
    pool.query(
      `SELECT
         ts.id, ts.status,
         ts.basic_salary + ts.bonus - ts.deduction AS net_salary,
         t.full_name, t.id AS teacher_id
       FROM teacher_salaries ts
       INNER JOIN teachers t ON t.id = ts.teacher_id
       WHERE ts.school_id = $1
         AND ts.month     = $2
         AND ts.year      = $3
       ORDER BY ts.status ASC, t.full_name ASC
       LIMIT 6`,
      [school_id, salaryMonth, salaryYear]
    ),

    // 13. Active notices (pinned first, latest 4)
    pool.query(
      `SELECT
         n.id, n.title, n.content, n.created_by_name, n.created_by_role,
         n.target_type, n.is_pinned, n.created_at
       FROM notices n
       WHERE n.school_id  = $1
         AND n.status     = 'active'
         AND (n.expires_at IS NULL OR n.expires_at >= CURRENT_DATE)
       ORDER BY n.is_pinned DESC, n.created_at DESC
       LIMIT 4`,
      [school_id]
    ),
  ]);

  // ── Assemble & return ──────────────────────────────────────
  const students = studentsRes.rows[0];
  const teachers = teachersRes.rows[0];
  const classes  = classRes.rows[0];
  const fee      = feeRes.rows[0];
  const expense  = expenseRes.rows[0];
  const salary   = salaryRes.rows[0];

  const totalCollected = Number(fee.total_collected);
  const totalAssigned  = Number(fee.total_assigned);
  const collectionRate = totalAssigned > 0
    ? Math.round((totalCollected / totalAssigned) * 100)
    : 0;

  const totalExpenses = Number(expense.total_expenses);
  const salaryPaid    = Number(salary.paid_amount);
  const netBalance    = totalCollected - totalExpenses - salaryPaid;

  const expCatTotal      = expCatRes.rows.reduce((acc: number, r: any) => acc + Number(r.value), 0);
  const expenseBreakdown = expCatRes.rows.map((r: any) => ({
    name:  r.name,
    value: expCatTotal > 0 ? Math.round((Number(r.value) / expCatTotal) * 100) : 0,
    raw:   Number(r.value),
  }));

  // ── Helper to safely parse date without UTC midnight timezone shifting ──
  const parseDateSafe = (val: any): Date => {
    if (val instanceof Date) return val;
    const str = String(val);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [y, m, d] = str.slice(0, 10).split('-').map(Number);
      return new Date(y, m - 1, d || 1);
    }
    return new Date(val);
  };

  // ── Aggregate fee collections into timeline slots ─────────
  const feeAggMap = new Map<string, { collected: number; pending: number }>();
  for (const row of feeMonthlyRes.rows) {
    const d = parseDateSafe(row.fee_date);
    let key: string;
    if (isBS) {
      const bs = adToBS(d);
      key = `${bs.year}-${String(bs.month).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    const cur = feeAggMap.get(key) || { collected: 0, pending: 0 };
    cur.collected += Number(row.collected || 0);
    cur.pending += Number(row.pending || 0);
    feeAggMap.set(key, cur);
  }

  // ── Aggregate admissions into timeline slots ──────────────
  const admAggMap = new Map<string, number>();
  for (const row of admissionsRes.rows) {
    const d = parseDateSafe(row.admission_date);
    let key: string;
    if (isBS) {
      const bs = adToBS(d);
      key = `${bs.year}-${String(bs.month).padStart(2, '0')}`;
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    admAggMap.set(key, (admAggMap.get(key) || 0) + Number(row.count || 1));
  }

  const summary = {
    // Hero stats
    totalStudents:  students.total_students,
    activeStudents: students.active_students,
    newThisMonth:   students.new_this_month,
    totalTeachers:  teachers.total_teachers,
    activeTeachers: teachers.active_teachers,
    totalClasses:   classes.total_classes,
    totalSections:  classes.total_sections,

    // Fee
    totalAssigned:   Number(fee.total_assigned),
    totalCollected,
    totalPending:    Number(fee.total_pending),
    overdueAmount:   Number(fee.overdue_amount),
    pendingStudents: fee.pending_students,
    pendingBills:    fee.pending_bills,
    collectionRate,

    // Expense
    totalExpenses,
    expenseCount:    expense.expense_count,
    expenseBreakdown,

    // Salary
    salaryPaidCount: salary.paid_count,
    salaryTotal:     salary.total_records,
    salaryPaidAmt:   salaryPaid,

    // Currency configuration
    currency,
    currencySymbol,

    // Net balance
    netBalance,

    // Charts — Continuous 6-month timeline
    feeMonthly: timeline.map(slot => {
      const r = feeAggMap.get(slot.key);
      return {
        month:     slot.label,
        collected: r ? Math.round(r.collected / 1000) : 0,
        pending:   r ? Math.round(r.pending   / 1000) : 0,
      };
    }),

    admissionsMonthly: timeline.map(slot => {
      return {
        month:      slot.label,
        admissions: admAggMap.get(slot.key) || 0,
      };
    }),

    // Tables
    recentStudents: recentStudentsRes.rows,
    recentExpenses: recentExpensesRes.rows,
    recentSalaries: recentSalaryRes.rows,
    notices:        noticesRes.rows,
  };

  // Cache summary for 3 minutes
  dashboardCache.set(cacheKey, { data: summary, cachedAt: Date.now() });

  return summary;
};
