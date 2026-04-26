import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function dungeonFight(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('DUNGEON_FIGHT', 'dungeon', state, Date.now());
}
