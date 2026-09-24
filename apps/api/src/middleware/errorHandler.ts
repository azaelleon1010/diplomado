import { Request, Response, NextFunction } from 'express';
import { AppError } from '@erp/errors';
import { logger } from '../lib/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const traceId = req.traceId || (req.headers['x-trace-id'] as string) || 'no-trace';
  if (err instanceof AppError) {
    logger.warn({ err: err.message, code: err.code, traceId, path: req.path }, 'operational error');
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, fields: err.fields ?? {} },
      traceId,
    });
    return;
  }
  // Zod validation
  if (err && typeof err === 'object' && 'issues' in (err as Record<string, unknown>)) {
    logger.warn({ err, traceId }, 'validation error');
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: { issues: (err as { issues: unknown }).issues } },
      traceId,
    });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error({ err, traceId, stack: err instanceof Error ? err.stack : undefined }, 'unhandled error');
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: isProd ? 'Internal server error' : message, fields: {} },
    traceId,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found`, fields: {} },
    traceId: req.traceId || 'no-trace',
  });
}
