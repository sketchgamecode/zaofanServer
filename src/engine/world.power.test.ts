import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './gameStateFactory.js';
import { ensureWorldInitialized, worldActorsGetOverview } from './world.js';
import type { ActionContext } from './actionContext.js';
import type { GameState } from '../types/gameState.js';

function makeCtx(state: GameState, now = 1_000_000): ActionContext {
  let dirty = false;
  return {
    playerId: 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

describe('World Actor Pool Cold Start', () => {
  it('should initialize exactly 260 bots with total powerShare = 10000', () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    expect(state.world.status).toBe('UNINITIALIZED');
    expect(state.world.actors).toHaveLength(0);

    ensureWorldInitialized(ctx);

    expect(state.world.status).toBe('ACTIVE');
    expect(state.world.actors).toHaveLength(260);

    const totalPowerShare = state.world.actors.reduce((sum, actor) => sum + actor.powerShare, 0);
    expect(totalPowerShare).toBe(10000);
  });

  it('all actorIds should be unique', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const ids = new Set(state.world.actors.map((a) => a.actorId));
    expect(ids.size).toBe(260);
  });

  it('all 6 factions must have actors', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const factions = new Set(state.world.actors.map((a) => a.faction));
    expect(factions.has('imperial')).toBe(true);
    expect(factions.has('noble')).toBe(true);
    expect(factions.has('censorate')).toBe(true);
    expect(factions.has('border')).toBe(true);
    expect(factions.has('silver')).toBe(true);
    expect(factions.has('underworld')).toBe(true);
    expect(factions.size).toBe(6);
  });

  it('all 10 locations must have actors', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const locations = new Set(state.world.actors.map((a) => a.locationId));
    expect(locations.size).toBe(10);
    expect(locations.has('imperial_palace')).toBe(true);
    expect(locations.has('player_inventory')).toBe(true);
  });

  it('WORLD_ACTORS_GET_OVERVIEW should return aggregated data', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    
    const response = await worldActorsGetOverview(ctx, {});
    expect(response.ok).toBe(true);
    
    const data = response.data;
    expect(data.totalActors).toBe(260);
    expect(data.totalPowerShare).toBe(10000);
    expect(data.byFaction).toHaveLength(6);
    expect(data.byLocation).toHaveLength(10);

    const aggregatedPower = data.byFaction.reduce((sum: number, f: any) => sum + f.powerShare, 0);
    expect(aggregatedPower).toBe(10000);
  });

  it('should auto initialize if old save missing world object', async () => {
    const state = createInitialGameState({ now: 1 });
    // mock old save
    delete (state as any).world;

    const ctx = makeCtx(state);
    const response = await worldActorsGetOverview(ctx, {});
    
    expect(response.ok).toBe(true);
    expect(state.world).toBeDefined();
    expect(state.world.status).toBe('ACTIVE');
    expect(state.world.actors).toHaveLength(260);
  });
});
