import type { ActionSuccessResponse } from '../types/action.js';
import type { BattleReplayRecord } from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { buildBattleReplayRecord } from './battleReplayRecords.js';
import { GameError } from './errors.js';
import {
  deleteBattleReplay,
  findBattleReplayBySource,
  getBattleReplay,
  insertBattleReplay,
  listBattleReplays,
} from '../lib/battleReplayStore.js';

type ReplayListItem = Omit<BattleReplayRecord, 'battleResult'>;

function listItem(record: BattleReplayRecord): ReplayListItem {
  const { battleResult: _battleResult, ...rest } = record;
  return rest;
}

export async function mailGetBattleReplays(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<{ replays: ReplayListItem[] }>> {
  const limit = typeof payload.limit === 'number' ? Math.max(1, Math.min(100, Math.floor(payload.limit))) : 50;
  const records = await listBattleReplays(ctx.playerId, limit);
  return {
    ok: true,
    action: 'MAIL_GET_BATTLE_REPLAYS',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { replays: records.map(listItem) },
  };
}

export async function mailGetBattleReplay(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<{ replay: BattleReplayRecord }>> {
  const replayId = typeof payload.replayId === 'string' ? payload.replayId : '';
  const replay = await getBattleReplay(ctx.playerId, replayId);
  if (!replay) throw new GameError('BATTLE_REPLAY_NOT_FOUND', 'Battle replay not found.');
  return {
    ok: true,
    action: 'MAIL_GET_BATTLE_REPLAY',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { replay },
  };
}

export async function mailSaveMissionReplay(ctx: ActionContext, _payload: Record<string, unknown>): Promise<ActionSuccessResponse<{ replay: BattleReplayRecord; alreadySaved: boolean }>> {
  const settlement = ctx.state.tavern.lastSettlement;
  const battleResult = settlement?.battleResult;
  if (!settlement || !battleResult) {
    throw new GameError('MISSION_REPLAY_NOT_AVAILABLE', 'No mission battle replay is available to save.');
  }

  const sourceId = `${settlement.offerSetId}:${settlement.missionId}:${settlement.settledAt}`;
  const existing = await findBattleReplayBySource(ctx.playerId, 'MISSION', sourceId);
  if (existing) {
    return {
      ok: true,
      action: 'MAIL_SAVE_MISSION_REPLAY',
      serverTime: ctx.now,
      stateRevision: ctx.state.meta.stateRevision,
      data: { replay: existing, alreadySaved: true },
    };
  }

  const replay = await insertBattleReplay(buildBattleReplayRecord({
    ownerPlayerId: ctx.playerId,
    context: 'MISSION',
    now: ctx.now,
    battleResult,
    sourceId,
    isSavedByPlayer: true,
    title: `Mission: ${settlement.missionId}`,
  }));

  settlement.replayId = replay.replayId;
  settlement.canSaveReplay = false;
  ctx.markDirty();

  return {
    ok: true,
    action: 'MAIL_SAVE_MISSION_REPLAY',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { replay, alreadySaved: false },
  };
}

export async function mailDeleteBattleReplay(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<{ deleted: true; replayId: string }>> {
  const replayId = typeof payload.replayId === 'string' ? payload.replayId : '';
  await deleteBattleReplay(ctx.playerId, replayId);
  return {
    ok: true,
    action: 'MAIL_DELETE_BATTLE_REPLAY',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: { deleted: true, replayId },
  };
}
