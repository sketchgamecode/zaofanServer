import { MAX_LEVEL, XP_TABLE } from '../data/xpTable.js';
import { getGameDateString } from '../lib/time.js';
import type {
  BaseAttributeValues,
  BattleResultV2,
  EquipmentItem,
  GameState,
  PlayerClassId,
  PlayerCombatSnapshot,
  EnemySnapshot,
} from '../types/gameState.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { simulateBattleV2 } from './combatSimulator.js';

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
    total.strength += item.bonusAttributes.strength ?? 0;
    total.intelligence += item.bonusAttributes.intelligence ?? 0;
    total.agility += item.bonusAttributes.agility ?? 0;
    total.constitution += item.bonusAttributes.constitution ?? 0;
    total.luck += item.bonusAttributes.luck ?? 0;
  }

  return total;
}

export function getTodayCN(): string {
  return getGameDateString(Date.now());
}

export interface BattleSide {
  hp: number;
  damageMin: number;
  damageMax: number;
  critChanceBp: number;
  dodgeChanceBp?: number;
  blockChanceBp?: number;
  armor: number;
  level: number;
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
    firstAttacker: 'player',
  });
}

function getWeaponAverageDamage(item: EquipmentItem | null, level: number): number {
  if (!item?.weaponDamage) return level * 3;
  return (item.weaponDamage.min + item.weaponDamage.max) / 2;
}

export function buildPlayerBattleSide(state: GameState): BattleSide {
  const attrs = getTotalAttributes(state);
  const classConf = CLASS_CONFIG[state.player.classId];
  const mainAttr = attrs[classConf.mainStat];
  const totalArmor = Object.values(state.equipment.equipped).reduce((sum, item) => sum + (item?.armor ?? 0), 0);
  const weaponAverageDamage = getWeaponAverageDamage(state.equipment.equipped.weapon, state.player.level);
  const damageMin = Math.max(1, Math.floor(weaponAverageDamage * 0.8 * classConf.weaponFactor * (1 + mainAttr / 10)));
  const damageMax = Math.max(damageMin + 1, Math.floor(weaponAverageDamage * 1.2 * classConf.weaponFactor * (1 + mainAttr / 10)));

  return {
    hp: MathCore.getMaxHP(attrs.constitution, state.player.level, state.player.classId),
    damageMin,
    damageMax,
    critChanceBp: Math.floor(MathCore.getCritChance(attrs.luck, state.player.level) * 10000),
    dodgeChanceBp: classConf.dodgeChanceBp || undefined,
    blockChanceBp: classConf.blockChanceBp || undefined,
    armor: totalArmor,
    level: state.player.level,
  };
}
