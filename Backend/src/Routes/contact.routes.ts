import { Router } from 'express';
import { submitContact } from '../Controllers/contact.controller';

const router = Router();

// Public — no auth required
router.post('/', submitContact);

export default router;
