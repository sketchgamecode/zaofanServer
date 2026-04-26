import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function guardWorkStart(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('GUARD_WORK_START', 'guardWork', state, Date.now());
}

export function guardWorkClaim(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('GUARD_WORK_CLAIM', 'guardWork', state, Date.now());
}
