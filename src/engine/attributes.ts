/**
 * 属性升级引擎 — 严格还原 S&F 属性系统
 *
 * S&F 规则：
 * - 5 种属性（STR/DEX/INT/CON/LCK），每次升级消耗铜钱
 * - 升级费用 = floor(10 * 1.1^当前值)，指数增长
 * - 每次升级 +1 点
 */
import type { GameState, PlayerAttributes, ActionResult } from '../types/gameState.js';
import { MathCore } from './mathCore.js';

type AttributeName = keyof PlayerAttributes;
const VALID_ATTRIBUTES: AttributeName[] = ['strength', 'intelligence', 'agility', 'constitution', 'luck'];

const ATTR_NAMES_ZH: Record<AttributeName, string> = {
  strength: '武力',
  intelligence: '智谋',
  agility: '身法',
  constitution: '体质',
  luck: '福缘',
};

/** UPGRADE_ATTRIBUTE：升级一个属性 */
export function upgradeAttribute(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const attr = payload.attribute as AttributeName;

  if (!VALID_ATTRIBUTES.includes(attr)) {
    return { success: false, gameState: state, log, error: `无效的属性名：${attr}` };
  }

  const currentValue = state.attributes[attr];
  const cost = MathCore.getUpgradeCost(currentValue);

  if (state.resources.copper < cost) {
    return {
      success: false, gameState: state, log,
      error: `铜钱不足！升级 ${ATTR_NAMES_ZH[attr]} 需要 ${cost} 铜钱，当前仅有 ${state.resources.copper} 铜钱`,
    };
  }

  const newState: GameState = {
    ...state,
    attributes: { ...state.attributes, [attr]: currentValue + 1 },
    resources: { ...state.resources, copper: state.resources.copper - cost },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'info', text: `${ATTR_NAMES_ZH[attr]} 升至 ${currentValue + 1} 点，花费 ${cost} 铜钱` });

  return { success: true, gameState: newState, log };
}
