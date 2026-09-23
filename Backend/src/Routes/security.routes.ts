import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import {
  get2FASetup,
  enable2FA,
  disable2FA,
  getSecurityOverview,
  getUserDevices,
  revokeDevice,
  verify2FAChallenge,
  getTrafficStats,
  getSecurityEvents,
  getBannedIpsList,
  banIpAddress,
  unbanIpAddress,
  updateMaintenanceMode,
  updateAnnouncement,
  syncBlockedSchoolsState,
} from '../Controllers/security.controller';
import {
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  listUserPasskeys,
  deletePasskey,
} from '../Controllers/passkey.controller';

const router = Router();

// Public 2FA login challenge verification endpoint
router.post('/2fa/verify-challenge', verify2FAChallenge);

// Protected security dashboard endpoints
router.use(protect);

// Heartbeat keep-alive endpoint (maintains active presence in Redis)
router.all('/heartbeat', (req, res) => {
  res.status(200).json({ success: true, message: 'Heartbeat recorded' });
});

router.get('/overview', getSecurityOverview);
router.get('/2fa/setup', get2FASetup);
router.post('/2fa/enable', enable2FA);
router.post('/2fa/disable', disable2FA);

router.get('/devices', getUserDevices);
router.delete('/devices/:id', revokeDevice);

// Super Admin platform traffic, threats, and Redis controls
router.get('/traffic-stats', getTrafficStats);
router.get('/events', getSecurityEvents);
router.get('/banned-ips', getBannedIpsList);
router.post('/ban-ip', banIpAddress);
router.delete('/unban-ip/:ip', unbanIpAddress);
router.post('/maintenance', updateMaintenanceMode);
router.post('/announcement', updateAnnouncement);
router.post('/sync-blocked-schools', syncBlockedSchoolsState);

// Passkey registration & management
router.get('/passkey/register-options', getPasskeyRegistrationOptions);
router.post('/passkey/verify-register', verifyPasskeyRegistration);
router.get('/passkey/list', listUserPasskeys);
router.delete('/passkey/:id', deletePasskey);

export default router;
