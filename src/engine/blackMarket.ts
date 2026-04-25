import type { GameState, ActionResult } from '../types/gameState.js';
import { generateShopItems } from './equipmentGenerator.js';

/** BLACK_MARKET_REFRESH：花费通宝刷新黑市物品 */
export function blackMarketRefresh(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const REFRESH_COST = 1;

  if (state.resources.tokens < REFRESH_COST) {
    return { success: false, gameState: state, log, error: '通宝不足！' };
  }

  const newItems = generateShopItems(state.playerLevel, 6);

  const newState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      tokens: state.resources.tokens - REFRESH_COST,
    },
    blackMarket: {
      items: newItems,
      lastRefresh: Date.now(),
    },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'info', text: `花费了 ${REFRESH_COST} 通宝，刷新了黑市。` });

  return { success: true, gameState: newState, log };
}

/** BLACK_MARKET_BUY：购买黑市物品 */
export function blackMarketBuy(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const itemIndex = payload.itemIndex as number;

  if (typeof itemIndex !== 'number' || itemIndex < 0 || itemIndex >= 6) {
    return { success: false, gameState: state, log, error: '无效的物品索引' };
  }

  const item = state.blackMarket.items[itemIndex];
  if (!item) {
    return { success: false, gameState: state, log, error: '该物品已被买走' };
  }

  if (state.resources.copper < (item.price || 0)) {
    return { success: false, gameState: state, log, error: '铜钱不足！' };
  }

  const newBlackMarketItems = [...state.blackMarket.items];
  newBlackMarketItems[itemIndex] = null;

  const newState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      copper: state.resources.copper - (item.price || 0),
    },
    inventory: [...state.inventory, item],
    blackMarket: {
      ...state.blackMarket,
      items: newBlackMarketItems,
    },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'reward', text: `花费了 ${item.price} 铜钱，购买了 ${item.name}。` });

  return { success: true, gameState: newState, log };
}
