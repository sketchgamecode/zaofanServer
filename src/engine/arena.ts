/**
 * arena.ts — 竞技场服务端引擎
 * 
 * 战斗动画仍在客户端播放，但所有状态结算（声望、经验、铜钱、冷却）在此处完成。
 * 
 * 支持的 actions:
 *   ARENA_FIGHT    { npcLevel, npcPrestige, playerWon, xpWinsToday }
 *   ARENA_SKIP_COOLDOWN  {}
 */
import type { GameState, ActionResult, ClassId } from '../types/gameState.js';
import { checkLevelUp, getTodayCN } from './mathCore.js';
import { XP_TABLE } from '../data/xpTable.js';

const CD_DURATION_MS = 5 * 60 * 1000; // 5分钟冷却
const MAX_XP_WINS_PER_DAY = 10;
const SKIP_COST_TOKENS = 1;

/** ARENA_FIGHT: 客户端已算好胜负，服务端做结算 */
export function arenaFight(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const now = Date.now();
  const today = getTodayCN();

  const playerWon = Boolean(payload.playerWon);
  const npcLevel = Number(payload.npcLevel) || 1;
  const npcPrestige = Number(payload.npcPrestige) || 0;

  // 冷却检查
  if ((state.arenaCooldownEndTime || 0) > now) {
    return { success: false, gameState: state, log, error: '竞技场冷却中' };
  }

  const dailyXP = state.arenaDailyXP;
  const xpWinsToday = dailyXP.date === today ? dailyXP.wins : 0;

  let xpGain = 0;
  let prestigeDiff = 0;
  let coinGain = 0;

  if (playerWon) {
    // XP 每日有上限
    if (xpWinsToday < MAX_XP_WINS_PER_DAY) {
      xpGain = Math.floor((XP_TABLE[state.playerLevel] ?? 400) * 0.05);
    }
    const prestigeGainBase = 10 + Math.floor((npcPrestige - state.resources.prestige) * 0.1);
    prestigeDiff = Math.max(0, Math.floor(prestigeGainBase));
    coinGain = Math.floor(npcLevel * 20 * (1 + Math.random() * 0.2));
    log.push({ type: 'reward', text: `竞技场胜利！获得 ${coinGain} 铜钱，声望 +${prestigeDiff}` });
  } else {
    prestigeDiff = -Math.max(5, Math.floor(state.resources.prestige * 0.02));
    log.push({ type: 'info', text: `竞技场落败，声望 ${prestigeDiff}` });
  }

  const newExpRaw = (state.exp ?? 0) + xpGain;
  const { newLevel, newExp, didLevelUp } = checkLevelUp(state.playerLevel, newExpRaw);

  if (didLevelUp) log.push({ type: 'system', text: `🎉 升级！现在是 ${newLevel} 级` });

  const newState: GameState = {
    ...state,
    playerLevel: newLevel,
    exp: newExp,
    arenaWins: playerWon ? (state.arenaWins ?? 0) + 1 : (state.arenaWins ?? 0),
    arenaDailyXP: { date: today, wins: xpWinsToday + (playerWon ? 1 : 0) },
    arenaCooldownEndTime: now + CD_DURATION_MS,
    resources: {
      ...state.resources,
      copper: state.resources.copper + coinGain,
      prestige: Math.max(0, state.resources.prestige + prestigeDiff),
    },
    lastUpdated: now,
  };

  return { success: true, gameState: newState, log };
}

/** ARENA_SKIP_COOLDOWN: 花1枚通宝跳过冷却 */
export function arenaSkipCooldown(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  if (state.resources.tokens < SKIP_COST_TOKENS) {
    return { success: false, gameState: state, log, error: '通宝不足' };
  }
  if ((state.arenaCooldownEndTime || 0) <= Date.now()) {
    return { success: false, gameState: state, log, error: '当前未处于冷却状态' };
  }
  const newState: GameState = {
    ...state,
    arenaCooldownEndTime: 0,
    resources: { ...state.resources, tokens: state.resources.tokens - SKIP_COST_TOKENS },
    lastUpdated: Date.now(),
  };
  log.push({ type: 'system', text: '花费1枚通宝，竞技场冷却已跳过' });
  return { success: true, gameState: newState, log };
}
