import type { DisabledActionResponse } from '../types/action.js';
import type { GameState } from '../types/gameState.js';

export function buildDisabledActionResponse(
  action: string,
  feature: string,
  state: GameState,
  now: number,
  message?: string,
): DisabledActionResponse {
  return {
    ok: true,
    action,
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: {
      status: 'DISABLED',
      feature,
      message: message ?? `${feature} is temporarily disabled during core rebuild.`,
    },
  };
}

export function createDisabledActionHandler(action: string, feature: string) {
  return (state: GameState, now: number): DisabledActionResponse =>
    buildDisabledActionResponse(action, feature, state, now);
}
