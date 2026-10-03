import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import saveRouter from './routes/save.js';
import adminRouter from './routes/admin.js';
import actionRouter from './routes/action.js';
import debugRouter from './routes/debug.js';
import { logServerEvent, getReleaseTag, getRuntimeEnv } from './lib/observability.js';
import { attachRequestContext } from './middleware/requestContext.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://game.sketchgame.net',
  'https://api.sketchgame.net',
  'https://sketchgame.net',
];

const envAllowed = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allAllowed = new Set([...defaultAllowedOrigins, ...envAllowed]);

app.use(attachRequestContext);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allAllowed.has(origin) ||
        origin.endsWith('.sketchgame.net') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked: origin ${origin} is not in ALLOWED_ORIGINS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'zaofan-server',
    env: getRuntimeEnv(),
    releaseTag: getReleaseTag(),
  });
});

app.use('/api/save', saveRouter);
app.use('/api/admin', adminRouter);
app.use('/api/action', actionRouter);
app.use('/api/debug', debugRouter);
app.use('/debug', debugRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  logServerEvent(
    'request_unhandled_error',
    {
      requestId: res.locals.requestId ?? 'unknown',
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      hasAuthHeader: typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0,
      ok: false,
      errorCode: 'UNHANDLED_REQUEST_ERROR',
      message: error instanceof Error ? error.message : 'Unknown request error',
    },
    'error',
  );

  if (res.headersSent) {
    return;
  }

  const isCorsError = error instanceof Error && error.message.startsWith('CORS blocked:');
  res.status(isCorsError ? 403 : 500).json({
    error: isCorsError ? 'CORS_BLOCKED' : 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'Unknown request error',
    requestId: res.locals.requestId ?? 'unknown',
  });
});

app.listen(PORT, () => {
  logServerEvent('server_started', {
    port: PORT,
    allowedOrigins: Array.from(allAllowed),
  });
});
