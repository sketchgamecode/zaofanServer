/**
 * dungeon.ts — 副本/州府讨伐服务端引擎（服务端唯一真相版）
 *
 * 客户端只传 { chapterId }，服务端查当前Boss、模拟战斗、结算奖励。
 * 客户端拿到 data.playerWon 再决定播放胜利或失败动画。
 *
 * Actions:
 *   DUNGEON_FIGHT  { chapterId }
 */
import type { GameState, ActionResult } from '../types/gameState.js';
import {
  checkLevelUp, getTodayCN,
  serverSimulateBattle, buildPlayerBattleSide,
  MathCore, type BattleSide
} from './mathCore.js';
import { generateEquipment } from './equipmentGenerator.js';
import { DUNGEON_CHAPTERS } from '../data/dungeonTable.js';

const MAX_DAILY_ATTEMPTS = 1;

/** DUNGEON_FIGHT: 服务端模拟战斗，结算副本进度 */
export function dungeonFight(state: GameState, payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const today = getTodayCN();
  const chapterId = payload.chapterId as string;

  // 每日次数检查
  const dailyAttempt = state.dungeonDailyAttempt;
  const usedToday = dailyAttempt.date === today ? dailyAttempt.used : 0;
  if (usedToday >= MAX_DAILY_ATTEMPTS) {
    return { success: false, gameState: state, log, error: '今日挑战次数已用尽' };
  }

  // 查章节
  const chapter = DUNGEON_CHAPTERS.find(c => c.id === chapterId);
  if (!chapter) {
    return { success: false, gameState: state, log, error: `未知章节 ${chapterId}` };
  }
  if (state.playerLevel < chapter.unlockLevel) {
    return { success: false, gameState: state, log, error: `需要 Lv.${chapter.unlockLevel} 才能进入` };
  }

  const progress = state.dungeonProgress?.[chapterId] ?? 0;
  if (progress >= chapter.bosses.length) {
    return { success: false, gameState: state, log, error: '该章节已通关' };
  }

  const currentBoss = chapter.bosses[progress];

  // 构建双方战力
  const player: BattleSide = buildPlayerBattleSide(state);
  const bossAttrs = currentBoss.attributes;
  const enemy: BattleSide = {
    hp:         MathCore.getMaxHP(bossAttrs.constitution, currentBoss.level, 'CLASS_A'),
    atk:        Math.floor(currentBoss.weaponDamage * (1 + bossAttrs.strength / 10)),
    critChance: MathCore.getCritChance(bossAttrs.luck, currentBoss.level),
    armor:      currentBoss.armor,
    level:      currentBoss.level,
  };

  const playerWon = serverSimulateBattle(player, enemy);

  // 扣除每日次数（无论胜负）
  const newDailyAttempt = { date: today, used: usedToday + 1 };

  if (!playerWon) {
    log.push({ type: 'info', text: `【${currentBoss.name}】击败了你，明日再战！` });
    return {
      success: true,
      gameState: { ...state, dungeonDailyAttempt: newDailyAttempt, lastUpdated: Date.now() },
      log,
      data: { playerWon: false, bossName: currentBoss.name },
    };
  }

  // 胜利结算
  const drop = generateEquipment(currentBoss.level * 5, 'A', true, 'blue');
  const { newLevel, newExp, didLevelUp } = checkLevelUp(
    state.playerLevel,
    (state.exp ?? 0) + currentBoss.rewardXp
  );
  if (didLevelUp) log.push({ type: 'system', text: `🎉 升级！现在是 ${newLevel} 级` });
  log.push({ type: 'reward', text: `讨伐【${currentBoss.name}】成功！+${currentBoss.rewardCoins} 铜钱，+${currentBoss.rewardXp} 经验` });
  if (drop) log.push({ type: 'reward', text: `获得装备【${drop.name}】` });

  const newState: GameState = {
    ...state,
    playerLevel:          newLevel,
    exp:                  newExp,
    dungeonProgress:      { ...state.dungeonProgress, [chapterId]: progress + 1 },
    dungeonDailyAttempt:  newDailyAttempt,
    resources:            { ...state.resources, copper: state.resources.copper + currentBoss.rewardCoins },
    inventory:            drop ? [...state.inventory, drop] : state.inventory,
    lastUpdated:          Date.now(),
  };

  return {
    success: true,
    gameState: newState,
    log,
    data: {
      playerWon:       true,
      bossName:        currentBoss.name,
      coinGain:        currentBoss.rewardCoins,
      xpGain:          currentBoss.rewardXp,
      droppedItemName: drop?.name ?? null,
      didLevelUp,
      newLevel,
    },
  };
}
