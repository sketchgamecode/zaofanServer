import type { GameState } from '../types/gameState.js';

export type ActionContext = {
  playerId: string;
  now: number;
  state: GameState;
  dirty: boolean;
  worldDirty?: boolean;
  markDirty: () => void;
  markWorldDirty?: () => void;
};

export function createActionContext(input: {
  playerId: string;
  now: number;
  state: GameState;
  dirty?: boolean;
  worldDirty?: boolean;
}): ActionContext {
  let dirty = input.dirty ?? false;
  let worldDirty = input.worldDirty ?? false;

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
    get worldDirty() {
      return worldDirty;
    },
    markWorldDirty() {
      worldDirty = true;
    },
  };
}
