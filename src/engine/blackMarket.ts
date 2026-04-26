import { buildDisabledActionResponse } from './disabledActions.js';
import type { LegacyActionResult } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function blackMarketRefresh(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('BLACK_MARKET_REFRESH', 'blackMarket', state, Date.now());
}

export function blackMarketBuy(state: GameState, _payload: Record<string, unknown>): LegacyActionResult {
  return buildDisabledActionResponse('BLACK_MARKET_BUY', 'blackMarket', state, Date.now());
}
