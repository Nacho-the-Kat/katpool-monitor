import { Request, Response, NextFunction } from 'express';
import rTracer from 'cls-rtracer';

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId: string = String(req.headers['x-request-id']);
  if (requestId && requestId !== 'undefined') {
    rTracer.runWithId(() => {
      next();
    }, requestId);
  } else {
    next();
  }
};

export default requestContextMiddleware;
