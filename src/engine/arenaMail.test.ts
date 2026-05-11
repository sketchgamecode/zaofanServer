import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './gameStateFactory.js';
import { arenaFight, arenaRefreshCandidates } from './arena.js';
import { mailSaveMissionReplay } from './mail.js';
import { simulateBattleV2 } from './combatSimulator.js';
import type { ActionContext } from './actionContext.js';
import type { CombatantSnapshot, GameState } from '../types/gameState.js';

function makeCtx(state: GameState, now = Date.now()): ActionContext {
  let dirty = false;
  return {
    playerId: '00000000-0000-0000-0000-000000000001',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

function activate(state: GameState): void {
  state.player.id = '00000000-0000-0000-0000-000000000001';
  state.player.status = 'ACTIVE';
  state.player.displayName = 'tester';
  state.player.avatarId = 'avatar_placeholder_001';
  state.attributes.strength = 50;
  state.attributes.constitution = 80;
  state.equipment.equipped.weapon = {
    id: 'weapon',
    name: 'weapon',
    description: 'weapon',
    slot: 'weapon',
    rarity: 0,
    subType: 'weapon',
    weaponDamage: { min: 10, max: 14 },
    sellPrice: 1,
    bonusAttributes: {},
  };
}

describe('arena and replay mail', () => {
  it('ARENA_FIGHT auto-creates replayId', async () => {
    const state = createInitialGameState({ now: 1, playerId: '00000000-0000-0000-0000-000000000001' });
    activate(state);
    const ctx = makeCtx(state, 1000);
    const refresh = arenaRefreshCandidates(ctx, {});
    const target = refresh.data.candidates[0]!;
    const fight = await arenaFight(ctx, { targetPlayerId: target.playerId, candidateSetId: refresh.data.candidateSetId });
    expect(fight.ok).toBe(true);
    expect(fight.data.replayId).toMatch(/^battle_arena_/);
    expect(fight.data.battleResult.schemaVersion).toBe(2);
  });

  it('MAIL_SAVE_MISSION_REPLAY does not duplicate saves', async () => {
    const state = createInitialGameState({ now: 1, playerId: '00000000-0000-0000-0000-000000000001' });
    activate(state);
    const player: CombatantSnapshot = {
      id: state.player.id!,
      displayName: 'tester',
      level: 1,
      classId: 'CLASS_A',
      attributes: { strength: 20, intelligence: 10, agility: 10, constitution: 30, luck: 5 },
      armor: 0,
      weaponDamage: { min: 2, max: 3 },
    };
    const enemy: CombatantSnapshot = {
      ...player,
      id: 'enemy',
      displayName: 'enemy',
      classId: 'CLASS_B',
    };
    const v2 = simulateBattleV2({ player, enemy, seed: 'mission-replay', context: 'MISSION', firstAttacker: 'player' });
    state.tavern.lastSettlement = {
      missionId: 'mission-1',
      offerSetId: 'offer-set',
      settledAt: 123,
      result: v2.playerWon ? 'SUCCESS' : 'FAILED',
      rewardGranted: false,
      rewardSnapshot: {
        xp: 0,
        copper: 0,
        tokens: 0,
        equipment: null,
        dungeonKey: null,
        hourglass: 0,
        firstMissionBonusApplied: false,
        hiddenRolls: { rewardSeed: 'hidden' },
      },
      grantedReward: { xp: 0, copper: 0, tokens: 0, hourglass: 0 },
      battleResult: v2,
      canSaveReplay: true,
      replayId: null,
      playerDelta: {
        levelBefore: 1,
        levelAfter: 1,
        xpBefore: 0,
        xpAfter: 0,
        copperBefore: 0,
        copperAfter: 0,
        tokensBefore: 0,
        tokensAfter: 0,
        hourglassesBefore: 0,
        hourglassesAfter: 0,
        prestigeBefore: 0,
        prestigeAfter: 0,
      },
    };

    const ctx = makeCtx(state, 2000);
    const first = await mailSaveMissionReplay(ctx, {});
    const second = await mailSaveMissionReplay(ctx, {});
    expect(first.data.alreadySaved).toBe(false);
    expect(second.data.alreadySaved).toBe(true);
    expect(second.data.replay.replayId).toBe(first.data.replay.replayId);
  });
});
