import { Request, Response } from 'express';
import catchAsync   from '../utils/catchAsync';
import sendResponse  from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import {
  getSchoolSettingsService,
  updateSchoolSettingsService,
  changePasswordService,
  toggleTwoFAService,
} from '../Service/auth.service';

// ── GET SETTINGS ──────────────────────────────────────────────────────────────

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const school  = await getSchoolSettingsService(id);
  sendResponse(res, 200, true, 'Settings fetched', school);
});

// ── UPDATE SETTINGS ───────────────────────────────────────────────────────────

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const updated = await updateSchoolSettingsService(id, req.body);
  sendResponse(res, 200, true, 'Settings updated successfully', updated);
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password)
    throw { message: 'Current password and new password are required.', statusCode: 400 };

  await changePasswordService(id, current_password, new_password);
  sendResponse(res, 200, true, 'Password changed successfully', null);
});

// ── TOGGLE 2FA (school admin for own school) ──────────────────────────────────

export const toggleMyTwoFA = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user as IJwtAdminPayload;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean')
    throw { message: '`enabled` (boolean) is required.', statusCode: 400 };

  await toggleTwoFAService(id, enabled);
  sendResponse(
    res, 200, true,
    `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} successfully`,
    { schoolId: id, two_fa_enabled: enabled }
  );
});

// ── TOGGLE 2FA (super admin for any school) ───────────────────────────────────

export const toggleTwoFA = catchAsync(async (req: Request, res: Response) => {
  const schoolId = Number(req.params.schoolId);
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean')
    throw { message: '`enabled` (boolean) is required.', statusCode: 400 };

  await toggleTwoFAService(schoolId, enabled);
  sendResponse(
    res, 200, true,
    `Two-factor authentication ${enabled ? 'enabled' : 'disabled'} for school`,
    { schoolId, two_fa_enabled: enabled }
  );
});

// ── SUPER ADMIN GET SCHOOL COMPREHENSIVE DETAILS ──────────────────────────────
import pool from '../config/db';
import { resolveCurrentPlanStatus, getSubscriptionHistoryService } from '../Service/subscription.service';
import { getSchoolStorageUsage } from '../utils/azureStorage';
import { getSchoolActiveUsersCount } from '../Service/redis.service';

export const getSuperAdminSchoolDetails = catchAsync(async (req: Request, res: Response) => {
  const schoolId = Number(req.params.schoolId);
  if (!schoolId) {
    return sendResponse(res, 400, false, 'Invalid school ID', null);
  }

  // 1. Fetch School profile
  const schoolRes = await pool.query(
    `SELECT id, school_name, school_code, city, state, country, pincode, phone, email,
            owner_full_name, logo, established_year, school_type, role, is_account,
            is_verified, timezone, calendar_system, two_fa_enabled, created_at, updated_at
     FROM schools WHERE id = $1`,
    [schoolId]
  );

  if (schoolRes.rows.length === 0) {
    return sendResponse(res, 404, false, 'School not found', null);
  }
  const rawSchool = schoolRes.rows[0];
  const school = {
    ...rawSchool,
    currency: rawSchool.country?.toLowerCase() === 'india' ? 'INR' : 'NPR',
  };

  // 2. Fetch Resource Counts in parallel
  const [
    studentsCount,
    teachersCount,
    staffCount,
    classesCount,
    sectionsCount,
    yearsCount,
    planStatus,
    subHistory,
    storageUsage,
    activeUsersCount,
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM students WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    pool.query(`SELECT COUNT(*)::int AS count FROM faculty WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    pool.query(`SELECT COUNT(*)::int AS count FROM staff WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    pool.query(`SELECT COUNT(*)::int AS count FROM classes WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    pool.query(`SELECT COUNT(*)::int AS count FROM sections WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    pool.query(`SELECT COUNT(*)::int AS count FROM academic_years WHERE school_id = $1`, [schoolId]).then((r) => r.rows[0]?.count || 0).catch(() => 0),
    resolveCurrentPlanStatus(schoolId).catch(() => null),
    getSubscriptionHistoryService(schoolId).catch(() => []),
    getSchoolStorageUsage(schoolId).catch(() => ({ totalBytes: 0, totalMB: '0.00', totalFiles: 0, breakdown: {} })),
    getSchoolActiveUsersCount(schoolId).catch(() => 0),
  ]);

  sendResponse(res, 200, true, 'School details fetched successfully', {
    school,
    metrics: {
      totalStudents: studentsCount,
      totalTeachers: teachersCount,
      totalStaff: staffCount,
      totalClasses: classesCount,
      totalSections: sectionsCount,
      totalAcademicYears: yearsCount,
      liveActiveUsers: activeUsersCount,
    },
    plan: planStatus,
    history: subHistory,
    storage: storageUsage,
  });
});
