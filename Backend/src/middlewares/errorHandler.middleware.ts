import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError';

const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Only log real server errors (5xx) or unexpected errors.
  // Known operational errors (4xx — bad input, not logged in, etc.)
  // are expected user-facing responses and should NOT pollute server logs.
  const isServerError = statusCode >= 500;
  const isUnexpected  = !(err instanceof AppError);

  if (isServerError || isUnexpected) {
    console.error('ERROR:', err);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
};

export default errorHandler;