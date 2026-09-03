import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getTrafficStats,
  getSecurityEvents,
  getBannedIpsController,
  banIpController,
  unbanIpController,
  getMaintenanceController,
  setMaintenanceController,
  getAnnouncementController,
  setAnnouncementController,
  syncBlockedSchoolsController,
} from '../Controllers/security.controller';

const router = Router();

// Publicly readable announcement (for banners across portals)
router.get('/public-announcement', getAnnouncementController);

// Heartbeat endpoint: any authenticated user (admin, teacher, student, super_admin) can ping to refresh their active Redis session
router.post('/heartbeat', protect, (req, res) => {
  res.json({ success: true, timestamp: Date.now() });
});

// All other endpoints require super_admin
router.use(protect, restrictTo('super_admin'));

router.get('/traffic-stats',         getTrafficStats);
router.get('/events',                getSecurityEvents);
router.get('/banned-ips',            getBannedIpsController);
router.post('/ban-ip',               banIpController);
router.delete('/unban-ip/:ip',       unbanIpController);
router.get('/maintenance',          getMaintenanceController);
router.post('/maintenance',         setMaintenanceController);
router.get('/announcement',           getAnnouncementController);
router.post('/announcement',          setAnnouncementController);
router.post('/sync-blocked-schools', syncBlockedSchoolsController);

export default router;
