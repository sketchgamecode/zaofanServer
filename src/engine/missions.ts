import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import { createSeededRandom } from '../lib/rng.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type {
  ActiveMission,
  EnemySnapshot,
  GameState,
  GrantedReward,
  MissionSettlement,
  PlayerCombatSnapshot,
  RewardSnapshot,
} from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { buildPlayerCombatSnapshot } from './characterCombat.js';
import { generateEquipment } from './equipmentGenerator.js';
import { GameError } from './errors.js';
import { buildPlayerBattleSide, getTotalAttributes, serverSimulateBattle } from './mathCore.js';
import { buildPlayerDelta, captureResourceSnapshot, grantExp, grantResource, spendResource } from './resourceService.js';
import { buildTavernSummaryView, generateMissionOffers, getCurrentMountMultiplierBp, getTavernInfo, getTavernStatus, type TavernInfoData } from './tavern.js';

export type StartMissionPayload = {
  missionId?: string;
  offerSetId?: string;
};

export type CompleteMissionData = {
  result: 'SUCCESS' | 'FAILED' | 'ALREADY_SETTLED';
  missionId: string;
  offerSetId: string;
  battleResult: GameState['tavern']['lastSettlement'] extends infer _T
    ? {
        playerWon: boolean;
        rounds: { attacker: 'player' | 'enemy'; damage: number; targetHpAfter: number; wasCrit?: boolean }[];
        playerHpEnd: number;
        enemyHpEnd: number;
        totalRounds: number;
      }
    : never;
  rewardGranted: boolean;
  grantedReward: GrantedReward;
  playerDelta: MissionSettlement['playerDelta'];
  nextMissionOffers: GameState['tavern']['missionOffers'];
  tavern: ReturnType<typeof buildTavernSummaryView>;
};

function emptyGrantedReward(): GrantedReward {
  return {
    xp: 0,
    copper: 0,
    tokens: 0,
    hourglass: 0,
  };
}

function buildEnemySnapshot(player: PlayerCombatSnapshot, offer: GameState['tavern']['missionOffers'][number], seed: string): EnemySnapshot {
  const rng = createSeededRandom(`${seed}:enemy`);
  const hpRatioBp = rng.int(8600, 9400);
  const damageRatioBp = rng.int(8400, 9300);
  const armorRatioBp = rng.int(7000, 9000);
  const critChanceBp = Math.max(300, Math.min(2200, player.combatStats.critChanceBp - rng.int(0, 250)));
  const dodgeChanceBp = Math.max(0, Math.min(2000, (player.combatStats.dodgeChanceBp ?? 0) - rng.int(0, 200)));
  const level = Math.max(1, offer.enemyPreview.level);

  return {
    enemyId: offer.enemyPreview.enemyId,
    name: offer.enemyPreview.name,
    level,
    attributes: {
      strength: Math.max(1, Math.floor(player.attributes.strength * hpRatioBp / 10000)),
      intelligence: Math.max(1, Math.floor(player.attributes.intelligence * hpRatioBp / 10000)),
      agility: Math.max(1, Math.floor(player.attributes.agility * damageRatioBp / 10000)),
      constitution: Math.max(1, Math.floor(player.attributes.constitution * hpRatioBp / 10000)),
      luck: Math.max(1, Math.floor(player.attributes.luck * 9000 / 10000)),
    },
    combatStats: {
      hp: Math.max(8, Math.floor(player.combatStats.hp * hpRatioBp / 10000)),
      armor: Math.max(0, Math.floor(player.combatStats.armor * armorRatioBp / 10000)),
      damageMin: Math.max(1, Math.floor(player.combatStats.damageMin * damageRatioBp / 10000)),
      damageMax: Math.max(2, Math.floor(player.combatStats.damageMax * damageRatioBp / 10000)),
      critChanceBp,
      dodgeChanceBp,
    },
    enemyPowerRatioBp: damageRatioBp,
  };
}

function buildRewardSnapshot(
  state: GameState,
  offer: GameState['tavern']['missionOffers'][number],
  rewardSeed: string,
): RewardSnapshot {
  const rng = createSeededRandom(`${rewardSeed}:reward`);
  let tokens = 0;
  let firstMissionBonusApplied = false;
  const equipmentRollSeed = `${rewardSeed}:equipment`;
  const equipment = offer.visibleReward.hasEquipment
    ? generateEquipment({
        playerLevel: state.player.level,
        slot: offer.visibleReward.equipmentPreview?.slot,
        rarity: offer.visibleReward.equipmentPreview?.rarity,
        rng: createSeededRandom(equipmentRollSeed),
      })
    : null;

  if (!state.tavern.firstMissionBonusClaimed) {
    tokens += CLASSIC_TAVERN_RULES.firstMissionBonusTokens;
    firstMissionBonusApplied = true;
    state.tavern.firstMissionBonusClaimed = true;
  }

  return {
    xp: offer.visibleReward.xp,
    copper: offer.visibleReward.copper,
    tokens,
    equipment,
    dungeonKey: null,
    hourglass: 0,
    firstMissionBonusApplied,
    hiddenRolls: {
      rewardSeed,
      equipmentRollSeed: equipment ? equipmentRollSeed : undefined,
      dungeonKeyRollSeed: undefined,
    },
  };
}

function findMissionOffer(state: GameState, payload: StartMissionPayload) {
  const missionId = payload.missionId;
  if (!missionId) {
    throw new GameError('MISSION_NOT_FOUND', 'Mission id is required.');
  }

  const offer = state.tavern.missionOffers.find((entry) => entry.missionId === missionId);
  if (!offer) {
    throw new GameError('MISSION_NOT_FOUND', 'Mission not found.');
  }

  if (payload.offerSetId !== undefined && payload.offerSetId !== offer.offerSetId) {
    throw new GameError('OFFER_SET_MISMATCH', 'Offer set mismatch.');
  }

  return offer;
}

function grantRewardSnapshot(state: GameState, rewardSnapshot: RewardSnapshot): GrantedReward {
  const grantedReward: GrantedReward = {
    xp: rewardSnapshot.xp,
    copper: rewardSnapshot.copper,
    tokens: rewardSnapshot.tokens,
    hourglass: rewardSnapshot.hourglass,
  };

  if (rewardSnapshot.xp > 0) {
    grantExp(state, rewardSnapshot.xp);
  }
  if (rewardSnapshot.copper > 0) {
    grantResource(state, 'copper', rewardSnapshot.copper);
  }
  if (rewardSnapshot.tokens > 0) {
    grantResource(state, 'tokens', rewardSnapshot.tokens);
  }
  if (rewardSnapshot.hourglass > 0) {
    grantResource(state, 'hourglasses', rewardSnapshot.hourglass);
  }
  if (rewardSnapshot.equipment) {
    state.inventory.items.push(rewardSnapshot.equipment);
    grantedReward.equipment = rewardSnapshot.equipment;
  }
  if (rewardSnapshot.dungeonKey) {
    state.dungeon.keys.push(rewardSnapshot.dungeonKey);
    grantedReward.dungeonKey = rewardSnapshot.dungeonKey;
  }

  return grantedReward;
}

function buildCompleteMissionData(
  state: GameState,
  settlement: MissionSettlement,
  now: number,
  resultOverride?: 'ALREADY_SETTLED',
): CompleteMissionData {
  return {
    result: resultOverride ?? settlement.result,
    missionId: settlement.missionId,
    offerSetId: settlement.offerSetId,
    battleResult: settlement.battleResult,
    rewardGranted: settlement.rewardGranted,
    grantedReward: settlement.grantedReward,
    playerDelta: settlement.playerDelta,
    nextMissionOffers: state.tavern.missionOffers,
    tavern: buildTavernSummaryView(state, now),
  };
}

function buildAlreadySettledResponse(
  state: GameState,
  settlement: MissionSettlement,
  now: number,
  action: 'COMPLETE_MISSION' | 'SKIP_MISSION',
): ActionSuccessResponse<CompleteMissionData> {
  return {
    ok: true,
    action,
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildCompleteMissionData(state, settlement, now, 'ALREADY_SETTLED'),
  };
}

function buildStartMissionResponse(state: GameState, now: number): ActionSuccessResponse<TavernInfoData> {
  return {
    ok: true,
    action: 'START_MISSION',
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: getTavernInfo({ playerId: state.player.id ?? 'unknown', now, state, dirty: false, markDirty: () => {} }, {}).data,
  };
}

function buildCompleteMissionResponse(
  state: GameState,
  settlement: MissionSettlement,
  now: number,
  action: 'COMPLETE_MISSION' | 'SKIP_MISSION',
): ActionSuccessResponse<CompleteMissionData> {
  return {
    ok: true,
    action,
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildCompleteMissionData(state, settlement, now),
  };
}

export function startMission(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (getTavernStatus(ctx.state, ctx.now) !== 'IDLE' || ctx.state.tavern.activeMission !== null) {
    throw new GameError('MISSION_ALREADY_IN_PROGRESS', 'A mission is already in progress.');
  }

  const offer = findMissionOffer(ctx.state, payload as StartMissionPayload);
  if (ctx.state.tavern.thirstSecRemaining < offer.thirstCostSec) {
    throw new GameError('NOT_ENOUGH_THIRST', 'Not enough thirst to start mission.');
  }

  const playerCombatSnapshot = buildPlayerCombatSnapshot(ctx.state);
  const combatSeed = `combat_${ctx.playerId}_${offer.missionId}_${ctx.now}`;
  const rewardSeed = `reward_${ctx.playerId}_${offer.missionId}_${ctx.now}`;
  const enemySnapshot = buildEnemySnapshot(playerCombatSnapshot, offer, combatSeed);
  const rewardSnapshot = buildRewardSnapshot(ctx.state, offer, rewardSeed);
  const mountTimeMultiplierBp = getCurrentMountMultiplierBp(ctx.state.mount, ctx.now);

  const activeMission: ActiveMission = {
    missionId: offer.missionId,
    offerSetId: offer.offerSetId,
    offerSeq: offer.offerSeq,
    slotIndex: offer.slotIndex,
    title: offer.title,
    description: offer.description,
    locationName: offer.locationName,
    startedAt: ctx.now,
    endTime: ctx.now + offer.actualDurationSec * 1000,
    baseDurationSec: offer.baseDurationSec,
    actualDurationSec: offer.actualDurationSec,
    thirstCostSec: offer.thirstCostSec,
    mountSnapshot: {
      timeMultiplierBp: mountTimeMultiplierBp,
      name: ctx.state.mount.name,
      tier: ctx.state.mount.tier,
      capturedAt: ctx.now,
    },
    playerCombatSnapshot,
    enemySnapshot,
    rewardSnapshot,
    combatSeed,
    rewardSeed,
    settlementStatus: 'UNSETTLED',
    rewardGranted: false,
  };

  ctx.state.tavern.thirstSecRemaining -= offer.thirstCostSec;
  ctx.state.tavern.dailyQuestCounter += 1;
  ctx.state.tavern.activeMission = activeMission;
  ctx.state.tavern.missionOffers = [];
  ctx.markDirty();

  return buildStartMissionResponse(ctx.state, ctx.now);
}

export function completeMission(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<CompleteMissionData> {
  const activeMission = ctx.state.tavern.activeMission;
  if (!activeMission) {
    if (ctx.state.tavern.lastSettlement) {
      return buildAlreadySettledResponse(ctx.state, ctx.state.tavern.lastSettlement, ctx.now, 'COMPLETE_MISSION');
    }
    throw new GameError('NO_ACTIVE_MISSION', 'No active mission.');
  }

  if (ctx.now < activeMission.endTime) {
    throw new GameError('MISSION_NOT_FINISHED', 'Mission has not finished yet.');
  }

  if (activeMission.settlementStatus === 'SETTLED' && ctx.state.tavern.lastSettlement) {
    return buildAlreadySettledResponse(ctx.state, ctx.state.tavern.lastSettlement, ctx.now, 'COMPLETE_MISSION');
  }

  const before = captureResourceSnapshot(ctx.state);
  const battleResult = serverSimulateBattle({
    player: activeMission.playerCombatSnapshot,
    enemy: activeMission.enemySnapshot,
    seed: activeMission.combatSeed,
  });

  let grantedReward = emptyGrantedReward();
  let rewardGranted = false;

  if (battleResult.playerWon) {
    grantedReward = grantRewardSnapshot(ctx.state, activeMission.rewardSnapshot);
    rewardGranted = true;
  }

  const after = captureResourceSnapshot(ctx.state);
  const settlement: MissionSettlement = {
    missionId: activeMission.missionId,
    offerSetId: activeMission.offerSetId,
    settledAt: ctx.now,
    result: battleResult.playerWon ? 'SUCCESS' : 'FAILED',
    rewardGranted,
    rewardSnapshot: activeMission.rewardSnapshot,
    grantedReward,
    battleResult,
    playerDelta: buildPlayerDelta(before, after),
  };

  activeMission.settlementStatus = 'SETTLED';
  activeMission.rewardGranted = rewardGranted;
  ctx.state.tavern.lastSettlement = settlement;
  ctx.state.tavern.activeMission = null;
  ctx.state.tavern.missionOffers = [];
  generateMissionOffers(ctx.state, ctx.now);
  ctx.markDirty();

  return buildCompleteMissionResponse(ctx.state, settlement, ctx.now, 'COMPLETE_MISSION');
}

function consumeSkipCost(state: GameState): void {
  if (state.resources.hourglasses > 0) {
    spendResource(state, 'hourglasses', 1);
    return;
  }

  if (state.resources.tokens > 0) {
    spendResource(state, 'tokens', 1);
    return;
  }

  throw new GameError('NOT_ENOUGH_SKIP_RESOURCE', 'Not enough skip resources.');
}

export function skipMission(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<CompleteMissionData> {
  const activeMission = ctx.state.tavern.activeMission;
  if (!activeMission) {
    if (ctx.state.tavern.lastSettlement) {
      return buildAlreadySettledResponse(ctx.state, ctx.state.tavern.lastSettlement, ctx.now, 'SKIP_MISSION');
    }
    throw new GameError('NO_ACTIVE_MISSION', 'No active mission.');
  }

  if (activeMission.settlementStatus === 'SETTLED' && ctx.state.tavern.lastSettlement) {
    return buildAlreadySettledResponse(ctx.state, ctx.state.tavern.lastSettlement, ctx.now, 'SKIP_MISSION');
  }

  if (ctx.now < activeMission.endTime) {
    consumeSkipCost(ctx.state);
    ctx.markDirty();
  }

  activeMission.endTime = ctx.now;
  const result = completeMission(ctx, {});
  return {
    ...result,
    action: 'SKIP_MISSION',
  };
}
