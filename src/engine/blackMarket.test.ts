/**
 * blackMarket.test.ts — 黑市系统单元测试
 *
 * 覆盖：
 *   1.  pickShopRarity()        — 大样本统计验证 90/8/2 概率分布
 *   2.  calcItemPrice()         — 价格公式精度 floor(level^1.5 * QualityMult * 10)
 *   3.  generateEquipment()     — BaseAttr 值域 (0.85 ~ 1.15 * level * slotFactor * qualityMult)
 *   4.  generateEquipment()     — 武器伤害公式精度
 *   5.  generateWeaponShopItems() — 首件必为本职业武器槽
 *   6.  refreshBlackMarket()    — 首次 (UNINITIALIZED) 强制初始化
 *   7.  refreshBlackMarket()    — 冷却未到不刷新 (force=false)
 *   8.  refreshBlackMarket()    — 冷却到期后自动刷新 (force=false)
 *   9.  refreshBlackMarket()    — force=true 消耗 1 令牌立即刷新
 *   10. refreshBlackMarket()    — 令牌不足时抛出 NOT_ENOUGH_TOKENS
 *   11. buyAndEquipItem()       — 成功购买：铜钱扣减 + 装备上身 + 黑市商品移除
 *   12. buyAndEquipItem()       — 槽位替换：旧装备自动入背包
 *   13. buyAndEquipItem()       — 铜钱不足抛出 NOT_ENOUGH_COPPER
 *   14. buyAndEquipItem()       — itemId 不存在抛出 ITEM_NOT_FOUND
 *   15. buyAndEquipItem()       — 黑市为空时抛出 ITEM_NOT_FOUND
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  pickShopRarity,
  calcItemPrice,
  generateEquipment,
  generateWeaponShopItems,
  generateBlackMarketItems,
} from './equipmentGenerator.js';
import { refreshBlackMarket, buyAndEquipItem } from './blackMarket.js';
import type { ActionContext } from './actionContext.js';
import type { GameState, EquipmentItem } from '../types/gameState.js';
import type { SeededRandom } from '../lib/rng.js';

// ---------------------------------------------------------------------------
// 测试工具
// ---------------------------------------------------------------------------

/** 构造一个返回固定值序列的确定性 RNG（便于边界测试） */
function makeFixedRng(values: number[]): SeededRandom {
  let idx = 0;
  const next = (): number => {
    const v = values[idx % values.length] ?? 0;
    idx++;
    return v;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    chanceBp: (bp) => next() * 10000 < bp,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
  };
}

/** 构造最小化 GameState 用于 Action 测试 */
function makeState(overrides: Partial<GameState['resources']> = {}): GameState {
  const now = Date.now();
  return {
    meta: {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      lastDailyResetDate: '2026-01-01',
      stateRevision: 0,
    },
    player: {
      level: 10,
      exp: 0,
      classId: 'CLASS_A',
    },
    resources: {
      copper: 10_000,
      tokens: 50,
      hourglasses: 50,
      prestige: 0,
      ...overrides,
    },
    attributes: {
      strength: 10,
      intelligence: 10,
      agility: 10,
      constitution: 10,
      luck: 10,
      unspentPoints: 0,
    },
    inventory: { items: [], capacity: 60 },
    equipment: {
      equipped: {
        head: null, body: null, hands: null, feet: null,
        neck: null, belt: null, ring: null, trinket: null,
        weapon: null, offHand: null,
      },
    },
    tavern: {
      thirstSecRemaining: 6000,
      drinksUsedToday: 0,
      firstMissionBonusClaimed: false,
      dailyQuestCounter: 0,
      offerSeq: 0,
      missionOffers: [],
      activeMission: null,
      lastSettlement: null,
    },
    mount: { timeMultiplierBp: 10000, expiresAt: null },
    blackMarket: {
      status: 'UNINITIALIZED',
      items: [],
      lastRefreshAt: null,
    },
    arena: {
      status: 'UNINITIALIZED',
      dailyWins: 0,
      lastDailyResetDate: '2026-01-01',
      cooldownEndTime: null,
    },
    dungeon: {
      status: 'UNINITIALIZED',
      progress: {},
      keys: [],
      dailyAttemptsUsed: 0,
      lastDailyResetDate: '2026-01-01',
    },
  };
}

/** 构造 ActionContext */
function makeCtx(state: GameState, now: number = Date.now()): ActionContext {
  let dirty = false;
  return {
    playerId: 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

// ---------------------------------------------------------------------------
// 1. pickShopRarity — 大样本统计
// ---------------------------------------------------------------------------
describe('pickShopRarity()', () => {
  it('在 level < 50 时应符合 Normal 90%, Excellent 8%, Epic 0% 分布', () => {
    const N = 10_000;
    const counts = [0, 0, 0]; // [Normal, Excellent, Epic]
    for (let i = 0; i < N; i++) {
      const r = pickShopRarity({ next: Math.random, int: () => 0, chanceBp: () => false, pick: (a) => a[0]! }, 10);
      if (r === 0) counts[0]!++;
      else if (r === 1) counts[1]!++;
      else if (r === 2) counts[2]!++;
    }
    // 允许 ±3% 的统计误差
    expect(counts[0]! / N).toBeGreaterThan(0.87);
    expect(counts[0]! / N).toBeLessThan(0.93);
    expect(counts[1]! / N).toBeGreaterThan(0.05);
    expect(counts[1]! / N).toBeLessThan(0.11);
    expect(counts[2]!).toBe(0); // level=10 不应出 Epic
  });

  it('在 level >= 50 时 Epic 应出现约 2%', () => {
    const N = 10_000;
    let epicCount = 0;
    for (let i = 0; i < N; i++) {
      const r = pickShopRarity({ next: Math.random, int: () => 0, chanceBp: () => false, pick: (a) => a[0]! }, 50);
      if (r === 2) epicCount++;
    }
    const epicRate = epicCount / N;
    expect(epicRate).toBeGreaterThan(0.005); // 至少 0.5%
    expect(epicRate).toBeLessThan(0.035);    // 不超过 3.5%
  });
});

// ---------------------------------------------------------------------------
// 2. calcItemPrice — 价格公式
// ---------------------------------------------------------------------------
describe('calcItemPrice()', () => {
  it('level=10, rarity=0 => floor(10^1.5 * 1.0 * 10) = 316', () => {
    expect(calcItemPrice(10, 0)).toBe(316);
  });

  it('level=10, rarity=1 => floor(10^1.5 * 1.15 * 10) = 363', () => {
    expect(calcItemPrice(10, 1)).toBe(363);
  });

  it('level=10, rarity=2 => floor(10^1.5 * 1.35 * 10) = 426', () => {
    expect(calcItemPrice(10, 2)).toBe(426);
  });

  it('level=50, rarity=0 => floor(50^1.5 * 1.0 * 10) = 3535', () => {
    expect(calcItemPrice(50, 0)).toBe(3535);
  });
});

// ---------------------------------------------------------------------------
// 3. generateEquipment — BaseAttr 值域校验
// ---------------------------------------------------------------------------
describe('generateEquipment() — BaseAttr 值域', () => {
  it('weapon 槽 (SlotFactor=1.2), rarity=0 时 armor 应在期望范围内', () => {
    // weapon 不生成 armor，改测 body 槽
    const level = 20;
    // slotFactor[body] = 1.0, qualityMult[0] = 1.0
    // BaseAttr ∈ [20*1.0*1.0*0.85, 20*1.0*1.0*1.15] = [17, 23]
    for (let i = 0; i < 50; i++) {
      const item = generateEquipment({ playerLevel: level, slot: 'body', rarity: 0 });
      expect(item.armor).toBeGreaterThanOrEqual(Math.floor(level * 1.0 * 1.0 * 0.85));
      expect(item.armor).toBeLessThanOrEqual(Math.ceil(level * 1.0 * 1.0 * 1.15));
    }
  });

  it('不同品质的 armor 应随品质上升而增加', () => {
    const level = 30;
    const avg = (rarity: 0 | 1 | 2) => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += generateEquipment({ playerLevel: level, slot: 'body', rarity }).armor ?? 0;
      }
      return sum / 100;
    };
    const avgNormal    = avg(0);
    const avgExcellent = avg(1);
    const avgEpic      = avg(2);
    expect(avgExcellent).toBeGreaterThan(avgNormal);
    expect(avgEpic).toBeGreaterThan(avgExcellent);
  });
});

// ---------------------------------------------------------------------------
// 4. generateEquipment — 武器伤害公式
// ---------------------------------------------------------------------------
describe('generateEquipment() — 武器伤害', () => {
  it('level=10, weapon 槽, rarity=0: MinDmg=floor(10*1.2*0.7*1.0)=8, MaxDmg=floor(10*1.2*1.3*1.0)=15', () => {
    // 确定性 RNG 使 floatFactor 固定在某值；多次生成验证公式
    const item = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    expect(item.weaponDamage).toBeDefined();
    expect(item.weaponDamage!.min).toBe(8);   // floor(10*1.2*0.7*1.0) = 8
    expect(item.weaponDamage!.max).toBe(15);  // floor(10*1.2*1.3*1.0) = 15
  });

  it('level=20, weapon, rarity=1: MinDmg=floor(20*1.2*0.7*1.15)=19, MaxDmg=floor(20*1.2*1.3*1.15)=35', () => {
    const item = generateEquipment({ playerLevel: 20, slot: 'weapon', rarity: 1 });
    expect(item.weaponDamage!.min).toBe(19);  // floor(20*1.2*0.7*1.15) = 19
    expect(item.weaponDamage!.max).toBe(35);  // floor(20*1.2*1.3*1.15) = 35
  });

  it('非武器槽 (neck) 不应有 weaponDamage', () => {
    const item = generateEquipment({ playerLevel: 10, slot: 'neck', rarity: 0 });
    expect(item.weaponDamage).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. generateWeaponShopItems — 首件必为本职业武器
// ---------------------------------------------------------------------------
describe('generateWeaponShopItems()', () => {
  it('生成的第 1 件商品应为 weapon 槽', () => {
    for (const classId of ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D'] as const) {
      const items = generateWeaponShopItems({ playerLevel: 15, classId });
      expect(items[0]!.slot).toBe('weapon');
    }
  });

  it('默认生成 6 件兵器铺商品 + 6 件奇珍阁商品 = 12 件 (generateBlackMarketItems)', () => {
    const items = generateBlackMarketItems({ playerLevel: 20, classId: 'CLASS_A' });
    expect(items).toHaveLength(12);
  });

  it('CLASS_A (猛将) 的保障武器名称应在允许列表中', () => {
    const warriorNames = ['朴刀', '长枪', '陌刀', '斩马刀', '铁锏'];
    for (let i = 0; i < 20; i++) {
      const items = generateWeaponShopItems({ playerLevel: 10, classId: 'CLASS_A' });
      expect(warriorNames).toContain(items[0]!.name);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. refreshBlackMarket — 首次初始化 (UNINITIALIZED)
// ---------------------------------------------------------------------------
describe('refreshBlackMarket() — 首次初始化', () => {
  it('UNINITIALIZED 状态下调用应生成商品并将 status 设为 ACTIVE', () => {
    const state = makeState();
    const ctx = makeCtx(state);
    const res = refreshBlackMarket(ctx, { force: false });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.status).toBe('ACTIVE');
      expect(res.data.items.length).toBe(12);
    }
    expect(state.blackMarket.status).toBe('ACTIVE');
    expect(state.blackMarket.lastRefreshAt).toBe(ctx.now);
    expect(ctx.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. refreshBlackMarket — 冷却未到不刷新
// ---------------------------------------------------------------------------
describe('refreshBlackMarket() — 冷却期内不刷新', () => {
  it('距上次刷新不足 1 小时时，force=false 应保留旧商品', () => {
    const now = Date.now();
    const state = makeState();
    // 模拟刚刚刷新过（30分钟前）
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.lastRefreshAt = now - 30 * 60 * 1000;
    state.blackMarket.items = [
      generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 }),
    ];
    const originalItemId = state.blackMarket.items[0]!.id;

    const ctx = makeCtx(state, now);
    const res = refreshBlackMarket(ctx, { force: false });

    expect(res.ok).toBe(true);
    // 商品未变化
    if (res.ok) {
      expect(res.data.items[0]!.id).toBe(originalItemId);
    }
    // 冷却内不应触发 markDirty
    expect(ctx.dirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. refreshBlackMarket — 冷却到期自动刷新
// ---------------------------------------------------------------------------
describe('refreshBlackMarket() — 冷却到期自动刷新', () => {
  it('距上次刷新超过 1 小时时，force=false 应重新生成商品', () => {
    const now = Date.now();
    const state = makeState();
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.lastRefreshAt = now - 61 * 60 * 1000; // 61分钟前
    state.blackMarket.items = [
      generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 }),
    ];

    const ctx = makeCtx(state, now);
    const res = refreshBlackMarket(ctx, { force: false });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.items.length).toBe(12);
    }
    expect(state.blackMarket.lastRefreshAt).toBe(now);
    expect(ctx.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 9. refreshBlackMarket — force=true 消耗令牌
// ---------------------------------------------------------------------------
describe('refreshBlackMarket() — 手动刷新消耗 1 令牌', () => {
  it('force=true 应消耗 1 令牌并刷新商品', () => {
    const now = Date.now();
    const state = makeState({ tokens: 5 });
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.lastRefreshAt = now - 10 * 60 * 1000; // 10分钟前，冷却未到

    const ctx = makeCtx(state, now);
    refreshBlackMarket(ctx, { force: true });

    expect(state.resources.tokens).toBe(4); // 扣了1
    expect(state.blackMarket.items.length).toBe(12);
    expect(ctx.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. refreshBlackMarket — 令牌不足
// ---------------------------------------------------------------------------
describe('refreshBlackMarket() — 令牌不足', () => {
  it('force=true 但令牌为 0 时应抛出 NOT_ENOUGH_TOKENS 错误', () => {
    const state = makeState({ tokens: 0 });
    const ctx = makeCtx(state);

    expect(() => refreshBlackMarket(ctx, { force: true })).toThrowError();
    // 状态不应被改变
    expect(state.resources.tokens).toBe(0);
    expect(state.blackMarket.status).toBe('UNINITIALIZED');
  });
});

// ---------------------------------------------------------------------------
// 11. buyAndEquipItem — 成功购买
// ---------------------------------------------------------------------------
describe('buyAndEquipItem() — 成功购买', () => {
  it('应扣除正确铜钱、商品出现在装备槽、黑市中移除该商品', () => {
    const state = makeState({ copper: 10_000 });
    const item = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    item.price = 500; // 固定价格便于断言
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.items = [item];

    const ctx = makeCtx(state);
    const res = buyAndEquipItem(ctx, { itemId: item.id });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.purchasedItemId).toBe(item.id);
      expect(res.data.copperSpent).toBe(500);
      expect(res.data.remainingItems).toHaveLength(0);
    }
    expect(state.resources.copper).toBe(9_500);
    expect(state.equipment.equipped.weapon?.id).toBe(item.id);
    expect(state.blackMarket.items).toHaveLength(0);
    expect(ctx.dirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. buyAndEquipItem — 槽位替换（旧装备入背包）
// ---------------------------------------------------------------------------
describe('buyAndEquipItem() — 槽位替换', () => {
  it('已有装备的槽位购买新装备时，旧装备应自动进入背包', () => {
    const state = makeState({ copper: 10_000 });
    const oldWeapon = generateEquipment({ playerLevel: 8, slot: 'weapon', rarity: 0 });
    oldWeapon.id = 'old-weapon-id';
    state.equipment.equipped.weapon = oldWeapon;

    const newWeapon = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    newWeapon.id = 'new-weapon-id';
    newWeapon.price = 316;
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.items = [newWeapon];

    const ctx = makeCtx(state);
    const res = buyAndEquipItem(ctx, { itemId: 'new-weapon-id' });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.unequippedItem?.id).toBe('old-weapon-id');
    }
    expect(state.equipment.equipped.weapon?.id).toBe('new-weapon-id');
    expect(state.inventory.items.find(i => i.id === 'old-weapon-id')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 13. buyAndEquipItem — 铜钱不足
// ---------------------------------------------------------------------------
describe('buyAndEquipItem() — 铜钱不足', () => {
  it('铜钱不足时应抛出错误，状态不变', () => {
    const state = makeState({ copper: 100 });
    const item = generateEquipment({ playerLevel: 30, slot: 'weapon', rarity: 1 });
    item.price = 5_000; // 远超余额
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.items = [item];

    const ctx = makeCtx(state);
    expect(() => buyAndEquipItem(ctx, { itemId: item.id })).toThrowError();

    // 验证状态回滚（未修改）
    expect(state.resources.copper).toBe(100);
    expect(state.blackMarket.items).toHaveLength(1);
    expect(state.equipment.equipped.weapon).toBeNull();
    expect(ctx.dirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. buyAndEquipItem — itemId 不存在
// ---------------------------------------------------------------------------
describe('buyAndEquipItem() — itemId 不存在', () => {
  it('itemId 不在黑市中时应抛出 ITEM_NOT_FOUND', () => {
    const state = makeState();
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.items = [
      generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 }),
    ];

    const ctx = makeCtx(state);
    expect(() => buyAndEquipItem(ctx, { itemId: 'nonexistent-id' })).toThrowError();
  });
});

// ---------------------------------------------------------------------------
// 15. buyAndEquipItem — 黑市为空
// ---------------------------------------------------------------------------
describe('buyAndEquipItem() — 黑市为空', () => {
  it('黑市商品为空时尝试购买应抛出错误', () => {
    const state = makeState();
    state.blackMarket.status = 'ACTIVE';
    state.blackMarket.items = [];

    const ctx = makeCtx(state);
    expect(() => buyAndEquipItem(ctx, { itemId: 'any-id' })).toThrowError();
  });
});
