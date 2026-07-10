import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getStudentsForPromotionService,
  bulkPromoteService,
  getSectionsForClassService,
} from '../Service/promotion.service';

// ── PROMOTION CONTROLLERS ───────────────────────────────────────────────────

/**
 * GET /api/promotion/students
 * Query: academic_year_id, class_id
 * Returns students in that class with their promotion status.
 */
export const getStudentsForPromotion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id: school_id } = req.user as IJwtAdminPayload;
    const { academic_year_id, class_id } = req.query;

    if (!academic_year_id || !class_id) {
      return sendResponse(res, 400, false, 'academic_year_id and class_id are required', null);
    }

    const data = await getStudentsForPromotionService(
      school_id,
      Number(academic_year_id),
      Number(class_id)
    );

    sendResponse(res, 200, true, 'Students fetched for promotion', data);
  }
);

/**
 * POST /api/promotion/bulk
 * Body: { source_academic_year_id, target_academic_year_id, rows: [...] }
 * Promotes selected students to the next year in bulk.
 */
export const bulkPromote = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id: school_id } = req.user as IJwtAdminPayload;
    const result = await bulkPromoteService(school_id, req.body);

    const message =
      result.promoted > 0
        ? `${result.promoted} student(s) promoted to ${result.target_year} successfully.`
        : 'No students were promoted.';

    sendResponse(res, 200, true, message, result);
  }
);

/**
 * GET /api/promotion/sections
 * Query: class_id
 * Returns sections for a target class — used to populate section dropdown.
 */
export const getSectionsForClass = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id: school_id } = req.user as IJwtAdminPayload;
    const { class_id } = req.query;

    if (!class_id) {
      return sendResponse(res, 400, false, 'class_id is required', null);
    }

    const sections = await getSectionsForClassService(school_id, Number(class_id));
    sendResponse(res, 200, true, 'Sections fetched', sections);
  }
);
