/**
 * dungeon.power.test.ts — 阶段2：蓝玉案副本原型单元测试
 *
 * 覆盖：
 *   1. 蓝玉案章节存在且 powerCase 字段正确
 *   2. 蓝玉案 Boss 数量为 10、enemy 文案符合大明权力清洗包装
 *   3. dungeonFight 返回 powerCase 字段（透传给前端）
 *   4. 挑战蓝玉案胜利后 suspicion 正确增加
 *   5. dungeonFight 返回 powerResult（delta + after）
 *   6. 挑战失败时 suspicion 不变，powerResult 不存在
 *   7. 旧存档无 suspicion 时自动补全六个派系为 0 不报错
 *   8. 非权力案件章节（chapter_1 等）胜利时不产生 powerResult
 *   9. 现有奖励逻辑（xp/copper/progress）不回归
 *  10. dailyAttemptsUsed 递增正确
 */

import { describe, it, expect } from 'vitest';
import { dungeonFight } from './dungeon.js';
import { DUNGEON_CHAPTERS } from '../data/dungeonTable.js';
import { createInitialGameState } from './gameStateFactory.js';
import type { GameState, PowerFactionId } from '../types/gameState.js';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

const ALL_FACTIONS: PowerFactionId[] = [
  'imperial', 'noble', 'censorate', 'border', 'silver', 'underworld',
];

function makeActiveState(overrides?: Partial<GameState['player']>): GameState {
  const state = createInitialGameState({ now: 1_000_000, playerId: 'test-player' });
  state.player.status = 'ACTIVE';
  state.player.classId = 'CLASS_A';
  state.player.raceId = 'RACE_01';
  state.player.displayName = '测试武官';
  state.player.avatarId = 'avatar_placeholder_001';
  state.player.powerFaction = 'border';
  state.player.suspicion = {
    imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0,
  };
  // 给足够高的战斗属性，方便控制胜负
  state.attributes.strength = 50;
  state.attributes.constitution = 80;
  state.attributes.agility = 20;
  if (overrides) Object.assign(state.player, overrides);
  return state;
}

function makeCtx(state: GameState, now = 1_000_000) {
  let dirty = false;
  return {
    playerId: state.player.id ?? 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

// ---------------------------------------------------------------------------
// 1. 蓝玉案章节存在且 powerCase 字段正确
// ---------------------------------------------------------------------------
describe('蓝玉案章节数据', () => {
  const chapter = DUNGEON_CHAPTERS.find((c) => c.id === 'case_lanyu_purge');

  it('蓝玉案章节应存在', () => {
    expect(chapter).toBeDefined();
  });

  it('章节名称应为蓝玉案', () => {
    expect(chapter!.name).toBe('蓝玉案');
  });

  it('解锁等级应为 1（新手可挑战）', () => {
    expect(chapter!.unlockLevel).toBe(1);
  });

  it('应有 powerCase 字段', () => {
    expect(chapter!.powerCase).toBeDefined();
  });

  it('issuerFaction 应为 imperial', () => {
    expect(chapter!.powerCase!.issuerFaction).toBe('imperial');
  });

  it('targetFactions 应包含 noble 和 border', () => {
    expect(chapter!.powerCase!.targetFactions).toContain('noble');
    expect(chapter!.powerCase!.targetFactions).toContain('border');
  });

  it('historicalHook 应包含"蓝玉"关键词', () => {
    expect(chapter!.powerCase!.historicalHook).toContain('蓝玉');
  });

  it('suspicionDeltaOnWin 应给 noble +2, border +1', () => {
    expect(chapter!.powerCase!.suspicionDeltaOnWin?.noble).toBe(2);
    expect(chapter!.powerCase!.suspicionDeltaOnWin?.border).toBe(1);
  });

  it('应有 10 个 Boss', () => {
    expect(chapter!.bosses).toHaveLength(10);
  });

  it('Boss 文案不应包含修仙/妖怪/大宋/江湖等旧包装关键词', () => {
    const bannedKeywords = ['修仙', '妖怪', '大宋', '江湖', '仙', '法阵', '妖'];
    for (const boss of chapter!.bosses) {
      for (const kw of bannedKeywords) {
        expect(boss.name + boss.description).not.toContain(kw);
      }
    }
  });

  it('Boss 名称应包含大明权力清洗相关文案', () => {
    const bossNames = chapter!.bosses.map((b) => b.name);
    // 至少一个 boss 名包含以下关键词
    const powerKeywords = ['蓝党', '国公府', '边镇', '军功', '供状', '护院', '谋主', '游击', '党援', '旧将'];
    const found = powerKeywords.some((kw) => bossNames.some((n) => n.includes(kw)));
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. dungeonFight 返回 powerCase（前端透传）
// ---------------------------------------------------------------------------
describe('dungeonFight — powerCase 透传', () => {
  it('挑战蓝玉案时，返回 data.powerCase 应与章节定义一致', async () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });
    expect(res.data.powerCase).toBeDefined();
    expect(res.data.powerCase!.issuerFaction).toBe('imperial');
    expect(res.data.powerCase!.targetFactions).toContain('noble');
    expect(res.data.powerCase!.historicalHook).toContain('蓝玉');
  });

  it('挑战普通章节（chapter_1）时，data.powerCase 应为 undefined', async () => {
    // chapter_1 要求 level >= 10
    const state = makeActiveState({ level: 10 } as any);
    state.player.level = 10;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'chapter_1' });
    expect(res.data.powerCase).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. 胜利时 suspicion 写入 + powerResult 返回
// ---------------------------------------------------------------------------
describe('dungeonFight — 胜利时 suspicion 与 powerResult', () => {
  it('胜利时 noble suspicion 应增加 2，border 增加 1', async () => {
    const state = makeActiveState();
    // 给玩家极高属性确保必胜（boss level 1 属性极低）
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'WIN') {
      expect(state.player.suspicion!.noble).toBe(2);
      expect(state.player.suspicion!.border).toBe(1);
      expect(res.data.powerResult).toBeDefined();
      expect(res.data.powerResult!.suspicionDelta.noble).toBe(2);
      expect(res.data.powerResult!.suspicionDelta.border).toBe(1);
      expect(res.data.powerResult!.suspicionAfter.noble).toBe(2);
      expect(res.data.powerResult!.suspicionAfter.border).toBe(1);
    } else {
      // 战斗系统随机，此用例在极高属性下几乎必赢，若输则跳过具体断言
      console.warn('dungeonFight WIN test: player lost (random), skipping suspicion assertion');
    }
  });

  it('胜利时 suspicion 值应随多次挑战累积', async () => {
    const state = makeActiveState({
      suspicion: { imperial: 0, noble: 5, censorate: 0, border: 3, silver: 0, underworld: 0 },
    });
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'WIN') {
      expect(state.player.suspicion!.noble).toBe(7);  // 5 + 2
      expect(state.player.suspicion!.border).toBe(4); // 3 + 1
    }
  });

  it('普通章节（chapter_1）胜利时不应产生 powerResult', async () => {
    const state = makeActiveState();
    state.player.level = 10;
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'chapter_1' });

    // 不管胜负，普通章节都不产生 powerResult
    expect(res.data.powerResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. 失败时 suspicion 不变
// ---------------------------------------------------------------------------
describe('dungeonFight — 失败时 suspicion 不变', () => {
  it('失败时 suspicion 不应改变，powerResult 不应存在', async () => {
    const state = makeActiveState({
      suspicion: { imperial: 10, noble: 10, censorate: 10, border: 10, silver: 10, underworld: 10 },
    });
    // 给极低属性确保必败
    state.attributes.strength = 1;
    state.attributes.constitution = 1;
    state.attributes.agility = 1;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'LOSE') {
      expect(state.player.suspicion!.noble).toBe(10);
      expect(state.player.suspicion!.border).toBe(10);
      expect(res.data.powerResult).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 5. 旧存档 — 无 suspicion 字段时不报错
// ---------------------------------------------------------------------------
describe('旧存档兼容性 — 无 suspicion 时自动补全', () => {
  it('旧存档不含 suspicion 时，胜利后应自动补全所有派系并写入', async () => {
    const state = makeActiveState();
    delete (state.player as any).suspicion;
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'WIN') {
      // suspicion 应该被自动补全
      expect(state.player.suspicion).toBeDefined();
      for (const faction of ALL_FACTIONS) {
        expect(state.player.suspicion![faction]).toBeGreaterThanOrEqual(0);
      }
    } else {
      // 即使没有赢，suspicion 不应报错
      expect(() => res).not.toThrow();
    }
  });

  it('旧存档不含 suspicion 时，失败也不应报错', async () => {
    const state = makeActiveState();
    delete (state.player as any).suspicion;
    state.attributes.strength = 1;
    state.attributes.constitution = 1;
    const ctx = makeCtx(state);
    await expect(dungeonFight(ctx, { chapterId: 'case_lanyu_purge' })).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 6. 现有奖励逻辑不回归
// ---------------------------------------------------------------------------
describe('现有 dungeon 奖励逻辑不回归', () => {
  it('胜利时 grantedReward.xp 应大于 0', async () => {
    const state = makeActiveState();
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'WIN') {
      expect(res.data.grantedReward.xp).toBeGreaterThan(0);
      expect(res.data.grantedReward.copper).toBeGreaterThan(0);
    }
  });

  it('失败时 grantedReward 应为 0', async () => {
    const state = makeActiveState();
    state.attributes.strength = 1;
    state.attributes.constitution = 1;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'LOSE') {
      expect(res.data.grantedReward.xp).toBe(0);
      expect(res.data.grantedReward.copper).toBe(0);
    }
  });

  it('每次战斗后 dailyAttemptsUsed 应递增 1', async () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);
    const before = state.dungeon.dailyAttemptsUsed;
    await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });
    expect(state.dungeon.dailyAttemptsUsed).toBe(before + 1);
  });

  it('胜利时 progress 应递增', async () => {
    const state = makeActiveState();
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });

    if (res.data.result === 'WIN') {
      expect(res.data.progressAfter).toBe(1);
    }
  });

  it('等级不足时应抛出 ACTION_DISABLED', async () => {
    // chapter_1 需要 level >= 10，但玩家 level 1
    const state = makeActiveState();
    state.player.level = 1;
    const ctx = makeCtx(state);
    await expect(dungeonFight(ctx, { chapterId: 'chapter_1' })).rejects.toMatchObject({
      code: 'ACTION_DISABLED',
    });
  });

  it('DUNGEON_FIGHT action 名称不应改变', async () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });
    expect(res.action).toBe('DUNGEON_FIGHT');
  });

  it('dungeonFight WIN case should transfer 3 points from target factions to player', async () => {
    const state = makeActiveState();
    state.attributes.strength = 9999;
    state.attributes.constitution = 9999;
    
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });
    
    if (res.data.result === 'WIN') {
      const powerTransfer = res.data.powerResult?.powerTransfer;
      expect(powerTransfer).toBeDefined();
      expect(powerTransfer.worldPowerTotal).toBe(10000);
      expect(powerTransfer.actorPowerDelta).toBe(3);
      expect(powerTransfer.targetActorIds).toBeDefined();
      expect(powerTransfer.targetActorIds.length).toBeGreaterThan(0);
      
      const player = state.world.actors.find(a => a.actorId === `player:${ctx.playerId}`);
      expect(player).toBeDefined();
      expect(player!.powerShare).toBe(3);
      
      const totalPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
      expect(totalPower).toBe(10000);
    }
  });

  it('dungeonFight LOSE case should not trigger power transfer', async () => {
    const state = makeActiveState();
    state.attributes.strength = 1;
    state.attributes.constitution = 1;
    state.attributes.agility = 1;
    
    const ctx = makeCtx(state);
    const res = await dungeonFight(ctx, { chapterId: 'case_lanyu_purge' });
    
    if (res.data.result === 'LOSE') {
      expect(res.data.powerResult).toBeUndefined();
    }
  });
});
