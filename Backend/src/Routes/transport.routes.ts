import { Router } from 'express';
import protect    from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createVehicle, getVehicles, getVehicleById, updateVehicle, deleteVehicle,
  createRoute, getRoutes, getRouteById, updateRoute, deleteRoute,
  createStop, getStops, updateStop, deleteStop,
  assignStudent, getRouteAssignments, updateAssignment,
  getStudentTransport, getSummary,
} from '../Controllers/transport.controller';

const router = Router();
router.use(protect);

// ── Summary ──
router.get('/summary', restrictTo('admin', 'super_admin'), getSummary);

// ── Vehicles ──
router.get   ('/vehicles',     restrictTo('admin', 'super_admin'), getVehicles);
router.post  ('/vehicles',     restrictTo('admin', 'super_admin'), createVehicle);
router.get   ('/vehicles/:id', restrictTo('admin', 'super_admin'), getVehicleById);
router.patch ('/vehicles/:id', restrictTo('admin', 'super_admin'), updateVehicle);
router.delete('/vehicles/:id', restrictTo('admin', 'super_admin'), deleteVehicle);

// ── Routes ──
router.get   ('/routes',     restrictTo('admin', 'super_admin'), getRoutes);
router.post  ('/routes',     restrictTo('admin', 'super_admin'), createRoute);
router.get   ('/routes/:id', restrictTo('admin', 'super_admin', 'faculty', 'student'), getRouteById);
router.patch ('/routes/:id', restrictTo('admin', 'super_admin'), updateRoute);
router.delete('/routes/:id', restrictTo('admin', 'super_admin'), deleteRoute);

// ── Stops ──
router.get   ('/routes/:routeId/stops', restrictTo('admin', 'super_admin', 'faculty', 'student'), getStops);
router.post  ('/stops',     restrictTo('admin', 'super_admin'), createStop);
router.patch ('/stops/:id', restrictTo('admin', 'super_admin'), updateStop);
router.delete('/stops/:id', restrictTo('admin', 'super_admin'), deleteStop);

// ── Assignments ──
router.post  ('/assignments',              restrictTo('admin', 'super_admin'), assignStudent);
router.get   ('/routes/:routeId/students', restrictTo('admin', 'super_admin'), getRouteAssignments);
router.patch ('/assignments/:id',          restrictTo('admin', 'super_admin'), updateAssignment);

// ── Student self-service ──
router.get('/students/:studentId', restrictTo('admin', 'super_admin', 'student'), getStudentTransport);

export default router;
