import type { AttributeKey } from '../types/gameState.js';

export const CHARACTER_RULES = {
  combatRatingWeights: {
    hp: 0.12,
    armor: 1.5,
    damageMin: 6,
    damageMax: 6,
    critChanceBp: 0.02,
    dodgeChanceBp: 0.02,
    itemPowerTotal: 0.35,
  },
} as const;

/**
 * 属性升级成本（新公式，对标 S&F 阶梯式）。
 *
 * Cost = floor(level × (0.2 + boughtCount × 0.05))
 * 保底 1（防止低等级时成本为 0）。
 *
 * @param level 玩家当前等级
 * @param boughtCount 该属性已通过铜钱累计购买的点数
 */
export function getAttributeUpgradeCost(level: number, boughtCount: number): number {
  return Math.max(1, Math.floor(level * (0.2 + boughtCount * 0.05)));
}

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  'strength',
  'intelligence',
  'agility',
  'constitution',
  'luck',
];
