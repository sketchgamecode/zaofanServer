/**
 * createCharacter.test.ts — 角色创建与成长系统 2.0 单元测试
 *
 * 覆盖：
 *   1.  CREATE_CHARACTER — 成功创建（验证种族修正、状态转换）
 *   2.  CREATE_CHARACTER — 重复创建（应抛 CHARACTER_ALREADY_CREATED）
 *   3.  CREATE_CHARACTER — 无效种族 / 职业 / 昵称 / 头像校验
 *   4.  UPGRADE_ATTRIBUTE — 新成本公式精度验证
 *   5.  UPGRADE_ATTRIBUTE — bought 计数递增
 *   6.  UPGRADE_ATTRIBUTE — 未创建角色不可升级
 *   7.  HP 新公式 — Constitution × ClassMultiplier × (Level + 1)
 *   8.  暴击率新公式 — min(50%, Luck × 2.5 / (EnemyLevel × 100))
 */

import { describe, it, expect } from 'vitest';
import { createCharacter } from './createCharacter.js';
import { upgradeAttribute } from './attributes.js';
import { getAttributeUpgradeCost } from '../config/characterRules.js';
import { MathCore } from './mathCore.js';
import { createInitialGameState } from './gameStateFactory.js';
import { createActionContext } from './actionContext.js';
import type { GameState } from '../types/gameState.js';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

function makeCtx(state: GameState, now: number = Date.now()) {
  let dirty = false;
  return {
    playerId: 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

function makePendingState(): GameState {
  return createInitialGameState({ now: Date.now(), playerId: 'test-player' });
}

function makeActiveState(): GameState {
  const state = makePendingState();
  state.player.status = 'ACTIVE';
  state.player.classId = 'CLASS_A';
  state.player.raceId = 'RACE_01';
  state.player.displayName = '测试侠';
  state.resources.copper = 10000;
  return state;
}

// ---------------------------------------------------------------------------
// 1. CREATE_CHARACTER — 成功创建
// ---------------------------------------------------------------------------
describe('CREATE_CHARACTER — 成功创建', () => {
  it('应正确设置职业、种族、昵称、头像，并将 status 置为 ACTIVE', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    const res = createCharacter(ctx, {
      nickname: '宋江',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_003',
    });

    expect(res.ok).toBe(true);
    expect(state.player.status).toBe('ACTIVE');
    expect(state.player.classId).toBe('CLASS_A');
    expect(state.player.raceId).toBe('RACE_01');
    expect(state.player.displayName).toBe('宋江');
    expect(state.player.avatarId).toBe('avatar_placeholder_003');
    expect(ctx.dirty).toBe(true);
  });

  it('选择契丹豪勇(RACE_05)时应正确应用属性修正 +1/0/-1/0/0', () => {
    const state = makePendingState();
    const baseCon = state.attributes.constitution;
    const baseStr = state.attributes.strength;
    const baseInt = state.attributes.intelligence;
    const ctx = makeCtx(state);
    createCharacter(ctx, {
      nickname: '耶律',
      classId: 'CLASS_A',
      raceId: 'RACE_05',
      avatarId: 'avatar_placeholder_000',
    });

    expect(state.attributes.strength).toBe(baseStr + 1);
    expect(state.attributes.agility).toBe(10);       // +0
    expect(state.attributes.intelligence).toBe(baseInt - 1);
    expect(state.attributes.constitution).toBe(baseCon);  // +0
    expect(state.attributes.luck).toBe(10);           // +0
  });

  it('选择摩尼教徒(RACE_08)时应正确应用属性修正 +3/-1/0/+1/-3', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    createCharacter(ctx, {
      nickname: '方腊',
      classId: 'CLASS_C',
      raceId: 'RACE_08',
      avatarId: 'avatar_placeholder_063',
    });

    expect(state.attributes.strength).toBe(13);    // 10 + 3
    expect(state.attributes.agility).toBe(9);       // 10 - 1
    expect(state.attributes.intelligence).toBe(10); // 10 + 0
    expect(state.attributes.constitution).toBe(11); // 10 + 1
    expect(state.attributes.luck).toBe(7);          // 10 - 3
  });
});

// ---------------------------------------------------------------------------
// 2. CREATE_CHARACTER — 重复创建
// ---------------------------------------------------------------------------
describe('CREATE_CHARACTER — 重复创建', () => {
  it('已创建角色后再次调用应抛出 CHARACTER_ALREADY_CREATED', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    createCharacter(ctx, {
      nickname: '林冲',
      classId: 'CLASS_B',
      raceId: 'RACE_02',
      avatarId: 'avatar_placeholder_010',
    });

    expect(() => createCharacter(ctx, {
      nickname: '另一个名字',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_000',
    })).toThrowError(/角色已创建/);
  });
});

// ---------------------------------------------------------------------------
// 3. CREATE_CHARACTER — 输入校验
// ---------------------------------------------------------------------------
describe('CREATE_CHARACTER — 输入校验', () => {
  it('昵称过短（1字符）应抛出 INVALID_NICKNAME', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    expect(() => createCharacter(ctx, {
      nickname: 'A',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_000',
    })).toThrowError(/昵称长度/);
  });

  it('昵称过长（13字符）应抛出 INVALID_NICKNAME', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    expect(() => createCharacter(ctx, {
      nickname: '一二三四五六七八九十壹贰叁',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_000',
    })).toThrowError(/昵称长度/);
  });

  it('无效职业 ID 应抛出 INVALID_CLASS', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    expect(() => createCharacter(ctx, {
      nickname: '正常昵称',
      classId: 'WARRIOR' as any,
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_000',
    })).toThrowError(/无效的职司/);
  });

  it('无效种族 ID 应抛出 INVALID_RACE', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    expect(() => createCharacter(ctx, {
      nickname: '正常昵称',
      classId: 'CLASS_A',
      raceId: 'HUMAN' as any,
      avatarId: 'avatar_placeholder_000',
    })).toThrowError(/无效的出身/);
  });

  it('无效头像 ID 应抛出 INVALID_AVATAR', () => {
    const state = makePendingState();
    const ctx = makeCtx(state);
    expect(() => createCharacter(ctx, {
      nickname: '正常昵称',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'bad_avatar',
    })).toThrowError(/无效的头像/);
  });
});

// ---------------------------------------------------------------------------
// 3b. CREATE_CHARACTER — powerFaction / suspicion 初始化
// ---------------------------------------------------------------------------
describe('CREATE_CHARACTER — powerFaction 和 suspicion 初始化', () => {
  const FACTIONS = ['imperial', 'noble', 'censorate', 'border', 'silver', 'underworld'] as const;

  it('RACE_01(军户) → powerFaction 应为 border', () => {
    const state = makePendingState();
    createCharacter(makeCtx(state), {
      nickname: '小兵',
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      avatarId: 'avatar_placeholder_000',
    });
    expect(state.player.powerFaction).toBe('border');
  });

  it('RACE_03(市井商贾) → powerFaction 应为 silver', () => {
    const state = makePendingState();
    createCharacter(makeCtx(state), {
      nickname: '商贾',
      classId: 'CLASS_C',
      raceId: 'RACE_03',
      avatarId: 'avatar_placeholder_001',
    });
    expect(state.player.powerFaction).toBe('silver');
  });

  it('RACE_05(清流世家) → powerFaction 应为 censorate', () => {
    const state = makePendingState();
    createCharacter(makeCtx(state), {
      nickname: '世家子',
      classId: 'CLASS_C',
      raceId: 'RACE_05',
      avatarId: 'avatar_placeholder_002',
    });
    expect(state.player.powerFaction).toBe('censorate');
  });

  it('RACE_07(流民) → powerFaction 应为 underworld', () => {
    const state = makePendingState();
    createCharacter(makeCtx(state), {
      nickname: '流民甲',
      classId: 'CLASS_B',
      raceId: 'RACE_07',
      avatarId: 'avatar_placeholder_003',
    });
    expect(state.player.powerFaction).toBe('underworld');
  });

  it('新角色创建后所有派系的疑心度应全部为 0', () => {
    const state = makePendingState();
    createCharacter(makeCtx(state), {
      nickname: '新兵',
      classId: 'CLASS_A',
      raceId: 'RACE_02',
      avatarId: 'avatar_placeholder_010',
    });
    expect(state.player.suspicion).toBeDefined();
    for (const faction of FACTIONS) {
      expect(state.player.suspicion![faction]).toBe(0);
    }
  });

  it('CharacterInfoView 中应返回 powerFaction 和 suspicion', () => {
    const state = makePendingState();
    const res = createCharacter(makeCtx(state), {
      nickname: '小张',
      classId: 'CLASS_A',
      raceId: 'RACE_04',
      avatarId: 'avatar_placeholder_020',
    });
    expect(res.data.player.powerFaction).toBe('silver');
    expect(res.data.player.suspicion).toBeDefined();
    expect(res.data.player.suspicion!.imperial).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 3c. CREATE_CHARACTER — 旧存档兼容性
// ---------------------------------------------------------------------------
describe('旧存档兑容性 — 不含 powerFaction/suspicion 时现有逻辑不受影响', () => {
  it('旧存档不含 powerFaction 时，upgradeAttribute 不应报错', () => {
    const state = makeActiveState();
    // 模拟旧存档：不含新字段
    delete (state.player as any).powerFaction;
    delete (state.player as any).suspicion;
    // upgradeAttribute 不应抛错
    expect(() => upgradeAttribute(makeCtx(state), { attribute: 'strength' })).not.toThrow();
    // 字段不存在也不应影响状态
    expect(state.player.powerFaction).toBeUndefined();
    expect(state.player.suspicion).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. UPGRADE_ATTRIBUTE — 新成本公式精度验证
// ---------------------------------------------------------------------------
describe('UPGRADE_ATTRIBUTE — 新成本公式', () => {
  it('level=1, bought=0 时成本应为 max(1, floor(1 × (0.2 + 0 × 0.05))) = 1', () => {
    expect(getAttributeUpgradeCost(1, 0)).toBe(1);
  });

  it('level=10, bought=0 时成本应为 floor(10 × 0.2) = 2', () => {
    expect(getAttributeUpgradeCost(10, 0)).toBe(2);
  });

  it('level=10, bought=5 时成本应为 floor(10 × (0.2 + 0.25)) = 4', () => {
    expect(getAttributeUpgradeCost(10, 5)).toBe(4);
  });

  it('level=50, bought=20 时成本应为 floor(50 × (0.2 + 1.0)) = 60', () => {
    expect(getAttributeUpgradeCost(50, 20)).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// 5. UPGRADE_ATTRIBUTE — bought 计数递增
// ---------------------------------------------------------------------------
describe('UPGRADE_ATTRIBUTE — bought 计数', () => {
  it('升级后 bought[attr] 应递增 1', () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);

    expect(state.attributes.bought.strength).toBe(0);
    upgradeAttribute(ctx, { attribute: 'strength' });
    expect(state.attributes.bought.strength).toBe(1);
    expect(state.attributes.strength).toBe(11);
  });

  it('连续升级两次后 bought 和 base 都应递增 2', () => {
    const state = makeActiveState();
    const ctx = makeCtx(state);

    upgradeAttribute(ctx, { attribute: 'agility' });
    upgradeAttribute(ctx, { attribute: 'agility' });
    expect(state.attributes.bought.agility).toBe(2);
    expect(state.attributes.agility).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// 6. UPGRADE_ATTRIBUTE — 未创建角色不可升级
// ---------------------------------------------------------------------------
describe('UPGRADE_ATTRIBUTE — 未创建角色', () => {
  it('PENDING_CREATION 状态下升级应抛出 CHARACTER_NOT_CREATED', () => {
    const state = makePendingState();
    state.resources.copper = 10000;
    const ctx = makeCtx(state);
    expect(() => upgradeAttribute(ctx, { attribute: 'strength' })).toThrowError(/角色尚未创建/);
  });
});

// ---------------------------------------------------------------------------
// 7. HP 新公式 — Con × ClassMult × (Level + 1)
// ---------------------------------------------------------------------------
describe('MathCore.getMaxHP — 新公式', () => {
  it('Con=10, Level=1, CLASS_A(x5) → 10 × 5 × 2 = 100', () => {
    expect(MathCore.getMaxHP(10, 1, 'CLASS_A')).toBe(100);
  });

  it('Con=20, Level=10, CLASS_C(x2) → 20 × 2 × 11 = 440', () => {
    expect(MathCore.getMaxHP(20, 10, 'CLASS_C')).toBe(440);
  });

  it('Con=15, Level=5, CLASS_B(x4) → 15 × 4 × 6 = 360', () => {
    expect(MathCore.getMaxHP(15, 5, 'CLASS_B')).toBe(360);
  });
});

// ---------------------------------------------------------------------------
// 8. 暴击率新公式 — min(50%, Luck × 2.5 / (EnemyLevel × 100))
// ---------------------------------------------------------------------------
describe('MathCore.getCritChance — 新公式', () => {
  it('Luck=100, EnemyLevel=10 → min(0.5, 100*2.5 / (10*100)) = 0.25', () => {
    expect(MathCore.getCritChance(100, 10)).toBeCloseTo(0.25);
  });

  it('Luck=500, EnemyLevel=10 → 上限 50%', () => {
    expect(MathCore.getCritChance(500, 10)).toBe(0.5);
  });

  it('Luck=10, EnemyLevel=50 → min(0.5, 25/5000) = 0.005', () => {
    expect(MathCore.getCritChance(10, 50)).toBeCloseTo(0.005);
  });
});
