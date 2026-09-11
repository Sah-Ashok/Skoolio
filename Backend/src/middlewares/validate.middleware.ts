import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import sendResponse from '../utils/response';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstError = err.issues[0]?.message || 'Validation failed';
        const errors = err.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return sendResponse(res, 400, false, firstError, { errors });
      }
      next(err);
    }
  };
};
