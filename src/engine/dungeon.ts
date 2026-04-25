/**
 * dungeon.ts — 副本/州府讨伐服务端引擎
 * 
 * DUNGEON_FIGHT { chapterId, playerWon }
 *   客户端已播放完战斗动画后上报胜负，服务端做状态结算。
 *   服务端读取 dungeonTable 数据，基于 dungeonProgress 确认当前Boss，
 *   验证合法性后结算经验、铜钱、进度、掉落。
 */
import type { GameState, ActionResult } from '../types/gameState.js';
import { checkLevelUp, getTodayCN } from './mathCore.js';
import { generateEquipment } from './equipmentGenerator.js';
import { DUNGEON_CHAPTERS } from '../data/dungeonTable.js';

const MAX_DAILY_ATTEMPTS = 1;

/** DUNGEON_FIGHT: 副本战斗结算 */
export function dungeonFight(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const today = getTodayCN();
  const chapterId = payload.chapterId as string;
  const playerWon = Boolean(payload.playerWon);

  // 每日次数检查
  const dailyAttempt = state.dungeonDailyAttempt;
  const usedToday = dailyAttempt.date === today ? dailyAttempt.used : 0;
  if (usedToday >= MAX_DAILY_ATTEMPTS) {
    return { success: false, gameState: state, log, error: '今日挑战次数已用尽' };
  }

  // 查找章节
  const chapter = DUNGEON_CHAPTERS.find(c => c.id === chapterId);
  if (!chapter) {
    return { success: false, gameState: state, log, error: `未知章节 ${chapterId}` };
  }

  // 关卡解锁检查
  if (state.playerLevel < chapter.unlockLevel) {
    return { success: false, gameState: state, log, error: `需要 Lv.${chapter.unlockLevel} 才能进入` };
  }

  const progress = state.dungeonProgress?.[chapterId] ?? 0;
  if (progress >= chapter.bosses.length) {
    return { success: false, gameState: state, log, error: '该章节已通关' };
  }

  const currentBoss = chapter.bosses[progress];

  // 扣除每日次数（无论胜负）
  const newDailyAttempt = { date: today, used: usedToday + 1 };

  if (!playerWon) {
    log.push({ type: 'info', text: `${currentBoss.name} 击败了你，明日再战！` });
    const newState: GameState = {
      ...state,
      dungeonDailyAttempt: newDailyAttempt,
      lastUpdated: Date.now(),
    };
    return { success: true, gameState: newState, log };
  }

  // 胜利结算
  const xpGain = currentBoss.rewardXp;
  const coinGain = currentBoss.rewardCoins;
  const drop = generateEquipment(currentBoss.level * 5, 'A', true, 'blue');

  const newExpRaw = (state.exp ?? 0) + xpGain;
  const { newLevel, newExp, didLevelUp } = checkLevelUp(state.playerLevel, newExpRaw);
  if (didLevelUp) log.push({ type: 'system', text: `🎉 升级！现在是 ${newLevel} 级` });

  const newInventory = drop ? [...state.inventory, drop] : state.inventory;
  log.push({ type: 'reward', text: `讨伐【${currentBoss.name}】成功！获得 ${coinGain} 铜钱，${xpGain} 经验` });
  if (drop) log.push({ type: 'reward', text: `获得装备【${drop.name}】` });

  const newState: GameState = {
    ...state,
    playerLevel: newLevel,
    exp: newExp,
    dungeonProgress: { ...state.dungeonProgress, [chapterId]: progress + 1 },
    dungeonDailyAttempt: newDailyAttempt,
    resources: {
      ...state.resources,
      copper: state.resources.copper + coinGain,
    },
    inventory: newInventory,
    lastUpdated: Date.now(),
  };

  return {
    success: true,
    gameState: newState,
    log,
    data: { bossName: currentBoss.name, coinGain, xpGain, droppedItemName: drop?.name ?? null, didLevelUp, newLevel },
  };
}
