import type { ActionErrorResponse } from '../types/action.js';

export type GameErrorCode =
  | 'ITEM_NOT_FOUND'
  | 'INVALID_EQUIPMENT_SLOT'
  | 'EQUIP_SLOT_MISMATCH'
  | 'EMPTY_EQUIPMENT_SLOT'
  | 'INVALID_ATTRIBUTE_KEY'
  | 'NOT_ENOUGH_COPPER'
  | 'UNKNOWN_ACTION'
  | 'ACTION_DISABLED'
  | 'INVALID_GAME_STATE'
  | 'INVALID_TAVERN_STATE'
  | 'CHEATS_DISABLED'
  | 'SAVE_READ_FAILED'
  | 'SAVE_WRITE_FAILED'
  | 'MISSION_ALREADY_IN_PROGRESS'
  | 'MISSION_NOT_FOUND'
  | 'OFFER_SET_MISMATCH'
  | 'NOT_ENOUGH_THIRST'
  | 'MISSION_NOT_FINISHED'
  | 'NO_ACTIVE_MISSION'
  | 'NOT_ENOUGH_TOKENS'
  | 'NOT_ENOUGH_SKIP_RESOURCE'
  | 'ARENA_COOLDOWN_ACTIVE'
  | 'ARENA_TARGET_NOT_FOUND'
  | 'ARENA_SELF_TARGET'
  | 'ARENA_DISABLED'
  | 'INSUFFICIENT_PREMIUM_RESOURCE'
  | 'BATTLE_REPLAY_NOT_FOUND'
  | 'BATTLE_REPLAY_WRITE_FAILED'
  | 'BATTLE_REPLAY_READ_FAILED'
  | 'MISSION_REPLAY_NOT_AVAILABLE'
  | 'TAVERN_DRINK_LIMIT_REACHED'
  | 'INVENTORY_FULL'
  | 'CHARACTER_ALREADY_CREATED'
  | 'CHARACTER_NOT_CREATED'
  | 'INVALID_RACE'
  | 'INVALID_CLASS'
  | 'INVALID_NICKNAME'
  | 'INVALID_AVATAR'
  | 'WORLD_PLAYER_ACTOR_NOT_FOUND'
  | 'WORLD_ACTOR_NOT_FOUND';

export class GameError extends Error {
  public readonly code: GameErrorCode;

  constructor(code: GameErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function toActionErrorResponse(input: {
  action: string;
  serverTime: number;
  error: unknown;
  stateRevision?: number;
}): ActionErrorResponse {
  if (input.error instanceof GameError) {
    return {
      ok: false,
      action: input.action,
      serverTime: input.serverTime,
      stateRevision: input.stateRevision,
      errorCode: input.error.code,
      message: input.error.message,
    };
  }

  return {
    ok: false,
    action: input.action,
    serverTime: input.serverTime,
    stateRevision: input.stateRevision,
    errorCode: 'INVALID_GAME_STATE',
    message: input.error instanceof Error ? input.error.message : 'Unknown server error',
  };
}
