/**
 * 任务引擎 — 严格还原 S&F 任务机制
 *
 * S&F 任务规则：
 * - 三种时长（短/中/长），分别对应不同的时间、食物消耗、XP/金币奖励
 * - 奖励按角色等级动态缩放
 * - 每次任务消耗食物（rations），食物不足则无法出发
 * - 任务有唯一的 endTime 时间戳，服务端负责判断是否到期
 */
import type { GameState, MissionType, ActionResult } from '../types/gameState.js';
import { checkLevelUp } from './mathCore.js';

interface MissionTemplate {
  nameZh: string;
  durationSec: number;
  foodCost: number;
  /** XP 奖励 = baseXP * level */
  baseXP: number;
  /** 金币奖励 = baseCoin * level */
  baseCoin: number;
  dropRate: number;
}

/** S&F 原版三种任务配置（按等级缩放） */
const MISSION_TEMPLATES: Record<MissionType, MissionTemplate> = {
  A: { nameZh: '短期任务', durationSec: 15 * 60,  foodCost: 1,  baseXP: 4,  baseCoin: 3,  dropRate: 0.05 },
  B: { nameZh: '中期任务', durationSec: 2 * 3600,  foodCost: 3,  baseXP: 32, baseCoin: 24, dropRate: 0.12 },
  C: { nameZh: '长期任务', durationSec: 8 * 3600,  foodCost: 10, baseXP: 96, baseCoin: 72, dropRate: 0.20 },
};

/** START_MISSION：开始一个新任务 */
export function startMission(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const missionType = payload.missionType as MissionType;

  if (!['A', 'B', 'C'].includes(missionType)) {
    return { success: false, gameState: state, log, error: '无效的任务类型，必须为 A/B/C' };
  }

  if (state.activeMission) {
    return { success: false, gameState: state, log, error: '已有进行中的任务，请先完成当前任务' };
  }

  const tmpl = MISSION_TEMPLATES[missionType];

  if (state.resources.rations < tmpl.foodCost) {
    return { success: false, gameState: state, log,
      error: `干粮不足！需要 ${tmpl.foodCost} 份，当前仅有 ${state.resources.rations} 份` };
  }

  const expReward  = tmpl.baseXP   * state.playerLevel;
  const coinReward = tmpl.baseCoin * state.playerLevel;
  const endTime    = Date.now() + tmpl.durationSec * 1000;

  const newState: GameState = {
    ...state,
    resources: { ...state.resources, rations: state.resources.rations - tmpl.foodCost },
    activeMission: {
      id: `mission_${Date.now()}`,
      type: missionType,
      name: tmpl.nameZh,
      durationSec: tmpl.durationSec,
      foodCost: tmpl.foodCost,
      expReward,
      coinReward,
      dropRate: tmpl.dropRate,
      endTime,
    },
    lastUpdated: Date.now(),
  };

  const durationStr = tmpl.durationSec >= 3600
    ? `${Math.floor(tmpl.durationSec / 3600)}小时`
    : `${tmpl.durationSec / 60}分钟`;

  log.push({ type: 'info', text: `出发执行${tmpl.nameZh}，预计 ${durationStr} 后返回` });
  log.push({ type: 'reward', text: `预计奖励：${coinReward} 铜钱，${expReward} 经验` });

  return { success: true, gameState: newState, log };
}

/** COMPLETE_MISSION：服务端结算任务（验证时间戳后发放奖励） */
export function completeMission(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];

  if (!state.activeMission) {
    return { success: false, gameState: state, log, error: '没有进行中的任务' };
  }

  if (Date.now() < state.activeMission.endTime) {
    const remaining = Math.ceil((state.activeMission.endTime - Date.now()) / 1000);
    return { success: false, gameState: state, log,
      error: `任务尚未完成，还需等待 ${remaining} 秒` };
  }

  const mission = state.activeMission;
  const { newLevel, newExp, levelsGained } = checkLevelUp(
    state.playerLevel,
    state.exp + mission.expReward
  );

  const newState: GameState = {
    ...state,
    exp: newExp,
    playerLevel: newLevel,
    resources: { ...state.resources, copper: state.resources.copper + mission.coinReward },
    activeMission: null,
    lastUpdated: Date.now(),
  };

  log.push({ type: 'reward', text: `任务完成！获得 ${mission.coinReward} 铜钱，${mission.expReward} 经验` });
  if (levelsGained > 0) {
    log.push({ type: 'system', text: `🎉 升级！你现在是 ${newLevel} 级了` });
    if (levelsGained > 1) {
      log.push({ type: 'system', text: `连续升了 ${levelsGained} 级！` });
    }
  }

  return { success: true, gameState: newState, log };
}

/** SKIP_MISSION：花费代币（token）立即完成任务 */
export function skipMission(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const TOKEN_COST = 1;

  if (!state.activeMission) {
    return { success: false, gameState: state, log, error: '没有进行中的任务' };
  }

  if (Date.now() >= state.activeMission.endTime) {
    return completeMission(state, _payload);
  }

  if (state.resources.tokens < TOKEN_COST) {
    return { success: false, gameState: state, log, error: `代币不足，需要 ${TOKEN_COST} 枚代币` };
  }

  const tempState: GameState = {
    ...state,
    resources: { ...state.resources, tokens: state.resources.tokens - TOKEN_COST },
    activeMission: { ...state.activeMission, endTime: Date.now() - 1 },
  };

  log.push({ type: 'info', text: `花费 ${TOKEN_COST} 枚代币，立即完成任务` });

  const result = completeMission(tempState, _payload);
  return { ...result, log: [...log, ...result.log] };
}
