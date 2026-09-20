import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createCalendarService, getCalendarService, updateCalendarService,
  createCalendarEventService, getCalendarEventsService,
  updateCalendarEventService, deleteCalendarEventService,
  getWeeklyOffsService, setWeeklyOffsService,
  calculateWorkingDays,
} from '../Service/calendar.service';
import { getActiveAcademicYear } from '../Repositories/academic.repository';

// Helper — resolves school_id from any JWT shape (admin, faculty, student)
const resolveSchoolId = (user: any): number => {
  if (user && 'school_id' in user && user.school_id) {
    return Number(user.school_id);
  }
  return Number(user?.id || 0);
};

// ── CALENDAR CONTROLLERS ──

export const createCalendar = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createCalendarService(school_id, req.body);
  sendResponse(res, 201, true, 'Calendar created successfully', result);
});

export const getCalendar = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req.user);
  let { academic_year_id } = req.query as any;
  if (!academic_year_id) {
    const activeYear = await getActiveAcademicYear(school_id);
    if (activeYear) {
      academic_year_id = activeYear.id;
    }
  }
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getCalendarService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Calendar fetched successfully', result);
});

export const updateCalendar = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateCalendarService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Calendar updated successfully', result);
});

// ── CALENDAR EVENT CONTROLLERS ──

export const createCalendarEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createCalendarEventService(school_id, req.body);
  sendResponse(res, 201, true, 'Calendar event created successfully', result);
});

export const getCalendarEvents = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req.user);
  const result = await getCalendarEventsService(Number(req.params.calendarId), school_id);
  sendResponse(res, 200, true, 'Calendar events fetched successfully', result);
});

export const updateCalendarEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateCalendarEventService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Calendar event updated successfully', result);
});

export const deleteCalendarEvent = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteCalendarEventService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Calendar event deleted successfully', null);
});

// ── WORKING DAYS CONTROLLER ──

export const getWorkingDays = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req.user);
  const { academic_year_id, start_date, end_date } = req.query;

  if (!academic_year_id || !start_date || !end_date) {
    return sendResponse(res, 400, false, 'academic_year_id, start_date and end_date are required', null);
  }

  const result = await calculateWorkingDays(
    school_id,
    Number(academic_year_id),
    String(start_date),
    String(end_date)
  );
  sendResponse(res, 200, true, 'Working days calculated successfully', result);
});

// ── CALENDAR WEEKLY OFF CONTROLLERS ──

export const getCalendarWeeklyOffs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req.user);
  const result = await getWeeklyOffsService(Number(req.params.calendarId), school_id);
  sendResponse(res, 200, true, 'Weekly off days fetched successfully', result);
});

export const setCalendarWeeklyOffs = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await setWeeklyOffsService(Number(req.params.calendarId), school_id, req.body.offs);
  sendResponse(res, 200, true, 'Weekly off days updated successfully', result);
});