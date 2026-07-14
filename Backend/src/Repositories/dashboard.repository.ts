import pool from '../config/db';

/**
 * Single aggregated query for the admin dashboard.
 * Returns everything the dashboard needs in one DB round-trip.
 */
export const getDashboardSummary = async (school_id: number) => {

  // ── 1. Students ────────────────────────────────────────────
  const studentsRes = await pool.query(
    `SELECT
       COUNT(*)::int                                                 AS total_students,
       COUNT(*) FILTER (WHERE s.status = 'active')::int             AS active_students,
       COUNT(*) FILTER (
         WHERE s.created_at >= date_trunc('month', CURRENT_DATE)
       )::int                                                        AS new_this_month
     FROM students s
     WHERE s.school_id = $1`,
    [school_id]
  );

  // ── 2. Teachers ────────────────────────────────────────────
  const teachersRes = await pool.query(
    `SELECT
       COUNT(*)::int                                             AS total_teachers,
       COUNT(*) FILTER (WHERE t.status = 'active')::int         AS active_teachers
     FROM teachers t
     WHERE t.school_id = $1`,
    [school_id]
  );

  // ── 3. Classes & Sections ──────────────────────────────────
  const classRes = await pool.query(
    `SELECT
       COUNT(DISTINCT c.id)::int  AS total_classes,
       COUNT(DISTINCT s.id)::int  AS total_sections
     FROM classes c
     LEFT JOIN sections s ON s.class_id = c.id AND s.school_id = $1
     WHERE c.school_id = $1 AND c.status = 'active'`,
    [school_id]
  );

  // ── 4. Fee summary (current academic year) ─────────────────
  // Qualify every column reference — both fee_collections and academic_years
  // have a "status" column, making bare "status" ambiguous.
  const feeRes = await pool.query(
    `SELECT
       COALESCE(SUM(fc.net_amount),       0)::numeric AS total_assigned,
       COALESCE(SUM(fc.paid_amount),      0)::numeric AS total_collected,
       COALESCE(SUM(fc.remaining_amount), 0)::numeric AS total_pending,
       COALESCE(SUM(CASE
         WHEN fc.status != 'paid' AND fc.due_date < CURRENT_DATE - INTERVAL '30 days'
         THEN fc.remaining_amount ELSE 0 END), 0)::numeric AS overdue_amount,
       COUNT(*) FILTER (WHERE fc.status != 'paid')::int     AS pending_students
     FROM fee_collections fc
     INNER JOIN academic_years ay
       ON ay.school_id = $1 AND ay.status = 'active'
     WHERE fc.school_id      = $1
       AND fc.academic_year_id = ay.id`,
    [school_id]
  );

  // ── 5. Expenses — current month ────────────────────────────
  const expenseRes = await pool.query(
    `SELECT
       COALESCE(SUM(e.amount), 0)::numeric AS total_expenses,
       COUNT(*)::int                        AS expense_count
     FROM expenses e
     WHERE e.school_id    = $1
       AND e.expense_date >= date_trunc('month', CURRENT_DATE)`,
    [school_id]
  );

  // ── 6. Expense breakdown by category (current month) ───────
  const expCatRes = await pool.query(
    `SELECT
       COALESCE(ec.name, 'Uncategorised')   AS name,
       COALESCE(SUM(e.amount), 0)::numeric  AS value
     FROM expenses e
     LEFT JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.school_id    = $1
       AND e.expense_date >= date_trunc('month', CURRENT_DATE)
     GROUP BY ec.name
     ORDER BY value DESC
     LIMIT 6`,
    [school_id]
  );

  // ── 7. Teacher salary — current month ──────────────────────
  const salaryRes = await pool.query(
    `SELECT
       COUNT(*)::int                                                AS total_records,
       COUNT(*) FILTER (WHERE ts.status = 'paid')::int             AS paid_count,
       COALESCE(SUM(CASE WHEN ts.status = 'paid'
         THEN ts.basic_salary + ts.bonus - ts.deduction ELSE 0
       END), 0)::numeric AS paid_amount
     FROM teacher_salaries ts
     WHERE ts.school_id = $1
       AND ts.month     = EXTRACT(MONTH FROM CURRENT_DATE)::int
       AND ts.year      = EXTRACT(YEAR  FROM CURRENT_DATE)::int`,
    [school_id]
  );

  // ── 8. Fee collection per month (last 6 months) ────────────
  const feeMonthlyRes = await pool.query(
    `SELECT
       TO_CHAR(date_trunc('month', fc.created_at), 'Mon') AS month,
       date_trunc('month', fc.created_at)                  AS month_date,
       COALESCE(SUM(fc.paid_amount),      0)::numeric      AS collected,
       COALESCE(SUM(fc.remaining_amount), 0)::numeric      AS pending
     FROM fee_collections fc
     WHERE fc.school_id  = $1
       AND fc.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY date_trunc('month', fc.created_at)
     ORDER BY month_date ASC`,
    [school_id]
  );

  // ── 9. New student admissions per month (last 6 months) ────
  const admissionsRes = await pool.query(
    `SELECT
       TO_CHAR(date_trunc('month', s.created_at), 'Mon') AS month,
       date_trunc('month', s.created_at)                  AS month_date,
       COUNT(*)::int                                       AS admissions
     FROM students s
     WHERE s.school_id  = $1
       AND s.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
     GROUP BY date_trunc('month', s.created_at)
     ORDER BY month_date ASC`,
    [school_id]
  );

  // ── 10. Recent students (last 5 enrolled) ──────────────────
  // Qualify s.status explicitly — student_enrollments also has a status column.
  const recentStudentsRes = await pool.query(
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
     ORDER BY s.created_at DESC
     LIMIT 5`,
    [school_id]
  );

  // ── 11. Recent expenses (last 5) ───────────────────────────
  const recentExpensesRes = await pool.query(
    `SELECT
       e.id, e.title, e.amount, e.expense_date::text, e.payment_method,
       ec.name AS category_name
     FROM expenses e
     LEFT JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.school_id = $1
     ORDER BY e.expense_date DESC, e.created_at DESC
     LIMIT 5`,
    [school_id]
  );

  // ── 12. Recent teacher salary statuses (current month) ─────
  const recentSalaryRes = await pool.query(
    `SELECT
       ts.id, ts.status,
       ts.basic_salary + ts.bonus - ts.deduction AS net_salary,
       t.full_name, t.id AS teacher_id
     FROM teacher_salaries ts
     INNER JOIN teachers t ON t.id = ts.teacher_id
     WHERE ts.school_id = $1
       AND ts.month     = EXTRACT(MONTH FROM CURRENT_DATE)::int
       AND ts.year      = EXTRACT(YEAR  FROM CURRENT_DATE)::int
     ORDER BY ts.status ASC, t.full_name ASC
     LIMIT 6`,
    [school_id]
  );

  // ── 13. Active notices (pinned first, latest 4) ────────────
  const noticesRes = await pool.query(
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
  );

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

  return {
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
    collectionRate,

    // Expense
    totalExpenses,
    expenseCount:    expense.expense_count,
    expenseBreakdown,

    // Salary
    salaryPaidCount: salary.paid_count,
    salaryTotal:     salary.total_records,
    salaryPaidAmt:   salaryPaid,

    // Net balance
    netBalance,

    // Charts
    feeMonthly: feeMonthlyRes.rows.map(r => ({
      month:     r.month,
      collected: Math.round(Number(r.collected) / 1000),
      pending:   Math.round(Number(r.pending)   / 1000),
    })),
    admissionsMonthly: admissionsRes.rows.map(r => ({
      month:      r.month,
      admissions: r.admissions,
    })),

    // Tables
    recentStudents: recentStudentsRes.rows,
    recentExpenses: recentExpensesRes.rows,
    recentSalaries: recentSalaryRes.rows,
    notices:        noticesRes.rows,
  };
};
