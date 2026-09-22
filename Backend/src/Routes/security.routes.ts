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
} from '../Controllers/security.controller';

const router = Router();

// Public 2FA login challenge verification endpoint
router.post('/2fa/verify-challenge', verify2FAChallenge);

// Protected security dashboard endpoints
router.use(protect);

router.get('/overview', getSecurityOverview);
router.get('/2fa/setup', get2FASetup);
router.post('/2fa/enable', enable2FA);
router.post('/2fa/disable', disable2FA);

router.get('/devices', getUserDevices);
router.delete('/devices/:id', revokeDevice);

export default router;
