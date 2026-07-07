import {
  createAcademicYear,
  getAcademicYearsBySchool,
  getAcademicYearById,
  getActiveAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
} from '../Repositories/academic.repository';
import { ICreateAcademicYear, IUpdateAcademicYear } from '../types/academic.types';
import AppError from '../utils/AppError';

// Create Academic Year
export const createAcademicYearService = async (
  school_id: number,
  data: ICreateAcademicYear
) => {
  // 1. If new year is active, check no other active year exists
  if (data.status === 'active') {
    const existing = await getActiveAcademicYear(school_id);
    if (existing) {
      throw new AppError(
        `Academic year "${existing.year_name}" is already active. Please complete it first.`,
        400
      );
    }
  }

  // 2. Validate dates
  if (new Date(data.start_date) >= new Date(data.end_date)) {
    throw new AppError('Start date must be before end date.', 400);
  }

  // 3. Create
  const academicYear = await createAcademicYear(school_id, data);
  return academicYear;
};

// Get All Academic Years
export const getAcademicYearsService = async (school_id: number) => {
  const years = await getAcademicYearsBySchool(school_id);
  return years;
};

// Get Single Academic Year
export const getAcademicYearByIdService = async (
  id: number,
  school_id: number
) => {
  const year = await getAcademicYearById(id, school_id);
  if (!year) {
    throw new AppError('Academic year not found.', 404);
  }
  return year;
};

// Get Active Academic Year
export const getActiveAcademicYearService = async (school_id: number) => {
  const year = await getActiveAcademicYear(school_id);
  if (!year) {
    throw new AppError('No active academic year found.', 404);
  }
  return year;
};

// Update Academic Year
export const updateAcademicYearService = async (
  id: number,
  school_id: number,
  data: IUpdateAcademicYear
) => {
  // If updating to active, check no other active year exists
  if (data.status === 'active') {
    const existing = await getActiveAcademicYear(school_id);
    if (existing && existing.id !== id) {
      throw new AppError(
        `Academic year "${existing.year_name}" is already active. Please complete it first.`,
        400
      );
    }
  }

  // Validate dates if both provided
  if (data.start_date && data.end_date) {
    if (new Date(data.start_date) >= new Date(data.end_date)) {
      throw new AppError('Start date must be before end date.', 400);
    }
  }

  const year = await updateAcademicYear(id, school_id, data);
  if (!year) {
    throw new AppError('Academic year not found.', 404);
  }
  return year;
};

// Delete Academic Year
export const deleteAcademicYearService = async (
  id: number,
  school_id: number
) => {
  // Cannot delete active year
  const year = await getAcademicYearById(id, school_id);
  if (!year) {
    throw new AppError('Academic year not found.', 404);
  }

  if (year.status === 'active') {
    throw new AppError('Cannot delete an active academic year.', 400);
  }

  const deleted = await deleteAcademicYear(id, school_id);
  if (!deleted) {
    throw new AppError('Failed to delete academic year.', 500);
  }
};