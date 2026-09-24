import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = req.startTime || Date.now();
  // log on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const base = {
      traceId: req.traceId,
      requestId: req.requestId,
      tenantId: req.tenantId,
      userId: req.userId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      duration,
    };
    if (res.statusCode >= 500) logger.error(base, 'request failed');
    else if (res.statusCode >= 400) logger.warn(base, 'request warn');
    else logger.info(base, 'request ok');
  });
  next();
}
