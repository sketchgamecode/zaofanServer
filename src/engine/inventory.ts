import type { GameState, ActionResult, EquipmentSlot, Equipment } from '../types/gameState.js';

/** EQUIP_ITEM：穿上或替换装备 */
export function equipItem(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const slot = payload.slot as EquipmentSlot;
  const itemIndex = payload.itemIndex as number;

  if (typeof itemIndex !== 'number' || itemIndex < 0 || itemIndex >= state.inventory.length) {
    return { success: false, gameState: state, log, error: '无效的物品索引' };
  }

  const itemToEquip = state.inventory[itemIndex];
  if (!itemToEquip) {
    return { success: false, gameState: state, log, error: '该位置没有物品' };
  }

  if (itemToEquip.slot !== slot) {
    // 检查副手可以装小盾或短剑等
    if (slot === 'offHand') {
      if (itemToEquip.slot !== 'offHand' && itemToEquip.subType !== 'shield' && itemToEquip.subType !== 'weapon') {
         return { success: false, gameState: state, log, error: '物品不适合该部位' };
      }
    } else {
      return { success: false, gameState: state, log, error: '物品不适合该部位' };
    }
  }

  const currentEquipped = state.equipped[slot];
  
  // 复制背包数组
  const newInventory = [...state.inventory];
  // 移除刚穿上的物品
  newInventory.splice(itemIndex, 1);
  // 如果当前部位有装备，脱下放入背包
  if (currentEquipped) {
    newInventory.push(currentEquipped);
  }

  const newState: GameState = {
    ...state,
    equipped: {
      ...state.equipped,
      [slot]: itemToEquip,
    },
    inventory: newInventory,
    lastUpdated: Date.now(),
  };

  log.push({ type: 'system', text: `装备了 ${itemToEquip.name}` });

  return { success: true, gameState: newState, log };
}

/** UNEQUIP_ITEM：脱下装备放入背包 */
export function unequipItem(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const slot = payload.slot as EquipmentSlot;

  const currentEquipped = state.equipped[slot];
  if (!currentEquipped) {
    return { success: false, gameState: state, log, error: '该部位没有装备' };
  }

  const newState: GameState = {
    ...state,
    equipped: {
      ...state.equipped,
      [slot]: null,
    },
    inventory: [...state.inventory, currentEquipped],
    lastUpdated: Date.now(),
  };

  log.push({ type: 'system', text: `脱下了 ${currentEquipped.name}` });

  return { success: true, gameState: newState, log };
}
