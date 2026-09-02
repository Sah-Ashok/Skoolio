import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  createExamService, getExamsService, getExamByIdService, updateExamService, deleteExamService,
  createExamScheduleService, getExamSchedulesService, updateExamScheduleService, deleteExamScheduleService,
  createExamResultService, getClassResultsService, getStudentExamResultsService,
  getStudentAllResultsService, updateExamResultService, publishExamResultsService, unpublishExamResultsService,
  createGradeScaleService, getGradeScalesService, updateGradeScaleService, deleteGradeScaleService,
  getStudentExamSchedulesService, publishExamScheduleService,
} from '../Service/exam.service';

const resolveSchoolId = (req: Request): number => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  return 'school_id' in user ? user.school_id : user.id;
};

// ── EXAM CONTROLLERS (ADMIN) ──

export const createExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createExamService(school_id, req.body);
  sendResponse(res, 201, true, 'Exam created successfully', result);
});

export const getExams = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getExamsService(school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Exams fetched successfully', result);
});

export const getExamById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const result = await getExamByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Exam fetched successfully', result);
});

export const updateExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateExamService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Exam updated successfully', result);
});

export const deleteExam = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteExamService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Exam deleted successfully', null);
});

// ── EXAM SCHEDULE CONTROLLERS (ADMIN VIEW / CREATE, FACULTY CAN VIEW) ──

export const createExamSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createExamScheduleService(school_id, req.body);
  sendResponse(res, 201, true, 'Exam schedule created successfully', result);
});

export const getExamSchedules = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const result = await getExamSchedulesService(Number(req.params.examId), school_id);
  sendResponse(res, 200, true, 'Exam schedules fetched successfully', result);
});

export const updateExamSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateExamScheduleService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Exam schedule updated successfully', result);
});

export const deleteExamSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteExamScheduleService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Exam schedule deleted successfully', null);
});

// ── EXAM RESULT CONTROLLERS (ADMIN + FACULTY enter marks) ──

export const createExamResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const isFaculty = 'school_id' in user;
  const entered_by = isFaculty ? user.id : undefined;
  // P1: pass teacher id so service can enforce class_subject_teachers assignment
  const requester_teacher_id = isFaculty ? user.id : undefined;
  const result = await createExamResultService(
    school_id,
    { ...req.body, entered_by: req.body.entered_by ?? entered_by },
    requester_teacher_id
  );
  sendResponse(res, 201, true, 'Result entered successfully', result);
});

export const getClassResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const result = await getClassResultsService(
    Number(req.params.examId),
    Number(req.params.classId),
    school_id
  );
  sendResponse(res, 200, true, 'Class results fetched successfully', result);
});

export const getStudentExamResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const result = await getStudentExamResultsService(
    Number(req.params.studentId),
    Number(req.params.examId),
    school_id
  );
  sendResponse(res, 200, true, 'Student exam results fetched successfully', result);
});

export const getStudentAllResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getStudentAllResultsService(
    Number(req.params.id),
    school_id,
    Number(academic_year_id)
  );
  sendResponse(res, 200, true, 'Student results fetched successfully', result);
});

export const updateExamResult = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  const isFaculty = 'school_id' in user;
  // P1: pass teacher id so service can enforce class_subject_teachers assignment
  const requester_teacher_id = isFaculty ? user.id : undefined;
  const result = await updateExamResultService(Number(req.params.id), school_id, req.body, requester_teacher_id);
  sendResponse(res, 200, true, 'Result updated successfully', result);
});

export const publishExamResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { exam_id, class_id } = req.body;
  const result = await publishExamResultsService(exam_id, class_id, school_id);
  sendResponse(res, 200, true, 'Results published successfully', result);
});

export const unpublishExamResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const { exam_id, class_id } = req.body;
  const result = await unpublishExamResultsService(exam_id, class_id, school_id);
  sendResponse(res, 200, true, 'Results unpublished successfully', result);
});

// ── GRADE SCALE CONTROLLERS (ADMIN) ──

export const createGradeScale = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await createGradeScaleService(school_id, req.body);
  sendResponse(res, 201, true, 'Grade scale created successfully', result);
});

export const getGradeScales = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = resolveSchoolId(req);
  const result = await getGradeScalesService(school_id);
  sendResponse(res, 200, true, 'Grade scales fetched successfully', result);
});

export const updateGradeScale = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const result = await updateGradeScaleService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Grade scale updated successfully', result);
});

export const deleteGradeScale = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteGradeScaleService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Grade scale deleted successfully', null);
});

// ── SELF-SERVICE CONTROLLERS (STUDENT'S OWN RESULTS) ──

export const getMyResults = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { academic_year_id } = req.query;
  if (!academic_year_id) {
    return sendResponse(res, 400, false, 'academic_year_id is required', null);
  }
  const result = await getStudentAllResultsService(id, school_id, Number(academic_year_id));
  sendResponse(res, 200, true, 'Your results fetched successfully', result);
});

export const getMyExamSchedules = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id, school_id } = req.user as IJwtUserPayload;
  const { academic_year_id } = req.query;
  const result = await getStudentExamSchedulesService(
    id,
    school_id,
    academic_year_id ? Number(academic_year_id) : undefined
  );
  sendResponse(res, 200, true, 'Your exam schedules fetched successfully', result);
});

export const publishExamSchedule = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const examId = Number(req.params.id);
  const is_published = req.body.is_published !== undefined ? Boolean(req.body.is_published) : true;
  const result = await publishExamScheduleService(examId, school_id, is_published);
  sendResponse(res, 200, true, is_published ? 'Exam schedule published successfully' : 'Exam schedule unpublished successfully', result);
});
