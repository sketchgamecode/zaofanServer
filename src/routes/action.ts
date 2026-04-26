import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createActionContext } from '../engine/actionContext.js';
import { dispatchAction } from '../engine/actionDispatcher.js';
import { applyDailyResetIfNeeded } from '../engine/dailyReset.js';
import { toActionErrorResponse } from '../engine/errors.js';
import { loadOrCreateGameState, saveGameState } from '../lib/gameStateStore.js';
import { withPlayerLock } from '../lib/playerLock.js';
import { getNow } from '../lib/time.js';
import type { GameActionEnvelope } from '../types/action.js';

const router = Router();

const actionSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()).optional().default({}),
});

router.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user.id as string;
  const parsed = actionSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      message: 'Request body is invalid',
      detail: parsed.error.issues,
    });
    return;
  }

  const actionEnvelope: GameActionEnvelope = {
    action: parsed.data.action,
    payload: parsed.data.payload,
  };

  try {
    const response = await withPlayerLock(userId, async () => {
      const now = getNow();
      const loadResult = await loadOrCreateGameState(userId, now);
      const resetApplied = applyDailyResetIfNeeded(loadResult.state, now);
      const ctx = createActionContext({
        playerId: userId,
        now,
        state: loadResult.state,
        dirty: loadResult.created || loadResult.resetInvalid || resetApplied,
      });

      const result = await dispatchAction(ctx, actionEnvelope);

      if (ctx.dirty) {
        await saveGameState(userId, ctx.state, now);
        if (result.ok) {
          result.stateRevision = ctx.state.meta.stateRevision;
        } else {
          result.stateRevision = ctx.state.meta.stateRevision;
        }
      }

      return result;
    });

    res.json(response);
  } catch (error) {
    const now = getNow();
    res.status(500).json(
      toActionErrorResponse({
        action: actionEnvelope.action,
        serverTime: now,
        error,
      }),
    );
  }
});

export default router;
