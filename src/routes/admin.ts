import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { loadOrCreateGameState, saveGameState } from '../lib/gameStateStore.js';
import { loadOrCreateWorldState } from '../lib/worldStateStore.js';
import { getNow } from '../lib/time.js';

const router = Router();
router.use(requireAuth, requireAdmin);

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
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ players: data });
});

router.get('/players/:id/resources', async (req: Request, res: Response): Promise<void> => {
  const now = getNow();
  const targetPlayerId = String(req.params.id);

  try {
    const loadResult = await loadOrCreateGameState(targetPlayerId, now);
    const globalWorld = await loadOrCreateWorldState(now);
    loadResult.state.world = globalWorld;

    if (loadResult.created || loadResult.resetInvalid) {
      await saveGameState(targetPlayerId, loadResult.state, now);
    }

    res.json({ resources: loadResult.state.resources });
  } catch (error) {
    res.status(500).json({
      error: '读取玩家资源失败',
      detail: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

const grantSchema = z.object({
  tokens: z.number().int().min(0).optional(),
  hourglasses: z.number().int().min(0).optional(),
  reason: z.string().min(1, '必须填写操作原因'),
});

router.post('/players/:id/grant', async (req: Request, res: Response): Promise<void> => {
  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '参数错误', detail: parsed.error.issues });
    return;
  }

  res.status(503).json({
    error: '功能暂时不可用',
    detail: 'Admin resource grant is disabled until it is rebuilt on top of GameState.resources.',
  });
});

/**
 * DELETE /api/admin/wipe-all-saves
 *
 * 清空所有玩家存档。可被 CI/CD webhook 自动调用。
 * 需要 Admin 权限认证。
 */
router.delete('/wipe-all-saves', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('player_saves')
      .delete()
      .neq('player_id', '__impossible_id__')
      .select('player_id');

    if (error) {
      res.status(500).json({ error: '清档失败', detail: error.message });
      return;
    }

    const deletedCount = data?.length ?? 0;
    console.log(`[ADMIN] 🧹 wipe-all-saves: 已删除 ${deletedCount} 条存档`);

    res.json({
      ok: true,
      deletedCount,
      message: `已成功删除 ${deletedCount} 条玩家存档`,
    });
  } catch (err) {
    res.status(500).json({
      error: '清档失败',
      detail: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

export default router;
