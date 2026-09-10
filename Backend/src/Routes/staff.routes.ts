import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createStaffRole, getStaffRoles, updateStaffRole, deleteStaffRole,
  createStaff, getStaff, getStaffById, updateStaff, deleteStaff,
  setSalaryStructure, getSalaryStructure, updateSalaryStructure,
  createSalaryPayment, getStaffSalaryPayments, getAllSalaryPayments,
  getPendingSalaries, getSalaryPaymentDetail, updateSalaryPayment,
  getAttendanceForSalary,
  markAttendance, bulkMarkAttendance, getAttendanceByDate,
  getStaffAttendance, updateAttendance, getMonthlyAbsents,
  getStaffRegister,
} from '../Controllers/staff.controller';

const router = Router();

router.use(protect);

// ── Staff Roles ───────────────────────────────────────────────────────────────
router.post  ('/roles',       restrictTo('admin', 'super_admin'), createStaffRole);
router.get   ('/roles',       restrictTo('admin', 'super_admin', 'finance'), getStaffRoles);
router.patch ('/roles/:id',   restrictTo('admin', 'super_admin'), updateStaffRole);
router.delete('/roles/:id',   restrictTo('admin', 'super_admin'), deleteStaffRole);

// ── Salary Structure ──────────────────────────────────────────────────────────
router.post  ('/salary/structure',      restrictTo('admin', 'super_admin'), setSalaryStructure);
router.patch ('/salary/structure/:id',  restrictTo('admin', 'super_admin'), updateSalaryStructure);

// ── Salary Payments ───────────────────────────────────────────────────────────
// IMPORTANT: all static sub-paths BEFORE dynamic /:id
router.get  ('/salary/attendance-preview', restrictTo('admin', 'super_admin', 'finance'), getAttendanceForSalary);  // ?staff_id=X&month=YYYY-MM
router.post ('/salary/payments',           restrictTo('admin', 'super_admin', 'finance'), createSalaryPayment);
router.get  ('/salary/payments/pending',   restrictTo('admin', 'super_admin', 'finance'), getPendingSalaries);
router.get  ('/salary/payments',           restrictTo('admin', 'super_admin', 'finance'), getAllSalaryPayments);     // ?month=YYYY-MM
router.get  ('/salary/payments/:id',       restrictTo('admin', 'super_admin', 'finance'), getSalaryPaymentDetail);
router.patch('/salary/payments/:id',       restrictTo('admin', 'super_admin', 'finance'), updateSalaryPayment);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get  ('/attendance/register', restrictTo('admin', 'super_admin', 'finance'), getStaffRegister);      // ?start_date=&end_date=
router.post ('/attendance/bulk',     restrictTo('admin', 'super_admin'), bulkMarkAttendance);
router.post ('/attendance',          restrictTo('admin', 'super_admin'), markAttendance);
router.get  ('/attendance',          restrictTo('admin', 'super_admin', 'finance'), getAttendanceByDate);   // ?date=YYYY-MM-DD
router.patch('/attendance/:id',      restrictTo('admin', 'super_admin'), updateAttendance);

// ── Staff Members (dynamic /:id last — avoids swallowing static paths) ────────
router.post  ('/',      restrictTo('admin', 'super_admin'), createStaff);
router.get   ('/',      restrictTo('admin', 'super_admin', 'finance'), getStaff);
router.get   ('/:id',   restrictTo('admin', 'super_admin', 'finance'), getStaffById);
router.patch ('/:id',   restrictTo('admin', 'super_admin'), updateStaff);
router.delete('/:id',   restrictTo('admin', 'super_admin'), deleteStaff);

// ── Per-staff sub-resources ───────────────────────────────────────────────────
router.get('/:id/salary/structure',   restrictTo('admin', 'super_admin', 'finance'), getSalaryStructure);
router.get('/:id/salary/payments',    restrictTo('admin', 'super_admin', 'finance'), getStaffSalaryPayments);
router.get('/:id/attendance',         restrictTo('admin', 'super_admin', 'finance'), getStaffAttendance);        // ?from=&to=
router.get('/:id/attendance/absents', restrictTo('admin', 'super_admin', 'finance'), getMonthlyAbsents);         // ?year=&month=

export default router;
