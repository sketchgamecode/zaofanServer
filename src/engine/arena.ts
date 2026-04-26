import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function arenaFight(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('ARENA_FIGHT', 'arena', state, Date.now());
}

export function arenaSkipCooldown(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('ARENA_SKIP_COOLDOWN', 'arena', state, Date.now());
}
