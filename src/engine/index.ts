/**
 * 统一 Action 分发器
 * 所有客户端的游戏动作都经过此处路由到对应的引擎函数。
 * 新增功能只需在此注册，无需修改路由层。
 */
import type { GameState, GameAction, ActionResult } from '../types/gameState.js';
import { startMission, completeMission, skipMission } from './missions.js';
import { upgradeAttribute } from './attributes.js';

// ── 开发作弊动作（仅限测试，上线前可通过环境变量禁用） ──────────────────────
function debugCheat(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_CHEATS) {
    return { success: false, gameState: state, log, error: '作弊指令在生产环境已禁用' };
  }
  const preset = (payload.preset as string) ?? 'default';
  let newState = { ...state };

  if (preset === 'money') {
    newState.resources = { ...newState.resources, copper: newState.resources.copper + 100_000 };
    log.push({ type: 'system', text: '【作弊】获得 100,000 铜钱' });
  } else if (preset === 'tokens') {
    newState.resources = { ...newState.resources, tokens: newState.resources.tokens + 100 };
    log.push({ type: 'system', text: '【作弊】获得 100 枚代币' });
  } else if (preset === 'xp') {
    newState.exp += 999_999;
    log.push({ type: 'system', text: '【作弊】获得 999,999 经验' });
  } else if (preset === 'food') {
    newState.resources = { ...newState.resources, rations: 9999 };
    log.push({ type: 'system', text: '【作弊】干粮满至 9999' });
  } else {
    // default: 全给
    newState.resources = { ...newState.resources, copper: newState.resources.copper + 100_000, tokens: newState.resources.tokens + 100, rations: 9999 };
    newState.exp += 999_999;
    log.push({ type: 'system', text: '【作弊】资源全满' });
  }

  newState.lastUpdated = Date.now();
  return { success: true, gameState: newState, log };
}

/** Action 注册表，key 为客户端发送的 action 字符串 */
type ActionHandler = (state: GameState, payload: Record<string, unknown>) => ActionResult;

const ACTION_MAP: Record<string, ActionHandler> = {
  // 任务系统
  START_MISSION:    startMission,
  COMPLETE_MISSION: completeMission,
  SKIP_MISSION:     skipMission,

  // 属性系统
  UPGRADE_ATTRIBUTE: upgradeAttribute,

  // 开发工具
  DEBUG_CHEAT: debugCheat,
};

/** 主分发入口 */
export function dispatch(state: GameState, action: GameAction): ActionResult {
  const handler = ACTION_MAP[action.action];

  if (!handler) {
    return {
      success: false,
      gameState: state,
      log: [],
      error: `未知动作：${action.action}。支持的动作：${Object.keys(ACTION_MAP).join(', ')}`,
    };
  }

  return handler(state, action.payload ?? {});
}
