import type { GameState } from './gameState.js';

export type GameActionName =
  | 'PLAYER_GET_INFO'
  | 'TAVERN_GET_INFO'
  | 'GENERATE_MISSIONS'
  | 'TAVERN_DRINK'
  | 'START_MISSION'
  | 'COMPLETE_MISSION'
  | 'SKIP_MISSION'
  | 'UPGRADE_ATTRIBUTE'
  | 'EQUIP_ITEM'
  | 'UNEQUIP_ITEM'
  | 'BLACK_MARKET_REFRESH'
  | 'BLACK_MARKET_BUY'
  | 'REFRESH_BLACKMARKET'
  | 'BUY_AND_EQUIP_ITEM'
  | 'ARENA_FIGHT'
  | 'ARENA_SKIP_COOLDOWN'
  | 'GUARD_WORK_START'
  | 'GUARD_WORK_CLAIM'
  | 'DUNGEON_FIGHT'
  | 'DEBUG_CHEAT'
  | 'DEBUG_RESET_SAVE';

export type GameActionEnvelope = {
  action: string;
  payload?: Record<string, unknown>;
};

export type FeatureDisabledData = {
  status: 'DISABLED';
  feature: string;
  message: string;
};

export type ActionSuccessResponse<T> = {
  ok: true;
  action: string;
  serverTime: number;
  stateRevision: number;
  data: T;
};

export type DisabledActionResponse = ActionSuccessResponse<FeatureDisabledData>;

export type ActionErrorResponse = {
  ok: false;
  action: string;
  serverTime: number;
  stateRevision?: number;
  errorCode: string;
  message: string;
};

export type ActionResponse<T = unknown> = ActionSuccessResponse<T> | ActionErrorResponse;

export type LegacyActionResult = ActionResponse<{ state?: GameState } | FeatureDisabledData>;
