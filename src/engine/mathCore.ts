import { MAX_LEVEL, XP_TABLE } from '../data/xpTable.js';
import { createSeededRandom } from '../lib/rng.js';
import { getGameDateString } from '../lib/time.js';
import type {
  AttributeState,
  BattleResult,
  EquipmentItem,
  EnemySnapshot,
  GameState,
  PlayerClassId,
  PlayerCombatSnapshot,
} from '../types/gameState.js';

export const CLASS_CONFIG: Record<PlayerClassId, {
  name: string;
  mainStat: 'strength' | 'agility' | 'intelligence';
  hpMultiplier: number;
  armorCap: number;
}> = {
  CLASS_A: { name: '猛将', mainStat: 'strength', hpMultiplier: 5, armorCap: 50 },
  CLASS_B: { name: '游侠', mainStat: 'agility', hpMultiplier: 4, armorCap: 25 },
  CLASS_C: { name: '谋士', mainStat: 'intelligence', hpMultiplier: 2, armorCap: 10 },
  CLASS_D: { name: '刺客', mainStat: 'agility', hpMultiplier: 4, armorCap: 25 },
};

export const MathCore = {
  getMaxHP: (constitution: number, level: number, classId: PlayerClassId): number =>
    constitution * level * CLASS_CONFIG[classId].hpMultiplier,

  getCritChance: (luck: number, enemyLevel: number): number =>
    Math.min(0.5, ((luck * 5) / (Math.max(1, enemyLevel) * 2)) / 100),
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
    if (required === undefined || exp < required) {
      break;
    }

    exp -= required;
    level += 1;
    levelsGained += 1;
  }

  return { newLevel: level, newExp: exp, didLevelUp: levelsGained > 0, levelsGained };
}

export function getTotalAttributes(state: GameState): AttributeState {
  const total: AttributeState = { ...state.attributes };

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

function battleSideFromPlayer(snapshot: PlayerCombatSnapshot): BattleSide {
  return {
    hp: snapshot.combatStats.hp,
    damageMin: snapshot.combatStats.damageMin,
    damageMax: snapshot.combatStats.damageMax,
    critChanceBp: snapshot.combatStats.critChanceBp,
    dodgeChanceBp: snapshot.combatStats.dodgeChanceBp,
    armor: snapshot.combatStats.armor,
    level: snapshot.level,
  };
}

function battleSideFromEnemy(snapshot: EnemySnapshot): BattleSide {
  return {
    hp: snapshot.combatStats.hp,
    damageMin: snapshot.combatStats.damageMin,
    damageMax: snapshot.combatStats.damageMax,
    critChanceBp: snapshot.combatStats.critChanceBp,
    dodgeChanceBp: snapshot.combatStats.dodgeChanceBp,
    armor: snapshot.combatStats.armor,
    level: snapshot.level,
  };
}

function rollDamage(attacker: BattleSide, defender: BattleSide, rng: ReturnType<typeof createSeededRandom>): { damage: number; wasCrit: boolean; dodged: boolean } {
  const dodged = defender.dodgeChanceBp !== undefined && rng.chanceBp(defender.dodgeChanceBp);
  if (dodged) {
    return { damage: 0, wasCrit: false, dodged: true };
  }

  const rawDamage = rng.int(attacker.damageMin, attacker.damageMax);
  const wasCrit = rng.chanceBp(attacker.critChanceBp);
  const critDamage = wasCrit ? Math.floor(rawDamage * 1.75) : rawDamage;
  const mitigated = Math.max(1, Math.floor(critDamage - defender.armor * 0.25));
  return { damage: mitigated, wasCrit, dodged: false };
}

export function serverSimulateBattle(input: {
  player: PlayerCombatSnapshot;
  enemy: EnemySnapshot;
  seed: string;
}): BattleResult {
  const rng = createSeededRandom(input.seed);
  const player = battleSideFromPlayer(input.player);
  const enemy = battleSideFromEnemy(input.enemy);
  let playerHp = player.hp;
  let enemyHp = enemy.hp;
  const rounds: BattleResult['rounds'] = [];

  for (let roundIndex = 0; roundIndex < 200; roundIndex += 1) {
    const playerRoll = rollDamage(player, enemy, rng);
    enemyHp = Math.max(0, enemyHp - playerRoll.damage);
    rounds.push({
      attacker: 'player',
      damage: playerRoll.damage,
      targetHpAfter: enemyHp,
      wasCrit: playerRoll.wasCrit || undefined,
    });
    if (enemyHp <= 0) {
      return {
        playerWon: true,
        rounds,
        playerHpEnd: playerHp,
        enemyHpEnd: enemyHp,
        totalRounds: rounds.length,
      };
    }

    const enemyRoll = rollDamage(enemy, player, rng);
    playerHp = Math.max(0, playerHp - enemyRoll.damage);
    rounds.push({
      attacker: 'enemy',
      damage: enemyRoll.damage,
      targetHpAfter: playerHp,
      wasCrit: enemyRoll.wasCrit || undefined,
    });
    if (playerHp <= 0) {
      return {
        playerWon: false,
        rounds,
        playerHpEnd: playerHp,
        enemyHpEnd: enemyHp,
        totalRounds: rounds.length,
      };
    }
  }

  return {
    playerWon: playerHp >= enemyHp,
    rounds,
    playerHpEnd: playerHp,
    enemyHpEnd: enemyHp,
    totalRounds: rounds.length,
  };
}

function getWeaponAverageDamage(item: EquipmentItem | null, level: number): number {
  if (!item?.weaponDamage) {
    return level * 3;
  }

  return (item.weaponDamage.min + item.weaponDamage.max) / 2;
}

export function buildPlayerBattleSide(state: GameState): BattleSide {
  const attrs = getTotalAttributes(state);
  const classConf = CLASS_CONFIG[state.player.classId];
  const mainAttr = attrs[classConf.mainStat];
  const totalArmor = Object.values(state.equipment.equipped).reduce((sum, item) => sum + (item?.armor ?? 0), 0);
  const weaponAverageDamage = getWeaponAverageDamage(state.equipment.equipped.weapon, state.player.level);
  const damageMin = Math.floor(weaponAverageDamage * 0.8 * (1 + mainAttr / 10));
  const damageMax = Math.floor(weaponAverageDamage * 1.2 * (1 + mainAttr / 10));

  return {
    hp: MathCore.getMaxHP(attrs.constitution, state.player.level, state.player.classId),
    damageMin,
    damageMax,
    critChanceBp: Math.floor(MathCore.getCritChance(attrs.luck, state.player.level) * 10000),
    dodgeChanceBp: Math.min(2500, attrs.agility * 15),
    blockChanceBp: undefined,
    armor: Math.min(totalArmor, classConf.armorCap * state.player.level),
    level: state.player.level,
  };
}
