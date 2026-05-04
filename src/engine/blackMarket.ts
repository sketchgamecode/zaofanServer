/**
 * blackMarket.ts — 黑市系统 Action Handlers
 *
 * 实现两个 Action：
 *   REFRESH_BLACKMARKET  — 刷新黑市商品（自动/手动）
 *   BUY_AND_EQUIP_ITEM  — 购买并立即穿戴商品
 *
 * 数值约定严格遵循 BlackMarket_System_Spec_V1.md。
 */

import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import type {
  BuyAndEquipPayload,
  RefreshBlackMarketPayload,
} from '../types/gameState.js';
import type { EquipmentItem } from '../types/gameState.js';
import { GameError } from './errors.js';
import { spendResource } from './resourceService.js';
import { generateBlackMarketItems } from './equipmentGenerator.js';
import { isEquipmentSlot } from '../types/gameState.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 自动刷新冷却时间：1 小时（毫秒）。Spec § 4.1 */
const AUTO_REFRESH_COOLDOWN_MS = 60 * 60 * 1000;

/** 手动刷新消耗的令牌数量。Spec § 4.1 */
const MANUAL_REFRESH_TOKEN_COST = 1;

/** 每个黑市分支的货架位数量。Spec § 4.2 */
const SHOP_ITEMS_PER_BRANCH = 6;

// ---------------------------------------------------------------------------
// 响应类型
// ---------------------------------------------------------------------------

export type BlackMarketView = {
  status: 'ACTIVE';
  items: EquipmentItem[];
  /** 距离下次免费自动刷新的剩余毫秒数（客户端用于倒计时展示） */
  nextAutoRefreshMs: number;
};

export type BuyAndEquipView = {
  /** 已从黑市移除的商品 id */
  purchasedItemId: string;
  /** 购买花费的铜钱 */
  copperSpent: number;
  /** 穿戴后被替换下来的旧装备（如有），已自动送入背包 */
  unequippedItem: EquipmentItem | null;
  /** 当前黑市剩余商品 */
  remainingItems: EquipmentItem[];
  nextAutoRefreshMs: number;
};

// ---------------------------------------------------------------------------
// REFRESH_BLACKMARKET
// ---------------------------------------------------------------------------

/**
 * 刷新黑市商品列表。
 *
 * payload.force = false (默认)：
 *   仅当距上次刷新已超过 1 小时时执行刷新，否则原样返回当前商品。
 *
 * payload.force = true（手动刷新）：
 *   消耗 1 令牌，立即刷新，忽略冷却时间。
 */
export function refreshBlackMarket(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<BlackMarketView> {
  const { force = false } = payload as RefreshBlackMarketPayload;
  const { state, now } = ctx;

  const bm = state.blackMarket;
  const lastRefresh = bm.lastRefreshAt ?? 0;
  const cooldownElapsed = now - lastRefresh >= AUTO_REFRESH_COOLDOWN_MS;

  if (force) {
    // 手动刷新：消耗 1 令牌
    spendResource(state, 'tokens', MANUAL_REFRESH_TOKEN_COST, 'NOT_ENOUGH_TOKENS');
    doRefresh(ctx);
  } else if (bm.status === 'UNINITIALIZED' || cooldownElapsed) {
    // 首次初始化或冷却到期的自动刷新
    doRefresh(ctx);
  }
  // 否则：冷却未到，不刷新，不报错，直接返回当前状态

  return {
    ok: true,
    action: 'REFRESH_BLACKMARKET',
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildBlackMarketView(state.blackMarket.items, state.blackMarket.lastRefreshAt, now),
  };
}

// ---------------------------------------------------------------------------
// BUY_AND_EQUIP_ITEM
// ---------------------------------------------------------------------------

/**
 * 购买黑市中的某件商品并立即穿戴到对应槽位。
 *
 * 流程：
 *   1. 校验 payload.itemId 存在于 blackMarket.items。
 *   2. 扣除铜钱（NOT_ENOUGH_COPPER 如余额不足）。
 *   3. 将商品从黑市移除。
 *   4. 将商品装备到对应槽位；若槽位有旧装备，旧装备自动入背包。
 *   5. markDirty() 并返回视图。
 */
export function buyAndEquipItem(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<BuyAndEquipView> {
  const { itemId } = payload as BuyAndEquipPayload;
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw new GameError('ITEM_NOT_FOUND', '`itemId` 是必填字段。');
  }

  const { state, now } = ctx;
  const bm = state.blackMarket;

  // 1. 查找商品
  const itemIndex = bm.items.findIndex(i => i.id === itemId);
  if (itemIndex < 0) {
    throw new GameError('ITEM_NOT_FOUND', `黑市中不存在 id 为 "${itemId}" 的商品。`);
  }
  const item = bm.items[itemIndex]!;

  // 2. 扣除铜钱（price 字段由 generateEquipment 保证存在）
  const price = item.price ?? 0;
  spendResource(state, 'copper', price, 'NOT_ENOUGH_COPPER');

  // 3. 从黑市移除
  bm.items = bm.items.filter((_, idx) => idx !== itemIndex);

  // 4. 装备到槽位（处理槽位替换）
  if (!isEquipmentSlot(item.slot)) {
    throw new GameError('INVALID_EQUIPMENT_SLOT', `无效槽位：${String(item.slot)}`);
  }
  const targetSlot = item.slot;
  const previousItem = state.equipment.equipped[targetSlot] ?? null;

  // 旧装备入背包
  if (previousItem) {
    state.inventory.items.push(previousItem);
  }
  state.equipment.equipped[targetSlot] = item;

  // 5. 标脏
  ctx.markDirty();

  return {
    ok: true,
    action: 'BUY_AND_EQUIP_ITEM',
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: {
      purchasedItemId: itemId,
      copperSpent: price,
      unequippedItem: previousItem,
      remainingItems: bm.items,
      nextAutoRefreshMs: calcNextAutoRefreshMs(bm.lastRefreshAt, now),
    },
  };
}

// ---------------------------------------------------------------------------
// 内部辅助
// ---------------------------------------------------------------------------

/**
 * 执行实际的刷新操作（生成新商品，更新状态，标脏）。
 */
function doRefresh(ctx: ActionContext): void {
  const { state, now } = ctx;

  const newItems = generateBlackMarketItems({
    playerLevel: state.player.level,
    classId: state.player.classId,
    count: SHOP_ITEMS_PER_BRANCH,
  });

  state.blackMarket.items = newItems;
  state.blackMarket.lastRefreshAt = now;
  state.blackMarket.status = 'ACTIVE';

  ctx.markDirty();
}

/**
 * 计算距下次自动刷新的剩余毫秒数。
 * 若已超时则返回 0（表示可以立即刷新）。
 */
function calcNextAutoRefreshMs(lastRefreshAt: number | null, now: number): number {
  if (lastRefreshAt === null) return 0;
  const nextAt = lastRefreshAt + AUTO_REFRESH_COOLDOWN_MS;
  return Math.max(0, nextAt - now);
}

/**
 * 构建返回给客户端的黑市视图对象。
 */
function buildBlackMarketView(
  items: EquipmentItem[],
  lastRefreshAt: number | null,
  now: number,
): BlackMarketView {
  return {
    status: 'ACTIVE',
    items,
    nextAutoRefreshMs: calcNextAutoRefreshMs(lastRefreshAt, now),
  };
}
