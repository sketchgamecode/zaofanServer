import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase.js';

/**
 * 身份验证中间件
 * 验证请求头中的 Authorization: Bearer <user_jwt_token>
 * 通过 Supabase 验证 token 合法性，并将用户信息挂载到 req.user
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未授权：缺少 Authorization header' });
    return;
  }

  const token = authHeader.replace('Bearer ', '');

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: '未授权：token 无效或已过期' });
    return;
  }

  // 把用户信息挂到 req 上，后续路由直接用
  (req as any).user = user;
  next();
}

/**
 * 管理员权限中间件
 * 在 requireAuth 之后使用，额外验证 ADMIN_SECRET header
 * 用于保护后台管理接口（发通宝、查玩家、写日志等）
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminSecret = req.headers['x-admin-secret'];

  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    res.status(403).json({ error: '禁止访问：需要管理员权限' });
    return;
  }

  next();
}
