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
router.get('/summary', restrictTo('admin', 'super_admin', 'finance'), getSummary);

// ── Vehicles ──
router.get   ('/vehicles',     restrictTo('admin', 'super_admin', 'finance'), getVehicles);
router.post  ('/vehicles',     restrictTo('admin', 'super_admin', 'finance'), createVehicle);
router.get   ('/vehicles/:id', restrictTo('admin', 'super_admin', 'finance'), getVehicleById);
router.patch ('/vehicles/:id', restrictTo('admin', 'super_admin', 'finance'), updateVehicle);
router.delete('/vehicles/:id', restrictTo('admin', 'super_admin', 'finance'), deleteVehicle);

// ── Routes ──
router.get   ('/routes',     restrictTo('admin', 'super_admin', 'finance'), getRoutes);
router.post  ('/routes',     restrictTo('admin', 'super_admin', 'finance'), createRoute);
router.get   ('/routes/:id', restrictTo('admin', 'super_admin', 'faculty', 'student', 'finance'), getRouteById);
router.patch ('/routes/:id', restrictTo('admin', 'super_admin', 'finance'), updateRoute);
router.delete('/routes/:id', restrictTo('admin', 'super_admin', 'finance'), deleteRoute);

// ── Stops ──
router.get   ('/routes/:routeId/stops', restrictTo('admin', 'super_admin', 'faculty', 'student', 'finance'), getStops);
router.post  ('/stops',     restrictTo('admin', 'super_admin', 'finance'), createStop);
router.patch ('/stops/:id', restrictTo('admin', 'super_admin', 'finance'), updateStop);
router.delete('/stops/:id', restrictTo('admin', 'super_admin', 'finance'), deleteStop);

// ── Assignments ──
router.post  ('/assignments',              restrictTo('admin', 'super_admin', 'finance'), assignStudent);
router.get   ('/routes/:routeId/students', restrictTo('admin', 'super_admin', 'finance'), getRouteAssignments);
router.patch ('/assignments/:id',          restrictTo('admin', 'super_admin', 'finance'), updateAssignment);

// ── Student self-service ──
router.get('/students/:studentId', restrictTo('admin', 'super_admin', 'student', 'finance'), getStudentTransport);

export default router;
