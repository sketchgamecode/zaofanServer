import { Router, Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { z } from 'zod';

const router = Router();
// 所有管理员路由都需要同时通过 requireAuth 和 requireAdmin
router.use(requireAuth, requireAdmin);

/**
 * GET /api/admin/players
 * 列出所有玩家（支持搜索）
 */
router.get('/players', async (req: Request, res: Response): Promise<void> => {
  const search = req.query.search as string | undefined;

  let query = supabaseAdmin
    .from('profiles')
    .select('id, display_name, qq_name, status, created_at, last_login_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,qq_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ error: error.message }); return; }

  res.json({ players: data });
});

/**
 * GET /api/admin/players/:id/resources
 * 查看特定玩家的资源
 */
router.get('/players/:id/resources', async (req: Request, res: Response): Promise<void> => {
  const { data, error } = await supabaseAdmin
    .from('player_resources')
    .select('*')
    .eq('player_id', req.params.id)
    .single();

  if (error) { res.status(404).json({ error: '玩家不存在或无资源记录' }); return; }
  res.json({ resources: data });
});

/**
 * POST /api/admin/players/:id/grant
 * 给玩家发放通宝或沙漏（核心运营动作，写 admin_actions 日志）
 */
const grantSchema = z.object({
  tokens: z.number().int().min(0).optional(),
  hourglasses: z.number().int().min(0).optional(),
  reason: z.string().min(1, '必须填写操作原因'),
});

router.post('/players/:id/grant', async (req: Request, res: Response): Promise<void> => {
  const operatorId = (req as any).user.id;
  const targetPlayerId = req.params.id;

  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误', detail: parsed.error.issues });
    return;
  }

  const { tokens = 0, hourglasses = 0, reason } = parsed.data;

  if (tokens === 0 && hourglasses === 0) {
    res.status(400).json({ error: '通宝和沙漏不能同时为 0' });
    return;
  }

  // 读取操作前的资源快照
  const { data: before } = await supabaseAdmin
    .from('player_resources')
    .select('tokens, hourglasses')
    .eq('player_id', targetPlayerId)
    .single();

  // 更新资源（使用 RPC 保证原子性）
  const { error: updateError } = await supabaseAdmin
    .from('player_resources')
    .upsert({
      player_id: targetPlayerId,
      tokens: (before?.tokens ?? 0) + tokens,
      hourglasses: (before?.hourglasses ?? 0) + hourglasses,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  if (updateError) {
    res.status(500).json({ error: '发放失败', detail: updateError.message });
    return;
  }

  // 写入 admin_actions 审计日志（绝不能省略）
  await supabaseAdmin.from('admin_actions').insert({
    operator_id: operatorId,
    target_player_id: targetPlayerId,
    action_type: 'grant_resources',
    before_snapshot: before ?? {},
    after_snapshot: {
      tokens: (before?.tokens ?? 0) + tokens,
      hourglasses: (before?.hourglasses ?? 0) + hourglasses,
    },
    reason,
  });

  res.json({
    success: true,
    granted: { tokens, hourglasses },
    newTotal: {
      tokens: (before?.tokens ?? 0) + tokens,
      hourglasses: (before?.hourglasses ?? 0) + hourglasses,
    },
  });
});

export default router;
