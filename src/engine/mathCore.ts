/**
 * S&F 核心数学公式 — 服务端权威实现
 * 所有数值计算在此处发生，客户端只做展示。
 */
import type { ClassId, GameState, PlayerAttributes } from '../types/gameState.js';
import { XP_TABLE, MAX_LEVEL } from '../data/xpTable.js';

export const CLASS_CONFIG: Record<ClassId, {
  name: string;
  mainStat: 'strength' | 'agility' | 'intelligence';
  hpMultiplier: number;
  armorCap: number;
}> = {
  CLASS_A: { name: '猛将', mainStat: 'strength',      hpMultiplier: 5, armorCap: 50 },
  CLASS_B: { name: '游侠', mainStat: 'agility',       hpMultiplier: 4, armorCap: 25 },
  CLASS_C: { name: '谋士', mainStat: 'intelligence',  hpMultiplier: 2, armorCap: 10 },
  CLASS_D: { name: '刺客', mainStat: 'agility',       hpMultiplier: 4, armorCap: 25 },
};

export const MathCore = {
  getMaxHP: (constitution: number, level: number, classId: ClassId): number => {
    return constitution * level * CLASS_CONFIG[classId].hpMultiplier;
  },

  getSingleHitDamage: (weaponDamage: number, mainAttribute: number, isAssassinDualWield: boolean): number => {
    let dmg = weaponDamage * (1 + mainAttribute / 10);
    if (isAssassinDualWield) dmg *= 0.625;
    return Math.floor(dmg);
  },

  getCritChance: (luck: number, enemyLevel: number): number => {
    const chance = (luck * 5) / (Math.max(1, enemyLevel) * 2);
    return Math.min(0.5, chance / 100);
  },

  getArmorDamageReduction: (totalArmor: number, enemyLevel: number, rootCap: number): number => {
    const reductionPercent = totalArmor / Math.max(1, enemyLevel);
    return Math.min(rootCap / 100, reductionPercent);
  },

  getUpgradeCost: (currentValue: number): number => {
    return Math.floor(10 * Math.pow(1.1, currentValue));
  },
};

/** 结算升级，支持连续升级 */
export function checkLevelUp(currentLevel: number, currentExp: number): {
  newLevel: number; newExp: number; didLevelUp: boolean; levelsGained: number;
} {
  let level = currentLevel;
  let exp = currentExp;
  let levelsGained = 0;

  while (level < MAX_LEVEL) {
    const required = XP_TABLE[level];
    if (required === undefined || exp < required) break;
    exp -= required;
    level++;
    levelsGained++;
  }

  return { newLevel: level, newExp: exp, didLevelUp: levelsGained > 0, levelsGained };
}

/** 计算装备加成后的总属性 */
export function getTotalAttributes(state: GameState): PlayerAttributes {
  const base = { ...state.attributes };
  const bonus: PlayerAttributes = { strength: 0, intelligence: 0, agility: 0, constitution: 0, luck: 0 };

  Object.values(state.equipped).forEach((equip) => {
    if (!equip?.bonusAttributes) return;
    const b = equip.bonusAttributes;
    bonus.strength     += b.strength     ?? 0;
    bonus.intelligence += b.intelligence ?? 0;
    bonus.agility      += b.agility      ?? 0;
    bonus.constitution += b.constitution ?? 0;
    bonus.luck         += b.luck         ?? 0;
  });

  return {
    strength:     base.strength     + bonus.strength,
    intelligence: base.intelligence + bonus.intelligence,
    agility:      base.agility      + bonus.agility,
    constitution: base.constitution + bonus.constitution,
    luck:         base.luck         + bonus.luck,
  };
}

/** 获取今天的日期字符串 YYYY-MM-DD (UTC+8) */
export function getTodayCN(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 服务端简化战斗模拟 — 不依赖客户端上报，返回胜负结果 */
export interface BattleSide {
  hp: number;
  atk: number;    // 每轮平均伤害
  critChance: number;
  armor: number;
  level: number;
}

export function serverSimulateBattle(player: BattleSide, enemy: BattleSide): boolean {
  let pHP = player.hp;
  let eHP = enemy.hp;
  const MAX_ROUNDS = 200;

  for (let i = 0; i < MAX_ROUNDS; i++) {
    // 玩家攻击敌人
    const pIsCrit = Math.random() < player.critChance;
    const pDmg = Math.max(1, Math.floor(player.atk * (pIsCrit ? 2 : 1) - enemy.armor * 0.3));
    eHP -= pDmg;
    if (eHP <= 0) return true;

    // 敌人攻击玩家
    const eDmg = Math.max(1, Math.floor(enemy.atk - player.armor * 0.3));
    pHP -= eDmg;
    if (pHP <= 0) return false;
  }

  // 超出轮数：血量多者胜
  return pHP > eHP;
}

/** 从 GameState 构建玩家战斗数据 */
export function buildPlayerBattleSide(state: GameState): BattleSide {
  const attrs = getTotalAttributes(state);
  const classConf = CLASS_CONFIG[state.classId];
  const mainAttr = attrs[classConf.mainStat];
  const mainHand = state.equipped.mainHand;
  const weaponAvg = mainHand?.weaponDamage
    ? (mainHand.weaponDamage.min + mainHand.weaponDamage.max) / 2
    : state.playerLevel * 3;

  const totalArmor = Object.values(state.equipped).reduce(
    (sum, e) => sum + (e?.armor ?? 0), 0
  );

  return {
    hp:         MathCore.getMaxHP(attrs.constitution, state.playerLevel, state.classId),
    atk:        Math.floor(weaponAvg * (1 + mainAttr / 10)),
    critChance: MathCore.getCritChance(attrs.luck, state.playerLevel),
    armor:      Math.min(totalArmor, classConf.armorCap * state.playerLevel),
    level:      state.playerLevel,
  };
}
