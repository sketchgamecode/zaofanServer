import { supabaseAdmin } from './supabase.js';
import { CORE_SCHEMA_VERSION } from '../config/coreRules.js';
import { createInitialGameState } from '../engine/gameStateFactory.js';
import { GameError } from '../engine/errors.js';
import { isGameState, type GameState } from '../types/gameState.js';

export type LoadGameStateResult = {
  state: GameState;
  created: boolean;
  resetInvalid: boolean;
};

export async function loadOrCreateGameState(playerId: string, now: number): Promise<LoadGameStateResult> {
  const { data, error } = await supabaseAdmin
    .from('player_saves')
    .select('game_state')
    .eq('player_id', playerId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new GameError('SAVE_READ_FAILED', `Failed to read save: ${error.message}`);
  }

  if (!data?.game_state) {
    return {
      state: createInitialGameState({ now, playerId }),
      created: true,
      resetInvalid: false,
    };
  }

  if (!isGameState(data.game_state)) {
    return {
      state: createInitialGameState({ now, playerId }),
      created: false,
      resetInvalid: true,
    };
  }

  return {
    state: data.game_state,
    created: false,
    resetInvalid: false,
  };
}

export async function saveGameState(playerId: string, state: GameState, now: number): Promise<GameState> {
  state.meta.updatedAt = now;
  state.meta.stateRevision += 1;
  if (!state.player.id) {
    state.player.id = playerId;
  }

  const { error } = await supabaseAdmin
    .from('player_saves')
    .upsert(
      {
        player_id: playerId,
        game_state: state,
        save_version: CORE_SCHEMA_VERSION,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: 'player_id' },
    );

  if (error) {
    throw new GameError('SAVE_WRITE_FAILED', `Failed to write save: ${error.message}`);
  }

  return state;
}

export async function resetGameStateForPlayer(playerId: string, now: number): Promise<GameState> {
  const state = createInitialGameState({ now, playerId });
  return saveGameState(playerId, state, now);
}
