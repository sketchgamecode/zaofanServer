import {
  CORE_SCHEMA_VERSION,
  INITIAL_ATTRIBUTES,
  INITIAL_MOUNT_STATE,
  INITIAL_PLAYER_LEVEL,
  INITIAL_RESOURCES,
} from '../config/coreRules.js';
import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import { getGameDateString } from '../lib/time.js';
import type { EquipmentState, GameState } from '../types/gameState.js';

function createEmptyEquipment(): EquipmentState {
  return {
    equipped: {
      head: null,
      body: null,
      hands: null,
      feet: null,
      neck: null,
      belt: null,
      ring: null,
      trinket: null,
      weapon: null,
      offHand: null,
    },
  };
}

export function createInitialGameState(input: { now: number; playerId?: string }): GameState {
  const today = getGameDateString(input.now);

  return {
    meta: {
      schemaVersion: CORE_SCHEMA_VERSION,
      createdAt: input.now,
      updatedAt: input.now,
      lastDailyResetDate: today,
      stateRevision: 0,
    },
    player: {
      id: input.playerId,
      level: INITIAL_PLAYER_LEVEL,
      exp: 0,
      classId: 'CLASS_A',
    },
    resources: { ...INITIAL_RESOURCES },
    attributes: { ...INITIAL_ATTRIBUTES },
    inventory: {
      items: [],
      capacity: 60,
    },
    equipment: createEmptyEquipment(),
    tavern: {
      thirstSecRemaining: CLASSIC_TAVERN_RULES.baseThirstSec,
      drinksUsedToday: 0,
      firstMissionBonusClaimed: false,
      dailyQuestCounter: 0,
      offerSeq: 0,
      missionOffers: [],
      activeMission: null,
      lastSettlement: null,
    },
    mount: { ...INITIAL_MOUNT_STATE },
    blackMarket: {
      status: 'UNINITIALIZED',
      items: [],
      lastRefreshAt: null,
    },
    arena: {
      status: 'UNINITIALIZED',
      dailyWins: 0,
      lastDailyResetDate: today,
      cooldownEndTime: null,
    },
    dungeon: {
      status: 'UNINITIALIZED',
      progress: {},
      keys: [],
      dailyAttemptsUsed: 0,
      lastDailyResetDate: today,
    },
  };
}
