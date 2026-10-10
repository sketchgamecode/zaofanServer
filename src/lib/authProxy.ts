import { createClient, isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js';

/**
 * Auth proxy helpers.
 *
 * The Unity client never talks to Supabase directly. All register / login / refresh
 * calls go through the game server, which talks to Supabase inside the server network.
 */

export type AuthErrorCode =
  | 'INVALID_REQUEST'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'WEAK_PASSWORD'
  | 'INVALID_CREDENTIALS'
  | 'REFRESH_TOKEN_INVALID'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'AUTH_UPSTREAM_UNAVAILABLE';

export class AuthProxyError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Creates a throwaway Supabase client for one auth call.
 * Never reuse `supabaseAdmin` for signIn/refresh: a successful sign-in stores the
 * user session inside the client, and later DB calls would run as that user.
 */
export function createEphemeralAuthClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

/** True when the failure is network / upstream trouble, not a bad credential. */
export function isUpstreamFailure(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: number }).status;
  return typeof status === 'number' && (status === 0 || status >= 500);
}

export function mapSupabaseAuthError(error: AuthError | Error | unknown, fallback: AuthErrorCode): AuthProxyError {
  if (isUpstreamFailure(error)) {
    return new AuthProxyError('AUTH_UPSTREAM_UNAVAILABLE', 503, 'Auth service is temporarily unavailable. Please retry.');
  }

  const code = (error as { code?: string }).code ?? '';
  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : 'Unknown auth error';

  if (status === 429 || code.startsWith('over_')) {
    return new AuthProxyError('RATE_LIMITED', 429, 'Too many requests. Please retry later.');
  }
  if (code === 'email_exists' || code === 'user_already_exists' || /already (been )?registered/i.test(message)) {
    return new AuthProxyError('EMAIL_ALREADY_REGISTERED', 409, 'This email is already registered.');
  }
  if (code === 'weak_password' || /password/i.test(message) && /(weak|short|at least)/i.test(message)) {
    return new AuthProxyError('WEAK_PASSWORD', 400, message);
  }
  if (code === 'invalid_credentials' || code === 'email_not_confirmed') {
    return new AuthProxyError('INVALID_CREDENTIALS', 401, 'Email or password is incorrect.');
  }
  if (code.startsWith('refresh_token') || code === 'session_expired' || code === 'session_not_found') {
    return new AuthProxyError('REFRESH_TOKEN_INVALID', 401, 'Refresh token is invalid or expired. Please log in again.');
  }

  const httpStatus = fallback === 'INVALID_REQUEST' || fallback === 'WEAK_PASSWORD' ? 400 : 401;
  return new AuthProxyError(fallback, httpStatus, message);
}

export type AuthSessionResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'bearer';
  /** Unix timestamp in SECONDS when accessToken expires. */
  expiresAt: number;
  /** Seconds until accessToken expires, measured at response time. */
  expiresIn: number;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
  };
};

export function toSessionResponse(session: Session): AuthSessionResponse {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? nowSec + (session.expires_in ?? 3600);
  const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    tokenType: 'bearer',
    expiresAt,
    expiresIn: Math.max(0, expiresAt - nowSec),
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      displayName: typeof meta.display_name === 'string' ? meta.display_name : null,
    },
  };
}
