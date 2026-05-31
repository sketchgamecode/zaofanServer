import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import { createSeededRandom } from '../lib/rng.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type {
  ActiveMission,
  EnemySnapshot,
  GameState,
  GrantedReward,
  MissionSettlement,
  BattleResultV2,
  PlayerCombatSnapshot,
  PowerFactionId,
  RewardSnapshot,
  PowerTransferResult,
  MissionTargetActorPreview,
  WorldActor,
  MissionIssuerActorPreview,
  OfficeSettlementPreview,
} from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { buildPlayerCombatSnapshot } from './characterCombat.js';
import { generateEquipment } from './equipmentGenerator.js';
import { GameError } from './errors.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { MathCore, buildPlayerBattleSide, getTotalAttributes, serverSimulateBattle } from './mathCore.js';
import { buildPlayerDelta, captureResourceSnapshot, grantExp, grantResource, spendResource } from './resourceService.js';
import { applyWorldPowerTransfer, POWER_LOCATIONS, buildServicePositions, writeOfficeLedgerFromMission } from './world.js';
import { buildTavernSummaryView, generateMissionOffers, getCurrentMountMultiplierBp, getTavernInfo, getTavernStatus, type TavernInfoData } from './tavern.js';

export type StartMissionPayload = {
  missionId?: string;
  offerSetId?: string;
};

export type CompleteMissionData = {
  result: 'SUCCESS' | 'FAILED' | 'ALREADY_SETTLED';
  missionId: string;
  offerSetId: string;
  battleResult: BattleResultV2;
  canSaveReplay: boolean;
  replayId: string | null;
  rewardGranted: boolean;
  grantedReward: GrantedReward;
  playerDelta: MissionSettlement['playerDelta'];
  nextMissionOffers: GameState['tavern']['missionOffers'];
  tavern: ReturnType<typeof buildTavernSummaryView>;
  /** 权力结算结果：疑心变化 + 结算后当前疑心池（阶段1新增） */
  powerResult?: {
    suspicionDelta?: Partial<Record<PowerFactionId, number>>;
    suspicionAfter?: Partial<Record<PowerFactionId, number>>;
    powerTransfer?: PowerTransferResult;
  };
  /** 任务目标世界角色预览（阶段6新增） */
  targetActor?: MissionTargetActorPreview;
  // 任务发布场所来源（任务发布场所统一化 V1 新增）
  sourceLocationId?: string;
  sourceLocationName?: string;
  sourcePositionId?: string;
  issuerActorId?: string;
  issuerDisplayName?: string;
  issuerTitle?: string;
  issuerFaction?: PowerFactionId;
  // 任务发布人世界角色预览（任务发布人角色化 V1 新增）
  issuerActor?: MissionIssuerActorPreview;
  // 职位分账预览（职位考功 V1 新增）
  officeSettlement?: OfficeSettlementPreview;
};

function emptyGrantedReward(): GrantedReward {
  return {
    xp: 0,
    copper: 0,
    tokens: 0,
    hourglass: 0,
  };
}

/** 所有已知派系列表，用于 suspicion 补全 */
const ALL_FACTIONS: ReadonlyArray<PowerFactionId> = [
  'imperial', 'noble', 'censorate', 'border', 'silver', 'underworld',
];

/**
 * 应用权力疑心变化：将 powerContext.suspicionDeltaPreview 加到 state.player.suspicion。
 * - 如果 suspicion 不存在或缺少某个派系，自动补 0。
 * - 返回实际 delta 和结算后全量。
 */
function applyPowerSuspicion(
  state: GameState,
  suspicionDeltaPreview: Partial<Record<PowerFactionId, number>>,
): { suspicionDelta: Partial<Record<PowerFactionId, number>>; suspicionAfter: Partial<Record<PowerFactionId, number>> } {
  // 如果旧存档没有 suspicion，就先全部初始化为 0
  if (!state.player.suspicion) {
    state.player.suspicion = {};
  }
  const suspicion = state.player.suspicion;

  // 补全缺失的派系
  for (const faction of ALL_FACTIONS) {
    if (suspicion[faction] === undefined) {
      suspicion[faction] = 0;
    }
  }

  const actualDelta: Partial<Record<PowerFactionId, number>> = {};

  for (const [faction, delta] of Object.entries(suspicionDeltaPreview) as [PowerFactionId, number][]) {
    if (delta !== 0) {
      const current = suspicion[faction] ?? 0;
      const newVal = Math.max(0, current + delta);
      suspicion[faction] = newVal;
      actualDelta[faction] = newVal - current;
    }
  }

  // 拍一份结算后状态
  const suspicionAfter: Partial<Record<PowerFactionId, number>> = { ...suspicion };
  return { suspicionDelta: actualDelta, suspicionAfter };
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
    classId: rng.pick(['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E'] as const),
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

function buildEnemySnapshotFromTargetActor(
  player: PlayerCombatSnapshot,
  targetActor: WorldActor,
  offer: GameState['tavern']['missionOffers'][number],
  seed: string
): EnemySnapshot {
  const rng = createSeededRandom(`${seed}:enemy`);
  const hpRatioBp = rng.int(8600, 9400);
  const damageRatioBp = rng.int(8400, 9300);
  const armorRatioBp = rng.int(7000, 9000);

  const level = targetActor.level;
  const classId = targetActor.classId;

  const attributes = { ...targetActor.combatSnapshot.attributes };
  // If bot attributes are the default 10s, scale them appropriately for level
  if (targetActor.kind === 'bot' && attributes.strength === 10 && attributes.intelligence === 10 && level > 1) {
    const base = 8 + level * 2;
    attributes.strength = base;
    attributes.intelligence = base;
    attributes.agility = base;
    attributes.constitution = Math.floor(base * 0.85);
    attributes.luck = Math.floor(base * 0.45);
    const mainStat = CLASS_CONFIG[classId].mainStat;
    attributes[mainStat] = Math.floor(base * 1.25);
  }

  // Calculate HP
  const baseHp = MathCore.getMaxHP(attributes.constitution, level, classId);

  // Calculate armor
  let baseArmor = targetActor.combatSnapshot.combatStats.armor;
  if (targetActor.kind === 'bot' || baseArmor <= 10) {
    baseArmor = Math.max(10, level * 10);
  }

  // Calculate damage
  let baseDamageMin = targetActor.combatSnapshot.combatStats.damageMin;
  let baseDamageMax = targetActor.combatSnapshot.combatStats.damageMax;
  if (targetActor.kind === 'bot' || (baseDamageMin === 5 && baseDamageMax === 10)) {
    baseDamageMin = Math.max(1, Math.floor(level * 2.2));
    baseDamageMax = Math.max(baseDamageMin + 1, Math.floor(level * 3.8));
  }

  const critChanceBp = Math.floor(MathCore.getCritChance(attributes.luck, level) * 10000);
  const dodgeChanceBp = CLASS_CONFIG[classId].dodgeChanceBp || undefined;

  return {
    enemyId: targetActor.actorId,
    name: targetActor.displayName,
    level,
    classId,
    avatarId: offer.targetActor?.avatarId || 'avatar_placeholder_000',
    attributes: {
      strength: Math.max(1, Math.floor(attributes.strength * hpRatioBp / 10000)),
      intelligence: Math.max(1, Math.floor(attributes.intelligence * hpRatioBp / 10000)),
      agility: Math.max(1, Math.floor(attributes.agility * damageRatioBp / 10000)),
      constitution: Math.max(1, Math.floor(attributes.constitution * hpRatioBp / 10000)),
      luck: Math.max(1, Math.floor(attributes.luck * 9000 / 10000)),
    },
    combatStats: {
      hp: Math.max(8, Math.floor(baseHp * hpRatioBp / 10000)),
      armor: Math.max(0, Math.floor(baseArmor * armorRatioBp / 10000)),
      damageMin: Math.max(1, Math.floor(baseDamageMin * damageRatioBp / 10000)),
      damageMax: Math.max(2, Math.floor(baseDamageMax * damageRatioBp / 10000)),
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
    canSaveReplay: settlement.canSaveReplay ?? false,
    replayId: settlement.replayId ?? null,
    rewardGranted: settlement.rewardGranted,
    grantedReward: settlement.grantedReward,
    playerDelta: settlement.playerDelta,
    nextMissionOffers: state.tavern.missionOffers,
    tavern: buildTavernSummaryView(state, now),
    powerResult: settlement.powerResult,
    targetActor: settlement.targetActor,
    // 来源字段
    sourceLocationId: settlement.sourceLocationId,
    sourceLocationName: settlement.sourceLocationName,
    sourcePositionId: settlement.sourcePositionId,
    issuerActorId: settlement.issuerActorId,
    issuerDisplayName: settlement.issuerDisplayName,
    issuerTitle: settlement.issuerTitle,
    issuerFaction: settlement.issuerFaction,
    // 新增 issuerActor
    issuerActor: settlement.issuerActor,
    // 新增 officeSettlement
    officeSettlement: settlement.officeSettlement,
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

  let enemySnapshot: EnemySnapshot;
  const targetActor = offer.targetActor && ctx.state.world?.actors
    ? ctx.state.world.actors.find((a) => a.actorId === offer.targetActor!.actorId)
    : undefined;

  if (targetActor) {
    enemySnapshot = buildEnemySnapshotFromTargetActor(playerCombatSnapshot, targetActor, offer, combatSeed);
  } else {
    enemySnapshot = buildEnemySnapshot(playerCombatSnapshot, offer, combatSeed);
  }

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
    // 携带 powerContext，确保结算时不丢失
    powerContext: offer.powerContext,
    // 携带 targetActor，从 offer 带过来
    targetActor: offer.targetActor,
    // 来源字段
    sourceLocationId: offer.sourceLocationId,
    sourceLocationName: offer.sourceLocationName,
    sourcePositionId: offer.sourcePositionId,
    issuerActorId: offer.issuerActorId,
    issuerDisplayName: offer.issuerDisplayName,
    issuerTitle: offer.issuerTitle,
    issuerFaction: offer.issuerFaction,
    // 新增 issuerActor
    issuerActor: offer.issuerActor,
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
  let powerResult: MissionSettlement['powerResult'];
  let officeSettlement: MissionSettlement['officeSettlement'] = undefined;

  if (battleResult.playerWon) {
    grantedReward = grantRewardSnapshot(ctx.state, activeMission.rewardSnapshot);
    rewardGranted = true;

    // 成功时应用权力疑心变化与权柄转移
    const powerContext = activeMission.powerContext;
    if (powerContext) {
      let suspicionResult: ReturnType<typeof applyPowerSuspicion> | undefined;
      const suspicionDeltaPreview = powerContext.suspicionDeltaPreview;
      if (suspicionDeltaPreview && Object.keys(suspicionDeltaPreview).length > 0) {
        suspicionResult = applyPowerSuspicion(ctx.state, suspicionDeltaPreview);
      }

      const amount = powerContext.issuerFaction === powerContext.targetFaction ? 1 : 2;

      let beneficiaryActorId: string | undefined = undefined;
      let beneficiaryDisplayName: string | undefined = undefined;
      let routingReason = '';

      if (activeMission.sourceLocationId === 'northern_bureau') {
        const northernBureauLoc = POWER_LOCATIONS.find(l => l.locationId === 'northern_bureau');
        const posList = northernBureauLoc ? buildServicePositions(northernBureauLoc, ctx.state.world.actors, ctx, `player:${ctx.playerId}`) : [];
        const missionsPos = posList.find(p => p.service === 'missions');

        if (missionsPos?.occupant.actorId) {
          beneficiaryActorId = missionsPos.occupant.actorId;
          beneficiaryDisplayName = missionsPos.occupant.displayName;
          routingReason = '锦衣卫差事权柄按人事权归公，流向该职务任职者。';
        } else {
          // fallback to top imperial bot
          const imperialBots = ctx.state.world.actors.filter(a => a.faction === 'imperial' && a.kind === 'bot');
          imperialBots.sort((a, b) => b.powerShare - a.powerShare);
          if (imperialBots[0]) {
            beneficiaryActorId = imperialBots[0].actorId;
            beneficiaryDisplayName = imperialBots[0].displayName;
            routingReason = '锦衣卫差事权柄归公，未找到该职任职者，流向皇权中枢主管太监（特旨兜底）。';
          } else {
            // final fallback to player
            beneficiaryActorId = `player:${ctx.playerId}`;
            beneficiaryDisplayName = ctx.state.player.displayName || '执行玩家';
            routingReason = '锦衣卫差支权柄归公，无合适接收者，暂时由执行人保管（临时兜底）。';
          }
        }
      }

      const powerTransfer = applyWorldPowerTransfer(ctx, {
        amount,
        targetFactionId: powerContext.targetFaction,
        issuerFactionId: powerContext.issuerFaction,
        targetActorId: activeMission.targetActor?.actorId,
        beneficiaryActorId,
      });

      powerResult = {
        ...(suspicionResult ? suspicionResult : {}),
        powerTransfer,
      };

      // Assemble officeSettlement
      if (activeMission.sourceLocationId === 'northern_bureau') {
        officeSettlement = {
          sourcePositionId: 'northern_bureau:missions',
          beneficiaryActorId,
          beneficiaryDisplayName,
          taxValueDelta: 0,
          powerValueDelta: powerTransfer.actorPowerDelta,
          routingReason,
        };
      } else if (activeMission.sourceLocationId) {
        const otherLoc = POWER_LOCATIONS.find(l => l.locationId === activeMission.sourceLocationId);
        const posList = otherLoc ? buildServicePositions(otherLoc, ctx.state.world.actors, ctx, `player:${ctx.playerId}`) : [];
        const missionsPos = posList.find(p => p.service === 'missions');

        officeSettlement = {
          sourcePositionId: activeMission.sourcePositionId || `${activeMission.sourceLocationId}:missions`,
          beneficiaryActorId: missionsPos?.occupant.actorId,
          beneficiaryDisplayName: missionsPos?.occupant.displayName,
          taxValueDelta: Math.max(10, Math.floor(activeMission.rewardSnapshot.copper * 0.15)),
          powerValueDelta: 0,
          routingReason: '其他衙门差事。所得税值与钱流流向该职务主官，玩家获发额定赏银。',
        };
      }

      if (officeSettlement) {
        writeOfficeLedgerFromMission(ctx, activeMission, officeSettlement);
      }
    }
  }
  // 失败时不修改 suspicion（阶段1设计：失败时不加疑心）

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
    canSaveReplay: true,
    replayId: null,
    playerDelta: buildPlayerDelta(before, after),
    powerResult,
    targetActor: activeMission.targetActor,
    // 来源字段
    sourceLocationId: activeMission.sourceLocationId,
    sourceLocationName: activeMission.sourceLocationName,
    sourcePositionId: activeMission.sourcePositionId,
    issuerActorId: activeMission.issuerActorId,
    issuerDisplayName: activeMission.issuerDisplayName,
    issuerTitle: activeMission.issuerTitle,
    issuerFaction: activeMission.issuerFaction,
    // 新增 issuerActor
    issuerActor: activeMission.issuerActor,
    // 新增 officeSettlement
    officeSettlement,
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
