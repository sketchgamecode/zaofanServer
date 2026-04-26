import type { ActionErrorResponse } from '../types/action.js';

export type GameErrorCode =
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
  | 'TAVERN_DRINK_LIMIT_REACHED';

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
