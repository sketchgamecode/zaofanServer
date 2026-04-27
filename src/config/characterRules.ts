import type { AttributeKey } from '../types/gameState.js';

export const CHARACTER_RULES = {
  attributeUpgradeBaseCost: 10,
  attributeUpgradeStepCost: 5,
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

export function getAttributeUpgradeCost(attributeValue: number): number {
  return CHARACTER_RULES.attributeUpgradeBaseCost
    + attributeValue * CHARACTER_RULES.attributeUpgradeStepCost;
}

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  'strength',
  'intelligence',
  'agility',
  'constitution',
  'luck',
];
