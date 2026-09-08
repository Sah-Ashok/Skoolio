import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import {
  getSchoolFinanceAccountService,
  createSchoolFinanceAccountService,
  updateSchoolFinanceAccountService,
  deleteSchoolFinanceAccountService,
  loginFinanceService,
} from '../Service/finance.service';

const getSchoolId = (req: Request): number => {
  const user = req.user as any;
  return user?.school_id || user?.id;
};

export const getFinanceAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const account = await getSchoolFinanceAccountService(school_id);
  sendResponse(res, 200, true, 'Finance account fetched successfully', account);
});

export const createFinanceAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const { full_name, email, password, phone } = req.body;

  if (!full_name || !email || !password) {
    throw { message: 'Full name, email, and password are required.', statusCode: 400 };
  }

  const account = await createSchoolFinanceAccountService(school_id, {
    full_name,
    email,
    password,
    phone,
  });

  sendResponse(res, 201, true, 'Finance account created successfully', account);
});

export const updateFinanceAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const account = await updateSchoolFinanceAccountService(school_id, req.body);
  sendResponse(res, 200, true, 'Finance account updated successfully', account);
});

export const deleteFinanceAccount = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  await deleteSchoolFinanceAccountService(school_id);
  sendResponse(res, 200, true, 'Finance account deleted successfully', null);
});

export const loginFinance = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await loginFinanceService(req.body);

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendResponse(res, 200, true, 'Finance login successful', { user });
});
