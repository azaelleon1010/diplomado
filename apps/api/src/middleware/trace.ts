import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '@erp/config';

export interface TraceContext {
  traceId: string;
  requestId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      traceId: string;
      requestId: string;
      tenantId?: string;
      userId?: string;
      startTime: number;
    }
  }
}

export function traceMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const config = getConfig();
  const traceHeader = config.TRACE_HEADER.toLowerCase();
  const requestIdHeader = config.REQUEST_ID_HEADER.toLowerCase();
  const traceId = req.get(traceHeader) || req.get(requestIdHeader) || uuidv4();
  const requestId = req.get(requestIdHeader) || uuidv4();
  req.traceId = traceId;
  req.requestId = requestId;
  req.startTime = Date.now();
  // Also propagate via headers for downstream
  req.headers[traceHeader] = traceId;
  req.headers[requestIdHeader] = requestId;
  next();
}
