import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createActionContext } from '../engine/actionContext.js';
import { dispatchAction } from '../engine/actionDispatcher.js';
import { applyDailyResetIfNeeded } from '../engine/dailyReset.js';
import { toActionErrorResponse } from '../engine/errors.js';
import { loadOrCreateGameState, saveGameState } from '../lib/gameStateStore.js';
import {
  getRequestMetadata,
  logServerEvent,
  summarizeActionPayload,
  summarizeGameState,
} from '../lib/observability.js';
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
  const requestStartedAtMs = Date.now();
  const requestMeta = getRequestMetadata(req, res);
  const parsed = actionSchema.safeParse(req.body);

  if (!parsed.success) {
    logServerEvent(
      'action_invalid_request',
      {
        ...requestMeta,
        playerId: userId,
        action: typeof req.body?.action === 'string' ? req.body.action : 'UNKNOWN',
        ok: false,
        errorCode: 'INVALID_REQUEST',
        durationMs: Date.now() - requestStartedAtMs,
        zodIssueCount: parsed.error.issues.length,
      },
      'error',
    );

    res.status(400).json({
      ok: false,
      errorCode: 'INVALID_REQUEST',
      message: 'Request body is invalid',
      detail: parsed.error.issues,
    });
    return;
  }

  const actionEnvelope: GameActionEnvelope = {
    action: parsed.data.action.trim(),
    payload: parsed.data.payload,
  };

  try {
    const response = await withPlayerLock(userId, async () => {
      const now = getNow();
      const loadResult = await loadOrCreateGameState(userId, now);
      const beforeSummary = summarizeGameState(loadResult.state, now);
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

      const afterSummary = summarizeGameState(ctx.state, now);
      logServerEvent(
        result.ok ? 'action_completed' : 'action_failed',
        {
          ...requestMeta,
          playerId: userId,
          action: actionEnvelope.action,
          ok: result.ok,
          errorCode: result.ok ? null : result.errorCode,
          message: result.ok ? null : result.message,
          durationMs: Date.now() - requestStartedAtMs,
          payloadSummary: summarizeActionPayload(actionEnvelope.payload),
          stateRevisionBefore: beforeSummary.stateRevision,
          stateRevisionAfter: afterSummary.stateRevision,
          tavernStatusBefore: beforeSummary.tavernStatus,
          tavernStatusAfter: afterSummary.tavernStatus,
          missionOfferCountBefore: beforeSummary.missionOfferCount,
          missionOfferCountAfter: afterSummary.missionOfferCount,
          activeMissionIdBefore: beforeSummary.activeMissionId,
          activeMissionIdAfter: afterSummary.activeMissionId,
          loadCreated: loadResult.created,
          loadResetInvalid: loadResult.resetInvalid,
          dailyResetApplied: resetApplied,
        },
        result.ok ? 'info' : 'error',
      );

      return result;
    });

    res.json(response);
  } catch (error) {
    const now = getNow();
    const errorResponse = toActionErrorResponse({
      action: actionEnvelope.action,
      serverTime: now,
      error,
    });

    logServerEvent(
      'action_exception',
      {
        ...requestMeta,
        playerId: userId,
        action: actionEnvelope.action,
        ok: false,
        errorCode: errorResponse.errorCode,
        message: errorResponse.message,
        durationMs: Date.now() - requestStartedAtMs,
        payloadSummary: summarizeActionPayload(actionEnvelope.payload),
      },
      'error',
    );

    res.status(500).json(errorResponse);
  }
});

export default router;
