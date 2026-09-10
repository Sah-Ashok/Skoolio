import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/response';
import { IJwtAdminPayload } from '../types/auth.types';
import { getPlatformSettingsService, updatePlatformSettingsService } from '../Service/platform.service';

export const getPlatformSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const settings = await getPlatformSettingsService();
  sendResponse(res, 200, true, 'Platform settings fetched successfully', settings);
});

export const updatePlatformSettings = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
  const { id: updated_by } = req.user as IJwtAdminPayload;
  const settings = await updatePlatformSettingsService(updated_by, req.body);
  sendResponse(res, 200, true, 'Platform settings updated successfully', settings);
});

import fs from 'fs';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), 'logs');

const resolveLogFile = (type: string = 'error'): string => {
  switch (type) {
    case 'crash':    return path.join(LOG_DIR, 'crash.log');
    case 'combined': return path.join(LOG_DIR, 'combined.log');
    default:         return path.join(LOG_DIR, 'error.log');
  }
};

/**
 * GET /api/platform/logs?type=error|crash|combined&lines=100
 */
export const getSystemLogs = catchAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'error';
  const linesCount = Math.min(Math.max(Number(req.query.lines) || 100, 10), 1000);
  const filePath = resolveLogFile(type);

  if (!fs.existsSync(filePath)) {
    return sendResponse(res, 200, true, 'Log file is empty or not yet generated.', {
      type,
      lines: [],
      totalLines: 0,
      sizeBytes: 0,
    });
  }

  const stat = fs.statSync(filePath);
  // Read file contents
  const content = fs.readFileSync(filePath, 'utf8');
  const allLines = content.split('\n').filter((l) => l.length > 0);
  const tail = allLines.slice(-linesCount);

  sendResponse(res, 200, true, 'Logs retrieved successfully', {
    type,
    lines: tail,
    totalLines: allLines.length,
    sizeBytes: stat.size,
    lastModified: stat.mtime,
  });
});

/**
 * GET /api/platform/logs/download?type=error|crash|combined
 */
export const downloadSystemLogs = catchAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'error';
  const filePath = resolveLogFile(type);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Log file not found.');
  }

  res.download(filePath, `${type}-${Date.now()}.log`);
});

/**
 * DELETE /api/platform/logs?type=error|crash|combined
 */
export const clearSystemLogs = catchAsync(async (req: Request, res: Response) => {
  const type = (req.query.type as string) || 'error';
  const filePath = resolveLogFile(type);

  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '', 'utf8');
  }

  sendResponse(res, 200, true, `Log file '${type}.log' has been cleared.`, null);
});

