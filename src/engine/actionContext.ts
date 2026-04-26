import type { GameState } from '../types/gameState.js';

export type ActionContext = {
  playerId: string;
  now: number;
  state: GameState;
  dirty: boolean;
  markDirty: () => void;
};

export function createActionContext(input: {
  playerId: string;
  now: number;
  state: GameState;
  dirty?: boolean;
}): ActionContext {
  let dirty = input.dirty ?? false;

  return {
    playerId: input.playerId,
    now: input.now,
    state: input.state,
    get dirty() {
      return dirty;
    },
    markDirty() {
      dirty = true;
    },
  };
}
