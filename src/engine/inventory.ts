import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import { buildCharacterInfoView } from './character.js';
import { GameError } from './errors.js';
import type { CharacterInfoView, EquipItemPayload, UnequipItemPayload } from '../types/gameState.js';
import { isEquipmentSlot } from '../types/gameState.js';

function buildInventoryResponse(
  action: 'EQUIP_ITEM' | 'UNEQUIP_ITEM',
  ctx: ActionContext,
): ActionSuccessResponse<CharacterInfoView> {
  return {
    ok: true,
    action,
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: buildCharacterInfoView(ctx.state),
  };
}

export function equipItem(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<CharacterInfoView> {
  const itemId = (payload as EquipItemPayload).itemId;
  if (typeof itemId !== 'string' || itemId.length === 0) {
    throw new GameError('ITEM_NOT_FOUND', 'Item id is required.');
  }

  const inventoryItems = ctx.state.inventory.items;
  const itemIndex = inventoryItems.findIndex((item) => item.id === itemId);
  if (itemIndex < 0) {
    throw new GameError('ITEM_NOT_FOUND', 'Item not found in inventory.');
  }

  const item = inventoryItems[itemIndex];
  if (!isEquipmentSlot(item.slot)) {
    throw new GameError('INVALID_EQUIPMENT_SLOT', `Invalid equipment slot: ${String(item.slot)}`);
  }

  const targetSlot = item.slot;
  const currentlyEquipped = ctx.state.equipment.equipped[targetSlot];
  const nextInventory = inventoryItems.filter((_, index) => index !== itemIndex);
  if (currentlyEquipped) {
    nextInventory.push(currentlyEquipped);
  }

  const nextEquipped = {
    ...ctx.state.equipment.equipped,
    [targetSlot]: item,
  };

  ctx.state.inventory.items = nextInventory;
  ctx.state.equipment.equipped = nextEquipped;
  ctx.markDirty();

  return buildInventoryResponse('EQUIP_ITEM', ctx);
}

export function unequipItem(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<CharacterInfoView> {
  const slot = (payload as UnequipItemPayload).slot;
  if (!isEquipmentSlot(slot)) {
    throw new GameError('INVALID_EQUIPMENT_SLOT', 'Slot is invalid.');
  }

  const equippedItem = ctx.state.equipment.equipped[slot];
  if (!equippedItem) {
    throw new GameError('EMPTY_EQUIPMENT_SLOT', 'No equipped item in target slot.');
  }

  const nextEquipped = {
    ...ctx.state.equipment.equipped,
    [slot]: null,
  };
  const nextInventory = [...ctx.state.inventory.items, equippedItem];

  ctx.state.inventory.items = nextInventory;
  ctx.state.equipment.equipped = nextEquipped;
  ctx.markDirty();

  return buildInventoryResponse('UNEQUIP_ITEM', ctx);
}
