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

router.use(protect, restrictTo('admin', 'super_admin'));

// ── Staff Roles ───────────────────────────────────────────────────────────────
router.post  ('/roles',       createStaffRole);
router.get   ('/roles',       getStaffRoles);
router.patch ('/roles/:id',   updateStaffRole);
router.delete('/roles/:id',   deleteStaffRole);

// ── Salary Structure ──────────────────────────────────────────────────────────
// NOTE: these must come BEFORE /:id routes to avoid param collision
router.post  ('/salary/structure',      setSalaryStructure);
router.patch ('/salary/structure/:id',  updateSalaryStructure);

// ── Salary Payments ───────────────────────────────────────────────────────────
// IMPORTANT: static segments (/pending) must be registered BEFORE dynamic /:id
router.post  ('/salary/payments',          createSalaryPayment);
router.get   ('/salary/payments/pending',  getPendingSalaries);     // ← BEFORE /:id
router.get   ('/salary/payments',          getAllSalaryPayments);    // ?month=YYYY-MM
router.get   ('/salary/payments/:id',      getSalaryPaymentDetail);
router.patch ('/salary/payments/:id',      updateSalaryPayment);

// ── Attendance ────────────────────────────────────────────────────────────────
// static /bulk and /attendance must come BEFORE /:id
router.post('/attendance/bulk',  bulkMarkAttendance);
router.post('/attendance',       markAttendance);
router.get ('/attendance',       getAttendanceByDate);   // ?date=YYYY-MM-DD
router.patch('/attendance/:id',  updateAttendance);

// ── Staff Members ─────────────────────────────────────────────────────────────
// NOTE: these /:id routes come LAST — they would swallow /roles, /salary, /attendance
router.post  ('/',      createStaff);
router.get   ('/',      getStaff);
router.get   ('/:id',   getStaffById);
router.patch ('/:id',   updateStaff);
router.delete('/:id',   deleteStaff);

// ── Per-staff sub-resources (nested under /:id) ───────────────────────────────
router.get('/:id/salary/structure',   getSalaryStructure);
router.get('/:id/salary/payments',    getStaffSalaryPayments);
router.get('/:id/attendance',         getStaffAttendance);        // ?from=&to=
router.get('/:id/attendance/absents', getMonthlyAbsents);         // ?year=&month=

export default router;
