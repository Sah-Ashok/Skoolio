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
  createStaff, getStaffBySchool, getStaffById, updateStaff, deleteStaff,
  createSalaryStructure, getSalaryStructureByStaff, getLatestSalaryStructure, updateSalaryStructure,
  createSalaryPayment, getSalaryPaymentsByStaff, getAllSalaryPayments, getPendingSalaries,
  getSalaryPaymentById, updateSalaryPayment,
  createDeductions, getDeductionsByPayment, deleteDeductionsByPayment,
  markAttendance, getAttendanceByDate, getAttendanceByStaff, updateAttendance, getMonthlyAbsentCount,
} from '../Repositories/staff.repository';

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
  // Guard: role in use?
  const deleted = await deleteStaffRole(id, school_id);
  if (!deleted) throw new AppError('Staff role not found or is still assigned to staff members.', 404);
};

// ── STAFF MEMBERS ─────────────────────────────────────────────────────────────

export const createStaffService = async (school_id: number, data: ICreateStaff) => {
  const role = await getStaffRoleById(data.staff_role_id, school_id);
  if (!role) throw new AppError('Staff role not found.', 404);
  return createStaff(school_id, data);
};

export const getStaffService = async (school_id: number) => {
  return getStaffBySchool(school_id);
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

// ── SALARY PAYMENTS ───────────────────────────────────────────────────────────

export const createSalaryPaymentService = async (school_id: number, data: ICreateSalaryPayment) => {
  const staff = await getStaffById(data.staff_id, school_id);
  if (!staff) throw new AppError('Staff member not found.', 404);

  // Sum deduction line items if provided
  const deductionItems: ICreateDeduction[] = data.deductions ?? [];
  const computedTotal = deductionItems.reduce((acc, d) => acc + (d.amount || 0), 0);
  const total_deductions = data.total_deductions ?? computedTotal;

  const payment = await createSalaryPayment(school_id, { ...data, total_deductions });

  // Insert deduction line items
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
  const payment = await updateSalaryPayment(id, school_id, data);
  if (!payment) throw new AppError('Salary payment not found.', 404);

  // Replace deductions if provided
  if (newDeductions) {
    await deleteDeductionsByPayment(id, school_id);
    const total = newDeductions.reduce((acc, d) => acc + (d.amount || 0), 0);
    await createDeductions(school_id, id, newDeductions);
    // Sync total_deductions
    await updateSalaryPayment(id, school_id, { total_deductions: total });
  }

  const deductions = await getDeductionsByPayment(id, school_id);
  const fresh = await getSalaryPaymentById(id, school_id);
  return { ...fresh, deductions };
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
  const results = await Promise.all(
    records.map(r => markAttendance(school_id, { ...r, date }))
  );
  return results;
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

  // Summary counts
  const summary = records.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
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
