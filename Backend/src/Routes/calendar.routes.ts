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
// ── CALENDAR ROUTES ──
router.post('/',           protect, restrictTo('admin'),                                       createCalendar);
router.get('/',            protect, restrictTo('admin','super_admin','faculty','student'),      getCalendar);
router.patch('/:id',       protect, restrictTo('admin'),                                       updateCalendar);

// ── WEEKLY OFF ROUTES ──
router.get('/:calendarId/weekly-offs',  protect, restrictTo('admin','super_admin','faculty','student'), getCalendarWeeklyOffs);
router.put('/:calendarId/weekly-offs',  protect, restrictTo('admin'),                                    setCalendarWeeklyOffs);

// ── CALENDAR EVENT ROUTES ──
router.post('/events',          protect, restrictTo('admin'),                                    createCalendarEvent);
router.get('/:calendarId/events', protect, restrictTo('admin','super_admin','faculty','student'), getCalendarEvents);
router.patch('/events/:id',     protect, restrictTo('admin'),                                    updateCalendarEvent);
router.delete('/events/:id',    protect, restrictTo('admin'),                                    deleteCalendarEvent);

// ── WORKING DAYS ROUTE ──
router.get('/working-days', protect, restrictTo('admin','super_admin','faculty','student'),     getWorkingDays);

export default router;
