import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import pool from '../config/db';
import {
  getFeeReportService,
  getIncomeExpenseReportService,
} from '../Service/finance_report.service';

const getSchoolId = (req: Request): number => {
  const user = req.user as any;
  const schoolId = user?.role === 'finance' ? user?.school_id : (user?.school_id || user?.id);
  if (!schoolId) throw { message: 'School identification missing.', statusCode: 401 };
  return Number(schoolId);
};

const resolveAcademicYearId = async (school_id: number, rawYearId?: any): Promise<number | null> => {
  if (rawYearId) {
    const id = Number(rawYearId);
    if (!isNaN(id) && id > 0) return id;
  }
  const activeRes = await pool.query(
    `SELECT id FROM academic_years WHERE school_id = $1 AND status = 'active' LIMIT 1`,
    [school_id]
  );
  if (activeRes.rows.length > 0) {
    return activeRes.rows[0].id;
  }
  const fallbackRes = await pool.query(
    `SELECT id FROM academic_years WHERE school_id = $1 ORDER BY id DESC LIMIT 1`,
    [school_id]
  );
  return fallbackRes.rows[0]?.id || null;
};

export const getFeeReport = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const academic_year_id = await resolveAcademicYearId(school_id, req.query.academic_year_id);

  if (!academic_year_id) {
    return sendResponse(res, 200, true, 'No academic year configured', {
      summary: { total_expected: 0, total_collected: 0, total_outstanding: 0, collection_rate: 0 },
      class_wise: [],
      type_wise: [],
    });
  }

  const data = await getFeeReportService(school_id, academic_year_id);
  sendResponse(res, 200, true, 'Fee report fetched successfully', data);
});

export const getIncomeExpenseReport = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const academic_year_id = await resolveAcademicYearId(school_id, req.query.academic_year_id);

  if (!academic_year_id) {
    return sendResponse(res, 200, true, 'No academic year configured', {
      summary: { total_income: 0, total_expense: 0, net_balance: 0, is_surplus: true },
      months: [],
      income_categories: [],
      expense_categories: [],
    });
  }

  const data = await getIncomeExpenseReportService(school_id, academic_year_id);
  sendResponse(res, 200, true, 'Income & expense report fetched successfully', data);
});
