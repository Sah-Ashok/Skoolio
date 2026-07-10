import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getHistoryService,
  getDistinctModulesService,
  purgeSchoolHistoryService,
  purgeAllHistoryService,
} from '../Service/history.service';

// ── SCHOOL ADMIN ──

/**
 * GET /api/history
 * School admin views their own school's activity logs (last 3 months).
 * Query params: module, action, actor_role, from_date, to_date, page, limit
 */
export const getHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;

  const {
    module,
    action,
    actor_role,
    from_date,
    to_date,
    page,
    limit,
  } = req.query;

  const result = await getHistoryService({
    school_id,
    module:     module     as string | undefined,
    action:     action     as string | undefined,
    actor_role: actor_role as string | undefined,
    from_date:  from_date  as string | undefined,
    to_date:    to_date    as string | undefined,
    page:       page  ? Number(page)  : 1,
    limit:      limit ? Number(limit) : 50,
  });

  sendResponse(res, 200, true, 'Activity logs fetched', result);
});

/**
 * GET /api/history/modules
 * Returns distinct module names for the filter dropdown.
 */
export const getHistoryModules = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: school_id } = req.user as IJwtAdminPayload;
  const modules = await getDistinctModulesService(school_id);
  sendResponse(res, 200, true, 'Modules fetched', modules);
});

// ── SUPER ADMIN ──

/**
 * GET /api/history/school/:school_id
 * Super admin can view any school's logs.
 */
export const getHistoryForSchool = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = Number(req.params.school_id);
  const { module, action, actor_role, from_date, to_date, page, limit } = req.query;

  const result = await getHistoryService({
    school_id,
    module:     module     as string | undefined,
    action:     action     as string | undefined,
    actor_role: actor_role as string | undefined,
    from_date:  from_date  as string | undefined,
    to_date:    to_date    as string | undefined,
    page:       page  ? Number(page)  : 1,
    limit:      limit ? Number(limit) : 50,
  });

  sendResponse(res, 200, true, 'Activity logs fetched', result);
});

/**
 * DELETE /api/history/school/:school_id/purge
 * Super admin purges logs older than 3 months for a specific school.
 */
export const purgeSchoolHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const school_id = Number(req.params.school_id);
  const result = await purgeSchoolHistoryService(school_id);
  sendResponse(res, 200, true, `Purged ${result.deleted} old log(s) for school ${school_id}`, result);
});

/**
 * DELETE /api/history/purge-all
 * Super admin purges logs older than 3 months across all schools.
 */
export const purgeAllHistory = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const result = await purgeAllHistoryService();
  sendResponse(res, 200, true, `Purged ${result.deleted} old log(s) across all schools`, result);
});
