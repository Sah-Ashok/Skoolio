import {
  getEnrollmentsForPromotion,
  bulkPromoteStudents,
  getPromotionSummary,
  PromotionRow,
} from '../Repositories/promotion.repository';
import { getAcademicYearById } from '../Repositories/academic.repository';
import { getClassById, getSectionsByClass } from '../Repositories/class.repository';
import AppError from '../utils/AppError';

// ── PROMOTION SERVICE ───────────────────────────────────────────────────────

/**
 * Return the list of students in a class for the given academic year,
 * annotated with their current promotion status.
 */
export const getStudentsForPromotionService = async (
  school_id: number,
  academic_year_id: number,
  class_id: number
) => {
  // Validate the academic year and class belong to this school
  const year = await getAcademicYearById(academic_year_id, school_id);
  if (!year) throw new AppError('Academic year not found.', 404);

  const cls = await getClassById(class_id, school_id);
  if (!cls) throw new AppError('Class not found.', 404);

  const students = await getEnrollmentsForPromotion(school_id, academic_year_id, class_id);
  const summary  = await getPromotionSummary(school_id, academic_year_id, class_id);

  return {
    academic_year: year,
    class: cls,
    students,
    summary,
  };
};

export interface BulkPromotePayload {
  source_academic_year_id: number;
  target_academic_year_id: number;
  rows: Array<{
    enrollment_id: number;
    student_id: number;
    target_class_id: number;
    target_section_id: number;
    stream?: string;
    roll_number?: string;
  }>;
}

/**
 * Validate inputs then delegate to the repository for the actual DB work.
 */
export const bulkPromoteService = async (
  school_id: number,
  payload: BulkPromotePayload
) => {
  const { source_academic_year_id, target_academic_year_id, rows } = payload;

  if (!rows || rows.length === 0) {
    throw new AppError('No students selected for promotion.', 400);
  }

  if (source_academic_year_id === target_academic_year_id) {
    throw new AppError('Source and target academic years must be different.', 400);
  }

  // Validate both years exist and belong to this school
  const sourceYear = await getAcademicYearById(source_academic_year_id, school_id);
  if (!sourceYear) throw new AppError('Source academic year not found.', 404);

  const targetYear = await getAcademicYearById(target_academic_year_id, school_id);
  if (!targetYear) throw new AppError('Target academic year not found.', 404);

  // Validate all target classes + sections belong to the target year / school
  const uniqueClassIds = [...new Set(rows.map(r => r.target_class_id))];
  for (const cid of uniqueClassIds) {
    const cls = await getClassById(cid, school_id);
    if (!cls) throw new AppError(`Target class ${cid} not found.`, 404);
    if (cls.academic_year_id !== target_academic_year_id) {
      throw new AppError(
        `Class "${cls.name}" does not belong to the target academic year.`,
        400
      );
    }
  }

  const result = await bulkPromoteStudents(
    school_id,
    source_academic_year_id,
    target_academic_year_id,
    rows as PromotionRow[]
  );

  return {
    ...result,
    source_year: sourceYear.year_name,
    target_year: targetYear.year_name,
  };
};

/**
 * Return all sections for a given class — used by the frontend to populate
 * the "target section" dropdown per student row.
 */
export const getSectionsForClassService = async (
  school_id: number,
  class_id: number
) => {
  const cls = await getClassById(class_id, school_id);
  if (!cls) throw new AppError('Class not found.', 404);
  const sections = await getSectionsByClass(class_id, school_id);
  return sections;
};
