import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function upgradeAttribute(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('UPGRADE_ATTRIBUTE', 'attributes', state, Date.now());
}
