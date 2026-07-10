import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createStaffRole, getStaffRoles, updateStaffRole, deleteStaffRole,
  createStaff, getStaff, getStaffById, updateStaff, deleteStaff,
  setSalaryStructure, getSalaryStructure, updateSalaryStructure,
  createSalaryPayment, getStaffSalaryPayments, getAllSalaryPayments,
  getPendingSalaries, getSalaryPaymentDetail, updateSalaryPayment,
  markAttendance, bulkMarkAttendance, getAttendanceByDate,
  getStaffAttendance, updateAttendance, getMonthlyAbsents,
} from '../Controllers/staff.controller';

const router = Router();

// All routes require admin / super_admin
router.use(protect, restrictTo('admin', 'super_admin'));

// ── Staff Roles ───────────────────────────────────────────────────────────────
router.post('/roles',        createStaffRole);
router.get('/roles',         getStaffRoles);
router.patch('/roles/:id',   updateStaffRole);
router.delete('/roles/:id',  deleteStaffRole);

// ── Staff Members ─────────────────────────────────────────────────────────────
router.post('/',       createStaff);
router.get('/',        getStaff);
router.get('/:id',     getStaffById);
router.patch('/:id',   updateStaff);
router.delete('/:id',  deleteStaff);

// ── Salary Structure ──────────────────────────────────────────────────────────
router.post('/salary/structure',       setSalaryStructure);
router.get('/:id/salary/structure',    getSalaryStructure);
router.patch('/salary/structure/:id',  updateSalaryStructure);

// ── Salary Payments ───────────────────────────────────────────────────────────
router.post('/salary/payments',           createSalaryPayment);
router.get('/salary/payments',            getAllSalaryPayments);    // ?month=YYYY-MM
router.get('/salary/payments/pending',    getPendingSalaries);
router.get('/salary/payments/:id',        getSalaryPaymentDetail);
router.patch('/salary/payments/:id',      updateSalaryPayment);
router.get('/:id/salary/payments',        getStaffSalaryPayments);

// ── Attendance ────────────────────────────────────────────────────────────────
router.post('/attendance',           markAttendance);
router.post('/attendance/bulk',      bulkMarkAttendance);
router.get('/attendance',            getAttendanceByDate);          // ?date=YYYY-MM-DD
router.patch('/attendance/:id',      updateAttendance);
router.get('/:id/attendance',        getStaffAttendance);           // ?from=&to=
router.get('/:id/attendance/absents', getMonthlyAbsents);           // ?year=&month=

export default router;
