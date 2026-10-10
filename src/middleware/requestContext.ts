import type { Request, Response, NextFunction } from 'express';
import { createRequestId, logServerEvent } from '../lib/observability.js';

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  const inboundRequestId = req.headers['x-request-id'];
  const requestId =
    typeof inboundRequestId === 'string' && inboundRequestId.trim().length > 0
      ? inboundRequestId.trim()
      : createRequestId();

  res.locals.requestId = requestId;
  res.locals.requestStartedAtMs = Date.now();
  res.setHeader('x-request-id', requestId);

  let logged = false;
  const logCompletion = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    if (req.path === '/health') return;
    logServerEvent(
      aborted ? 'request_aborted' : 'request_completed',
      {
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Date.now() - res.locals.requestStartedAtMs,
        contentLength: res.getHeader('content-length') ?? null,
        contentEncoding: res.getHeader('content-encoding') ?? null,
        clientAcceptEncoding: req.headers['accept-encoding'] ?? null,
        playerId: (req as any).user?.id ?? null,
      },
      aborted || res.statusCode >= 500 ? 'error' : 'info',
    );
  };
  res.on('finish', () => logCompletion(false));
  res.on('close', () => logCompletion(!res.writableFinished));

  next();
}
