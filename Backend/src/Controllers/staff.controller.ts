import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  createStaffRoleService, getStaffRolesService, updateStaffRoleService, deleteStaffRoleService,
  createStaffService, getStaffService, getStaffByIdService, updateStaffService, deleteStaffService,
  setSalaryStructureService, getSalaryStructureService, updateSalaryStructureService,
  createSalaryPaymentService, getSalaryPaymentsService, getAllSalaryPaymentsService,
  getPendingSalariesService, getSalaryPaymentDetailService, updateSalaryPaymentService,
  markAttendanceService, bulkMarkAttendanceService,
  getAttendanceByDateService, getStaffAttendanceService, updateAttendanceService,
  getMonthlyAbsentCountService, getAttendanceForSalaryService,
  getStaffAndTeacherRegisterService,
} from '../Service/staff.service';

const getSchoolId = (req: Request): number => {
  const user = req.user as any;
  return user?.school_id || user?.id;
};

// ── STAFF ROLES ───────────────────────────────────────────────────────────────

export const createStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const role = await createStaffRoleService(school_id, req.body);
  sendResponse(res, 201, true, 'Staff role created successfully', role);
});

export const getStaffRoles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const roles = await getStaffRolesService(school_id);
  sendResponse(res, 200, true, 'Staff roles fetched successfully', roles);
});

export const updateStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const role = await updateStaffRoleService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Staff role updated successfully', role);
});

export const deleteStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  await deleteStaffRoleService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff role deleted successfully', null);
});

// ── STAFF MEMBERS ─────────────────────────────────────────────────────────────

export const createStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const staff = await createStaffService(school_id, req.body);
  sendResponse(res, 201, true, 'Staff member created successfully', staff);
});

export const getStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const staff = await getStaffService(school_id);
  sendResponse(res, 200, true, 'Staff fetched successfully', staff);
});

export const getStaffById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const staff = await getStaffByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff member fetched successfully', staff);
});

export const updateStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const staff = await updateStaffService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Staff member updated successfully', staff);
});

export const deleteStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  await deleteStaffService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff member deleted successfully', null);
});

// ── SALARY STRUCTURE ──────────────────────────────────────────────────────────

export const setSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const record = await setSalaryStructureService(school_id, req.body);
  sendResponse(res, 201, true, 'Salary structure set successfully', record);
});

export const getSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const records = await getSalaryStructureService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary structure fetched successfully', records);
});

export const updateSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const record = await updateSalaryStructureService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Salary structure updated successfully', record);
});

// ── SALARY PAYMENTS ───────────────────────────────────────────────────────────

export const createSalaryPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const payment = await createSalaryPaymentService(school_id, req.body);
  sendResponse(res, 201, true, 'Salary payment recorded successfully', payment);
});

export const getStaffSalaryPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const payments = await getSalaryPaymentsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary payments fetched successfully', payments);
});

export const getAllSalaryPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const month = req.query.month as string | undefined;
  const payments = await getAllSalaryPaymentsService(school_id, month);
  sendResponse(res, 200, true, 'All salary payments fetched successfully', payments);
});

export const getPendingSalaries = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const pending = await getPendingSalariesService(school_id);
  sendResponse(res, 200, true, 'Pending salaries fetched successfully', pending);
});

export const getSalaryPaymentDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const payment = await getSalaryPaymentDetailService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary payment detail fetched successfully', payment);
});

export const updateSalaryPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { deductions, ...rest } = req.body;
  const payment = await updateSalaryPaymentService(Number(req.params.id), school_id, rest, deductions);
  sendResponse(res, 200, true, 'Salary payment updated successfully', payment);
});

// GET /staff/salary/attendance-preview?staff_id=X&month=YYYY-MM
export const getAttendanceForSalary = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { staff_id, month } = req.query as { staff_id: string; month: string };
  if (!staff_id || !month) {
    return sendResponse(res, 400, false, 'staff_id and month (YYYY-MM) are required', null);
  }
  const preview = await getAttendanceForSalaryService(Number(staff_id), school_id, month);
  sendResponse(res, 200, true, 'Attendance salary preview fetched', preview);
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export const markAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const record = await markAttendanceService(school_id, req.body);
  sendResponse(res, 201, true, 'Attendance marked successfully', record);
});

export const bulkMarkAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { date, records } = req.body;
  const results = await bulkMarkAttendanceService(school_id, date, records);
  sendResponse(res, 200, true, 'Bulk attendance marked successfully', results);
});

export const getAttendanceByDate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const date = req.query.date as string || new Date().toISOString().split('T')[0];
  const records = await getAttendanceByDateService(school_id, date);
  sendResponse(res, 200, true, 'Attendance fetched successfully', records);
});

export const getStaffAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { from, to } = req.query as { from: string; to: string };
  const data = await getStaffAttendanceService(Number(req.params.id), school_id, from, to);
  sendResponse(res, 200, true, 'Staff attendance fetched successfully', data);
});

export const updateAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const record = await updateAttendanceService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Attendance updated successfully', record);
});

export const getMonthlyAbsents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { year, month } = req.query as { year: string; month: string };
  const count = await getMonthlyAbsentCountService(Number(req.params.id), school_id, Number(year), Number(month));
  sendResponse(res, 200, true, 'Monthly absent count fetched', { absent_days: count });
});

export const getStaffRegister = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = getSchoolId(req);
  const { start_date, end_date } = req.query as { start_date: string; end_date: string };
  if (!start_date || !end_date) {
    return sendResponse(res, 400, false, 'start_date and end_date (YYYY-MM-DD) are required', null);
  }
  const rows = await getStaffAndTeacherRegisterService(school_id, start_date, end_date);
  sendResponse(res, 200, true, 'Staff attendance register fetched successfully', rows);
});

