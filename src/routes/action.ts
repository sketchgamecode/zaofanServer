/**
 * POST /api/action — 统一游戏动作接口
 *
 * 这是所有客户端（Web/Unity/iOS/UE）发送游戏指令的唯一入口。
 * 流程：验证身份 → 从DB读取GameState → 执行引擎 → 写回DB → 返回结果
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { dispatch } from '../engine/index.js';
import { getInitialGameState } from '../types/gameState.js';
import type { GameAction, GameState } from '../types/gameState.js';
import { z } from 'zod';

const router = Router();

const actionSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
});

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id;

  // ── 1. 解析请求 ─────────────────────────────────────────────────────────────
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: '请求格式错误', detail: parsed.error.issues });
    return;
  }
  const gameAction: GameAction = { action: parsed.data.action, payload: parsed.data.payload };

  // ── 2. 从数据库读取权威 GameState ───────────────────────────────────────────
  const { data: saveData, error: readError } = await supabaseAdmin
    .from('player_saves')
    .select('game_state')
    .eq('player_id', userId)
    .single();

  if (readError && readError.code !== 'PGRST116') {
    res.status(500).json({ success: false, error: '读取存档失败', detail: readError.message });
    return;
  }

  const currentState: GameState = (saveData?.game_state as GameState) ?? getInitialGameState();

  // ── 3. 执行引擎 ─────────────────────────────────────────────────────────────
  const result = dispatch(currentState, gameAction);

  if (!result.success) {
    // 动作失败（如资源不足），不写DB，直接返回
    res.status(200).json(result);
    return;
  }

  // ── 4. 将新 GameState 写回数据库 ─────────────────────────────────────────────
  const { error: writeError } = await supabaseAdmin
    .from('player_saves')
    .upsert({
      player_id: userId,
      game_state: result.gameState,
      save_version: 2,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' });

  if (writeError) {
    res.status(500).json({ success: false, error: '写入存档失败', detail: writeError.message });
    return;
  }

  // ── 5. 返回结果 ──────────────────────────────────────────────────────────────
  res.json(result);
});

export default router;
