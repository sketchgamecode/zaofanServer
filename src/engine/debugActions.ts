import { CORE_SCHEMA_VERSION } from '../config/coreRules.js';
import { resetGameStateForPlayer } from '../lib/gameStateStore.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import { GameError } from './errors.js';

function assertDebugResetAllowed(): void {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_CHEATS !== 'true') {
    throw new GameError('CHEATS_DISABLED', 'DEBUG_RESET_SAVE is disabled.');
  }
}

export async function debugResetSave(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{ reset: true; schemaVersion: number }>> {
  assertDebugResetAllowed();

  const newState = await resetGameStateForPlayer(ctx.playerId, ctx.now);
  ctx.state = newState;
  ctx.markDirty();

  return {
    ok: true,
    action: 'DEBUG_RESET_SAVE',
    serverTime: ctx.now,
    stateRevision: newState.meta.stateRevision,
    data: {
      reset: true,
      schemaVersion: CORE_SCHEMA_VERSION,
    },
  };
}
