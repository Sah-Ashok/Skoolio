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
  getMonthlyAbsentCountService,
} from '../Service/staff.service';

// ── STAFF ROLES ───────────────────────────────────────────────────────────────

export const createStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const role = await createStaffRoleService(school_id, req.body);
  sendResponse(res, 201, true, 'Staff role created successfully', role);
});

export const getStaffRoles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const roles = await getStaffRolesService(school_id);
  sendResponse(res, 200, true, 'Staff roles fetched successfully', roles);
});

export const updateStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const role = await updateStaffRoleService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Staff role updated successfully', role);
});

export const deleteStaffRole = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteStaffRoleService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff role deleted successfully', null);
});

// ── STAFF MEMBERS ─────────────────────────────────────────────────────────────

export const createStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const staff = await createStaffService(school_id, req.body);
  sendResponse(res, 201, true, 'Staff member created successfully', staff);
});

export const getStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const staff = await getStaffService(school_id);
  sendResponse(res, 200, true, 'Staff fetched successfully', staff);
});

export const getStaffById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const staff = await getStaffByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff member fetched successfully', staff);
});

export const updateStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const staff = await updateStaffService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Staff member updated successfully', staff);
});

export const deleteStaff = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteStaffService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Staff member deleted successfully', null);
});

// ── SALARY STRUCTURE ──────────────────────────────────────────────────────────

export const setSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const record = await setSalaryStructureService(school_id, req.body);
  sendResponse(res, 201, true, 'Salary structure set successfully', record);
});

export const getSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const records = await getSalaryStructureService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary structure fetched successfully', records);
});

export const updateSalaryStructure = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const record = await updateSalaryStructureService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Salary structure updated successfully', record);
});

// ── SALARY PAYMENTS ───────────────────────────────────────────────────────────

export const createSalaryPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const payment = await createSalaryPaymentService(school_id, req.body);
  sendResponse(res, 201, true, 'Salary payment recorded successfully', payment);
});

export const getStaffSalaryPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const payments = await getSalaryPaymentsService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary payments fetched successfully', payments);
});

export const getAllSalaryPayments = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const month = req.query.month as string | undefined;  // 'YYYY-MM'
  const payments = await getAllSalaryPaymentsService(school_id, month);
  sendResponse(res, 200, true, 'All salary payments fetched successfully', payments);
});

export const getPendingSalaries = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const pending = await getPendingSalariesService(school_id);
  sendResponse(res, 200, true, 'Pending salaries fetched successfully', pending);
});

export const getSalaryPaymentDetail = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const payment = await getSalaryPaymentDetailService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Salary payment detail fetched successfully', payment);
});

export const updateSalaryPayment = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { deductions, ...rest } = req.body;
  const payment = await updateSalaryPaymentService(Number(req.params.id), school_id, rest, deductions);
  sendResponse(res, 200, true, 'Salary payment updated successfully', payment);
});

// ── ATTENDANCE ────────────────────────────────────────────────────────────────

export const markAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const record = await markAttendanceService(school_id, req.body);
  sendResponse(res, 201, true, 'Attendance marked successfully', record);
});

export const bulkMarkAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { date, records } = req.body;
  const results = await bulkMarkAttendanceService(school_id, date, records);
  sendResponse(res, 200, true, 'Bulk attendance marked successfully', results);
});

export const getAttendanceByDate = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const date = req.query.date as string || new Date().toISOString().split('T')[0];
  const records = await getAttendanceByDateService(school_id, date);
  sendResponse(res, 200, true, 'Attendance fetched successfully', records);
});

export const getStaffAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { from, to } = req.query as { from: string; to: string };
  const data = await getStaffAttendanceService(Number(req.params.id), school_id, from, to);
  sendResponse(res, 200, true, 'Staff attendance fetched successfully', data);
});

export const updateAttendance = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const record = await updateAttendanceService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Attendance updated successfully', record);
});

export const getMonthlyAbsents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { year, month } = req.query as { year: string; month: string };
  const count = await getMonthlyAbsentCountService(Number(req.params.id), school_id, Number(year), Number(month));
  sendResponse(res, 200, true, 'Monthly absent count fetched', { absent_days: count });
});
