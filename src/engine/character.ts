import { ATTRIBUTE_KEYS, getAttributeUpgradeCost } from '../config/characterRules.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import { buildCombatPreview } from './characterCombat.js';
import type { CharacterInfoView } from '../types/gameState.js';
import { getTotalAttributes } from './mathCore.js';

function buildBaseAttributes(state: ActionContext['state']): CharacterInfoView['attributes']['base'] {
  return {
    strength: state.attributes.strength,
    intelligence: state.attributes.intelligence,
    agility: state.attributes.agility,
    constitution: state.attributes.constitution,
    luck: state.attributes.luck,
  };
}

export function buildCharacterInfoView(state: ActionContext['state']): CharacterInfoView {
  const baseAttributes = buildBaseAttributes(state);
  const totalAttributes = getTotalAttributes(state);

  return {
    player: {
      level: state.player.level,
      exp: state.player.exp,
      classId: state.player.classId,
      displayName: state.player.displayName,
    },
    resources: {
      copper: state.resources.copper,
      tokens: state.resources.tokens,
      hourglasses: state.resources.hourglasses,
      prestige: state.resources.prestige,
    },
    attributes: {
      base: baseAttributes,
      total: {
        strength: totalAttributes.strength,
        intelligence: totalAttributes.intelligence,
        agility: totalAttributes.agility,
        constitution: totalAttributes.constitution,
        luck: totalAttributes.luck,
      },
      upgradeCosts: {
        strength: getAttributeUpgradeCost(baseAttributes.strength),
        intelligence: getAttributeUpgradeCost(baseAttributes.intelligence),
        agility: getAttributeUpgradeCost(baseAttributes.agility),
        constitution: getAttributeUpgradeCost(baseAttributes.constitution),
        luck: getAttributeUpgradeCost(baseAttributes.luck),
      },
    },
    combatPreview: buildCombatPreview(state),
    equipment: {
      equipped: { ...state.equipment.equipped },
    },
    inventory: {
      capacity: state.inventory.capacity,
      count: state.inventory.items.length,
      items: [...state.inventory.items],
    },
  };
}

export function getPlayerInfo(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<CharacterInfoView> {
  return {
    ok: true,
    action: 'PLAYER_GET_INFO',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: buildCharacterInfoView(ctx.state),
  };
}
