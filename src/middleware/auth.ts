import { Request, Response, NextFunction } from 'express';
import { getRequestMetadata, logServerEvent } from '../lib/observability.js';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Require a valid Supabase bearer token and attach the user to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const requestMeta = getRequestMetadata(req, res);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logServerEvent(
      'auth_rejected',
      {
        ...requestMeta,
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header',
      },
      'error',
    );

    res.status(401).json({ error: 'Unauthorized: missing Authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    logServerEvent(
      'auth_rejected',
      {
        ...requestMeta,
        ok: false,
        errorCode: 'UNAUTHORIZED',
        message: 'Supabase token is invalid or expired',
      },
      'error',
    );

    res.status(401).json({ error: 'Unauthorized: token is invalid or expired' });
    return;
  }

  (req as any).user = user;
  next();
}

/**
 * Require the x-admin-secret header after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = req.headers['x-admin-secret'];
  const requestMeta = getRequestMetadata(req, res);

  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    logServerEvent(
      'admin_rejected',
      {
        ...requestMeta,
        playerId: (req as any).user?.id ?? null,
        ok: false,
        errorCode: 'FORBIDDEN',
        message: 'Admin secret is missing or invalid',
      },
      'error',
    );

    res.status(403).json({ error: 'Forbidden: admin secret is required' });
    return;
  }

  next();
}
