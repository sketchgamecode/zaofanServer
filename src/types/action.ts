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
  | 'ARENA_GET_INFO'
  | 'ARENA_REFRESH_CANDIDATES'
  | 'ARENA_FIGHT'
  | 'ARENA_SKIP_COOLDOWN'
  | 'MAIL_GET_BATTLE_REPLAYS'
  | 'MAIL_GET_BATTLE_REPLAY'
  | 'MAIL_SAVE_MISSION_REPLAY'
  | 'MAIL_DELETE_BATTLE_REPLAY'
  | 'GUARD_WORK_START'
  | 'GUARD_WORK_CLAIM'
  | 'DUNGEON_FIGHT'
  | 'DEBUG_CHEAT'
  | 'DEBUG_RESET_SAVE'
  | 'WORLD_ACTORS_GET_OVERVIEW'
  | 'WORLD_LOCATIONS_GET_STATUS'
  | 'WORLD_ACTOR_GET_DETAIL'
  | 'WORLD_SERVICE_POSITIONS_GET_LIST'
  | 'WORLD_SERVICE_POSITION_GET_DETAIL'
  | 'WORLD_SERVICE_POSITION_LEDGER_GET'
  | 'WORLD_SERVICE_POSITION_CANDIDATES_GET'
  | 'WORLD_LOCATION_TREASURY_GET'
  | 'WORLD_LOCATION_RAID_START'
  | 'WORLD_LOCATION_RAID_SETTLE'
  | 'WORLD_LOCATION_GUARD_JOIN'
  | 'WORLD_LOCATION_GUARD_LEAVE'
  | 'WORLD_LOCATION_GUARD_CLAIM'
  | 'WORLD_OFFICE_TRIBUTE_GET'
  | 'WORLD_OFFICE_TRIBUTE_PAY'
  | 'WORLD_LOCATION_FINANCE_REPORT_GET'
  | 'WORLD_LOCATION_CHIEF_DASHBOARD_GET';

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
