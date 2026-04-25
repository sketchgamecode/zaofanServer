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

export default router;
