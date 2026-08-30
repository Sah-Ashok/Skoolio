import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import { DayOfWeek } from '../types/timetable.types';
import {
  getSectionTimetableService,
  saveBulkSectionTimetableService,
  saveSingleSlotService,
  deleteSlotService,
  getTeacherScheduleService,
  getStudentScheduleService,
  checkConflictService,
} from '../Service/timetable.service';

export const getSectionTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const section_id = parseInt(String(req.params.sectionId), 10);
    const academic_year_id = req.query.academic_year_id
      ? parseInt(String(req.query.academic_year_id), 10)
      : undefined;

    const timetable = await getSectionTimetableService(school_id, section_id, academic_year_id);
    sendResponse(res, 200, true, 'Section timetable fetched successfully', timetable);
  }
);

export const saveBulkSectionTimetable = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const user_role = user.role;
    const user_id = user.id;
    const section_id = parseInt(String(req.params.sectionId), 10);

    const payload = {
      ...req.body,
      section_id,
    };

    const result = await saveBulkSectionTimetableService(school_id, user_role, user_id, payload);
    sendResponse(res, 200, true, 'Section timetable saved successfully', result);
  }
);

export const saveSlot = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const user_role = user.role;
    const user_id = user.id;

    const result = await saveSingleSlotService(school_id, user_role, user_id, req.body);
    sendResponse(res, 200, true, 'Timetable slot saved successfully', result);
  }
);

export const deleteSlot = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const slot_id = parseInt(String(req.params.id), 10);

    await deleteSlotService(school_id, slot_id);
    sendResponse(res, 200, true, 'Timetable slot deleted successfully', null);
  }
);

export const getMyTeacherSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtUserPayload;
    const school_id = user.school_id;
    const teacher_id = user.id;
    const academic_year_id = req.query.academic_year_id
      ? parseInt(String(req.query.academic_year_id), 10)
      : undefined;

    const schedule = await getTeacherScheduleService(school_id, teacher_id, academic_year_id);
    sendResponse(res, 200, true, 'Teacher schedule fetched successfully', schedule);
  }
);

export const getTeacherScheduleById = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const teacher_id = parseInt(String(req.params.teacherId), 10);
    const academic_year_id = req.query.academic_year_id
      ? parseInt(String(req.query.academic_year_id), 10)
      : undefined;

    const schedule = await getTeacherScheduleService(school_id, teacher_id, academic_year_id);
    sendResponse(res, 200, true, 'Teacher schedule fetched successfully', schedule);
  }
);

export const getMyStudentSchedule = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtUserPayload;
    const school_id = user.school_id;
    const student_id = user.id;

    const schedule = await getStudentScheduleService(school_id, student_id);
    sendResponse(res, 200, true, 'Student timetable fetched successfully', schedule);
  }
);

export const checkConflict = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IJwtAdminPayload | IJwtUserPayload;
    const school_id = 'school_id' in user ? user.school_id : user.id;
    const {
      teacher_id,
      day_of_week,
      start_time,
      end_time,
      academic_year_id,
      exclude_section_id,
      exclude_slot_id,
    } = req.query as any;

    if (!teacher_id || !day_of_week || !start_time || !end_time) {
      return sendResponse(res, 400, false, 'teacher_id, day_of_week, start_time, and end_time are required', null);
    }

    const conflict = await checkConflictService(
      school_id,
      parseInt(String(teacher_id), 10),
      day_of_week as DayOfWeek,
      String(start_time),
      String(end_time),
      academic_year_id ? parseInt(String(academic_year_id), 10) : undefined,
      exclude_section_id ? parseInt(String(exclude_section_id), 10) : undefined,
      exclude_slot_id ? parseInt(String(exclude_slot_id), 10) : undefined
    );

    sendResponse(res, 200, true, 'Conflict check completed', conflict);
  }
);
