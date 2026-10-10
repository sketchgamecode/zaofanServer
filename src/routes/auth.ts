import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../lib/supabase.js';
import {
  AuthProxyError,
  createEphemeralAuthClient,
  mapSupabaseAuthError,
  toSessionResponse,
} from '../lib/authProxy.js';
import { getRequestId, getRequestMetadata, logServerEvent } from '../lib/observability.js';

/**
 * Auth proxy routes. The client only ever talks to api.sketchgame.net.
 *
 *   POST /api/auth/register  { email, password, displayName }
 *   POST /api/auth/login     { email, password }
 *   POST /api/auth/refresh   { refreshToken }
 *
 * Success (200): AuthSessionResponse (see lib/authProxy.ts)
 * Failure:       { error: AuthErrorCode, message, requestId }
 */
const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(128),
  displayName: z.string().trim().min(1).max(32),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function sendAuthError(req: Request, res: Response, action: string, err: unknown): void {
  const proxyError =
    err instanceof AuthProxyError ? err : mapSupabaseAuthError(err, 'AUTH_UPSTREAM_UNAVAILABLE');

  logServerEvent(
    'auth_proxy_failed',
    {
      ...getRequestMetadata(req, res),
      action,
      ok: false,
      errorCode: proxyError.code,
      httpStatus: proxyError.httpStatus,
      message: err instanceof Error ? err.message : String(err),
    },
    'error',
  );

  res.status(proxyError.httpStatus).json({
    error: proxyError.code,
    message: proxyError.message,
    requestId: getRequestId(res),
  });
}

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ');
    throw new AuthProxyError('INVALID_REQUEST', 400, detail);
  }
  return parsed.data;
}

async function signIn(email: string, password: string) {
  const client = createEphemeralAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw mapSupabaseAuthError(error ?? new Error('No session returned'), 'INVALID_CREDENTIALS');
  }
  return data.session;
}

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, displayName } = parseBody(registerSchema, req.body);

    // Dev stage: accounts are created already confirmed, so no email verification step.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError) {
      throw mapSupabaseAuthError(createError, 'INVALID_REQUEST');
    }

    const session = await signIn(email, password);
    logServerEvent('auth_proxy_ok', { ...getRequestMetadata(req, res), action: 'register', playerId: session.user.id });
    res.json({ ...toSessionResponse(session), requiresEmailVerification: false });
  } catch (err) {
    sendAuthError(req, res, 'register', err);
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = parseBody(loginSchema, req.body);
    const session = await signIn(email, password);
    logServerEvent('auth_proxy_ok', { ...getRequestMetadata(req, res), action: 'login', playerId: session.user.id });
    res.json(toSessionResponse(session));
  } catch (err) {
    sendAuthError(req, res, 'login', err);
  }
});

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = parseBody(refreshSchema, req.body);
    const client = createEphemeralAuthClient();
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      throw mapSupabaseAuthError(error ?? new Error('No session returned'), 'REFRESH_TOKEN_INVALID');
    }
    res.json(toSessionResponse(data.session));
  } catch (err) {
    sendAuthError(req, res, 'refresh', err);
  }
});

export default router;
