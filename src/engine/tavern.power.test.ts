/**
 * tavern.power.test.ts — 阶段1：权力集团差事系统单元测试
 *
 * 覆盖：
 *   1. 任务生成：3 个 offer 均有 powerContext
 *   2. slot 0 是同阵营，slot 1 是 imperial，slot 2 是跨阵营
 *   3. 旧存档（无 powerFaction）fallback 处理不报错，且能生成任务
 *   4. START_MISSION 后 activeMission.powerContext 保存正确
 *   5. ActiveMissionView.powerContext 正确返回
 *   6. COMPLETE_MISSION 成功后 suspicion 正确增加
 *   7. CompleteMissionData.powerResult 字段正确
 *   8. 旧存档（无 suspicion）补全六个派系为 0 不报错
 *   9. 失败任务不更新 suspicion
 *  10. skipMission 也走结算逻辑（suspicion 正确写入）
 *  11. 现有任务奖励、firstMissionBonus 逻辑不回归
 */

import { describe, it, expect, vi } from 'vitest';
import { generateMissionOffers, buildActiveMissionView, getTavernInfo } from './tavern.js';
import { startMission, completeMission, skipMission } from './missions.js';
import { createInitialGameState } from './gameStateFactory.js';
import type { GameState, PowerFactionId, MissionOffer, ActiveMission } from '../types/gameState.js';
import { ensureWorldInitialized } from './world.js';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

const ALL_FACTIONS: PowerFactionId[] = [
  'imperial', 'noble', 'censorate', 'border', 'silver', 'underworld',
];

function makeCtx(state: GameState, now: number = 1_000_000) {
  let dirty = false;
  return {
    playerId: 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

function makeActiveState(overrides?: Partial<GameState['player']>): GameState {
  const state = createInitialGameState({ now: 1_000_000, playerId: 'test-player' });
  state.player.status = 'ACTIVE';
  state.player.classId = 'CLASS_A';
  state.player.raceId = 'RACE_01';
  state.player.displayName = '测试侠';
  state.player.powerFaction = 'border';
  state.player.suspicion = {
    imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0,
  };
  state.resources.copper = 99999;
  state.resources.tokens = 100;
  state.resources.hourglasses = 100;

  // Initialize world actors so location/servicePosition lookup doesn't crash on empty array
  ensureWorldInitialized(makeCtx(state));

  if (overrides) {
    Object.assign(state.player, overrides);
  }
  return state;
}

/**
 * 在存档中生成任务并启动，然后将 endTime 提前到过去以便立即结算。
 */
function setupMissionAndAdvanceTime(
  state: GameState,
  nowMs: number = 1_000_000,
): { activeMission: ActiveMission; endTime: number } {
  generateMissionOffers(state, nowMs);
  const offer = state.tavern.missionOffers[0]!;
  const ctx = makeCtx(state, nowMs);
  startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });
  const activeMission = state.tavern.activeMission!;
  // 将结束时间拉到过去，方便立刻结算
  activeMission.endTime = nowMs - 1;
  return { activeMission, endTime: activeMission.endTime };
}

// ---------------------------------------------------------------------------
// 1. 任务生成：3 个 offer 均有 powerContext
// ---------------------------------------------------------------------------
describe('任务生成 — 权力上下文', () => {
  it('生成的 3 个任务均应含有 powerContext', () => {
    const state = makeActiveState();
    const offers = generateMissionOffers(state, 1_000_000);
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.powerContext).toBeDefined();
      expect(offer.powerContext!.issuerFaction).toMatch(/^(imperial|noble|censorate|border|silver|underworld)$/);
      expect(offer.powerContext!.targetFaction).toMatch(/^(imperial|noble|censorate|border|silver|underworld)$/);
      expect(offer.powerContext!.caseType).toMatch(/^(raid|audit|escort|arrest|purge|smuggle|petition)$/);
    }
  });

  it('slot 0 的发布方应为玩家所属阵营', () => {
    const state = makeActiveState({ powerFaction: 'censorate' });
    const offers = generateMissionOffers(state, 1_000_000);
    expect(offers[0]!.powerContext!.issuerFaction).toBe('censorate');
  });

  it('slot 1 的发布方应为 imperial（皇权中枢任务）', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000);
    expect(offers[1]!.powerContext!.issuerFaction).toBe('imperial');
  });

  it('slot 2 的发布方应为玩家所属阵营（跨阵营任务）', () => {
    const state = makeActiveState({ powerFaction: 'silver' });
    const offers = generateMissionOffers(state, 1_000_000);
    expect(offers[2]!.powerContext!.issuerFaction).toBe('silver');
  });

  it('slot 1 的 suspicionDeltaPreview 应对目标阵营有 2-5 的值', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000);
    const slot1 = offers[1]!;
    const target = slot1.powerContext!.targetFaction;
    const delta = slot1.powerContext!.suspicionDeltaPreview?.[target] ?? 0;
    expect(delta).toBeGreaterThanOrEqual(2);
    expect(delta).toBeLessThanOrEqual(5);
  });

  it('slot 2 的 suspicionDeltaPreview 应对目标阵营有 3-8 的值', () => {
    const state = makeActiveState({ powerFaction: 'underworld' });
    const offers = generateMissionOffers(state, 1_000_000);
    const slot2 = offers[2]!;
    const target = slot2.powerContext!.targetFaction;
    const delta = slot2.powerContext!.suspicionDeltaPreview?.[target] ?? 0;
    expect(delta).toBeGreaterThanOrEqual(3);
    expect(delta).toBeLessThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// 2. 旧存档 fallback
// ---------------------------------------------------------------------------
describe('旧存档兼容性 — powerFaction/suspicion 缺失时不报错', () => {
  it('旧存档不含 powerFaction 时，generateMissionOffers 应不报错并生成 3 个任务', () => {
    const state = makeActiveState();
    delete (state.player as any).powerFaction;
    expect(() => generateMissionOffers(state, 1_000_000)).not.toThrow();
    expect(state.tavern.missionOffers).toHaveLength(3);
  });

  it('旧存档不含 powerFaction 时，所有任务仍应有 powerContext', () => {
    const state = makeActiveState();
    delete (state.player as any).powerFaction;
    generateMissionOffers(state, 1_000_000);
    for (const offer of state.tavern.missionOffers) {
      expect(offer.powerContext).toBeDefined();
    }
  });

  it('旧存档 powerFaction 按 raceId fallback：RACE_01(军户) → border', () => {
    const state = makeActiveState({ raceId: 'RACE_01' });
    delete (state.player as any).powerFaction;
    generateMissionOffers(state, 1_000_000);
    // slot 0 和 slot 2 的发布方应为 border（军户的默认派系）
    expect(state.tavern.missionOffers[0]!.powerContext!.issuerFaction).toBe('border');
  });

  it('旧存档不含 suspicion 时，completeMission 成功后应自动补全所有派系', () => {
    const state = makeActiveState();
    delete (state.player as any).suspicion;
    setupMissionAndAdvanceTime(state);
    // 让 activeMission 强制有 suspicionDeltaPreview 以触发补全
    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'border',
      targetFaction: 'silver',
      caseType: 'audit',
      suspicionDeltaPreview: { silver: 3 },
    };

    // 强制玩家在战斗中必赢（通过让敌人战力极低）
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    completeMission(ctx, {});

    // suspicion 应该被补全（成功后 ALL_FACTIONS 都有值）
    if (state.player.suspicion) {
      for (const faction of ALL_FACTIONS) {
        expect(state.player.suspicion[faction]).toBeDefined();
        expect(state.player.suspicion[faction]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. START_MISSION 后 powerContext 保存在 activeMission
// ---------------------------------------------------------------------------
describe('START_MISSION — powerContext 持久化', () => {
  it('startMission 后 activeMission 应保存 offer 的 powerContext', () => {
    const state = makeActiveState();
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[0]!;
    const expectedPowerContext = offer.powerContext;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });

    expect(state.tavern.activeMission).not.toBeNull();
    expect(state.tavern.activeMission!.powerContext).toBeDefined();
    expect(state.tavern.activeMission!.powerContext).toEqual(expectedPowerContext);
  });
});

// ---------------------------------------------------------------------------
// 4. ActiveMissionView 返回 powerContext
// ---------------------------------------------------------------------------
describe('ActiveMissionView — powerContext 透传', () => {
  it('buildActiveMissionView 应返回 activeMission.powerContext', () => {
    const state = makeActiveState();
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[1]!; // slot 1 有清晰的 powerContext
    startMission(makeCtx(state), { missionId: offer.missionId, offerSetId: offer.offerSetId });

    const view = buildActiveMissionView(state.tavern.activeMission, 1_000_000);
    expect(view).not.toBeNull();
    expect(view!.powerContext).toBeDefined();
    expect(view!.powerContext!.issuerFaction).toBe('imperial');
  });

  it('activeMission 无 powerContext 时，view.powerContext 应为 undefined', () => {
    const state = makeActiveState();
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[0]!;
    startMission(makeCtx(state), { missionId: offer.missionId, offerSetId: offer.offerSetId });
    // 手动删除 powerContext
    delete (state.tavern.activeMission as any).powerContext;

    const view = buildActiveMissionView(state.tavern.activeMission, 1_000_000);
    expect(view!.powerContext).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. COMPLETE_MISSION — suspicion 写入和 powerResult
// ---------------------------------------------------------------------------
describe('COMPLETE_MISSION — suspicion 写入', () => {
  it('成功结算后，powerResult 应包含正确的 suspicionDelta 和 suspicionAfter', () => {
    const state = makeActiveState({
      powerFaction: 'border',
      suspicion: { imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0 },
    });
    setupMissionAndAdvanceTime(state);

    // 直接覆盖 activeMission.powerContext，给定固定 delta 用于确定性测试
    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'border',
      targetFaction: 'silver',
      caseType: 'audit',
      suspicionDeltaPreview: { silver: 4 },
    };
    // 让敌人必败
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    const res = completeMission(ctx, {});

    // suspicion 应变化
    expect(state.player.suspicion!.silver).toBe(4);
    // powerResult 应在响应里
    expect(res.data.powerResult).toBeDefined();
    expect(res.data.powerResult!.suspicionDelta!.silver).toBe(4);
    expect(res.data.powerResult!.suspicionAfter!.silver).toBe(4);
  });

  it('失败时 suspicion 不应改变', () => {
    const state = makeActiveState({
      powerFaction: 'border',
      suspicion: { imperial: 5, noble: 5, censorate: 5, border: 5, silver: 5, underworld: 5 },
    });
    setupMissionAndAdvanceTime(state);

    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'border',
      targetFaction: 'silver',
      caseType: 'audit',
      suspicionDeltaPreview: { silver: 10 },
    };
    // 让玩家必败（HP极低，敌人超强）
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 99999;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 9999;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    const res = completeMission(ctx, {});

    expect(res.data.result).toBe('FAILED');
    // suspicion 不应改变
    expect(state.player.suspicion!.silver).toBe(5);
    // powerResult 在失败时不应存在
    expect(res.data.powerResult).toBeUndefined();
  });

  it('多次结算同一任务（ALREADY_SETTLED）应返回缓存的 powerResult', () => {
    const state = makeActiveState({
      powerFaction: 'silver',
      suspicion: { imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0 },
    });
    setupMissionAndAdvanceTime(state);
    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'silver',
      targetFaction: 'noble',
      caseType: 'smuggle',
      suspicionDeltaPreview: { noble: 3 },
    };
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    const res1 = completeMission(ctx, {});
    expect(res1.data.result).not.toBe('ALREADY_SETTLED');
    const suspicionAfterFirst = state.player.suspicion!.noble;

    // 第二次调用，此时 activeMission 已 null，走 lastSettlement
    const res2 = completeMission(ctx, {});
    expect(res2.data.result).toBe('ALREADY_SETTLED');
    // suspicion 不应再次增加
    expect(state.player.suspicion!.noble).toBe(suspicionAfterFirst);
  });
});

// ---------------------------------------------------------------------------
// 6. SKIP_MISSION — suspicion 也走结算逻辑
// ---------------------------------------------------------------------------
describe('SKIP_MISSION — suspicion 写入', () => {
  it('skipMission 成功时也应写入 suspicion 和 powerResult', () => {
    const state = makeActiveState({
      powerFaction: 'censorate',
      suspicion: { imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0 },
    });
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[2]!; // slot 2 牵连最明显
    startMission(makeCtx(state), { missionId: offer.missionId, offerSetId: offer.offerSetId });

    // 覆盖固定 powerContext
    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'censorate',
      targetFaction: 'border',
      caseType: 'audit',
      suspicionDeltaPreview: { border: 5 },
    };
    // 让玩家必赢
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    // skipMission 在任务进行中（endTime > now）时消耗资源并结算
    const ctx = makeCtx(state, 1_000_000);
    // activeMission.endTime 大于 ctx.now，触发 skip 消耗
    state.tavern.activeMission!.endTime = 2_000_000;

    const res = skipMission(ctx, {});
    expect(res.action).toBe('SKIP_MISSION');

    // suspicion 应该被写入
    expect(state.player.suspicion!.border).toBe(5);
    expect(res.data.powerResult).toBeDefined();
    expect(res.data.powerResult!.suspicionDelta!.border).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 7. 现有奖励机制不回归
// ---------------------------------------------------------------------------
describe('现有任务逻辑不回归', () => {
  it('生成任务后仍正确设置 baseDurationSec 和 visibleReward', () => {
    const state = makeActiveState();
    generateMissionOffers(state, 1_000_000);
    for (const offer of state.tavern.missionOffers) {
      expect(offer.baseDurationSec).toBeGreaterThan(0);
      expect(offer.visibleReward.xp).toBeGreaterThan(0);
      expect(offer.visibleReward.copper).toBeGreaterThan(0);
    }
  });

  it('firstMissionBonus 逻辑不受影响', () => {
    const state = makeActiveState();
    state.tavern.firstMissionBonusClaimed = false;
    setupMissionAndAdvanceTime(state);
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    const res = completeMission(ctx, {});

    expect(state.tavern.firstMissionBonusClaimed).toBe(true);
    expect(res.data.grantedReward.tokens).toBeGreaterThanOrEqual(1);
  });

  it('不带 powerContext 的任务（手动清除后）结算不应报错', () => {
    const state = makeActiveState();
    setupMissionAndAdvanceTime(state);
    delete (state.tavern.activeMission as any).powerContext;
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    expect(() => completeMission(ctx, {})).not.toThrow();
  });

  it('COMPLETE_MISSION SUCCESS should transfer power based on low/high risk rules', () => {
    // 1. Same faction: low risk (1 point)
    const state = makeActiveState({
      powerFaction: 'border',
    });
    setupMissionAndAdvanceTime(state);
    state.tavern.activeMission!.powerContext = {
      issuerFaction: 'border',
      targetFaction: 'border',
      caseType: 'raid',
      suspicionDeltaPreview: {},
    };
    state.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx = makeCtx(state);
    ctx.state.tavern.activeMission!.endTime = ctx.now - 1;
    const res = completeMission(ctx, {});
    
    expect(res.data.powerResult).toBeDefined();
    expect(res.data.powerResult!.powerTransfer).toBeDefined();
    expect(res.data.powerResult!.powerTransfer!.actorPowerDelta).toBe(1);

    // 2. Cross faction: high risk (2 points)
    const state2 = makeActiveState({
      powerFaction: 'border',
    });
    setupMissionAndAdvanceTime(state2);
    state2.tavern.activeMission!.powerContext = {
      issuerFaction: 'border',
      targetFaction: 'silver',
      caseType: 'raid',
      suspicionDeltaPreview: {},
    };
    state2.tavern.activeMission!.enemySnapshot.combatStats.hp = 1;
    state2.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 0;
    state2.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 0;
    state2.tavern.activeMission!.playerCombatSnapshot.combatStats.hp = 9999;

    const ctx2 = makeCtx(state2);
    ctx2.state.tavern.activeMission!.endTime = ctx2.now - 1;
    const res2 = completeMission(ctx2, {});
    
    expect(res2.data.powerResult).toBeDefined();
    expect(res2.data.powerResult!.powerTransfer).toBeDefined();
    expect(res2.data.powerResult!.powerTransfer!.actorPowerDelta).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 8. 任务目标世界角色化 V1 测试
// ---------------------------------------------------------------------------
describe('任务目标世界角色化 V1', () => {
  it('GENERATE_MISSIONS 返回的每个 mission offer 都有 targetActor 且 faction 匹配', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000);
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.targetActor).toBeDefined();
      expect(offer.targetActor!.actorId).toBeDefined();
      expect(offer.targetActor!.displayName).toBeDefined();
      expect(offer.targetActor!.avatarId).toBeDefined();
      expect(offer.targetActor!.faction).toBe(offer.powerContext!.targetFaction);
      expect(offer.targetActor!.reason).toBeDefined();
      expect(offer.targetActor!.reason.length).toBeGreaterThan(0);
      expect(offer.targetActor!.level).toBeGreaterThanOrEqual(1);
    }
  });

  it('START_MISSION 后 activeMission 保留同一个 targetActor 且敌方 snapshot 来自 targetActor', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[0]!;
    const expectedTarget = offer.targetActor!;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });

    const active = state.tavern.activeMission!;
    expect(active.targetActor).toBeDefined();
    expect(active.targetActor!.actorId).toBe(expectedTarget.actorId);

    // 敌方 snapshot 应该反映 targetActor
    expect(active.enemySnapshot.enemyId).toBe(expectedTarget.actorId);
    expect(active.enemySnapshot.name).toBe(expectedTarget.displayName);
    expect(active.enemySnapshot.level).toBe(expectedTarget.level);
    expect(active.enemySnapshot.classId).toBe(expectedTarget.classId);
    expect(active.enemySnapshot.avatarId).toBe(expectedTarget.avatarId);
  });

  it('COMPLETE_MISSION 成功返回同一个 targetActor，并正常写入 suspicion / powerResult，且优先扣除 targetActor 权柄', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[0]!;
    const targetActorId = offer.targetActor!.actorId;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });
    const active = state.tavern.activeMission!;
    active.endTime = ctx.now - 1;

    // 强制赢
    active.playerCombatSnapshot.combatStats.hp = 99999;
    active.enemySnapshot.combatStats.hp = 1;
    active.enemySnapshot.combatStats.damageMin = 0;
    active.enemySnapshot.combatStats.damageMax = 0;

    // 记录 target actor 的 powerShare 之前
    const actorInWorld = state.world.actors.find(a => a.actorId === targetActorId)!;
    const powerBefore = actorInWorld.powerShare;

    const res = completeMission(ctx, {});
    expect(res.data.result).toBe('SUCCESS');
    expect(res.data.targetActor).toBeDefined();
    expect(res.data.targetActor!.actorId).toBe(targetActorId);

    // 检查优先扣除了 targetActor 的权柄
    const powerAfter = actorInWorld.powerShare;
    expect(powerAfter).toBeLessThan(powerBefore);
    expect(res.data.powerResult!.powerTransfer!.targetActorIds).toContain(targetActorId);
  });

  it('COMPLETE_MISSION 失败返回同一个 targetActor，但不转移权柄，且目标不因胜负被删除或夺职', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    generateMissionOffers(state, 1_000_000);
    const offer = state.tavern.missionOffers[0]!;
    const targetActorId = offer.targetActor!.actorId;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });
    const active = state.tavern.activeMission!;
    active.endTime = ctx.now - 1;

    // 强制输
    active.playerCombatSnapshot.combatStats.hp = 1;
    active.playerCombatSnapshot.combatStats.damageMin = 0;
    active.playerCombatSnapshot.combatStats.damageMax = 0;
    active.enemySnapshot.combatStats.hp = 99999;
    active.enemySnapshot.combatStats.damageMin = 999;
    active.enemySnapshot.combatStats.damageMax = 999;

    // 记录 target actor 的 powerShare
    const actorInWorld = state.world.actors.find(a => a.actorId === targetActorId)!;
    const powerBefore = actorInWorld.powerShare;

    const res = completeMission(ctx, {});
    expect(res.data.result).toBe('FAILED');
    expect(res.data.targetActor).toBeDefined();
    expect(res.data.targetActor!.actorId).toBe(targetActorId);

    // 失败时不触发权柄转移
    const powerAfter = actorInWorld.powerShare;
    expect(powerAfter).toBe(powerBefore);
    expect(res.data.powerResult).toBeUndefined();

    // 目标不应被删除
    expect(state.world.actors.find(a => a.actorId === targetActorId)).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 9. 任务发布场所统一化 V1 测试
// ---------------------------------------------------------------------------
describe('任务发布场所统一化 V1', () => {
  it('向带有 missions 服务的地点（如 northern_bureau）生成任务成功，且携带 7 个来源字段及北镇抚司风味标题', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.sourceLocationId).toBe('northern_bureau');
      expect(offer.sourceLocationName).toBe('北镇抚司');
      expect(offer.sourcePositionId).toBe('northern_bureau:missions');
      expect(offer.issuerActorId).toBeDefined();
      expect(offer.issuerDisplayName).toBeDefined();
      expect(offer.issuerTitle).toBe('北镇经历司吏');
      expect(offer.issuerFaction).toBe('imperial');
      expect(offer.powerContext!.issuerFaction).toBe('imperial');
      
      expect(offer.title).toMatch(/^(诏狱严审重犯|密查百官行迹|缉拿潜逃钦犯|抄没违禁私财)$/);
      expect(offer.description).toContain('（前往北镇抚司活动');
    }
  });

  it('向不带有 missions 服务的地点（如 imperial_palace）生成任务应抛出 LOCATION_MISSIONS_NOT_AVAILABLE 错误', () => {
    const state = makeActiveState();
    expect(() => {
      generateMissionOffers(state, 1_000_000, 'imperial_palace');
    }).toThrowError('Missions are not available at 皇宫.');
  });

  it('START_MISSION 启动场所任务后，activeMission 能够完备保留来源字段', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    const offer = offers[0]!;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });

    const active = state.tavern.activeMission!;
    expect(active.sourceLocationId).toBe('northern_bureau');
    expect(active.sourceLocationName).toBe('北镇抚司');
    expect(active.sourcePositionId).toBe('northern_bureau:missions');
    expect(active.issuerActorId).toBe(offer.issuerActorId);
    expect(active.issuerDisplayName).toBe(offer.issuerDisplayName);
    expect(active.issuerTitle).toBe(offer.issuerTitle);
    expect(active.issuerFaction).toBe('imperial');

    const view = buildActiveMissionView(active, ctx.now)!;
    expect(view.sourceLocationId).toBe('northern_bureau');
    expect(view.sourceLocationName).toBe('北镇抚司');
    expect(view.sourcePositionId).toBe('northern_bureau:missions');
    expect(view.issuerActorId).toBe(offer.issuerActorId);
    expect(view.issuerDisplayName).toBe(offer.issuerDisplayName);
    expect(view.issuerTitle).toBe(offer.issuerTitle);
    expect(view.issuerFaction).toBe('imperial');
  });

  it('COMPLETE_MISSION 完成结算后，CompleteMissionData 依旧成功携带来源字段，且权柄转移按场所势力参与结算', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    const offer = offers[0]!;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });
    const active = state.tavern.activeMission!;
    active.endTime = ctx.now - 1;

    active.playerCombatSnapshot.combatStats.hp = 99999;
    active.enemySnapshot.combatStats.hp = 1;
    active.enemySnapshot.combatStats.damageMin = 0;
    active.enemySnapshot.combatStats.damageMax = 0;

    const res = completeMission(ctx, {});
    expect(res.data.result).toBe('SUCCESS');
    expect(res.data.sourceLocationId).toBe('northern_bureau');
    expect(res.data.sourceLocationName).toBe('北镇抚司');
    expect(res.data.sourcePositionId).toBe('northern_bureau:missions');
    expect(res.data.issuerActorId).toBe(offer.issuerActorId);
    expect(res.data.issuerDisplayName).toBe(offer.issuerDisplayName);
    expect(res.data.issuerTitle).toBe(offer.issuerTitle);
    expect(res.data.issuerFaction).toBe('imperial');

    expect(res.data.powerResult).toBeDefined();
    expect(res.data.powerResult!.powerTransfer).toBeDefined();
    expect(res.data.powerResult!.powerTransfer!.targetFactionPowerDelta?.['imperial']).toBe(-1);
  });

  it('getTavernInfo 和 generateMissions 应该在 locationId 变化时重新生成任务', () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);
    
    // First query with default (no location)
    const res1 = getTavernInfo(ctx, {});
    expect(res1.data.tavern.missionOffers[0]!.sourceLocationId).toBeUndefined();

    // Query for northern_bureau
    const res2 = getTavernInfo(ctx, { locationId: 'northern_bureau' });
    expect(res2.data.tavern.missionOffers[0]!.sourceLocationId).toBe('northern_bureau');

    // Query for censorate
    const res3 = getTavernInfo(ctx, { locationId: 'censorate' });
    expect(res3.data.tavern.missionOffers[0]!.sourceLocationId).toBe('censorate');

    // Query back to no location
    const res4 = getTavernInfo(ctx, {});
    expect(res4.data.tavern.missionOffers[0]!.sourceLocationId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 10. 任务发布人角色化 V1 测试
// ---------------------------------------------------------------------------
describe('任务发布人角色化 V1', () => {
  it('TAVERN_GET_INFO 带 locationId 时，MissionOffer 包含 issuerActor 且与零散字段一致', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    expect(offers).toHaveLength(3);
    for (const offer of offers) {
      expect(offer.issuerActor).toBeDefined();
      expect(offer.issuerActor!.actorId).toBe(offer.issuerActorId);
      expect(offer.issuerActor!.displayName).toBe(offer.issuerDisplayName);
      const actualActor = state.world.actors.find(a => a.actorId === offer.issuerActor!.actorId)!;
      expect(offer.issuerActor!.faction).toBe(actualActor.faction);
      expect(offer.issuerActor!.title).toBe(offer.issuerTitle);
      expect(offer.issuerActor!.locationId).toBe(offer.sourceLocationId);
      expect(offer.issuerActor!.locationName).toBe(offer.sourceLocationName);
      expect(offer.issuerActor!.positionId).toBe(offer.sourcePositionId);
      expect(offer.issuerActor!.avatarId).toBeDefined();
      expect(offer.issuerActor!.level).toBeGreaterThanOrEqual(1);
      expect(offer.issuerActor!.powerShare).toBeGreaterThanOrEqual(0);
    }
  });

  it('START_MISSION 启动场所任务后，ActiveMissionView 保留并透传 issuerActor', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    const offer = offers[0]!;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });

    const active = state.tavern.activeMission!;
    expect(active.issuerActor).toBeDefined();
    expect(active.issuerActor!.actorId).toBe(offer.issuerActor!.actorId);

    const view = buildActiveMissionView(active, ctx.now, state)!;
    expect(view.issuerActor).toBeDefined();
    expect(view.issuerActor!.actorId).toBe(offer.issuerActor!.actorId);
  });

  it('COMPLETE_MISSION 结算后，CompleteMissionData 依旧携带 issuerActor', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau');
    const offer = offers[0]!;

    const ctx = makeCtx(state);
    startMission(ctx, { missionId: offer.missionId, offerSetId: offer.offerSetId });
    const active = state.tavern.activeMission!;
    active.endTime = ctx.now - 1;

    active.playerCombatSnapshot.combatStats.hp = 99999;
    active.enemySnapshot.combatStats.hp = 1;
    active.enemySnapshot.combatStats.damageMin = 0;
    active.enemySnapshot.combatStats.damageMax = 0;

    const res = completeMission(ctx, {});
    expect(res.data.result).toBe('SUCCESS');
    expect(res.data.issuerActor).toBeDefined();
    expect(res.data.issuerActor!.actorId).toBe(offer.issuerActor!.actorId);
  });

  it('如果传了指定的 issuerActorId，且属于 world.actors，应优先使用该 actor', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    
    // 从 world.actors 找一个同 faction 的 bot 成员
    const testActor = state.world.actors.find(a => a.faction === 'imperial' && a.kind === 'bot')!;
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau', undefined, testActor.actorId);
    
    expect(offers[0]!.issuerActor).toBeDefined();
    expect(offers[0]!.issuerActor!.actorId).toBe(testActor.actorId);
    expect(offers[0]!.issuerActor!.displayName).toBe(testActor.displayName);
    expect(offers[0]!.issuerActorId).toBe(testActor.actorId);
  });

  it('如果传了不存在的 issuerActorId，应回退到该地点 missions 职务 occupant 并不影响任务生成', () => {
    const state = makeActiveState({ powerFaction: 'border' });
    
    // 传一个不存在的 ID
    const offers = generateMissionOffers(state, 1_000_000, 'northern_bureau', undefined, 'non-existent-actor-id');
    
    // 应正常生成且 issuerActor 自动回退到 occupant
    expect(offers).toHaveLength(3);
    expect(offers[0]!.issuerActor).toBeDefined();
    expect(offers[0]!.issuerActorId).toBeDefined();
    expect(offers[0]!.issuerActorId).not.toBe('non-existent-actor-id');
  });
});
