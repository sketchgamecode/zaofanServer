import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/save
 * 拉取当前登录玩家的云存档
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const { data, error } = await supabaseAdmin
    .from('player_saves')
    .select('game_state, save_version, updated_at')
    .eq('player_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    res.status(500).json({ error: '读取存档失败', detail: error.message });
    return;
  }

  if (!data) {
    // 新玩家，没有存档
    res.json({ save: null, isNewPlayer: true });
    return;
  }

  res.json({ save: data.game_state, saveVersion: data.save_version, updatedAt: data.updated_at });
});

/**
 * POST /api/save/sync
 * 同步玩家的完整 GameState 到云端
 * 使用 upsert（不存在则 INSERT，存在则 UPDATE）
 */
const syncSchema = z.object({
  gameState: z.record(z.unknown()), // 接受任意 JSON 对象
  saveVersion: z.number().int().optional(),
});

router.post('/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  const parsed = syncSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '请求体格式错误', detail: parsed.error.issues });
    return;
  }

  const { gameState, saveVersion = 1 } = parsed.data;

  const { error } = await supabaseAdmin
    .from('player_saves')
    .upsert({
      player_id: userId,
      game_state: gameState,
      save_version: saveVersion,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  if (error) {
    res.status(500).json({ error: '同步存档失败', detail: error.message });
    return;
  }

  res.json({ success: true, syncedAt: new Date().toISOString() });
});

export default router;
