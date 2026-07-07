import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  createAcademicYearService,
  getAcademicYearsService,
  getAcademicYearByIdService,
  getActiveAcademicYearService,
  updateAcademicYearService,
  deleteAcademicYearService,
} from '../Service/academic.service';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';

// Create Academic Year
export const createAcademicYear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const academicYear = await createAcademicYearService(school_id, req.body);
  sendResponse(res, 201, true, 'Academic year created successfully', academicYear);
});

// Get All Academic Years
export const getAcademicYears = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const years = await getAcademicYearsService(school_id);
  sendResponse(res, 200, true, 'Academic years fetched successfully', years);
});

// Get Single Academic Year
export const getAcademicYearById = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const year = await getAcademicYearByIdService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Academic year fetched successfully', year);
});

// Get Active Academic Year — accessible to admin, faculty, and student
export const getActiveAcademicYear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  // Admin JWT: school_id = user.id  |  Faculty/Student JWT: school_id = user.school_id
  const school_id = 'school_id' in user ? user.school_id : user.id;
  const year = await getActiveAcademicYearService(school_id);
  sendResponse(res, 200, true, 'Active academic year fetched successfully', year);
});

// Update Academic Year
export const updateAcademicYear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const year = await updateAcademicYearService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Academic year updated successfully', year);
});

// Delete Academic Year
export const deleteAcademicYear = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  await deleteAcademicYearService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, 'Academic year deleted successfully', null);
});