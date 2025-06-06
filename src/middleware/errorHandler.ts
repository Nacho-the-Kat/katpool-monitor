import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

export interface AppError extends Error {
  statusCode?: number;
}

// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
  });

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async handler wrapper
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
