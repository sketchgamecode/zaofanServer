/**
 * 统一 Action 分发器
 * 所有客户端的游戏动作都经过此处路由到对应的引擎函数。
 * 新增功能只需在此注册，无需修改路由层。
 */
import type { GameState, GameAction, ActionResult } from '../types/gameState.js';
import { startMission, completeMission, skipMission } from './missions.js';
import { upgradeAttribute } from './attributes.js';
import { tavernDrink, generateMissions } from './tavern.js';
import { equipItem, unequipItem } from './inventory.js';
import { blackMarketRefresh, blackMarketBuy } from './blackMarket.js';
import { arenaFight, arenaSkipCooldown } from './arena.js';
import { guardWorkStart, guardWorkClaim } from './guardWork.js';
import { dungeonFight } from './dungeon.js';

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

  // 客栈系统
  TAVERN_DRINK:       tavernDrink,
  GENERATE_MISSIONS:  generateMissions,

  // 物品/背包系统
  EQUIP_ITEM:         equipItem,
  UNEQUIP_ITEM:       unequipItem,

  // 黑市系统
  BLACK_MARKET_REFRESH: blackMarketRefresh,
  BLACK_MARKET_BUY:     blackMarketBuy,

  // 竞技场系统
  ARENA_FIGHT:           arenaFight,
  ARENA_SKIP_COOLDOWN:   arenaSkipCooldown,

  // 押镖/打工系统
  GUARD_WORK_START:  guardWorkStart,
  GUARD_WORK_CLAIM:  guardWorkClaim,

  // 副本系统
  DUNGEON_FIGHT:     dungeonFight,

  // 开发工具
  DEBUG_CHEAT: debugCheat,
};

/** 应用基于时间的自动恢复（例如干粮） */
function applyTimeBasedRegeneration(state: GameState): GameState {
  let newState = { ...state };
  const now = Date.now();
  const elapsed = now - (newState.lastRationsRefill ?? now);
  const toRestore = Math.floor(elapsed / 600_000); // 10 分钟恢复 1 点

  if (toRestore > 0 && newState.resources.rations < 100) {
    const restored = Math.min(toRestore, 100 - newState.resources.rations);
    newState = {
      ...newState,
      lastRationsRefill: (newState.lastRationsRefill ?? now) + toRestore * 600_000,
      resources: { ...newState.resources, rations: newState.resources.rations + restored },
    };
  }
  return newState;
}

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

  // 每次执行动作前，先由服务端权威结算离线/时间流逝带来的收益（如干粮恢复）
  const updatedState = applyTimeBasedRegeneration(state);

  return handler(updatedState, action.payload ?? {});
}
