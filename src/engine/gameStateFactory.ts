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
import { generateEquipment } from './equipmentGenerator.js';

function createEmptyEquipment(): EquipmentState {
  return {
    equipped: {
      weapon: null,
      offHand: null,
      body: null,
    },
  };
}

export function createInitialGameState(input: { now: number; playerId?: string }): GameState {
  const today = getGameDateString(input.now);

  // 初始赠送低级武器各一把
  const startingWeapons = [
    generateEquipment({ playerLevel: 1, forcedItemId: 'dao_hengdao', rarity: 0 }),
    generateEquipment({ playerLevel: 1, forcedItemId: 'jian_danshou', rarity: 0 }),
    generateEquipment({ playerLevel: 1, forcedItemId: 'bian_tiebian', rarity: 0 }),
    generateEquipment({ playerLevel: 1, forcedItemId: 'gong_mugong', rarity: 0 }),
  ];

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
      raceId: 'RACE_01',
      status: 'PENDING_CREATION',
    },
    resources: {
      ...INITIAL_RESOURCES,
      copper: (INITIAL_RESOURCES.copper ?? 0) + 5000,
      tokens: (INITIAL_RESOURCES.tokens ?? 0) + 10,
    },
    attributes: {
      ...INITIAL_ATTRIBUTES,
      bought: { ...INITIAL_ATTRIBUTES.bought },
    },
    inventory: {
      items: startingWeapons,
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
      honor: 1000,
      rank: null,
      dailyXpWins: 0,
      maxDailyXpWins: 10,
      fightsToday: 0,
      lastDailyResetDate: today,
      cooldownEndTime: null,
      candidateSetId: null,
      candidates: [],
    },
    dungeon: {
      status: 'UNINITIALIZED',
      progress: {},
      keys: [],
      dailyAttemptsUsed: 0,
      lastDailyResetDate: today,
    },
    world: {
      status: 'UNINITIALIZED',
      actors: [],
    },
  };
}
