import { supabaseAdmin } from './supabase.js';
import { GameError } from '../engine/errors.js';
import { ensureWorldInitialized } from '../engine/world.js';
import { createInitialGameState } from '../engine/gameStateFactory.js';
import type { WorldState } from '../types/gameState.js';
import type { ActionContext } from '../engine/actionContext.js';

export async function loadOrCreateWorldState(now: number): Promise<WorldState> {
  const { data, error } = await supabaseAdmin
    .from('world_state')
    .select('world_state')
    .eq('id', 'default_world')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new GameError('SAVE_READ_FAILED', `Failed to read world state: ${error.message}`);
  }

  if (!data?.world_state) {
    // Generate new world state using the existing engine logic
    const tempState = createInitialGameState({ now });
    let dirty = false;
    const tempCtx: ActionContext = {
      playerId: 'system',
      now,
      state: tempState,
      get dirty() { return dirty; },
      markDirty() { dirty = true; },
    };

    ensureWorldInitialized(tempCtx);

    const createdWorld = tempState.world;
    await saveWorldState(createdWorld, now);
    return createdWorld;
  }

  return data.world_state as WorldState;
}

export async function saveWorldState(world: WorldState, now: number): Promise<WorldState> {
  const { error } = await supabaseAdmin
    .from('world_state')
    .upsert(
      {
        id: 'default_world',
        world_state: world,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'id' }
    );

  if (error) {
    throw new GameError('SAVE_WRITE_FAILED', `Failed to write world state: ${error.message}`);
  }

  return world;
}
