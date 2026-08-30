import pool from '../config/db';
import {
  IStaffRole, ICreateStaffRole, IUpdateStaffRole,
  IStaff, ICreateStaff, IUpdateStaff,
  IStaffSalaryStructure, ICreateSalaryStructure, IUpdateSalaryStructure,
  IStaffSalaryPayment, ICreateSalaryPayment, IUpdateSalaryPayment,
  IStaffSalaryDeduction, ICreateDeduction,
  IStaffAttendance, ICreateAttendance, IUpdateAttendance,
} from '../types/staff.types';

// ── STAFF ROLES ───────────────────────────────────────────────────────────────

export const createStaffRole = async (school_id: number, data: ICreateStaffRole): Promise<IStaffRole> => {
  const result = await pool.query(
    `INSERT INTO staff_roles (school_id, role_name) VALUES ($1, $2) RETURNING *`,
    [school_id, data.role_name]
  );
  return result.rows[0];
};

export const getStaffRolesBySchool = async (school_id: number): Promise<IStaffRole[]> => {
  const result = await pool.query(
    `SELECT * FROM staff_roles WHERE school_id = $1 ORDER BY role_name ASC`,
    [school_id]
  );
  return result.rows;
};

export const getStaffRoleById = async (id: number, school_id: number): Promise<IStaffRole | null> => {
  const result = await pool.query(
    `SELECT * FROM staff_roles WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateStaffRole = async (id: number, school_id: number, data: IUpdateStaffRole): Promise<IStaffRole | null> => {
  const result = await pool.query(
    `UPDATE staff_roles SET role_name = COALESCE($1, role_name), updated_at = NOW()
     WHERE id = $2 AND school_id = $3 RETURNING *`,
    [data.role_name || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const deleteStaffRole = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM staff_roles WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── STAFF MEMBERS ─────────────────────────────────────────────────────────────

const STAFF_COLS = `
  s.id, s.school_id, s.staff_role_id, s.full_name, s.phone, s.address, s.gender,
  s.date_of_birth::text, s.joined_date::text, s.status, s.photo,
  to_jsonb(s)->>'citizen_id' AS citizen_id,
  to_jsonb(s)->>'license_number' AS license_number,
  s.created_at, s.updated_at,
  sr.role_name
`;

export const createStaff = async (school_id: number, data: ICreateStaff): Promise<IStaff> => {
  try {
    const result = await pool.query(
      `INSERT INTO staff
         (school_id, staff_role_id, full_name, phone, address, gender,
          date_of_birth, joined_date, status, photo, citizen_id, license_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING
         id, school_id, staff_role_id, full_name, phone, address, gender,
         date_of_birth::text, joined_date::text, status, photo,
         to_jsonb(staff)->>'citizen_id' AS citizen_id,
         to_jsonb(staff)->>'license_number' AS license_number,
         created_at, updated_at`,
      [
        school_id,
        data.staff_role_id,
        data.full_name,
        data.phone          || null,
        data.address        || null,
        data.gender         || null,
        data.date_of_birth  || null,
        data.joined_date,
        data.status         || 'active',
        data.photo          || null,
        data.citizen_id     || null,
        data.license_number || null,
      ]
    );
    return result.rows[0];
  } catch (err: any) {
    if (err?.code === '42703') {
      const result = await pool.query(
        `INSERT INTO staff
           (school_id, staff_role_id, full_name, phone, address, gender,
            date_of_birth, joined_date, status, photo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING
           id, school_id, staff_role_id, full_name, phone, address, gender,
           date_of_birth::text, joined_date::text, status, photo, created_at, updated_at`,
        [
          school_id,
          data.staff_role_id,
          data.full_name,
          data.phone          || null,
          data.address        || null,
          data.gender         || null,
          data.date_of_birth  || null,
          data.joined_date,
          data.status         || 'active',
          data.photo          || null,
        ]
      );
      return result.rows[0];
    }
    throw err;
  }
};

export const getStaffBySchool = async (school_id: number): Promise<IStaff[]> => {
  const result = await pool.query(
    `SELECT ${STAFF_COLS}
     FROM staff s
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE s.school_id = $1
     ORDER BY sr.role_name ASC, s.full_name ASC`,
    [school_id]
  );
  return result.rows;
};

export const getStaffWithSalary = async (school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       ${STAFF_COLS},
       sal.basic_salary,
       sal.effective_from::text AS salary_effective_from
     FROM staff s
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     LEFT JOIN LATERAL (
       SELECT basic_salary, effective_from
       FROM   staff_salary_structure ss
       WHERE  ss.staff_id   = s.id
         AND  ss.school_id  = s.school_id
         AND  ss.effective_from <= CURRENT_DATE
       ORDER BY ss.effective_from DESC
       LIMIT 1
     ) sal ON true
     WHERE s.school_id = $1
     ORDER BY sr.role_name ASC, s.full_name ASC`,
    [school_id]
  );
  return result.rows.map(r => ({
    ...r,
    current_salary: r.basic_salary != null
      ? { basic_salary: Number(r.basic_salary), effective_from: r.salary_effective_from }
      : null,
  }));
};

export const getStaffById = async (id: number, school_id: number): Promise<IStaff | null> => {
  const result = await pool.query(
    `SELECT ${STAFF_COLS}
     FROM staff s
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE s.id = $1 AND s.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateStaff = async (id: number, school_id: number, data: IUpdateStaff): Promise<IStaff | null> => {
  try {
    const result = await pool.query(
      `UPDATE staff SET
         staff_role_id   = COALESCE($1,  staff_role_id),
         full_name       = COALESCE($2,  full_name),
         phone           = COALESCE($3,  phone),
         address         = COALESCE($4,  address),
         gender          = COALESCE($5,  gender),
         date_of_birth   = COALESCE($6,  date_of_birth),
         joined_date     = COALESCE($7,  joined_date),
         status          = COALESCE($8,  status),
         photo           = COALESCE($9,  photo),
         citizen_id      = COALESCE($10, citizen_id),
         license_number  = COALESCE($11, license_number),
         updated_at      = NOW()
       WHERE id = $12 AND school_id = $13
       RETURNING
         id, school_id, staff_role_id, full_name, phone, address, gender,
         date_of_birth::text, joined_date::text, status, photo,
         to_jsonb(staff)->>'citizen_id' AS citizen_id,
         to_jsonb(staff)->>'license_number' AS license_number,
         created_at, updated_at`,
      [
        data.staff_role_id  || null,
        data.full_name      || null,
        data.phone          || null,
        data.address        || null,
        data.gender         || null,
        data.date_of_birth  || null,
        data.joined_date    || null,
        data.status         || null,
        data.photo          || null,
        data.citizen_id     || null,
        data.license_number || null,
        id,
        school_id,
      ]
    );
    return result.rows[0] || null;
  } catch (err: any) {
    if (err?.code === '42703') {
      const result = await pool.query(
        `UPDATE staff SET
           staff_role_id   = COALESCE($1,  staff_role_id),
           full_name       = COALESCE($2,  full_name),
           phone           = COALESCE($3,  phone),
           address         = COALESCE($4,  address),
           gender          = COALESCE($5,  gender),
           date_of_birth   = COALESCE($6,  date_of_birth),
           joined_date     = COALESCE($7,  joined_date),
           status          = COALESCE($8,  status),
           photo           = COALESCE($9,  photo),
           updated_at      = NOW()
         WHERE id = $10 AND school_id = $11
         RETURNING
           id, school_id, staff_role_id, full_name, phone, address, gender,
           date_of_birth::text, joined_date::text, status, photo, created_at, updated_at`,
        [
          data.staff_role_id  || null,
          data.full_name      || null,
          data.phone          || null,
          data.address        || null,
          data.gender         || null,
          data.date_of_birth  || null,
          data.joined_date    || null,
          data.status         || null,
          data.photo          || null,
          id,
          school_id,
        ]
      );
      return result.rows[0] || null;
    }
    throw err;
  }
};

export const deleteStaff = async (id: number, school_id: number): Promise<boolean> => {
  const result = await pool.query(
    `DELETE FROM staff WHERE id = $1 AND school_id = $2`,
    [id, school_id]
  );
  return (result.rowCount ?? 0) > 0;
};

// ── SALARY STRUCTURE ──────────────────────────────────────────────────────────

export const createSalaryStructure = async (school_id: number, data: ICreateSalaryStructure): Promise<IStaffSalaryStructure> => {
  const result = await pool.query(
    `INSERT INTO staff_salary_structure (school_id, staff_id, basic_salary, effective_from)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [school_id, data.staff_id, data.basic_salary, data.effective_from || new Date()]
  );
  return result.rows[0];
};

export const getSalaryStructureByStaff = async (staff_id: number, school_id: number): Promise<IStaffSalaryStructure[]> => {
  const result = await pool.query(
    `SELECT * FROM staff_salary_structure
     WHERE staff_id = $1 AND school_id = $2
     ORDER BY effective_from DESC`,
    [staff_id, school_id]
  );
  return result.rows;
};

export const getLatestSalaryStructure = async (staff_id: number, school_id: number): Promise<IStaffSalaryStructure | null> => {
  const result = await pool.query(
    `SELECT * FROM staff_salary_structure
     WHERE staff_id = $1 AND school_id = $2 AND effective_from <= CURRENT_DATE
     ORDER BY effective_from DESC LIMIT 1`,
    [staff_id, school_id]
  );
  return result.rows[0] || null;
};

export const updateSalaryStructure = async (id: number, school_id: number, data: IUpdateSalaryStructure): Promise<IStaffSalaryStructure | null> => {
  const result = await pool.query(
    `UPDATE staff_salary_structure SET
       basic_salary   = COALESCE($1, basic_salary),
       effective_from = COALESCE($2, effective_from),
       updated_at     = NOW()
     WHERE id = $3 AND school_id = $4 RETURNING *`,
    [data.basic_salary ?? null, data.effective_from || null, id, school_id]
  );
  return result.rows[0] || null;
};

// ── SALARY PAYMENTS ───────────────────────────────────────────────────────────

export const createSalaryPayment = async (school_id: number, data: ICreateSalaryPayment): Promise<IStaffSalaryPayment> => {
  const monthDate = data.salary_month.length === 7
    ? `${data.salary_month}-01`
    : data.salary_month;

  const result = await pool.query(
    `INSERT INTO staff_salary_payments
       (school_id, staff_id, salary_month, gross_amount, total_deductions,
        payment_method, paid_on, status, remarks,
        working_days, present_days, absent_days, half_days, leave_days, per_day_salary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *,
       net_amount,
       TO_CHAR(salary_month, 'YYYY-MM') AS salary_month_str,
       paid_on::text AS paid_on_str`,
    [
      school_id, data.staff_id, monthDate,
      data.gross_amount, data.total_deductions ?? 0,
      data.payment_method || null, data.paid_on || null,
      data.status || 'pending', data.remarks || null,
      data.working_days   ?? null,
      data.present_days   ?? null,
      data.absent_days    ?? null,
      data.half_days      ?? null,
      data.leave_days     ?? null,
      data.per_day_salary ?? null,
    ]
  );
  return result.rows[0];
};

export const getSalaryPaymentsByStaff = async (staff_id: number, school_id: number): Promise<IStaffSalaryPayment[]> => {
  const result = await pool.query(
    `SELECT *,
       net_amount,
       TO_CHAR(salary_month, 'YYYY-MM') AS salary_month_str,
       paid_on::text AS paid_on_str
     FROM staff_salary_payments
     WHERE staff_id = $1 AND school_id = $2
     ORDER BY salary_month DESC`,
    [staff_id, school_id]
  );
  return result.rows;
};

export const getAllSalaryPayments = async (school_id: number, month?: string): Promise<IStaffSalaryPayment[]> => {
  const params: any[] = [school_id];
  let monthFilter = '';
  if (month) {
    params.push(`${month}-01`);
    monthFilter = `AND sp.salary_month = $2`;
  }
  const result = await pool.query(
    `SELECT
       sp.*,
       sp.net_amount,
       TO_CHAR(sp.salary_month, 'YYYY-MM') AS salary_month_str,
       sp.paid_on::text AS paid_on_str,
       s.full_name,
       sr.role_name
     FROM staff_salary_payments sp
     LEFT JOIN staff s        ON s.id  = sp.staff_id
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE sp.school_id = $1 ${monthFilter}
     ORDER BY sp.salary_month DESC, s.full_name ASC`,
    params
  );
  return result.rows;
};

export const getPendingSalaries = async (school_id: number): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       sp.*,
       sp.net_amount,
       TO_CHAR(sp.salary_month, 'YYYY-MM') AS salary_month_str,
       sp.paid_on::text AS paid_on_str,
       s.full_name,
       sr.role_name
     FROM staff_salary_payments sp
     LEFT JOIN staff s        ON s.id  = sp.staff_id
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE sp.school_id = $1 AND sp.status = 'pending'
     ORDER BY sp.salary_month DESC`,
    [school_id]
  );
  return result.rows;
};

export const getSalaryPaymentById = async (id: number, school_id: number): Promise<IStaffSalaryPayment | null> => {
  const result = await pool.query(
    `SELECT
       sp.*,
       sp.net_amount,
       TO_CHAR(sp.salary_month, 'YYYY-MM') AS salary_month_str,
       sp.paid_on::text AS paid_on_str,
       s.full_name,
       sr.role_name
     FROM staff_salary_payments sp
     LEFT JOIN staff s        ON s.id  = sp.staff_id
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE sp.id = $1 AND sp.school_id = $2`,
    [id, school_id]
  );
  return result.rows[0] || null;
};

export const updateSalaryPayment = async (id: number, school_id: number, data: IUpdateSalaryPayment): Promise<IStaffSalaryPayment | null> => {
  const result = await pool.query(
    `UPDATE staff_salary_payments SET
       gross_amount     = COALESCE($1, gross_amount),
       total_deductions = COALESCE($2, total_deductions),
       payment_method   = COALESCE($3, payment_method),
       paid_on          = COALESCE($4, paid_on),
       status           = COALESCE($5, status),
       remarks          = COALESCE($6, remarks),
       updated_at       = NOW()
     WHERE id = $7 AND school_id = $8
     RETURNING *,
       net_amount,
       TO_CHAR(salary_month, 'YYYY-MM') AS salary_month_str,
       paid_on::text AS paid_on_str`,
    [
      data.gross_amount     ?? null,
      data.total_deductions ?? null,
      data.payment_method   || null,
      data.paid_on          || null,
      data.status           || null,
      data.remarks          || null,
      id, school_id,
    ]
  );
  return result.rows[0] || null;
};

// ── SALARY DEDUCTIONS ─────────────────────────────────────────────────────────

export const createDeductions = async (school_id: number, salary_payment_id: number, items: ICreateDeduction[]): Promise<IStaffSalaryDeduction[]> => {
  if (!items.length) return [];
  const values = items.map((_, i) => `($1, $2, $${i * 3 + 3}, $${i * 3 + 4}, $${i * 3 + 5})`).join(',');
  const params: any[] = [school_id, salary_payment_id];
  items.forEach(d => { params.push(d.deduction_type, d.amount, d.note || null); });
  const result = await pool.query(
    `INSERT INTO staff_salary_deductions (school_id, salary_payment_id, deduction_type, amount, note)
     VALUES ${values} RETURNING *`,
    params
  );
  return result.rows;
};

export const getDeductionsByPayment = async (salary_payment_id: number, school_id: number): Promise<IStaffSalaryDeduction[]> => {
  const result = await pool.query(
    `SELECT * FROM staff_salary_deductions
     WHERE salary_payment_id = $1 AND school_id = $2
     ORDER BY created_at ASC`,
    [salary_payment_id, school_id]
  );
  return result.rows;
};

export const deleteDeductionsByPayment = async (salary_payment_id: number, school_id: number): Promise<void> => {
  await pool.query(
    `DELETE FROM staff_salary_deductions WHERE salary_payment_id = $1 AND school_id = $2`,
    [salary_payment_id, school_id]
  );
};

// ── STAFF ATTENDANCE ──────────────────────────────────────────────────────────

export const markAttendance = async (school_id: number, data: ICreateAttendance): Promise<IStaffAttendance> => {
  const result = await pool.query(
    `INSERT INTO staff_attendance (school_id, staff_id, date, status, check_in, check_out, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (school_id, staff_id, date)
     DO UPDATE SET
       status    = EXCLUDED.status,
       check_in  = EXCLUDED.check_in,
       check_out = EXCLUDED.check_out,
       note      = EXCLUDED.note
     RETURNING *`,
    [school_id, data.staff_id, data.date, data.status,
     data.check_in || null, data.check_out || null, data.note || null]
  );
  return result.rows[0];
};

export const getAttendanceByDate = async (school_id: number, date: string): Promise<IStaffAttendance[]> => {
  const result = await pool.query(
    `SELECT sa.*, s.full_name, sr.role_name
     FROM staff_attendance sa
     LEFT JOIN staff s        ON s.id  = sa.staff_id
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     WHERE sa.school_id = $1 AND sa.date = $2
     ORDER BY sr.role_name ASC, s.full_name ASC`,
    [school_id, date]
  );
  return result.rows;
};

export const getAttendanceByStaff = async (staff_id: number, school_id: number, from: string, to: string): Promise<IStaffAttendance[]> => {
  const result = await pool.query(
    `SELECT * FROM staff_attendance
     WHERE staff_id = $1 AND school_id = $2 AND date BETWEEN $3 AND $4
     ORDER BY date DESC`,
    [staff_id, school_id, from, to]
  );
  return result.rows;
};

export const getMonthlyAbsentCount = async (staff_id: number, school_id: number, year: number, month: number): Promise<number> => {
  const result = await pool.query(
    `SELECT COUNT(*) FROM staff_attendance
     WHERE staff_id = $1 AND school_id = $2
       AND EXTRACT(YEAR  FROM date) = $3
       AND EXTRACT(MONTH FROM date) = $4
       AND status IN ('absent','half_day')`,
    [staff_id, school_id, year, month]
  );
  return parseInt(result.rows[0].count, 10);
};

export const getAttendanceSummaryByDateRange = async (
  staff_id:   number,
  school_id:  number,
  start_date: string,
  end_date:   string
): Promise<{
  present_days: number;
  absent_days:  number;
  half_days:    number;
  leave_days:   number;
  total_marked: number;
}> => {
  const result = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'present'  THEN 1 ELSE 0 END) AS present_days,
       SUM(CASE WHEN status = 'absent'   THEN 1 ELSE 0 END) AS absent_days,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_days,
       SUM(CASE WHEN status = 'leave'    THEN 1 ELSE 0 END) AS leave_days,
       COUNT(*)                                              AS total_marked
     FROM staff_attendance
     WHERE staff_id = $1 AND school_id = $2
       AND date BETWEEN $3 AND $4`,
    [staff_id, school_id, start_date, end_date]
  );
  const r = result.rows[0];
  return {
    present_days: parseInt(r.present_days ?? '0', 10),
    absent_days:  parseInt(r.absent_days  ?? '0', 10),
    half_days:    parseInt(r.half_days    ?? '0', 10),
    leave_days:   parseInt(r.leave_days   ?? '0', 10),
    total_marked: parseInt(r.total_marked ?? '0', 10),
  };
};

/**
 * Full attendance summary for a staff member in a given month.
 * Used by salary service to auto-calculate deductions from attendance.
 */
export const getMonthlyAttendanceSummary = async (
  staff_id:  number,
  school_id: number,
  year:      number,
  month:     number
): Promise<{
  present_days: number;
  absent_days:  number;
  half_days:    number;
  leave_days:   number;
  total_marked: number;
}> => {
  const result = await pool.query(
    `SELECT
       SUM(CASE WHEN status = 'present'  THEN 1 ELSE 0 END) AS present_days,
       SUM(CASE WHEN status = 'absent'   THEN 1 ELSE 0 END) AS absent_days,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_days,
       SUM(CASE WHEN status = 'leave'    THEN 1 ELSE 0 END) AS leave_days,
       COUNT(*)                                              AS total_marked
     FROM staff_attendance
     WHERE staff_id = $1 AND school_id = $2
       AND EXTRACT(YEAR  FROM date) = $3
       AND EXTRACT(MONTH FROM date) = $4`,
    [staff_id, school_id, year, month]
  );
  const r = result.rows[0];
  return {
    present_days: parseInt(r.present_days ?? '0', 10),
    absent_days:  parseInt(r.absent_days  ?? '0', 10),
    half_days:    parseInt(r.half_days    ?? '0', 10),
    leave_days:   parseInt(r.leave_days   ?? '0', 10),
    total_marked: parseInt(r.total_marked ?? '0', 10),
  };
};

export const updateAttendance = async (id: number, school_id: number, data: IUpdateAttendance): Promise<IStaffAttendance | null> => {
  const result = await pool.query(
    `UPDATE staff_attendance SET
       status    = COALESCE($1, status),
       check_in  = COALESCE($2, check_in),
       check_out = COALESCE($3, check_out),
       note      = COALESCE($4, note)
     WHERE id = $5 AND school_id = $6
     RETURNING *`,
    [data.status || null, data.check_in || null, data.check_out || null, data.note || null, id, school_id]
  );
  return result.rows[0] || null;
};

export const getStaffAndTeacherRegister = async (
  school_id: number,
  start_date: string,
  end_date: string
): Promise<any[]> => {
  const result = await pool.query(
    `SELECT
       'teacher' AS person_type,
       t.id AS person_id,
       t.full_name,
       t.phone,
       t.email,
       'Teacher' AS role_name,
       ta.date::text,
       ta.status,
       ta.note
     FROM teachers t
     LEFT JOIN teacher_attendance ta
       ON ta.teacher_id = t.id
      AND ta.school_id  = t.school_id
      AND ta.date BETWEEN $2 AND $3
     WHERE t.school_id = $1 AND t.status != 'inactive'

     UNION ALL

     SELECT
       'staff' AS person_type,
       s.id AS person_id,
       s.full_name,
       s.phone,
       NULL::text AS email,
       COALESCE(sr.role_name, 'Staff') AS role_name,
       sa.date::text,
       sa.status,
       sa.note
     FROM staff s
     LEFT JOIN staff_roles sr ON sr.id = s.staff_role_id
     LEFT JOIN staff_attendance sa
       ON sa.staff_id = s.id
      AND sa.school_id = s.school_id
      AND sa.date BETWEEN $2 AND $3
     WHERE s.school_id = $1 AND s.status != 'terminated'

     ORDER BY role_name ASC, full_name ASC`,
    [school_id, start_date, end_date]
  );
  return result.rows;
};

