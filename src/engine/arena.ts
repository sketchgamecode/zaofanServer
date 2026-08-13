import { createSeededRandom } from '../lib/rng.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type { ArenaOpponentPreview, CombatantSnapshot, GameState, PlayerClassId } from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { buildBattleReplayRecord } from './battleReplayRecords.js';
import { buildPlayerCombatSnapshot } from './characterCombat.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { simulateBattleV2, getFallbackLoadout } from './combatSimulator.js';
import { GameError } from './errors.js';
import { MathCore } from './mathCore.js';
import { grantExp, grantResource, spendResource } from './resourceService.js';
import { insertBattleReplay } from '../lib/battleReplayStore.js';
import { getWeaponFinal, getArmorFinal, getShieldFinal, shields } from '../lib/equipmentData.js';

const ARENA_COOLDOWN_MS = 10 * 60 * 1000;

function ensureArenaActive(state: GameState): void {
  if (state.player.status !== 'ACTIVE') throw new GameError('CHARACTER_NOT_CREATED', 'Character is not active.');
  if (state.arena.status === 'DISABLED') throw new GameError('ARENA_DISABLED', 'Arena is disabled.');
  if (state.arena.status === 'UNINITIALIZED') state.arena.status = 'ACTIVE';
  state.arena.honor ??= 1000;
  state.arena.rank ??= null;
  state.arena.dailyXpWins ??= state.arena.dailyWins ?? 0;
  state.arena.maxDailyXpWins ??= 10;
  state.arena.fightsToday ??= 0;
  state.arena.candidates ??= [];
  state.arena.candidateSetId ??= null;
}

function buildBotCandidate(state: GameState, seed: string, index: number): ArenaOpponentPreview {
  const rng = createSeededRandom(`${seed}:${index}`);
  const classes: PlayerClassId[] = ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E'];
  const classId = rng.pick(classes);
  const level = Math.max(1, state.player.level + rng.int(-2, 2));
  const mainStat = CLASS_CONFIG[classId].mainStat;
  const base = 8 + level * 2 + rng.int(0, 8);
  const attributes = {
    strength: base,
    intelligence: base,
    agility: base,
    constitution: Math.floor(base * 0.85),
    luck: Math.floor(base * 0.45),
  };
  attributes[mainStat] = Math.floor(base * 1.25);

  const honor = Math.max(0, (state.arena.honor ?? 1000) + rng.int(-180, 220));

  // 为 Bot 候选人自动装备符合其等级与职业的 Sancai 武器
  const loadout = getFallbackLoadout(classId, level);

  let dmg = 12;
  let blockBp = 1500;
  let dodgeBp = 0;
  let armorValue = 0;
  let hp = 100;

  if (loadout.weapon) {
    const finalW = getWeaponFinal(loadout.weapon.itemId!, loadout.weapon.material!, loadout.weapon.craft, loadout.weapon.shaft, loadout.weapon.arrow);
    dmg = finalW.dmg;
  }
  if (loadout.body) {
    const finalA = getArmorFinal(loadout.body.itemId!, loadout.body.upgrade);
    armorValue = finalA.reduce;
    dodgeBp = finalA.dodge * 100;
    hp = finalA.stamina;
  }
  if (loadout.offHand) {
    const isShield = shields.some((s) => s.id === loadout.offHand!.itemId);
    if (isShield) {
      const finalS = getShieldFinal(loadout.offHand!.itemId!);
      blockBp += finalS.blockMod * 10000;
      dodgeBp += finalS.dodgeMod * 100;
    } else {
      blockBp = 0;
    }
  }

  return {
    candidateId: `arena_candidate_${Date.now().toString(36)}_${index}`,
    playerId: `bot_${seed}_${index}`,
    displayName: rng.pick(['林冲', '鲁智深', '杨志', '武松', '花荣', '扈三娘']),
    avatarId: `avatar_placeholder_${String(rng.int(0, 63)).padStart(3, '0')}`,
    level,
    classId,
    raceId: 'RACE_01',
    honor,
    rank: Math.max(1, 5000 - honor + index),
    guildName: undefined,
    attributes,
    combatPreview: {
      hp,
      armor: armorValue,
      damageMin: dmg,
      damageMax: dmg,
      critChanceBp: 0,
      blockChanceBp: blockBp,
      dodgeChanceBp: Math.max(0, dodgeBp),
    },
    loadout,
  };
}

function candidateToSnapshot(candidate: ArenaOpponentPreview): CombatantSnapshot {
  return {
    id: candidate.playerId,
    displayName: candidate.displayName,
    level: candidate.level,
    classId: candidate.classId,
    attributes: candidate.attributes,
    armor: candidate.combatPreview.armor,
    weaponDamage: {
      min: candidate.combatPreview.damageMin,
      max: candidate.combatPreview.damageMax,
    },
    honor: candidate.honor,
    rank: candidate.rank,
    avatarId: candidate.avatarId,
    equipmentSummary: { itemPowerTotal: 0 },
    loadout: candidate.loadout,
  };
}

function playerSnapshotToCombatant(state: GameState): CombatantSnapshot {
  const snapshot = buildPlayerCombatSnapshot(state);
  return {
    id: state.player.id ?? 'player',
    displayName: state.player.displayName ?? 'Player',
    level: snapshot.level,
    classId: snapshot.classId ?? state.player.classId,
    attributes: snapshot.attributes,
    hpMax: snapshot.combatStats.hp,
    armor: snapshot.combatStats.armor,
    weaponDamage: {
      min: snapshot.combatStats.damageMin,
      max: snapshot.combatStats.damageMax,
    },
    honor: state.arena.honor ?? 1000,
    rank: state.arena.rank ?? null,
    avatarId: state.player.avatarId,
    equipmentSummary: snapshot.equipmentSummary,
    loadout: snapshot.loadout,
  };
}

function refreshCandidates(state: GameState, now: number): ArenaOpponentPreview[] {
  const setId = `arena_set_${now.toString(36)}`;
  const candidates = [0, 1, 2].map((index) => buildBotCandidate(state, setId, index));
  state.arena.candidateSetId = setId;
  state.arena.candidates = candidates;
  return candidates;
}

function honorDelta(playerHonor: number, targetHonor: number, playerWon: boolean): number {
  const expected = 1 / (1 + (10 ** ((targetHonor - playerHonor) / 400)));
  if (playerWon) return Math.max(1, Math.round(32 * (1 - expected)));
  return -Math.round(32 * expected);
}

export function arenaGetInfo(ctx: ActionContext, _payload: Record<string, unknown>): ActionSuccessResponse<{
  arena: GameState['arena'];
  playerSummary: {
    honor: number;
    rank: number | null;
    dailyXpWins: number;
    maxDailyXpWins: number;
    cooldownRemainingMs: number;
  };
}> {
  ensureArenaActive(ctx.state);
  if (!ctx.state.arena.candidates?.length) refreshCandidates(ctx.state, ctx.now);
  ctx.markDirty();
  return {
    ok: true,
    action: 'ARENA_GET_INFO',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      arena: ctx.state.arena,
      playerSummary: {
        honor: ctx.state.arena.honor ?? 1000,
        rank: ctx.state.arena.rank ?? null,
        dailyXpWins: ctx.state.arena.dailyXpWins ?? 0,
        maxDailyXpWins: ctx.state.arena.maxDailyXpWins ?? 10,
        cooldownRemainingMs: Math.max(0, (ctx.state.arena.cooldownEndTime ?? 0) - ctx.now),
      },
    },
  };
}

export function arenaRefreshCandidates(ctx: ActionContext, _payload: Record<string, unknown>): ActionSuccessResponse<{
  candidateSetId: string | null;
  candidates: ArenaOpponentPreview[];
}> {
  ensureArenaActive(ctx.state);
  const candidates = refreshCandidates(ctx.state, ctx.now);
  ctx.markDirty();
  return {
    ok: true,
    action: 'ARENA_REFRESH_CANDIDATES',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { candidateSetId: ctx.state.arena.candidateSetId ?? null, candidates },
  };
}

export async function arenaFight(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<any>> {
  ensureArenaActive(ctx.state);
  const targetPlayerId = typeof payload.targetPlayerId === 'string' ? payload.targetPlayerId : '';
  if (!targetPlayerId) throw new GameError('ARENA_TARGET_NOT_FOUND', 'Arena target not found.');
  if (targetPlayerId === ctx.playerId) throw new GameError('ARENA_SELF_TARGET', 'Cannot fight yourself.');
  if ((ctx.state.arena.cooldownEndTime ?? 0) > ctx.now) throw new GameError('ARENA_COOLDOWN_ACTIVE', 'Arena cooldown is active.');
  if (!ctx.state.arena.candidates?.length) refreshCandidates(ctx.state, ctx.now);

  if (payload.candidateSetId !== undefined && payload.candidateSetId !== ctx.state.arena.candidateSetId) {
    throw new GameError('ARENA_TARGET_NOT_FOUND', 'Arena candidate set expired.');
  }
  const target = ctx.state.arena.candidates?.find((candidate) => candidate.playerId === targetPlayerId);
  if (!target) throw new GameError('ARENA_TARGET_NOT_FOUND', 'Arena target not found.');

  const honorBefore = ctx.state.arena.honor ?? 1000;
  const rankBefore = ctx.state.arena.rank ?? null;
  const player = playerSnapshotToCombatant(ctx.state);
  const enemy = candidateToSnapshot(target);
  const firstAttacker = honorBefore >= target.honor ? 'player' : 'enemy';
  const battleResult = simulateBattleV2({
    player,
    enemy,
    seed: `arena_${ctx.playerId}_${target.playerId}_${ctx.now}`,
    context: 'ARENA',
    firstAttacker,
  });
  const delta = honorDelta(honorBefore, target.honor, battleResult.playerWon);
  const honorAfter = Math.max(0, honorBefore + delta);
  ctx.state.arena.honor = honorAfter;
  ctx.state.arena.rank = Math.max(1, 5000 - honorAfter);
  ctx.state.arena.fightsToday = (ctx.state.arena.fightsToday ?? 0) + 1;
  ctx.state.arena.cooldownEndTime = ctx.now + ARENA_COOLDOWN_MS;

  const grantedReward = { xp: 0, copper: 0 };
  if (battleResult.playerWon && (ctx.state.arena.dailyXpWins ?? 0) < (ctx.state.arena.maxDailyXpWins ?? 10)) {
    grantedReward.xp = 5 + ctx.state.player.level * 2;
    grantedReward.copper = 10 + ctx.state.player.level * 3;
    grantExp(ctx.state, grantedReward.xp);
    grantResource(ctx.state, 'copper', grantedReward.copper);
    ctx.state.arena.dailyXpWins = (ctx.state.arena.dailyXpWins ?? 0) + 1;
    ctx.state.arena.dailyWins = ctx.state.arena.dailyXpWins;
  }

  const replay = await insertBattleReplay(buildBattleReplayRecord({
    ownerPlayerId: ctx.playerId,
    context: 'ARENA',
    now: ctx.now,
    battleResult,
    sourceId: `${ctx.state.arena.candidateSetId}:${target.playerId}:${ctx.now}`,
    relatedPlayerId: target.playerId,
    isSavedByPlayer: false,
    title: `Arena: ${target.displayName}`,
  }));
  const nextCandidates = refreshCandidates(ctx.state, ctx.now + 1);
  ctx.markDirty();

  return {
    ok: true,
    action: 'ARENA_FIGHT',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      result: battleResult.playerWon ? 'WIN' : 'LOSE',
      battleResult,
      replayId: replay.replayId,
      honorDelta: delta,
      honorBefore,
      honorAfter,
      rankBefore,
      rankAfter: ctx.state.arena.rank ?? null,
      rankDelta: rankBefore === null ? null : (ctx.state.arena.rank ?? rankBefore) - rankBefore,
      grantedReward,
      dailyXpWinsAfter: ctx.state.arena.dailyXpWins ?? 0,
      cooldownEndTime: ctx.state.arena.cooldownEndTime,
      nextCandidates,
    },
  };
}

export function arenaSkipCooldown(ctx: ActionContext, _payload: Record<string, unknown>): ActionSuccessResponse<{
  cooldownEndTime: null;
  spent: 'hourglasses' | 'tokens';
}> {
  ensureArenaActive(ctx.state);
  if ((ctx.state.arena.cooldownEndTime ?? 0) <= ctx.now) {
    return {
      ok: true,
      action: 'ARENA_SKIP_COOLDOWN',
      serverTime: ctx.now,
      stateRevision: ctx.state.meta.stateRevision,
      data: { cooldownEndTime: null, spent: 'hourglasses' },
    };
  }

  let spent: 'hourglasses' | 'tokens';
  if (ctx.state.resources.hourglasses > 0) {
    spendResource(ctx.state, 'hourglasses', 1, 'INSUFFICIENT_PREMIUM_RESOURCE');
    spent = 'hourglasses';
  } else if (ctx.state.resources.tokens > 0) {
    spendResource(ctx.state, 'tokens', 1, 'INSUFFICIENT_PREMIUM_RESOURCE');
    spent = 'tokens';
  } else {
    throw new GameError('INSUFFICIENT_PREMIUM_RESOURCE', 'Not enough resources to skip arena cooldown.');
  }

  ctx.state.arena.cooldownEndTime = null;
  ctx.markDirty();
  return {
    ok: true,
    action: 'ARENA_SKIP_COOLDOWN',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { cooldownEndTime: null, spent },
  };
}
