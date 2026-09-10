import { Router } from 'express';
import protect    from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createHostel, getHostels, getHostelById, updateHostel, deleteHostel,
  createRoom, getRooms, updateRoom, deleteRoom,
  assignStudent, getHostelAssignments, getRoomAssignments,
  updateAssignment, getStudentHostel, getSummary,
} from '../Controllers/hostel.controller';

const router = Router();
router.use(protect);

// ── Summary ──
router.get('/summary', restrictTo('admin', 'super_admin', 'finance'), getSummary);

// ── Hostels ──
router.get   ('/',     restrictTo('admin', 'super_admin', 'finance'), getHostels);
router.post  ('/',     restrictTo('admin', 'super_admin', 'finance'), createHostel);
router.get   ('/:id',  restrictTo('admin', 'super_admin', 'finance'), getHostelById);
router.patch ('/:id',  restrictTo('admin', 'super_admin', 'finance'), updateHostel);
router.delete('/:id',  restrictTo('admin', 'super_admin', 'finance'), deleteHostel);

// ── Rooms ──
router.get   ('/:hostelId/rooms', restrictTo('admin', 'super_admin', 'finance'), getRooms);
router.post  ('/rooms',           restrictTo('admin', 'super_admin', 'finance'), createRoom);
router.patch ('/rooms/:id',       restrictTo('admin', 'super_admin', 'finance'), updateRoom);
router.delete('/rooms/:id',       restrictTo('admin', 'super_admin', 'finance'), deleteRoom);

// ── Assignments ──
router.post  ('/assignments',                restrictTo('admin', 'super_admin', 'finance'), assignStudent);
router.get   ('/:hostelId/students',         restrictTo('admin', 'super_admin', 'finance'), getHostelAssignments);
router.get   ('/rooms/:roomId/students',     restrictTo('admin', 'super_admin', 'finance'), getRoomAssignments);
router.patch ('/assignments/:id',            restrictTo('admin', 'super_admin', 'finance'), updateAssignment);

// ── Student self-service ──
router.get('/students/:studentId', restrictTo('admin', 'super_admin', 'student', 'finance'), getStudentHostel);

export default router;
