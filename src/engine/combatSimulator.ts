import { createHash } from 'node:crypto';
import { createSeededRandom } from '../lib/rng.js';
import type {
  BattleActionEvent,
  BattleContext,
  BattleHitEvent,
  BattleResultV2,
  CombatantSnapshot,
  EnemySnapshot,
  PlayerCombatSnapshot,
} from '../types/gameState.js';
import { CLASS_CONFIG } from './combatConfig.js';

type SideKey = 'player' | 'enemy';

const MAX_ACTIONS = 200;
const MAX_FRENZY_HITS = 15;
const CRIT_MULTIPLIER = 2;

function seedPublicHash(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function defaultAttributes() {
  return { strength: 10, intelligence: 10, agility: 10, constitution: 10, luck: 10 };
}

function normalizePlayer(snapshot: PlayerCombatSnapshot): CombatantSnapshot {
  const classId = snapshot.classId ?? 'CLASS_A';
  return {
    id: snapshot.playerId ?? 'player',
    displayName: snapshot.displayName ?? 'Player',
    level: snapshot.level,
    classId,
    attributes: snapshot.attributes,
    hpMax: snapshot.combatStats.hp,
    armor: snapshot.combatStats.armor,
    weaponDamage: {
      min: Math.max(1, snapshot.combatStats.damageMin),
      max: Math.max(snapshot.combatStats.damageMin + 1, snapshot.combatStats.damageMax),
    },
    avatarId: snapshot.avatarId,
    equipmentSummary: snapshot.equipmentSummary,
  };
}

function normalizeEnemy(snapshot: EnemySnapshot): CombatantSnapshot {
  const attrs = snapshot.attributes ?? defaultAttributes();
  const classId = snapshot.classId ?? 'CLASS_A';
  return {
    id: snapshot.enemyId,
    displayName: snapshot.name,
    level: snapshot.level,
    classId,
    attributes: attrs,
    hpMax: snapshot.combatStats.hp,
    armor: snapshot.combatStats.armor,
    weaponDamage: {
      min: Math.max(1, snapshot.combatStats.damageMin),
      max: Math.max(snapshot.combatStats.damageMin + 1, snapshot.combatStats.damageMax),
    },
    avatarId: snapshot.avatarId,
  };
}

export function getCombatantMaxHp(snapshot: CombatantSnapshot): number {
  if (snapshot.hpMax !== undefined) return Math.max(1, snapshot.hpMax);
  return Math.ceil(snapshot.attributes.constitution * CLASS_CONFIG[snapshot.classId].hpMultiplier * (snapshot.level + 1));
}

function getMainStat(snapshot: CombatantSnapshot): number {
  return snapshot.attributes[CLASS_CONFIG[snapshot.classId].mainStat];
}

function getCritChanceBp(attacker: CombatantSnapshot, defender: CombatantSnapshot): number {
  return Math.min(5000, Math.floor((attacker.attributes.luck * 2.5 / Math.max(1, defender.level)) * 100));
}

function getArmorReductionBp(attacker: CombatantSnapshot, defender: CombatantSnapshot): number {
  if (CLASS_CONFIG[attacker.classId].bypassArmor) return 0;
  const defenderConfig = CLASS_CONFIG[defender.classId];
  const effectiveArmor = defenderConfig.armorHalved ? Math.floor(defender.armor * 0.5) : defender.armor;
  const reductionPercent = Math.min(defenderConfig.armorCap, effectiveArmor / Math.max(1, attacker.level));
  return Math.max(0, Math.floor(reductionPercent * 100));
}

function getAttrFactor(attacker: CombatantSnapshot, defender: CombatantSnapshot): number {
  const ownMain = getMainStat(attacker);
  const enemyMain = getMainStat(defender);
  return 1 + Math.max(ownMain / 2, ownMain - enemyMain / 2) / 10;
}

function getActionHitCount(attacker: CombatantSnapshot, rng: ReturnType<typeof createSeededRandom>): number {
  const config = CLASS_CONFIG[attacker.classId];
  if (config.dualWield) return 2;
  if (!config.frenzyChanceBp) return 1;

  let hits = 1;
  while (hits < MAX_FRENZY_HITS && rng.chanceBp(config.frenzyChanceBp)) {
    hits += 1;
  }
  return hits;
}

function rollHit(input: {
  attackerKey: SideKey;
  defenderKey: SideKey;
  attacker: CombatantSnapshot;
  defender: CombatantSnapshot;
  defenderHp: number;
  roundNumber: number;
  hitIndex: number;
  rng: ReturnType<typeof createSeededRandom>;
}): { event: BattleHitEvent; defenderHpAfter: number } {
  const attackerConfig = CLASS_CONFIG[input.attacker.classId];
  let wasBlocked = false;
  let wasDodged = false;

  if (!attackerConfig.bypassArmor) {
    const defenderConfig = CLASS_CONFIG[input.defender.classId];
    wasBlocked = input.rng.chanceBp(defenderConfig.blockChanceBp);
    wasDodged = !wasBlocked && input.rng.chanceBp(defenderConfig.dodgeChanceBp);
  }

  const rawWeaponRoll = input.rng.int(input.attacker.weaponDamage.min, input.attacker.weaponDamage.max);
  const armorReductionBp = getArmorReductionBp(input.attacker, input.defender);
  const rageMultiplierBp = Math.floor((1 + input.roundNumber / 6) * 10000);
  let wasCrit = false;
  let damage = 0;

  if (!wasBlocked && !wasDodged) {
    wasCrit = input.rng.chanceBp(getCritChanceBp(input.attacker, input.defender));
    const classAttackFactor = attackerConfig.dualWield ? 0.625 : 1;
    const rawDamage = rawWeaponRoll
      * attackerConfig.weaponFactor
      * classAttackFactor
      * getAttrFactor(input.attacker, input.defender)
      * (1 - armorReductionBp / 10000)
      * (wasCrit ? CRIT_MULTIPLIER : 1)
      * (rageMultiplierBp / 10000);
    damage = Math.max(1, Math.floor(rawDamage));
  }

  const defenderHpAfter = Math.max(0, input.defenderHp - damage);
  return {
    defenderHpAfter,
    event: {
      hitIndex: input.hitIndex,
      attacker: input.attackerKey,
      defender: input.defenderKey,
      attackerClassId: input.attacker.classId,
      defenderClassId: input.defender.classId,
      rawWeaponRoll,
      damage,
      targetHpAfter: defenderHpAfter,
      wasCrit,
      wasBlocked,
      wasDodged,
      armorReductionBp,
      rageMultiplierBp,
    },
  };
}

export function simulateBattleV2(input: {
  player: PlayerCombatSnapshot | CombatantSnapshot;
  enemy: EnemySnapshot | CombatantSnapshot;
  seed: string;
  context: BattleContext;
  firstAttacker?: SideKey;
}): BattleResultV2 {
  const rng = createSeededRandom(input.seed);
  const player = 'combatStats' in input.player ? normalizePlayer(input.player) : input.player;
  const enemy = 'combatStats' in input.enemy ? normalizeEnemy(input.enemy) : input.enemy;
  let playerHp = getCombatantMaxHp(player);
  let enemyHp = getCombatantMaxHp(enemy);
  const playerHpMax = playerHp;
  const enemyHpMax = enemyHp;
  const actions: BattleActionEvent[] = [];
  let attackerKey: SideKey = input.firstAttacker ?? 'player';
  let roundNumber = 0;
  let actionsInRound = 0;
  let endedBy: BattleResultV2['endedBy'] = 'ROUND_LIMIT';

  for (let actionIndex = 0; actionIndex < MAX_ACTIONS; actionIndex += 1) {
    const attacker = attackerKey === 'player' ? player : enemy;
    const defenderKey: SideKey = attackerKey === 'player' ? 'enemy' : 'player';
    const defender = defenderKey === 'player' ? player : enemy;
    const hits: BattleHitEvent[] = [];
    const hitCount = getActionHitCount(attacker, rng);

    for (let hitIndex = 0; hitIndex < hitCount; hitIndex += 1) {
      const defenderHp = defenderKey === 'player' ? playerHp : enemyHp;
      const rolled = rollHit({
        attackerKey,
        defenderKey,
        attacker,
        defender,
        defenderHp,
        roundNumber,
        hitIndex,
        rng,
      });
      hits.push(rolled.event);
      if (defenderKey === 'player') playerHp = rolled.defenderHpAfter;
      else enemyHp = rolled.defenderHpAfter;

      if (rolled.defenderHpAfter <= 0) {
        endedBy = 'KNOCKOUT';
        break;
      }
    }

    actions.push({ actionIndex, roundNumber, attacker: attackerKey, hits });
    if (endedBy === 'KNOCKOUT') break;

    attackerKey = defenderKey;
    actionsInRound += 1;
    if (actionsInRound >= 2) {
      roundNumber += 1;
      actionsInRound = 0;
    }
  }

  const winner: SideKey = playerHp === enemyHp ? (attackerKey === 'player' ? 'enemy' : 'player') : (playerHp > enemyHp ? 'player' : 'enemy');

  return {
    schemaVersion: 2,
    context: input.context,
    seedPublicHash: seedPublicHash(input.seed),
    winner,
    playerWon: winner === 'player',
    player: {
      id: player.id,
      name: player.displayName,
      level: player.level,
      classId: player.classId,
      hpMax: playerHpMax,
      hpEnd: playerHp,
      avatarId: player.avatarId,
      snapshot: player,
    },
    enemy: {
      id: enemy.id,
      name: enemy.displayName,
      level: enemy.level,
      classId: enemy.classId,
      hpMax: enemyHpMax,
      hpEnd: enemyHp,
      avatarId: enemy.avatarId,
      snapshot: enemy,
    },
    actions,
    totalActions: actions.length,
    totalRounds: Math.max(roundNumber + (actionsInRound > 0 ? 1 : 0), 1),
    endedBy,
  };
}
