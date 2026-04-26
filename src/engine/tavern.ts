import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type {
  ActiveMission,
  EnemyPreview,
  GameState,
  MissionOffer,
  MountState,
  VisibleReward,
} from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { GameError } from './errors.js';
import { createSeededRandom } from '../lib/rng.js';
import { spendResource } from './resourceService.js';
import { getGameDateString } from '../lib/time.js';

export type TavernStatus = 'IDLE' | 'IN_PROGRESS' | 'READY_TO_COMPLETE';

export type ActiveMissionView = {
  missionId: string;
  offerSetId: string;
  offerSeq: number;
  slotIndex: 0 | 1 | 2;
  title: string;
  description: string;
  locationName?: string;
  startedAt: number;
  endTime: number;
  baseDurationSec: number;
  actualDurationSec: number;
  thirstCostSec: number;
  remainingSec: number;
  rewardPreview: {
    xp: number;
    copper: number;
    hasEquipment: boolean;
    hasDungeonKey: boolean;
    hasHourglass: boolean;
  };
  mountSnapshot: ActiveMission['mountSnapshot'];
};

export type TavernInfoData = {
  tavern: {
    status: TavernStatus;
    thirstSecRemaining: number;
    drinksUsedToday: number;
    firstMissionBonusAvailable: boolean;
    missionOffers: MissionOffer[];
    activeMission: ActiveMissionView | null;
  };
  mount: {
    timeMultiplierBp: number;
    expiresAt: number | null;
    name?: string;
    tier?: string;
  };
};

export type TavernSummaryView = TavernInfoData['tavern'];

const LOCATION_NAMES = ['汴京暗巷', '盐帮码头', '西市黑铺', '旧城地窖', '关外驿道', '河道栈桥'] as const;
const MISSION_TITLES = [
  ['追踪密探', '刺探口风', '潜入账房'],
  ['截获密信', '收债清账', '护送内线'],
  ['夜探仓库', '抄录名册', '伏击耳目'],
] as const;
const ENEMY_ARCHETYPES = ['逃兵', '打手', '账房', '密探', '护卫', '地痞'] as const;

function bpMul(value: number, basisPoints: number): number {
  return Math.floor((value * basisPoints) / 10000);
}

export function getCurrentMountMultiplierBp(mount: MountState, now: number): number {
  if (mount.expiresAt !== null && now >= mount.expiresAt) {
    return CLASSIC_TAVERN_RULES.mountMultiplierBp.none;
  }

  return mount.timeMultiplierBp;
}

export function getTavernStatus(state: GameState, now: number): TavernStatus {
  const active = state.tavern.activeMission;
  if (!active) return 'IDLE';
  if (now < active.endTime) return 'IN_PROGRESS';
  return 'READY_TO_COMPLETE';
}

function getDurationMinutesForLevel(level: number): number[] {
  return CLASSIC_TAVERN_RULES.lowLevelDurationMinByLevel[level] ?? [...CLASSIC_TAVERN_RULES.defaultDurationMin];
}

export function computeActualDurationSec(baseDurationSec: number, timeMultiplierBp: number): number {
  return bpMul(baseDurationSec, timeMultiplierBp);
}

function buildVisibleReward(level: number, durationMin: number, slotIndex: number, seed: string): VisibleReward {
  const rewardProfiles = [
    CLASSIC_TAVERN_RULES.rewardProfileWeights.xpFocused,
    CLASSIC_TAVERN_RULES.rewardProfileWeights.balanced,
    CLASSIC_TAVERN_RULES.rewardProfileWeights.copperFocused,
  ] as const;
  const profile = rewardProfiles[slotIndex] ?? rewardProfiles[1];
  const rng = createSeededRandom(`${seed}:reward:${slotIndex}`);
  const baseXp = Math.max(8, level * durationMin * 3);
  const baseCopper = Math.max(6, level * durationMin * 2);
  const xp = Math.max(1, bpMul(baseXp, profile.xpMulBp) + rng.int(0, level * 2));
  const copper = Math.max(1, bpMul(baseCopper, profile.copperMulBp) + rng.int(0, durationMin));
  const hasEquipment = rng.chanceBp(CLASSIC_TAVERN_RULES.itemDropChanceBp);

  return {
    xp,
    copper,
    hasEquipment,
    equipmentPreview: hasEquipment
      ? {
          slot: rng.pick(['head', 'body', 'hands', 'feet', 'neck', 'belt', 'ring', 'trinket', 'weapon', 'offHand'] as const),
          rarity: rng.int(0, 2) as 0 | 1 | 2,
        }
      : undefined,
    hasDungeonKey: false,
    hasHourglass: false,
  };
}

function buildEnemyPreview(level: number, slotIndex: number, seed: string): EnemyPreview {
  const rng = createSeededRandom(`${seed}:enemy:${slotIndex}`);
  return {
    enemyId: `enemy_${seed}_${slotIndex}`,
    name: rng.pick(ENEMY_ARCHETYPES),
    level: Math.max(1, level + rng.int(-1, 1)),
    archetype: rng.pick(['rogue', 'guard', 'scout', 'bruiser'] as const),
  };
}

function buildMissionDescription(title: string, locationName: string, durationMin: number): string {
  return `${title}，前往${locationName}活动 ${durationMin} 分钟。`;
}

function buildOfferSetId(playerId: string, offerSeq: number, dateStr: string): string {
  return `offer_${playerId}_${dateStr}_${offerSeq}`;
}

export function generateMissionOffers(state: GameState, now: number): MissionOffer[] {
  if (getTavernStatus(state, now) !== 'IDLE') {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate mission offers while a mission is active.');
  }

  if (state.tavern.missionOffers.length > 0) {
    return state.tavern.missionOffers;
  }

  const nextOfferSeq = state.tavern.offerSeq + 1;
  const dateStr = getGameDateString(now);
  const playerId = state.player.id ?? 'anonymous';
  const offerSetId = buildOfferSetId(playerId, nextOfferSeq, dateStr);
  const rng = createSeededRandom(`${offerSetId}:${state.player.level}`);
  const durationPool = getDurationMinutesForLevel(state.player.level);
  const shuffledDurations = [...durationPool]
    .map((durationMin, index) => ({ durationMin, order: rng.next(), index }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  const mountMultiplierBp = getCurrentMountMultiplierBp(state.mount, now);

  const offers: MissionOffer[] = shuffledDurations.map(({ durationMin }, slotIndex) => {
    const title = rng.pick(MISSION_TITLES[slotIndex] ?? MISSION_TITLES[0]);
    const locationName = rng.pick(LOCATION_NAMES);
    const baseDurationSec = durationMin * 60;
    const actualDurationSec = computeActualDurationSec(baseDurationSec, mountMultiplierBp);
    const missionId = `mission_${offerSetId}_${slotIndex}`;

    return {
      offerSetId,
      missionId,
      offerSeq: nextOfferSeq,
      slotIndex: slotIndex as 0 | 1 | 2,
      title,
      description: buildMissionDescription(title, locationName, durationMin),
      locationName,
      baseDurationSec,
      actualDurationSec,
      thirstCostSec: actualDurationSec,
      visibleReward: buildVisibleReward(state.player.level, durationMin, slotIndex, offerSetId),
      enemyPreview: buildEnemyPreview(state.player.level, slotIndex, offerSetId),
      generatedAt: now,
    };
  });

  state.tavern.offerSeq = nextOfferSeq;
  state.tavern.missionOffers = offers;
  return offers;
}

export function buildActiveMissionView(activeMission: ActiveMission | null, now: number): ActiveMissionView | null {
  if (!activeMission) {
    return null;
  }

  return {
    missionId: activeMission.missionId,
    offerSetId: activeMission.offerSetId,
    offerSeq: activeMission.offerSeq,
    slotIndex: activeMission.slotIndex,
    title: activeMission.title,
    description: activeMission.description,
    locationName: activeMission.locationName,
    startedAt: activeMission.startedAt,
    endTime: activeMission.endTime,
    baseDurationSec: activeMission.baseDurationSec,
    actualDurationSec: activeMission.actualDurationSec,
    thirstCostSec: activeMission.thirstCostSec,
    remainingSec: Math.max(0, Math.ceil((activeMission.endTime - now) / 1000)),
    rewardPreview: {
      xp: activeMission.rewardSnapshot.xp,
      copper: activeMission.rewardSnapshot.copper,
      hasEquipment: activeMission.rewardSnapshot.equipment !== null,
      hasDungeonKey: activeMission.rewardSnapshot.dungeonKey !== null,
      hasHourglass: activeMission.rewardSnapshot.hourglass > 0,
    },
    mountSnapshot: activeMission.mountSnapshot,
  };
}

export function buildTavernInfoData(state: GameState, now: number): TavernInfoData {
  return {
    tavern: {
      status: getTavernStatus(state, now),
      thirstSecRemaining: state.tavern.thirstSecRemaining,
      drinksUsedToday: state.tavern.drinksUsedToday,
      firstMissionBonusAvailable: !state.tavern.firstMissionBonusClaimed,
      missionOffers: state.tavern.missionOffers,
      activeMission: buildActiveMissionView(state.tavern.activeMission, now),
    },
    mount: {
      timeMultiplierBp: getCurrentMountMultiplierBp(state.mount, now),
      expiresAt: state.mount.expiresAt,
      name: state.mount.name,
      tier: state.mount.tier,
    },
  };
}

export function buildTavernSummaryView(state: GameState, now: number): TavernSummaryView {
  return buildTavernInfoData(state, now).tavern;
}

function buildTavernResponse(action: string, state: GameState, now: number): ActionSuccessResponse<TavernInfoData> {
  return {
    ok: true,
    action,
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildTavernInfoData(state, now),
  };
}

export function getTavernInfo(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (getTavernStatus(ctx.state, ctx.now) === 'IDLE' && ctx.state.tavern.missionOffers.length === 0) {
    generateMissionOffers(ctx.state, ctx.now);
    ctx.markDirty();
  }

  return buildTavernResponse('TAVERN_GET_INFO', ctx.state, ctx.now);
}

export function generateMissions(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (ctx.state.tavern.activeMission !== null) {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate missions while a mission is active.');
  }

  if (ctx.state.tavern.missionOffers.length === 0) {
    generateMissionOffers(ctx.state, ctx.now);
    ctx.markDirty();
  }

  return buildTavernResponse('GENERATE_MISSIONS', ctx.state, ctx.now);
}

export function tavernDrink(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (ctx.state.tavern.drinksUsedToday >= CLASSIC_TAVERN_RULES.maxDrinksPerDay) {
    throw new GameError('TAVERN_DRINK_LIMIT_REACHED', 'Daily tavern drink limit reached.');
  }

  if (ctx.state.resources.tokens < 1) {
    throw new GameError('NOT_ENOUGH_TOKENS', 'Not enough tokens to buy a drink.');
  }

  spendResource(ctx.state, 'tokens', 1);
  ctx.state.tavern.thirstSecRemaining += CLASSIC_TAVERN_RULES.drinkRestoreSec;
  ctx.state.tavern.drinksUsedToday += 1;
  ctx.markDirty();

  return buildTavernResponse('TAVERN_DRINK', ctx.state, ctx.now);
}
