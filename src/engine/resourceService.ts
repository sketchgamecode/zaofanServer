import { MAX_LEVEL, XP_TABLE } from '../data/xpTable.js';
import { GameError } from './errors.js';
import type { GameState, ResourceState } from '../types/gameState.js';

export type ResourceKind = keyof ResourceState;

export type ResourceSnapshot = {
  level: number;
  exp: number;
  copper: number;
  tokens: number;
  hourglasses: number;
  prestige: number;
};

export function captureResourceSnapshot(state: GameState): ResourceSnapshot {
  return {
    level: state.player.level,
    exp: state.player.exp,
    copper: state.resources.copper,
    tokens: state.resources.tokens,
    hourglasses: state.resources.hourglasses,
    prestige: state.resources.prestige,
  };
}

export function assertEnoughResource(state: GameState, kind: ResourceKind, amount: number): void {
  if (state.resources[kind] < amount) {
    throw new GameError('INVALID_GAME_STATE', `Not enough ${kind}`);
  }
}

export function spendResource(state: GameState, kind: ResourceKind, amount: number): void {
  assertEnoughResource(state, kind, amount);
  state.resources[kind] -= amount;
}

export function grantResource(state: GameState, kind: ResourceKind, amount: number): void {
  state.resources[kind] += amount;
}

export function grantExp(state: GameState, amount: number): {
  levelBefore: number;
  levelAfter: number;
  expBefore: number;
  expAfter: number;
} {
  const levelBefore = state.player.level;
  const expBefore = state.player.exp;

  let level = state.player.level;
  let exp = state.player.exp + amount;

  while (level < MAX_LEVEL) {
    const required = XP_TABLE[level];
    if (required === undefined || exp < required) {
      break;
    }

    exp -= required;
    level += 1;
  }

  state.player.level = level;
  state.player.exp = exp;

  return {
    levelBefore,
    levelAfter: state.player.level,
    expBefore,
    expAfter: state.player.exp,
  };
}

export function buildPlayerDelta(
  before: ResourceSnapshot,
  after: ResourceSnapshot,
): GameState['tavern']['lastSettlement'] extends infer _T
  ? {
      levelBefore: number;
      levelAfter: number;
      xpBefore: number;
      xpAfter: number;
      copperBefore: number;
      copperAfter: number;
      tokensBefore: number;
      tokensAfter: number;
      hourglassesBefore: number;
      hourglassesAfter: number;
      prestigeBefore: number;
      prestigeAfter: number;
    }
  : never {
  return {
    levelBefore: before.level,
    levelAfter: after.level,
    xpBefore: before.exp,
    xpAfter: after.exp,
    copperBefore: before.copper,
    copperAfter: after.copper,
    tokensBefore: before.tokens,
    tokensAfter: after.tokens,
    hourglassesBefore: before.hourglasses,
    hourglassesAfter: after.hourglasses,
    prestigeBefore: before.prestige,
    prestigeAfter: after.prestige,
  };
}
