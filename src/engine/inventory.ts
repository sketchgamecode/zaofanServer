import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function equipItem(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('EQUIP_ITEM', 'inventory', state, Date.now());
}

export function unequipItem(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('UNEQUIP_ITEM', 'inventory', state, Date.now());
}
