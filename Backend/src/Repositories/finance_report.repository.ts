import pool from '../config/db';
import { adToBS, BS_MONTH_NAMES } from '../utils/bs-ad';

export const getFeeReportData = async (school_id: number, academic_year_id: number) => {
  // 1. Overall Summary
  const summaryRes = await pool.query(
    `SELECT
       COALESCE(SUM(fc.net_amount), 0)::numeric AS total_expected,
       COALESCE(SUM(fc.paid_amount), 0)::numeric AS total_collected,
       COALESCE(SUM(fc.remaining_amount), 0)::numeric AS total_outstanding
     FROM fee_collections fc
     WHERE fc.school_id = $1 AND fc.academic_year_id = $2
       AND fc.status != 'cancelled'`,
    [school_id, academic_year_id]
  );
  const summaryRow = summaryRes.rows[0] || {};
  const totalExpected = Number(summaryRow.total_expected || 0);
  const totalCollected = Number(summaryRow.total_collected || 0);
  const totalOutstanding = Number(summaryRow.total_outstanding || 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 1000) / 10 : 0;

  // 2. Class-wise Report
  const classRes = await pool.query(
    `SELECT
       COALESCE(cl.name, 'Unassigned') AS class_name,
       COALESCE(SUM(fc.net_amount), 0)::numeric AS expected,
       COALESCE(SUM(fc.paid_amount), 0)::numeric AS collected,
       COALESCE(SUM(fc.remaining_amount), 0)::numeric AS outstanding,
       COUNT(DISTINCT fc.student_id) FILTER (WHERE fc.status NOT IN ('paid', 'waived', 'cancelled') AND fc.remaining_amount > 0)::int AS defaulters
     FROM fee_collections fc
     LEFT JOIN student_enrollments se
       ON se.student_id = fc.student_id
      AND se.school_id = fc.school_id
      AND se.academic_year_id = fc.academic_year_id
      AND se.status = 'active'
     LEFT JOIN classes cl ON cl.id = se.class_id
     WHERE fc.school_id = $1 AND fc.academic_year_id = $2
       AND fc.status != 'cancelled'
     GROUP BY cl.name, cl.id
     ORDER BY cl.name ASC NULLS LAST`,
    [school_id, academic_year_id]
  );

  const class_wise = classRes.rows.map((row) => {
    const exp = Number(row.expected || 0);
    const col = Number(row.collected || 0);
    const out = Number(row.outstanding || 0);
    const rate = exp > 0 ? `${Math.round((col / exp) * 100)}%` : '0%';
    return {
      class_name: row.class_name,
      expected: exp,
      collected: col,
      outstanding: out,
      rate,
      defaulters: Number(row.defaulters || 0),
    };
  });

  // 3. Type-wise Report
  const typeRes = await pool.query(
    `SELECT
       COALESCE(fc.fee_type, 'academic') AS fee_type,
       COUNT(DISTINCT fc.student_id)::int AS total_students,
       COALESCE(SUM(fc.paid_amount), 0)::numeric AS collected,
       COALESCE(SUM(fc.remaining_amount), 0)::numeric AS outstanding
     FROM fee_collections fc
     WHERE fc.school_id = $1 AND fc.academic_year_id = $2
       AND fc.status != 'cancelled'
     GROUP BY COALESCE(fc.fee_type, 'academic')
     ORDER BY fee_type ASC`,
    [school_id, academic_year_id]
  );

  const type_wise = typeRes.rows.map((row) => ({
    fee_type: row.fee_type.charAt(0).toUpperCase() + row.fee_type.slice(1),
    total_students: Number(row.total_students || 0),
    collected: Number(row.collected || 0),
    outstanding: Number(row.outstanding || 0),
  }));

  return {
    summary: {
      total_expected: totalExpected,
      total_collected: totalCollected,
      total_outstanding: totalOutstanding,
      collection_rate: collectionRate,
    },
    class_wise,
    type_wise,
  };
};

export const getIncomeExpenseReportData = async (school_id: number, academic_year_id: number) => {
  // 0. Get School Calendar System
  const schoolRes = await pool.query(
    `SELECT calendar_system FROM schools WHERE id = $1`,
    [school_id]
  );
  const isBS = schoolRes.rows[0]?.calendar_system === 'BS';

  // 1. Get Academic Year
  const yearRes = await pool.query(
    `SELECT start_date, end_date FROM academic_years WHERE id = $1 AND school_id = $2`,
    [academic_year_id, school_id]
  );
  const year = yearRes.rows[0];
  const startDate = year?.start_date ? new Date(year.start_date) : new Date(new Date().getFullYear(), 0, 1);
  const endDate = year?.end_date ? new Date(year.end_date) : new Date(new Date().getFullYear(), 11, 31);

  // 2. Fetch Payments (Income strictly scoped to this academic year)
  const paymentsRes = await pool.query(
    `SELECT
       fp.paid_amount,
       fp.payment_date,
       COALESCE(fc.fee_type, 'academic') AS fee_type
     FROM fee_payments fp
     INNER JOIN fee_collections fc ON fc.id = fp.collection_id
     WHERE fp.school_id = $1
       AND fc.academic_year_id = $2`,
    [school_id, academic_year_id]
  );

  // 3. Fetch Expenses (Scoped to academic year, with date fallback only for legacy records without academic_year_id)
  const expensesRes = await pool.query(
    `SELECT
       e.amount,
       e.expense_date,
       COALESCE(ec.name, 'Uncategorized') AS category_name
     FROM expenses e
     LEFT JOIN expense_categories ec ON ec.id = e.category_id
     WHERE e.school_id = $1
       AND (e.academic_year_id = $2 OR (e.academic_year_id IS NULL AND e.expense_date >= $3 AND e.expense_date <= $4))`,
    [school_id, academic_year_id, startDate, endDate]
  );

  // 4. Group by Month and Categories
  let totalIncome = 0;
  let totalExpense = 0;

  const monthMap = new Map<string, { label: string; income: number; expense: number; sortKey: string }>();
  const incomeCatMap = new Map<string, number>();
  const expenseCatMap = new Map<string, number>();

  const getMonthInfo = (dateInput: Date | string) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { key: 'Unknown', label: 'Unknown', sortKey: '0000-00' };
    if (isBS) {
      const bs = adToBS(d);
      const key = `${bs.year}-${String(bs.month).padStart(2, '0')}`;
      const label = `${BS_MONTH_NAMES[bs.month - 1]} ${bs.year}`;
      return { key, label, sortKey: key };
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${y}`;
      return { key, label, sortKey: key };
    }
  };

  // Process Payments
  for (const row of paymentsRes.rows) {
    const amt = Number(row.paid_amount || 0);
    totalIncome += amt;

    // Category
    const rawType = String(row.fee_type || 'academic');
    const catName = rawType.charAt(0).toUpperCase() + rawType.slice(1) + ' Fees';
    incomeCatMap.set(catName, (incomeCatMap.get(catName) || 0) + amt);

    // Month
    const { key, label, sortKey } = getMonthInfo(row.payment_date);
    const existing = monthMap.get(key) || { label, income: 0, expense: 0, sortKey };
    existing.income += amt;
    monthMap.set(key, existing);
  }

  // Process Expenses
  for (const row of expensesRes.rows) {
    const amt = Number(row.amount || 0);
    totalExpense += amt;

    // Category
    const catName = String(row.category_name || 'Uncategorized');
    expenseCatMap.set(catName, (expenseCatMap.get(catName) || 0) + amt);

    // Month
    const { key, label, sortKey } = getMonthInfo(row.expense_date);
    const existing = monthMap.get(key) || { label, income: 0, expense: 0, sortKey };
    existing.expense += amt;
    monthMap.set(key, existing);
  }

  // Build sorted month rows
  const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) => {
    const itemA = monthMap.get(a)!;
    const itemB = monthMap.get(b)!;
    return itemA.sortKey.localeCompare(itemB.sortKey);
  });

  const months = sortedMonthKeys.map((key) => {
    const m = monthMap.get(key)!;
    const net = m.income - m.expense;
    return {
      month: m.label,
      income: m.income,
      expense: m.expense,
      net,
      trend: (net >= 0 ? 'up' : 'down') as 'up' | 'down',
    };
  });

  // Build Income Category breakdown
  const income_categories = Array.from(incomeCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percent: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
    }));

  // Build Expense Category breakdown
  const expense_categories = Array.from(expenseCatMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percent: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
    }));

  const netBalance = totalIncome - totalExpense;

  return {
    summary: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_balance: netBalance,
      is_surplus: netBalance >= 0,
    },
    months,
    income_categories,
    expense_categories,
  };
};
