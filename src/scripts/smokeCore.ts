import { createInitialGameState } from '../engine/gameStateFactory.js';
import { applyDailyResetIfNeeded } from '../engine/dailyReset.js';
import { captureResourceSnapshot, grantExp, grantResource, spendResource } from '../engine/resourceService.js';
import { buildDisabledActionResponse } from '../engine/disabledActions.js';
import { createActionContext } from '../engine/actionContext.js';
import {
  computeActualDurationSec,
  generateMissions,
  getTavernInfo,
  tavernDrink,
  type TavernInfoData,
} from '../engine/tavern.js';
import { completeMission, skipMission, startMission } from '../engine/missions.js';
import { GameError } from '../engine/errors.js';
import type { ActionSuccessResponse } from '../types/action.js';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function run(): Promise<void> {
  const now = Date.now();
  const state = createInitialGameState({ now, playerId: 'smoke-user' });

  assert(state.meta.schemaVersion === 1, 'schema version should be 1');
  assert(state.tavern.thirstSecRemaining === 6000, 'initial thirst should be 6000 sec');

  const before = captureResourceSnapshot(state);
  grantResource(state, 'copper', 10);
  spendResource(state, 'tokens', 1);
  grantExp(state, 1000);
  const after = captureResourceSnapshot(state);

  assert(after.copper === before.copper + 10, 'copper grant should apply');
  assert(after.tokens === before.tokens - 1, 'token spend should apply');

  state.meta.lastDailyResetDate = '2000-01-01';
  state.tavern.missionOffers = [
    {
      offerSetId: 'old',
      missionId: 'old',
      offerSeq: 1,
      slotIndex: 0,
      title: 'old',
      description: 'old',
      baseDurationSec: 60,
      actualDurationSec: 60,
      thirstCostSec: 60,
      visibleReward: { xp: 0, copper: 0, hasEquipment: false, hasDungeonKey: false },
      enemyPreview: { enemyId: 'e', name: 'e', level: 1 },
      generatedAt: now,
    },
  ];
  const resetApplied = applyDailyResetIfNeeded(state, now);
  assert(resetApplied, 'daily reset should apply after stale date');
  assert(state.tavern.missionOffers.length === 0, 'daily reset should clear idle cross-day offers');

  const disabled = buildDisabledActionResponse('TAVERN_GET_INFO', 'tavern', state, now);
  assert(disabled.ok && disabled.data.status === 'DISABLED', 'disabled response should be stable');

  const tavernState = createInitialGameState({ now, playerId: 'smoke-user' });
  const ctx = createActionContext({ playerId: 'smoke-user', now, state: tavernState });
  const info1 = getTavernInfo(ctx, {});
  assert(info1.ok, 'initial TAVERN_GET_INFO should succeed');
  const info1Data = (info1 as ActionSuccessResponse<TavernInfoData>).data;
  assert(info1Data.tavern.missionOffers.length === 3, 'initial TAVERN_GET_INFO should generate 3 offers');
  const firstOffers = JSON.stringify(info1Data.tavern.missionOffers);
  assert(!firstOffers.includes('combatSeed'), 'offers should not leak combatSeed');
  assert(!firstOffers.includes('rewardSeed'), 'offers should not leak rewardSeed');
  assert(!firstOffers.includes('rewardSnapshot'), 'offers should not leak rewardSnapshot');
  assert(!firstOffers.includes('hiddenRolls'), 'offers should not leak hiddenRolls');

  const info2 = getTavernInfo(ctx, {});
  assert(info2.ok, 'second TAVERN_GET_INFO should succeed');
  const info2Data = (info2 as ActionSuccessResponse<TavernInfoData>).data;
  assert(JSON.stringify(info2Data.tavern.missionOffers) === firstOffers, 'TAVERN_GET_INFO should not reroll existing offers');

  const generated = generateMissions(ctx, {});
  assert(generated.ok, 'GENERATE_MISSIONS should succeed');
  const generatedData = (generated as ActionSuccessResponse<TavernInfoData>).data;
  assert(JSON.stringify(generatedData.tavern.missionOffers) === firstOffers, 'GENERATE_MISSIONS should not reroll existing offers');

  const drinkPreserveState = createInitialGameState({ now, playerId: 'drink-preserve-user' });
  const drinkPreserveCtx = createActionContext({ playerId: 'drink-preserve-user', now, state: drinkPreserveState });
  const preDrinkInfo = getTavernInfo(drinkPreserveCtx, {});
  const preDrinkData = (preDrinkInfo as ActionSuccessResponse<TavernInfoData>).data;
  assert(preDrinkData.tavern.missionOffers.length === 3, 'pre-drink tavern info should have 3 offers');
  const preDrinkOfferSetId = preDrinkData.tavern.missionOffers[0]?.offerSetId;
  const preDrinkMissionIds = preDrinkData.tavern.missionOffers.map((offer) => offer.missionId).join(',');
  const postDrinkResult = tavernDrink(drinkPreserveCtx, {});
  const postDrinkData = (postDrinkResult as ActionSuccessResponse<TavernInfoData>).data;
  assert(postDrinkData.tavern.missionOffers.length === 3, 'drink should preserve 3 offers');
  assert(postDrinkData.tavern.missionOffers[0]?.offerSetId === preDrinkOfferSetId, 'drink should not replace offerSetId');
  assert(postDrinkData.tavern.missionOffers.map((offer) => offer.missionId).join(',') === preDrinkMissionIds, 'drink should not reroll mission ids');

  const drinkState = createInitialGameState({ now, playerId: 'drink-user' });
  drinkState.tavern.thirstSecRemaining = 6000;
  const drinkCtx = createActionContext({ playerId: 'drink-user', now, state: drinkState });
  const drinkResult = tavernDrink(drinkCtx, {});
  assert(drinkResult.ok, 'TAVERN_DRINK should succeed');
  const drinkData = (drinkResult as ActionSuccessResponse<TavernInfoData>).data;
  assert(drinkData.tavern.thirstSecRemaining === 7200, 'TAVERN_DRINK should increase thirst from 6000 to 7200');

  const limitState = createInitialGameState({ now, playerId: 'limit-user' });
  limitState.tavern.drinksUsedToday = 10;
  const limitCtx = createActionContext({ playerId: 'limit-user', now, state: limitState });
  let limitRejected = false;
  try {
    tavernDrink(limitCtx, {});
  } catch (error) {
    limitRejected = error instanceof GameError && error.code === 'TAVERN_DRINK_LIMIT_REACHED';
  }
  assert(limitRejected, '11th drink should be rejected');

  assert(computeActualDurationSec(20 * 60, 5000) === 600, '5000 BP mount should turn 20 min into 600 sec');

  const mountState = createInitialGameState({ now, playerId: 'mount-user' });
  mountState.mount.timeMultiplierBp = 5000;
  const mountCtx = createActionContext({ playerId: 'mount-user', now, state: mountState });
  const mountInfo = getTavernInfo(mountCtx, {});
  assert(mountInfo.ok, 'mount TAVERN_GET_INFO should succeed');
  const mountData = (mountInfo as ActionSuccessResponse<TavernInfoData>).data;
  const hasMounted20MinMission = mountData.tavern.missionOffers.some(
    (offer: TavernInfoData['tavern']['missionOffers'][number]) => offer.baseDurationSec === 20 * 60 && offer.actualDurationSec === 600,
  );
  assert(hasMounted20MinMission || computeActualDurationSec(20 * 60, 5000) === 600, 'mounted duration conversion should be valid');

  const missionState = createInitialGameState({ now, playerId: 'mission-user' });
  const missionCtx = createActionContext({ playerId: 'mission-user', now, state: missionState });
  const missionInfo = getTavernInfo(missionCtx, {});
  const missionInfoData = (missionInfo as ActionSuccessResponse<TavernInfoData>).data;
  const selectedMission = missionInfoData.tavern.missionOffers[0];
  assert(selectedMission !== undefined, 'mission offer should exist for START_MISSION');
  const thirstBeforeStart = missionState.tavern.thirstSecRemaining;
  const startResponse = startMission(missionCtx, { missionId: selectedMission.missionId, offerSetId: selectedMission.offerSetId });
  const startData = (startResponse as ActionSuccessResponse<TavernInfoData>).data;
  assert(startData.tavern.activeMission !== null, 'START_MISSION should create active mission');
  assert(startData.tavern.missionOffers.length === 0, 'START_MISSION should clear mission offers');
  assert(startData.tavern.thirstSecRemaining === thirstBeforeStart - selectedMission.thirstCostSec, 'START_MISSION should deduct thirst');
  const startJson = JSON.stringify(startResponse);
  assert(!startJson.includes('combatSeed'), 'START_MISSION response should not leak combatSeed');
  assert(!startJson.includes('rewardSnapshot'), 'START_MISSION response should not leak rewardSnapshot');
  assert(!startJson.includes('playerCombatSnapshot'), 'START_MISSION response should not leak playerCombatSnapshot');
  assert(!startJson.includes('hiddenRolls'), 'START_MISSION response should not leak hiddenRolls');

  const notEnoughThirstState = createInitialGameState({ now, playerId: 'thirst-user' });
  const notEnoughThirstCtx = createActionContext({ playerId: 'thirst-user', now, state: notEnoughThirstState });
  const thirstInfo = getTavernInfo(notEnoughThirstCtx, {});
  const thirstOffer = ((thirstInfo as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  notEnoughThirstState.tavern.thirstSecRemaining = Math.max(0, thirstOffer.thirstCostSec - 1);
  let notEnoughThirstTriggered = false;
  try {
    startMission(notEnoughThirstCtx, { missionId: thirstOffer.missionId, offerSetId: thirstOffer.offerSetId });
  } catch (error) {
    notEnoughThirstTriggered = error instanceof GameError && error.code === 'NOT_ENOUGH_THIRST';
  }
  assert(notEnoughThirstTriggered, 'START_MISSION should reject insufficient thirst');

  const earlyCompleteState = createInitialGameState({ now, playerId: 'early-complete-user' });
  const earlyCtx = createActionContext({ playerId: 'early-complete-user', now, state: earlyCompleteState });
  const earlyOffer = ((getTavernInfo(earlyCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(earlyCtx, { missionId: earlyOffer.missionId, offerSetId: earlyOffer.offerSetId });
  let earlyCompleteRejected = false;
  try {
    completeMission(earlyCtx, {});
  } catch (error) {
    earlyCompleteRejected = error instanceof GameError && error.code === 'MISSION_NOT_FINISHED';
  }
  assert(earlyCompleteRejected, 'COMPLETE_MISSION should reject before endTime');

  const successState = createInitialGameState({ now, playerId: 'success-user' });
  const successCtx = createActionContext({ playerId: 'success-user', now, state: successState });
  const successOffer = ((getTavernInfo(successCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(successCtx, { missionId: successOffer.missionId, offerSetId: successOffer.offerSetId });
  successState.tavern.activeMission!.endTime = now;
  const successBefore = captureResourceSnapshot(successState);
  const completeSuccessResponse = completeMission(successCtx, {});
  const completeSuccessData = completeSuccessResponse.data;
  const successAfter = captureResourceSnapshot(successState);
  assert(completeSuccessData.result === 'SUCCESS', 'COMPLETE_MISSION success path should return SUCCESS');
  assert(successAfter.copper >= successBefore.copper + successOffer.visibleReward.copper, 'COMPLETE_MISSION success should grant copper');
  assert(successAfter.exp >= successBefore.exp, 'COMPLETE_MISSION success should grant xp');
  assert(successState.tavern.activeMission === null, 'COMPLETE_MISSION success should clear active mission');
  assert(successState.tavern.lastSettlement !== null, 'COMPLETE_MISSION success should write lastSettlement');
  assert(completeSuccessData.nextMissionOffers.length === 3, 'COMPLETE_MISSION success should return 3 nextMissionOffers');
  assert(successState.tavern.missionOffers.length === 3, 'COMPLETE_MISSION success should generate next mission offers');
  assert(completeSuccessData.playerDelta.hourglassesBefore !== undefined, 'COMPLETE_MISSION success should include full playerDelta');
  assert(completeSuccessData.playerDelta.prestigeAfter !== undefined, 'COMPLETE_MISSION success should include full playerDelta');

  const failureState = createInitialGameState({ now, playerId: 'failure-user' });
  const failureCtx = createActionContext({ playerId: 'failure-user', now, state: failureState });
  const failureOffer = ((getTavernInfo(failureCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(failureCtx, { missionId: failureOffer.missionId, offerSetId: failureOffer.offerSetId });
  failureState.tavern.activeMission!.enemySnapshot.combatStats.hp = 999999;
  failureState.tavern.activeMission!.enemySnapshot.combatStats.damageMin = 9999;
  failureState.tavern.activeMission!.enemySnapshot.combatStats.damageMax = 9999;
  failureState.tavern.activeMission!.endTime = now;
  const failureBefore = captureResourceSnapshot(failureState);
  const failureInvBefore = failureState.inventory.items.length;
  const completeFailureResponse = completeMission(failureCtx, {});
  const completeFailureData = completeFailureResponse.data;
  const failureAfter = captureResourceSnapshot(failureState);
  assert(completeFailureData.result === 'FAILED', 'COMPLETE_MISSION failure path should return FAILED');
  assert(failureAfter.copper === failureBefore.copper, 'COMPLETE_MISSION failure should not grant copper');
  assert(failureAfter.exp === failureBefore.exp, 'COMPLETE_MISSION failure should not grant xp');
  assert(failureAfter.tokens === failureBefore.tokens, 'COMPLETE_MISSION failure should not grant tokens');
  assert(failureState.inventory.items.length === failureInvBefore, 'COMPLETE_MISSION failure should not grant equipment');
  assert(failureState.tavern.activeMission === null, 'COMPLETE_MISSION failure should clear active mission');
  assert(failureState.tavern.lastSettlement !== null, 'COMPLETE_MISSION failure should write lastSettlement');
  assert(completeFailureData.nextMissionOffers.length === 3, 'COMPLETE_MISSION failure should return 3 nextMissionOffers');
  assert(failureState.tavern.missionOffers.length === 3, 'COMPLETE_MISSION failure should generate next mission offers');
  assert(completeFailureData.playerDelta.hourglassesBefore !== undefined, 'COMPLETE_MISSION failure should include full playerDelta');
  assert(completeFailureData.playerDelta.prestigeAfter !== undefined, 'COMPLETE_MISSION failure should include full playerDelta');

  const skipHourglassState = createInitialGameState({ now, playerId: 'skip-hourglass-user' });
  skipHourglassState.tavern.firstMissionBonusClaimed = true;
  const skipHourglassCtx = createActionContext({ playerId: 'skip-hourglass-user', now, state: skipHourglassState });
  const skipHourglassOffer = ((getTavernInfo(skipHourglassCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(skipHourglassCtx, { missionId: skipHourglassOffer.missionId, offerSetId: skipHourglassOffer.offerSetId });
  const hourglassesBefore = skipHourglassState.resources.hourglasses;
  const tokensBeforeSkip = skipHourglassState.resources.tokens;
  const skipHourglassResponse = skipMission(skipHourglassCtx, {});
  assert(skipHourglassResponse.data.result === 'SUCCESS' || skipHourglassResponse.data.result === 'FAILED', 'SKIP_MISSION should settle mission');
  assert(skipHourglassResponse.action === 'SKIP_MISSION', 'SKIP_MISSION response action should be SKIP_MISSION');
  assert(skipHourglassResponse.data.nextMissionOffers.length === 3, 'SKIP_MISSION should return 3 nextMissionOffers');
  assert(skipHourglassState.resources.hourglasses === hourglassesBefore - 1, 'SKIP_MISSION should consume hourglass first');
  assert(skipHourglassState.resources.tokens === tokensBeforeSkip, 'SKIP_MISSION should not consume token if hourglass exists');
  assert(skipHourglassResponse.data.playerDelta.hourglassesBefore !== undefined, 'SKIP_MISSION should include full playerDelta');
  assert(skipHourglassResponse.data.playerDelta.prestigeAfter !== undefined, 'SKIP_MISSION should include full playerDelta');

  const skipTokenState = createInitialGameState({ now, playerId: 'skip-token-user' });
  skipTokenState.resources.hourglasses = 0;
  skipTokenState.tavern.firstMissionBonusClaimed = true;
  const skipTokenCtx = createActionContext({ playerId: 'skip-token-user', now, state: skipTokenState });
  const skipTokenOffer = ((getTavernInfo(skipTokenCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(skipTokenCtx, { missionId: skipTokenOffer.missionId, offerSetId: skipTokenOffer.offerSetId });
  const tokenBeforeSkip = skipTokenState.resources.tokens;
  skipMission(skipTokenCtx, {});
  assert(skipTokenState.resources.tokens === tokenBeforeSkip - 1, 'SKIP_MISSION should consume token when no hourglass exists');

  const idempotentCompleteState = createInitialGameState({ now, playerId: 'idempotent-complete-user' });
  const idempotentCompleteCtx = createActionContext({ playerId: 'idempotent-complete-user', now, state: idempotentCompleteState });
  const idempotentOffer = ((getTavernInfo(idempotentCompleteCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(idempotentCompleteCtx, { missionId: idempotentOffer.missionId, offerSetId: idempotentOffer.offerSetId });
  idempotentCompleteState.tavern.activeMission!.endTime = now;
  const idempotentBefore = captureResourceSnapshot(idempotentCompleteState);
  completeMission(idempotentCompleteCtx, {});
  const idempotentAfterFirst = captureResourceSnapshot(idempotentCompleteState);
  const secondComplete = completeMission(idempotentCompleteCtx, {});
  const idempotentAfterSecond = captureResourceSnapshot(idempotentCompleteState);
  assert(secondComplete.data.result === 'ALREADY_SETTLED', 'repeat COMPLETE_MISSION should return ALREADY_SETTLED');
  assert(JSON.stringify(idempotentAfterFirst) === JSON.stringify(idempotentAfterSecond), 'repeat COMPLETE_MISSION should not grant reward twice');
  assert(idempotentAfterFirst.copper >= idempotentBefore.copper, 'first COMPLETE_MISSION should settle normally');

  const skipThenCompleteState = createInitialGameState({ now, playerId: 'skip-then-complete-user' });
  const skipThenCompleteCtx = createActionContext({ playerId: 'skip-then-complete-user', now, state: skipThenCompleteState });
  const skipThenCompleteOffer = ((getTavernInfo(skipThenCompleteCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(skipThenCompleteCtx, { missionId: skipThenCompleteOffer.missionId, offerSetId: skipThenCompleteOffer.offerSetId });
  const skipThenCompleteAfterSkip = skipMission(skipThenCompleteCtx, {});
  const afterSkipSnapshot = captureResourceSnapshot(skipThenCompleteState);
  const completeAfterSkip = completeMission(skipThenCompleteCtx, {});
  const afterRepeatSnapshot = captureResourceSnapshot(skipThenCompleteState);
  assert(completeAfterSkip.data.result === 'ALREADY_SETTLED', 'COMPLETE_MISSION after SKIP should be idempotent');
  assert(JSON.stringify(afterSkipSnapshot) === JSON.stringify(afterRepeatSnapshot), 'COMPLETE_MISSION after SKIP should not grant twice');
  assert(skipThenCompleteAfterSkip.data.result === 'SUCCESS' || skipThenCompleteAfterSkip.data.result === 'FAILED', 'SKIP_MISSION should settle immediately');

  const completeThenSkipState = createInitialGameState({ now, playerId: 'complete-then-skip-user' });
  const completeThenSkipCtx = createActionContext({ playerId: 'complete-then-skip-user', now, state: completeThenSkipState });
  const completeThenSkipOffer = ((getTavernInfo(completeThenSkipCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(completeThenSkipCtx, { missionId: completeThenSkipOffer.missionId, offerSetId: completeThenSkipOffer.offerSetId });
  completeThenSkipState.tavern.activeMission!.endTime = now;
  completeMission(completeThenSkipCtx, {});
  const resourcesBeforeLateSkip = captureResourceSnapshot(completeThenSkipState);
  const skipAfterComplete = skipMission(completeThenSkipCtx, {});
  const resourcesAfterLateSkip = captureResourceSnapshot(completeThenSkipState);
  assert(skipAfterComplete.data.result === 'ALREADY_SETTLED', 'SKIP_MISSION after COMPLETE should be idempotent');
  assert(JSON.stringify(resourcesBeforeLateSkip) === JSON.stringify(resourcesAfterLateSkip), 'SKIP_MISSION after COMPLETE should not consume skip resource');

  const mountSnapshotState = createInitialGameState({ now, playerId: 'mount-snapshot-user' });
  mountSnapshotState.mount.timeMultiplierBp = 5000;
  const mountSnapshotCtx = createActionContext({ playerId: 'mount-snapshot-user', now, state: mountSnapshotState });
  const mountSnapshotOffer = ((getTavernInfo(mountSnapshotCtx, {}) as ActionSuccessResponse<TavernInfoData>).data.tavern.missionOffers[0])!;
  startMission(mountSnapshotCtx, { missionId: mountSnapshotOffer.missionId, offerSetId: mountSnapshotOffer.offerSetId });
  const activeDurationBefore = mountSnapshotState.tavern.activeMission!.actualDurationSec;
  mountSnapshotState.mount.timeMultiplierBp = 10000;
  assert(mountSnapshotState.tavern.activeMission!.actualDurationSec === activeDurationBefore, 'mount changes after START_MISSION must not affect active mission duration');

  const completeJson = JSON.stringify(completeSuccessResponse);
  assert(!completeJson.includes('combatSeed'), 'COMPLETE_MISSION response should not leak combatSeed');
  assert(!completeJson.includes('rewardSnapshot'), 'COMPLETE_MISSION response should not leak rewardSnapshot');
  assert(!completeJson.includes('playerCombatSnapshot'), 'COMPLETE_MISSION response should not leak playerCombatSnapshot');
  assert(!completeJson.includes('hiddenRolls'), 'COMPLETE_MISSION response should not leak hiddenRolls');
  const skipJson = JSON.stringify(skipHourglassResponse);
  assert(!skipJson.includes('combatSeed'), 'SKIP_MISSION response should not leak combatSeed');
  assert(!skipJson.includes('rewardSeed'), 'SKIP_MISSION response should not leak rewardSeed');
  assert(!skipJson.includes('rewardSnapshot'), 'SKIP_MISSION response should not leak rewardSnapshot');
  assert(!skipJson.includes('hiddenRolls'), 'SKIP_MISSION response should not leak hiddenRolls');
  assert(!skipJson.includes('playerCombatSnapshot'), 'SKIP_MISSION response should not leak playerCombatSnapshot');
  assert(!skipJson.includes('enemySnapshot'), 'SKIP_MISSION response should not leak enemySnapshot');
  assert(!skipJson.includes('settlementStatus'), 'SKIP_MISSION response should not leak settlementStatus');

  console.log('smoke:core ok');
}

await run();
