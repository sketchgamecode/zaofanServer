import { MAX_LEVEL, XP_TABLE } from '../data/xpTable.js';
import type {
  BaseAttributeValues,
  BattleResultV2,
  EquipmentItem,
  GameState,
  PlayerClassId,
  PlayerCombatSnapshot,
  EnemySnapshot,
  BattleSide,
} from '../types/gameState.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { simulateBattleV2 } from './combatSimulator.js';
import {
  getWeaponFinal,
  getArmorFinal,
  getShieldFinal,
  shields,
} from '../lib/equipmentData.js';

export { CLASS_CONFIG } from './combatConfig.js';

export const MathCore = {
  getMaxHP: (constitution: number, level: number, classId: PlayerClassId): number =>
    Math.ceil(constitution * CLASS_CONFIG[classId].hpMultiplier * (level + 1)),

  getCritChance: (luck: number, enemyLevel: number): number =>
    Math.min(0.5, ((luck * 2.5) / (Math.max(1, enemyLevel) * 100))),
};

export function checkLevelUp(currentLevel: number, currentExp: number): {
  newLevel: number;
  newExp: number;
  didLevelUp: boolean;
  levelsGained: number;
} {
  let level = currentLevel;
  let exp = currentExp;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const required = XP_TABLE[level];
    if (required === undefined || exp < required) break;
    exp -= required;
    level += 1;
    levelsGained += 1;
  }

  return { newLevel: level, newExp: exp, didLevelUp: levelsGained > 0, levelsGained };
}

export function getTotalAttributes(state: GameState): BaseAttributeValues {
  const total: BaseAttributeValues = {
    strength: state.attributes.strength,
    intelligence: state.attributes.intelligence,
    agility: state.attributes.agility,
    constitution: state.attributes.constitution,
    luck: state.attributes.luck,
  };

  for (const item of Object.values(state.equipment.equipped)) {
    if (!item) continue;
    total.strength += item.bonusAttributes?.strength ?? 0;
    total.intelligence += item.bonusAttributes?.intelligence ?? 0;
    total.agility += item.bonusAttributes?.agility ?? 0;
    total.constitution += item.bonusAttributes?.constitution ?? 0;
    total.luck += item.bonusAttributes?.luck ?? 0;
  }

  return total;
}

export function serverSimulateBattle(input: {
  player: PlayerCombatSnapshot;
  enemy: EnemySnapshot;
  seed: string;
}): BattleResultV2 {
  return simulateBattleV2({
    player: input.player,
    enemy: input.enemy,
    seed: input.seed,
    context: 'MISSION',
  });
}

function getWeaponAverageDamage(item: EquipmentItem | null, level: number): number {
  if (!item) return level * 3;
  if (item.weaponDamage) return (item.weaponDamage.min + item.weaponDamage.max) / 2;
  return level * 3;
}

export function buildPlayerBattleSide(state: GameState): BattleSide {
  const weapon = state.equipment.equipped.weapon;
  const body = state.equipment.equipped.body;
  const offHand = state.equipment.equipped.offHand;

  let dmg = 12; // 默认横刀/拳头基准
  let blockBp = 1500; // 基础 15%
  let dodgeBp = 0;
  let armorValue = 0;
  let hp = 100;

  if (weapon) {
    try {
      const finalW = getWeaponFinal(weapon.itemId!, weapon.material!, weapon.craft, weapon.shaft, weapon.arrow);
      dmg = finalW.dmg;
    } catch (e) {
      // 降级使用武器本身的数据
      dmg = getWeaponAverageDamage(weapon, state.player.level);
    }
  } else {
    dmg = 8; // 徒手
  }

  if (body) {
    try {
      const finalA = getArmorFinal(body.itemId!, body.upgrade);
      armorValue = finalA.reduce;
      dodgeBp = finalA.dodge * 100;
      hp = finalA.stamina;
    } catch (e) {
      armorValue = body.armor ?? 0;
      hp = 100;
    }
  }

  if (offHand) {
    try {
      const isShield = shields.some((s) => s.id === offHand.itemId);
      if (isShield) {
        const finalS = getShieldFinal(offHand.itemId!);
        blockBp += finalS.blockMod * 10000;
        dodgeBp += finalS.dodgeMod * 100;
      } else {
        blockBp = 0; // 双持没有格挡
      }
    } catch (e) {
      // 降级使用防具/副手
    }
  }

  return {
    hp,
    damageMin: dmg,
    damageMax: dmg,
    critChanceBp: 0,
    dodgeChanceBp: Math.max(0, dodgeBp),
    blockChanceBp: blockBp,
    armor: armorValue,
    level: state.player.level,
  };
}
