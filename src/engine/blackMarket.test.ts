import { describe, expect, it } from 'vitest';
import type { GameState, EquipmentItem } from '../types/gameState.js';
import { GameError } from './errors.js';
import {
  buyAndEquipItem,
  buyItem,
  sellItem,
  refreshBlackMarket,
} from './blackMarket.js';
import {
  calcItemPrice,
  calcSellPrice,
  generateEquipment,
  pickShopRarity,
} from './equipmentGenerator.js';

function makeState(overrides: Partial<GameState['player'] & { copper?: number }> = {}): GameState {
  return {
    meta: { schemaVersion: 2, createdAt: 1000, updatedAt: 1000, lastDailyResetDate: '2026-01-01', stateRevision: 1 },
    player: {
      id: 'p1',
      displayName: '测试玩家',
      avatarId: 'avatar_01',
      level: 10,
      classId: 'CLASS_A',
      raceId: 'RACE_01',
      exp: 0,
      status: 'ACTIVE',
      rankId: 'rank_01',
      dailyQuestCounter: 0,
      lastQuestResetAt: 1000,
      suspicion: { imperial: 0, noble: 0, censorate: 0, border: 0, silver: 0, underworld: 0 },
      ...overrides,
    },
    resources: {
      copper: overrides.copper ?? 100,
      tokens: 0,
      merit: 0,
      worldPower: 0,
    },
    attributes: {
      strength: 10,
      intelligence: 10,
      agility: 10,
      constitution: 10,
      luck: 10,
      unspentPoints: 0,
      bought: { strength: 0, intelligence: 0, agility: 0, constitution: 0, luck: 0 },
    },
    inventory: { items: [], capacity: 60 },
    equipment: {
      equipped: {
        weapon: null,
        offHand: null,
        body: null,
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
      chapterProgress: 0,
      bossFightCooldownEnd: null,
    },
    world: {
      prestige: {},
      locationOccupants: {},
      locationTreasuries: {},
      guildOccupants: {},
    },
  } as any;
}

function makeCtx(state: GameState) {
  let dirty = false;
  return {
    playerId: state.player.id ?? 'p1',
    state,
    now: 1_000_000,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  } as any;
}

describe('pickShopRarity()', () => {
  it('在 level < 10 时只出 凡 (rarity=0) 装备', () => {
    const r = pickShopRarity({ next: () => 0.5, int: () => 0, chanceBp: () => false, pick: (a) => a[0]! }, 5);
    expect(r).toBe(0);
  });

  it('在 level >= 10 时，30% 概率出 良 装备', () => {
    const rMatch = pickShopRarity({ next: () => 0.75, int: () => 0, chanceBp: () => false, pick: (a) => a[0]! }, 10);
    expect(rMatch).toBe(1); // >= 0.70 => 1
  });

  it('在 level >= 45 时，2% 概率出 绝 装备', () => {
    const rMatch = pickShopRarity({ next: () => 0.99, int: () => 0, chanceBp: () => false, pick: (a) => a[0]! }, 50);
    expect(rMatch).toBe(3); // >= 0.98 => 3
  });
});

describe('calcItemPrice()', () => {
  it('level=10, rarity=0 => floor(10^1.5 * 1.00 * 10) = 316', () => {
    expect(calcItemPrice(10, 0)).toBe(316);
  });

  it('level=10, rarity=1 => floor(10^1.5 * 1.20 * 10) = 379', () => {
    expect(calcItemPrice(10, 1)).toBe(379);
  });

  it('level=10, rarity=2 => floor(10^1.5 * 1.50 * 10) = 474', () => {
    expect(calcItemPrice(10, 2)).toBe(474);
  });
});

describe('generateEquipment()', () => {
  it('weapon 槽应该产生正确的 weaponDamage 字段，且 armor 字段为 undefined', () => {
    const item = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    expect(item.weaponDamage).toBeDefined();
    expect(item.armor).toBeUndefined();
    expect(item.subType).toBe('weapon');
  });

  it('body 槽应该产生 armor 字段，且 weaponDamage 字段为 undefined', () => {
    const item = generateEquipment({ playerLevel: 10, slot: 'body', rarity: 0 });
    expect(item.armor).toBeDefined();
    expect(item.weaponDamage).toBeUndefined();
    expect(item.subType).toBe('none');
  });
});

describe('blackMarket actions', () => {
  it('refreshBlackMarket should populate 12 items and deduct tokens', () => {
    const state = makeState();
    state.resources.tokens = 10;
    const ctx = makeCtx(state);

    const res = refreshBlackMarket(ctx, { force: true });
    expect(res.ok).toBe(true);
    expect(state.blackMarket.items).toHaveLength(12);
    expect(state.resources.tokens).toBe(9);
  });

  it('buyAndEquipItem should equip item and deduct copper', () => {
    const state = makeState({ copper: 1000 });
    const item = generateEquipment({ playerLevel: 10, slot: 'body', rarity: 0 });
    item.price = 200;
    state.blackMarket.items = [item];
    state.blackMarket.status = 'ACTIVE';

    const ctx = makeCtx(state);
    const res = buyAndEquipItem(ctx, { itemId: item.id });
    expect(res.ok).toBe(true);
    expect(state.resources.copper).toBe(800);
    expect(state.equipment.equipped.body).toEqual(item);
    expect(state.blackMarket.items).not.toContain(item);
  });

  it('buyItem should add item to inventory and deduct copper', () => {
    const state = makeState({ copper: 500 });
    const item = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    item.price = 150;
    state.blackMarket.items = [item];

    const ctx = makeCtx(state);
    const res = buyItem(ctx, { itemId: item.id });
    expect(res.ok).toBe(true);
    expect(state.resources.copper).toBe(350);
    expect(state.inventory.items).toContain(item);
  });

  it('sellItem should remove item and grant 25% refund', () => {
    const state = makeState({ copper: 0 });
    const item = generateEquipment({ playerLevel: 10, slot: 'weapon', rarity: 0 });
    item.sellPrice = 100;
    state.inventory.items = [item];

    const ctx = makeCtx(state);
    const res = sellItem(ctx, { itemId: item.id });
    expect(res.ok).toBe(true);
    expect(state.resources.copper).toBe(100);
    expect(state.inventory.items).toHaveLength(0);
  });
});
