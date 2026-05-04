import type { ActionResponse, GameActionEnvelope } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import { buildDisabledActionResponse } from './disabledActions.js';
import { upgradeAttribute } from './attributes.js';
import { getPlayerInfo } from './character.js';
import { debugResetSave } from './debugActions.js';
import { GameError, toActionErrorResponse } from './errors.js';
import { equipItem, unequipItem } from './inventory.js';
import { completeMission, skipMission, startMission } from './missions.js';
import { generateMissions, getTavernInfo, tavernDrink } from './tavern.js';
import { refreshBlackMarket, buyAndEquipItem } from './blackMarket.js';

type Handler = (ctx: ActionContext, payload: Record<string, unknown>) => Promise<ActionResponse> | ActionResponse;

const DISABLED_ACTIONS: Record<string, string> = {
  // 旧版黑市 API（已废弃，保留以防客户端未升级时报 UNKNOWN_ACTION）
  BLACK_MARKET_REFRESH: 'blackMarket',
  BLACK_MARKET_BUY: 'blackMarket',
  ARENA_FIGHT: 'arena',
  ARENA_SKIP_COOLDOWN: 'arena',
  GUARD_WORK_START: 'guardWork',
  GUARD_WORK_CLAIM: 'guardWork',
  DUNGEON_FIGHT: 'dungeon',
  DEBUG_CHEAT: 'debugCheat',
};

const ACTION_HANDLERS: Record<string, Handler> = {
  'DEBUG_RESET_SAVE': debugResetSave,
  'PLAYER_GET_INFO': getPlayerInfo,
  'UPGRADE_ATTRIBUTE': upgradeAttribute,
  'EQUIP_ITEM': equipItem,
  'UNEQUIP_ITEM': unequipItem,
  'TAVERN_GET_INFO': getTavernInfo,
  'GENERATE_MISSIONS': generateMissions,
  'TAVERN_DRINK': tavernDrink,
  'START_MISSION': startMission,
  'COMPLETE_MISSION': completeMission,
  'SKIP_MISSION': skipMission,
  // 黑市系统
  'REFRESH_BLACKMARKET': refreshBlackMarket,
  'BUY_AND_EQUIP_ITEM': buyAndEquipItem,
};

export async function dispatchAction(
  ctx: ActionContext,
  actionEnvelope: GameActionEnvelope,
): Promise<ActionResponse> {
  const action = actionEnvelope.action;
  const payload = actionEnvelope.payload ?? {};

  try {
    console.log('Registered actions:', Object.keys(ACTION_HANDLERS));
    const handler = ACTION_HANDLERS[action];
    if (handler) {
      return await handler(ctx, payload);
    }

    const disabledFeature = DISABLED_ACTIONS[action];
    if (disabledFeature) {
      return buildDisabledActionResponse(action, disabledFeature, ctx.state, ctx.now);
    }

    throw new GameError('UNKNOWN_ACTION', `Unknown action: ${action}`);
  } catch (error) {
    return toActionErrorResponse({
      action,
      serverTime: ctx.now,
      error,
      stateRevision: ctx.state.meta.stateRevision,
    });
  }
}
