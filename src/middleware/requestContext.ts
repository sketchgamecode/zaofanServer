import type { Request, Response, NextFunction } from 'express';
import { createRequestId } from '../lib/observability.js';

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const inboundRequestId = req.headers['x-request-id'];
  const requestId =
    typeof inboundRequestId === 'string' && inboundRequestId.trim().length > 0
      ? inboundRequestId.trim()
      : createRequestId();

  res.locals.requestId = requestId;
  res.locals.requestStartedAtMs = Date.now();
  res.setHeader('x-request-id', requestId);
  next();
}
