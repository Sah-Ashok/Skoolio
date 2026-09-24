import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  getStreams,
  createStream,
  updateStream,
  deleteStream,
} from '../Controllers/stream.controller';

const router = Router();

router.use(protect);

router.get('/', getStreams);
router.post('/', restrictTo('admin', 'super_admin'), createStream);
router.put('/:id', restrictTo('admin', 'super_admin'), updateStream);
router.delete('/:id', restrictTo('admin', 'super_admin'), deleteStream);

export default router;
