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
      raceId: state.player.raceId,
      displayName: state.player.displayName,
      avatarId: state.player.avatarId,
      status: state.player.status,
      powerFaction: state.player.powerFaction,
      suspicion: state.player.suspicion,
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
        strength: getAttributeUpgradeCost(state.player.level, state.attributes.bought.strength),
        intelligence: getAttributeUpgradeCost(state.player.level, state.attributes.bought.intelligence),
        agility: getAttributeUpgradeCost(state.player.level, state.attributes.bought.agility),
        constitution: getAttributeUpgradeCost(state.player.level, state.attributes.bought.constitution),
        luck: getAttributeUpgradeCost(state.player.level, state.attributes.bought.luck),
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
