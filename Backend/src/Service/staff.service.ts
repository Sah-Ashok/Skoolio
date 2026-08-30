import pool from '../config/db';
import AppError from '../utils/AppError';
import {
  ICreateStaffRole, IUpdateStaffRole,
  ICreateStaff, IUpdateStaff,
  ICreateSalaryStructure, IUpdateSalaryStructure,
  ICreateSalaryPayment, IUpdateSalaryPayment,
  ICreateDeduction,
  ICreateAttendance, IUpdateAttendance,
} from '../types/staff.types';
import {
  createStaffRole, getStaffRolesBySchool, getStaffRoleById, updateStaffRole, deleteStaffRole,
  createStaff, getStaffWithSalary, getStaffById, updateStaff, deleteStaff,
  createSalaryStructure, getSalaryStructureByStaff, getLatestSalaryStructure, updateSalaryStructure,
  createSalaryPayment, getSalaryPaymentsByStaff, getAllSalaryPayments, getPendingSalaries,
  getSalaryPaymentById, updateSalaryPayment,
  createDeductions, getDeductionsByPayment, deleteDeductionsByPayment,
  markAttendance, getAttendanceByDate, getAttendanceByStaff, updateAttendance,
  getMonthlyAbsentCount, getMonthlyAttendanceSummary, getAttendanceSummaryByDateRange,
  getStaffAndTeacherRegister,
} from '../Repositories/staff.repository';
import { getPayrollPolicyService } from './payroll_policy.service';
import { bsToISO, daysInBSMonth, isoToBS } from '../utils/bs-ad';

// ── STAFF ROLES ───────────────────────────────────────────────────────────────

export const createStaffRoleService = async (school_id: number, data: ICreateStaffRole) => {
  return createStaffRole(school_id, data);
};

export const getStaffRolesService = async (school_id: number) => {
  return getStaffRolesBySchool(school_id);
};

export const updateStaffRoleService = async (id: number, school_id: number, data: IUpdateStaffRole) => {
  const role = await updateStaffRole(id, school_id, data);
  if (!role) throw new AppError('Staff role not found.', 404);
  return role;
};

export const deleteStaffRoleService = async (id: number, school_id: number) => {
  try {
    const deleted = await deleteStaffRole(id, school_id);
    if (!deleted) throw new AppError('Staff role not found.', 404);
  } catch (err: any) {
    if (err.code === '23503') {
      throw new AppError('Cannot delete this role — it is still assigned to one or more staff members.', 400);
    }
    throw err;
  }
};

// ── STAFF MEMBERS ─────────────────────────────────────────────────────────────

export const createStaffService = async (school_id: number, data: ICreateStaff) => {
  const role = await getStaffRoleById(data.staff_role_id, school_id);
  if (!role) throw new AppError('Staff role not found.', 404);
  return createStaff(school_id, data);
};

export const getStaffService = async (school_id: number) => {
  return getStaffWithSalary(school_id);
};

export const getStaffByIdService = async (id: number, school_id: number) => {
  const staff = await getStaffById(id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  const salary  = await getLatestSalaryStructure(id, school_id);
  const history = await getSalaryStructureByStaff(id, school_id);
  return { ...staff, current_salary: salary, salary_history: history };
};

export const updateStaffService = async (id: number, school_id: number, data: IUpdateStaff) => {
  if (data.staff_role_id) {
    const role = await getStaffRoleById(data.staff_role_id, school_id);
    if (!role) throw new AppError('Staff role not found.', 404);
  }
  const staff = await updateStaff(id, school_id, data);
  if (!staff) throw new AppError('Staff member not found.', 404);
  return staff;
};

export const deleteStaffService = async (id: number, school_id: number) => {
  const staff = await getStaffById(id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  await deleteStaff(id, school_id);
};

// ── SALARY STRUCTURE ──────────────────────────────────────────────────────────

export const setSalaryStructureService = async (school_id: number, data: ICreateSalaryStructure) => {
  const staff = await getStaffById(data.staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  return createSalaryStructure(school_id, data);
};

export const getSalaryStructureService = async (staff_id: number, school_id: number) => {
  const staff = await getStaffById(staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  return getSalaryStructureByStaff(staff_id, school_id);
};

export const updateSalaryStructureService = async (id: number, school_id: number, data: IUpdateSalaryStructure) => {
  const record = await updateSalaryStructure(id, school_id, data);
  if (!record) throw new AppError('Salary structure record not found.', 404);
  return record;
};

// ── ATTENDANCE-BASED SALARY PREVIEW ──────────────────────────────────────────
/**
 * Called by the frontend "Pay Salary" modal before the admin submits.
 * Returns the attendance summary for the given month + the calculated
 * gross, deduction, and net amounts so the admin can review before saving.
 *
 * Formula:
 *   per_day   = basic_salary / working_days
 *   deduction = (absent_days + half_days × 0.5) × per_day
 *   gross     = basic_salary              (the assigned monthly salary)
 *   net       = gross - deduction
 *
 * working_days = total days marked in staff_attendance for the month
 *   (present + absent + half_day + leave).
 * Leave days are NOT deducted.
 */
export const getAttendanceForSalaryService = async (
  staff_id:  number,
  school_id: number,
  month:     string   // "YYYY-MM"
) => {
  const [staff, salary, policy, schoolRes] = await Promise.all([
    getStaffById(staff_id, school_id),
    getLatestSalaryStructure(staff_id, school_id),
    getPayrollPolicyService(school_id),
    pool.query('SELECT calendar_system FROM schools WHERE id = $1', [school_id]),
  ]);
  if (!staff) throw new AppError('Staff member not found.', 404);
  const isBS = (schoolRes.rows[0]?.calendar_system ?? 'AD') === 'BS';

  const [yearStr, monthStr] = month.split('-');
  const year  = parseInt(yearStr,  10);
  const mo    = parseInt(monthStr, 10);

  let startDateStr = '';
  let endDateStr   = '';
  let standardMonthDays = 30;

  if (isBS) {
    const bsYear  = year > 2050 ? year : isoToBS(`${month}-15`).year;
    const bsMonth = year > 2050 ? mo   : isoToBS(`${month}-15`).month;
    standardMonthDays = daysInBSMonth(bsYear, bsMonth);
    startDateStr = bsToISO({ year: bsYear, month: bsMonth, day: 1 });
    endDateStr   = bsToISO({ year: bsYear, month: bsMonth, day: standardMonthDays });
  } else {
    standardMonthDays = new Date(year, mo, 0).getDate();
    startDateStr = `${yearStr}-${String(mo).padStart(2, '0')}-01`;
    endDateStr   = `${yearStr}-${String(mo).padStart(2, '0')}-${String(standardMonthDays).padStart(2, '0')}`;
  }

  const att = await getAttendanceSummaryByDateRange(staff_id, school_id, startDateStr, endDateStr);

  const basic_salary  = salary ? Number(salary.basic_salary) : 0;
  const working_days  = att.total_marked > 0 ? att.total_marked : standardMonthDays;
  const per_day       = working_days > 0 ? basic_salary / working_days : 0;

  // Policy-aware deduction calculation
  const paidLeaveQuota = policy?.paid_leave_days_per_month ?? 0;
  const halfPayPct     = (policy?.half_day_pay_percent ?? 50) / 100;
  const unpaidLeave    = Math.max(0, att.leave_days - paidLeaveQuota);
  const absentDeduct   = per_day * att.absent_days;
  const halfDeduct     = per_day * (1 - halfPayPct) * att.half_days;
  const leaveDeduct    = per_day * unpaidLeave;
  const totalAttDeduct = Math.round((absentDeduct + halfDeduct + leaveDeduct) * 100) / 100;
  const net_salary     = Math.round((basic_salary - totalAttDeduct) * 100) / 100;

  return {
    staff_id,
    month,
    basic_salary,
    // attendance
    working_days: att.total_marked,
    present_days: att.present_days,
    absent_days:  att.absent_days,
    half_days:    att.half_days,
    leave_days:   att.leave_days,
    // calculated
    per_day_salary: Math.round(per_day * 100) / 100,
    absent_deduction: totalAttDeduct,
    gross_amount:   basic_salary,
    net_salary,
    // meta
    has_attendance: att.total_marked > 0,
    salary_set:     !!salary,
  };
};

// ── SALARY PAYMENTS ───────────────────────────────────────────────────────────

export const createSalaryPaymentService = async (school_id: number, data: ICreateSalaryPayment) => {
  const staff = await getStaffById(data.staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);

  const deductionItems: ICreateDeduction[] = data.deductions ?? [];
  const computedTotal    = deductionItems.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  const total_deductions = data.total_deductions ?? computedTotal;

  // If attendance fields were not provided by the caller, try to auto-fetch them
  let attFields = {
    working_days:   data.working_days,
    present_days:   data.present_days,
    absent_days:    data.absent_days,
    half_days:      data.half_days,
    leave_days:     data.leave_days,
    per_day_salary: data.per_day_salary,
  };

  if (attFields.working_days == null) {
    try {
      const [yearStr, monthStr] = data.salary_month.slice(0, 7).split('-');
      const att = await getMonthlyAttendanceSummary(
        data.staff_id, school_id,
        parseInt(yearStr, 10), parseInt(monthStr, 10)
      );
      const salary = await getLatestSalaryStructure(data.staff_id, school_id);
      const basic  = salary ? Number(salary.basic_salary) : Number(data.gross_amount);
      const wDays  = att.total_marked;
      const perDay = wDays > 0 ? basic / wDays : 0;
      attFields = {
        working_days:   wDays,
        present_days:   att.present_days,
        absent_days:    att.absent_days,
        half_days:      att.half_days,
        leave_days:     att.leave_days,
        per_day_salary: Math.round(perDay * 100) / 100,
      };
    } catch {
      // attendance data unavailable — proceed without it
    }
  }

  const payment = await createSalaryPayment(school_id, { ...data, total_deductions, ...attFields });

  if (deductionItems.length) {
    await createDeductions(school_id, payment.id, deductionItems);
  }

  const deductions = await getDeductionsByPayment(payment.id, school_id);
  return { ...payment, deductions };
};

export const getSalaryPaymentsService = async (staff_id: number, school_id: number) => {
  const staff = await getStaffById(staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  return getSalaryPaymentsByStaff(staff_id, school_id);
};

export const getAllSalaryPaymentsService = async (school_id: number, month?: string) => {
  return getAllSalaryPayments(school_id, month);
};

export const getPendingSalariesService = async (school_id: number) => {
  return getPendingSalaries(school_id);
};

export const getSalaryPaymentDetailService = async (id: number, school_id: number) => {
  const payment = await getSalaryPaymentById(id, school_id);
  if (!payment) throw new AppError('Salary payment not found.', 404);
  const deductions = await getDeductionsByPayment(id, school_id);
  return { ...payment, deductions };
};

export const updateSalaryPaymentService = async (
  id: number,
  school_id: number,
  data: IUpdateSalaryPayment,
  newDeductions?: ICreateDeduction[]
) => {
  let finalData = { ...data };

  if (newDeductions !== undefined) {
    await deleteDeductionsByPayment(id, school_id);
    if (newDeductions.length) {
      await createDeductions(school_id, id, newDeductions);
    }
    finalData.total_deductions = newDeductions.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
  }

  const payment = await updateSalaryPayment(id, school_id, finalData);
  if (!payment) throw new AppError('Salary payment not found.', 404);

  const deductions = await getDeductionsByPayment(id, school_id);
  return { ...payment, deductions };
};

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export const markAttendanceService = async (school_id: number, data: ICreateAttendance) => {
  const staff = await getStaffById(data.staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);
  return markAttendance(school_id, data);
};

export const bulkMarkAttendanceService = async (
  school_id: number,
  date: string,
  records: Array<{ staff_id: number; status: ICreateAttendance['status']; check_in?: string; check_out?: string; note?: string }>
) => {
  return Promise.all(records.map(r => markAttendance(school_id, { ...r, date })));
};

export const getAttendanceByDateService = async (school_id: number, date: string) => {
  return getAttendanceByDate(school_id, date);
};

export const getStaffAttendanceService = async (
  staff_id: number,
  school_id: number,
  from: string,
  to: string
) => {
  const staff = await getStaffById(staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);

  const records = await getAttendanceByStaff(staff_id, school_id, from, to);
  const summary = records.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  return { staff, records, summary };
};

export const updateAttendanceService = async (id: number, school_id: number, data: IUpdateAttendance) => {
  const record = await updateAttendance(id, school_id, data);
  if (!record) throw new AppError('Attendance record not found.', 404);
  return record;
};

export const getMonthlyAbsentCountService = async (
  staff_id: number,
  school_id: number,
  year: number,
  month: number
) => {
  return getMonthlyAbsentCount(staff_id, school_id, year, month);
};

export const getStaffAndTeacherRegisterService = async (
  school_id: number,
  start_date: string,
  end_date: string
) => {
  return getStaffAndTeacherRegister(school_id, start_date, end_date);
};

