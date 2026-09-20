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
import { adToBS, bsToISO, daysInBSMonth } from '../utils/bs-ad';
import pool from '../config/db';

// Setup Default Active Academic Year (current year only)
export const setupDefaultAcademicYear = async (
  school_id: number,
  country?: string,
  calendar_system?: string
) => {
  const existing = await getActiveAcademicYear(school_id);
  if (existing) return existing;

  let finalCountry = country;
  let finalCalendar = calendar_system;
  if (!finalCountry || !finalCalendar) {
    try {
      const sc = await pool.query('SELECT country, calendar_system FROM schools WHERE id = $1', [school_id]);
      if (sc.rows[0]) {
        finalCountry = sc.rows[0].country;
        finalCalendar = sc.rows[0].calendar_system;
      }
    } catch {
      // fallback to defaults
    }
  }

  const isBS = (finalCalendar === 'BS') || (finalCountry?.toLowerCase() === 'nepal');

  let year_name: string;
  let start_date: string;
  let end_date: string;
  let description: string;

  if (isBS) {
    const bsNow = adToBS(new Date());
    const bsYear = bsNow.year;
    const nextBsYear = bsYear + 1;
    year_name = `${bsYear}-${nextBsYear} BS`;
    start_date = bsToISO({ year: bsYear, month: 1, day: 1 });
    const lastDay = daysInBSMonth(bsYear, 12);
    end_date = bsToISO({ year: bsYear, month: 12, day: lastDay });
    description = `Academic Year ${year_name}`;
  } else {
    // Indian / AD session (April 1 to March 31)
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1; // 1-12
    const startYear = curMonth >= 4 ? curYear : curYear - 1;
    const endYear = startYear + 1;
    year_name = `${startYear}-${endYear}`;
    start_date = `${startYear}-04-01`;
    end_date = `${endYear}-03-31`;
    description = `Academic Year ${year_name}`;
  }

  return await createAcademicYear(school_id, {
    year_name,
    start_date,
    end_date,
    status: 'active',
    description,
  });
};

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
  let years = await getAcademicYearsBySchool(school_id);
  if (years.length === 0) {
    const defaultYear = await setupDefaultAcademicYear(school_id);
    if (defaultYear) years = [defaultYear];
  }
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
  let year = await getActiveAcademicYear(school_id);
  if (!year) {
    const all = await getAcademicYearsBySchool(school_id);
    if (all.length === 0) {
      year = await setupDefaultAcademicYear(school_id);
    } else {
      year = all[0];
    }
  }
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