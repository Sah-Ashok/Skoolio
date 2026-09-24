import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload, IJwtUserPayload } from '../types/auth.types';
import {
  getStreamsService,
  createStreamService,
  updateStreamService,
  deleteStreamService,
} from '../Service/stream.service';

const getSchoolId = (req: Request): number => {
  const user = req.user as IJwtAdminPayload | IJwtUserPayload;
  return 'school_id' in user ? user.school_id : user.id;
};

export const getStreams = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const streams = await getStreamsService(school_id);
  sendResponse(res, 200, true, 'Streams fetched successfully', streams);
});

export const createStream = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const stream = await createStreamService(school_id, req.body);
  sendResponse(res, 201, true, 'Stream created successfully', stream);
});

export const updateStream = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const stream = await updateStreamService(Number(req.params.id), school_id, req.body);
  sendResponse(res, 200, true, 'Stream updated successfully', stream);
});

export const deleteStream = catchAsync(async (req: Request, res: Response) => {
  const school_id = getSchoolId(req);
  const result = await deleteStreamService(Number(req.params.id), school_id);
  sendResponse(res, 200, true, result.message, null);
});
