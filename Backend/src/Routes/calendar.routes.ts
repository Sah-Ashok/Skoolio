import { Router } from 'express';
import protect from '../middlewares/auth.middleware';
import restrictTo from '../middlewares/role.middleware';
import {
  createCalendar, getCalendar, updateCalendar,
  createCalendarEvent, getCalendarEvents,
  updateCalendarEvent, deleteCalendarEvent,
  getWorkingDays,
  getCalendarWeeklyOffs, setCalendarWeeklyOffs,
} from '../Controllers/calendar.controller';

const router = Router();

router.use(protect, restrictTo('admin', 'super_admin'));

// ── CALENDAR ROUTES ──
router.post('/', createCalendar);
router.get('/', getCalendar);
router.patch('/:id', updateCalendar);

// ── WEEKLY OFF ROUTES ──
router.get('/:calendarId/weekly-offs', getCalendarWeeklyOffs);
router.put('/:calendarId/weekly-offs', setCalendarWeeklyOffs);

// ── CALENDAR EVENT ROUTES ──
router.post('/events', createCalendarEvent);
router.get('/:calendarId/events', getCalendarEvents);
router.patch('/events/:id', updateCalendarEvent);
router.delete('/events/:id', deleteCalendarEvent);

// ── WORKING DAYS ROUTE ──
router.get('/working-days', getWorkingDays);

export default router;
