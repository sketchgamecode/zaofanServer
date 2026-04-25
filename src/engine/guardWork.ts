/**
 * guardWork.ts — 押镖/打工服务端引擎
 * 
 * GUARD_WORK_START  { hours }  — 开始押镖
 * GUARD_WORK_CLAIM  {}         — 领取报酬
 */
import type { GameState, ActionResult } from '../types/gameState.js';

const GUARD_COIN_PER_HOUR_PER_LV = 30; // 每小时每等级铜钱收益

/** GUARD_WORK_START: 开始押镖 */
export function guardWorkStart(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];

  if (state.activeGuardWork) {
    return { success: false, gameState: state, log, error: '押镖进行中，请先领取报酬' };
  }

  const hours = Number(payload.hours);
  if (!hours || hours < 1 || hours > 10) {
    return { success: false, gameState: state, log, error: '无效的押镖时长（1-10小时）' };
  }

  const coinReward = Math.floor(hours * state.playerLevel * GUARD_COIN_PER_HOUR_PER_LV);
  const newState: GameState = {
    ...state,
    activeGuardWork: { endTime: Date.now() + hours * 3_600_000, coinReward },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'info', text: `开始 ${hours} 小时押镖，预计收益 ${coinReward} 铜钱` });
  return { success: true, gameState: newState, log };
}

/** GUARD_WORK_CLAIM: 领取押镖报酬 */
export function guardWorkClaim(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];

  if (!state.activeGuardWork) {
    return { success: false, gameState: state, log, error: '没有进行中的押镖任务' };
  }
  if (Date.now() < state.activeGuardWork.endTime) {
    const remaining = Math.ceil((state.activeGuardWork.endTime - Date.now()) / 60_000);
    return { success: false, gameState: state, log, error: `押镖尚未完成，还需 ${remaining} 分钟` };
  }

  const reward = state.activeGuardWork.coinReward;
  const newState: GameState = {
    ...state,
    activeGuardWork: null,
    resources: { ...state.resources, copper: state.resources.copper + reward },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'reward', text: `押镖归来！获得 ${reward} 铜钱` });
  return { success: true, gameState: newState, log };
}
