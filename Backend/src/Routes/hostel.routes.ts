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
router.get('/summary', restrictTo('admin', 'super_admin'), getSummary);

// ── Hostels ──
router.get   ('/',     restrictTo('admin', 'super_admin'), getHostels);
router.post  ('/',     restrictTo('admin', 'super_admin'), createHostel);
router.get   ('/:id',  restrictTo('admin', 'super_admin'), getHostelById);
router.patch ('/:id',  restrictTo('admin', 'super_admin'), updateHostel);
router.delete('/:id',  restrictTo('admin', 'super_admin'), deleteHostel);

// ── Rooms ──
router.get   ('/:hostelId/rooms', restrictTo('admin', 'super_admin'), getRooms);
router.post  ('/rooms',           restrictTo('admin', 'super_admin'), createRoom);
router.patch ('/rooms/:id',       restrictTo('admin', 'super_admin'), updateRoom);
router.delete('/rooms/:id',       restrictTo('admin', 'super_admin'), deleteRoom);

// ── Assignments ──
router.post  ('/assignments',                restrictTo('admin', 'super_admin'), assignStudent);
router.get   ('/:hostelId/students',         restrictTo('admin', 'super_admin'), getHostelAssignments);
router.get   ('/rooms/:roomId/students',     restrictTo('admin', 'super_admin'), getRoomAssignments);
router.patch ('/assignments/:id',            restrictTo('admin', 'super_admin'), updateAssignment);

// ── Student self-service ──
router.get('/students/:studentId', restrictTo('admin', 'super_admin', 'student'), getStudentHostel);

export default router;
