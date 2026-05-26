import { DUNGEON_CHAPTERS } from '../data/dungeonTable.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type { CombatantSnapshot, PowerFactionId } from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { buildBattleReplayRecord } from './battleReplayRecords.js';
import { buildPlayerCombatSnapshot } from './characterCombat.js';
import { simulateBattleV2 } from './combatSimulator.js';
import { GameError } from './errors.js';
import { grantExp, grantResource } from './resourceService.js';
import { insertBattleReplay } from '../lib/battleReplayStore.js';

/** 所有已知派系，用于 suspicion 补全（与 missions.ts 保持一致） */
const ALL_FACTIONS: ReadonlyArray<PowerFactionId> = [
  'imperial', 'noble', 'censorate', 'border', 'silver', 'underworld',
];

/**
 * 应用地下城胜利时的权力疑心变化。
 * 逻辑与 missions.ts 中的 applyPowerSuspicion 相同：旧存档自动补全，返回 delta 和 after。
 */
function applyDungeonSuspicion(
  ctx: ActionContext,
  suspicionDeltaOnWin: Partial<Record<PowerFactionId, number>>,
): { suspicionDelta: Partial<Record<PowerFactionId, number>>; suspicionAfter: Partial<Record<PowerFactionId, number>> } {
  // 旧存档没有 suspicion，先全部初始化为 0
  if (!ctx.state.player.suspicion) {
    ctx.state.player.suspicion = {};
  }
  const suspicion = ctx.state.player.suspicion;

  // 补全缺失派系
  for (const faction of ALL_FACTIONS) {
    if (suspicion[faction] === undefined) {
      suspicion[faction] = 0;
    }
  }

  const actualDelta: Partial<Record<PowerFactionId, number>> = {};
  for (const [faction, delta] of Object.entries(suspicionDeltaOnWin) as [PowerFactionId, number][]) {
    if (delta !== 0) {
      const current = suspicion[faction] ?? 0;
      const newVal = Math.max(0, current + delta);
      suspicion[faction] = newVal;
      actualDelta[faction] = newVal - current;
    }
  }

  const suspicionAfter: Partial<Record<PowerFactionId, number>> = { ...suspicion };
  return { suspicionDelta: actualDelta, suspicionAfter };
}

function playerSnapshotToCombatant(ctx: ActionContext): CombatantSnapshot {
  const snapshot = buildPlayerCombatSnapshot(ctx.state);
  return {
    id: ctx.playerId,
    displayName: ctx.state.player.displayName ?? 'Player',
    level: snapshot.level,
    classId: snapshot.classId ?? ctx.state.player.classId,
    attributes: snapshot.attributes,
    hpMax: snapshot.combatStats.hp,
    armor: snapshot.combatStats.armor,
    weaponDamage: { min: snapshot.combatStats.damageMin, max: snapshot.combatStats.damageMax },
    avatarId: ctx.state.player.avatarId,
    equipmentSummary: snapshot.equipmentSummary,
  };
}

export async function dungeonFight(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<any>> {
  if (ctx.state.player.status !== 'ACTIVE') throw new GameError('CHARACTER_NOT_CREATED', 'Character is not active.');
  if (ctx.state.dungeon.status === 'DISABLED') throw new GameError('ACTION_DISABLED', 'Dungeon is disabled.');
  if (ctx.state.dungeon.status === 'UNINITIALIZED') ctx.state.dungeon.status = 'ACTIVE';

  const chapterId = typeof payload.chapterId === 'string'
    ? payload.chapterId
    : DUNGEON_CHAPTERS.find((chapter) => ctx.state.player.level >= chapter.unlockLevel)?.id;
  const chapter = DUNGEON_CHAPTERS.find((entry) => entry.id === chapterId);
  if (!chapter || ctx.state.player.level < chapter.unlockLevel) throw new GameError('ACTION_DISABLED', 'Dungeon chapter is locked.');

  const progress = ctx.state.dungeon.progress[chapter.id] ?? 0;
  const boss = chapter.bosses[progress];
  if (!boss) throw new GameError('ACTION_DISABLED', 'Dungeon chapter is already cleared.');

  const player = playerSnapshotToCombatant(ctx);
  const enemy: CombatantSnapshot = {
    id: boss.id,
    displayName: boss.name,
    level: boss.level,
    classId: boss.class,
    attributes: {
      strength: boss.attributes.strength,
      agility: boss.attributes.dexterity,
      intelligence: boss.attributes.intelligence,
      constitution: boss.attributes.constitution,
      luck: boss.attributes.luck,
    },
    armor: boss.armor,
    weaponDamage: {
      min: Math.max(1, Math.floor(boss.weaponDamage * 0.8)),
      max: Math.max(2, Math.floor(boss.weaponDamage * 1.2)),
    },
  };
  const battleResult = simulateBattleV2({
    player,
    enemy,
    seed: `dungeon_${ctx.playerId}_${boss.id}_${ctx.now}`,
    context: 'DUNGEON',
    firstAttacker: 'player',
  });

  const grantedReward = { xp: 0, copper: 0 };
  // 权力结算结果（仅成功且章节有 powerCase 时存在）
  let powerResult: { suspicionDelta: Partial<Record<PowerFactionId, number>>; suspicionAfter: Partial<Record<PowerFactionId, number>> } | undefined;

  if (battleResult.playerWon) {
    ctx.state.dungeon.progress[chapter.id] = progress + 1;
    grantedReward.xp = boss.rewardXp;
    grantedReward.copper = boss.rewardCoins;
    grantExp(ctx.state, boss.rewardXp);
    grantResource(ctx.state, 'copper', boss.rewardCoins);

    // 阶段2：章节有 powerCase.suspicionDeltaOnWin 时写入疑心值
    const suspicionDeltaOnWin = chapter.powerCase?.suspicionDeltaOnWin;
    if (suspicionDeltaOnWin && Object.keys(suspicionDeltaOnWin).length > 0) {
      powerResult = applyDungeonSuspicion(ctx, suspicionDeltaOnWin);
    }
  }
  // 失败时不修改 suspicion（阶段2设计：失败不加疑心）

  ctx.state.dungeon.dailyAttemptsUsed += 1;
  const replay = await insertBattleReplay(buildBattleReplayRecord({
    ownerPlayerId: ctx.playerId,
    context: 'DUNGEON',
    now: ctx.now,
    battleResult,
    sourceId: `${chapter.id}:${boss.id}:${ctx.now}`,
    title: `${chapter.name}: ${boss.name}`,
    isSavedByPlayer: false,
  }));
  ctx.markDirty();

  return {
    ok: true,
    action: 'DUNGEON_FIGHT',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      result: battleResult.playerWon ? 'WIN' : 'LOSE',
      chapterId: chapter.id,
      bossId: boss.id,
      progressAfter: ctx.state.dungeon.progress[chapter.id] ?? progress,
      battleResult,
      replayId: replay.replayId,
      grantedReward,
      /** 权力结算结果（阶段2新增，成功且章节有 powerCase 时存在） */
      powerResult,
      /** 章节权力案件包装，透传给前端（阶段2新增） */
      powerCase: chapter.powerCase,
    },
  };
}
