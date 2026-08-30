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

router.use(protect, restrictTo('admin', 'super_admin'));

// ── Staff Roles ───────────────────────────────────────────────────────────────
router.post  ('/roles',       createStaffRole);
router.get   ('/roles',       getStaffRoles);
router.patch ('/roles/:id',   updateStaffRole);
router.delete('/roles/:id',   deleteStaffRole);

// ── Salary Structure ──────────────────────────────────────────────────────────
router.post  ('/salary/structure',      setSalaryStructure);
router.patch ('/salary/structure/:id',  updateSalaryStructure);

// ── Salary Payments ───────────────────────────────────────────────────────────
// IMPORTANT: all static sub-paths BEFORE dynamic /:id
router.get  ('/salary/attendance-preview', getAttendanceForSalary);  // ?staff_id=X&month=YYYY-MM
router.post ('/salary/payments',           createSalaryPayment);
router.get  ('/salary/payments/pending',   getPendingSalaries);
router.get  ('/salary/payments',           getAllSalaryPayments);     // ?month=YYYY-MM
router.get  ('/salary/payments/:id',       getSalaryPaymentDetail);
router.patch('/salary/payments/:id',       updateSalaryPayment);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get  ('/attendance/register', getStaffRegister);      // ?start_date=&end_date=
router.post ('/attendance/bulk',     bulkMarkAttendance);
router.post ('/attendance',          markAttendance);
router.get  ('/attendance',          getAttendanceByDate);   // ?date=YYYY-MM-DD
router.patch('/attendance/:id',      updateAttendance);

// ── Staff Members (dynamic /:id last — avoids swallowing static paths) ────────
router.post  ('/',      createStaff);
router.get   ('/',      getStaff);
router.get   ('/:id',   getStaffById);
router.patch ('/:id',   updateStaff);
router.delete('/:id',   deleteStaff);

// ── Per-staff sub-resources ───────────────────────────────────────────────────
router.get('/:id/salary/structure',   getSalaryStructure);
router.get('/:id/salary/payments',    getStaffSalaryPayments);
router.get('/:id/attendance',         getStaffAttendance);        // ?from=&to=
router.get('/:id/attendance/absents', getMonthlyAbsents);         // ?year=&month=

export default router;
