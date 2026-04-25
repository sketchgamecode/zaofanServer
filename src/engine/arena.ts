/**
 * arena.ts — 竞技场服务端引擎（服务端唯一真相版）
 *
 * 客户端只传 {} 触发战斗，NPC生成和胜负判定完全在服务端完成。
 * 客户端拿到结果（playerWon, npc信息）再决定播放什么动画。
 *
 * Actions:
 *   ARENA_FIGHT          {}  — 服务端生成NPC，模拟战斗，返回结果
 *   ARENA_SKIP_COOLDOWN  {}  — 花1通宝跳过冷却
 */
import type { GameState, ActionResult, ClassId } from '../types/gameState.js';
import {
  checkLevelUp, getTodayCN,
  serverSimulateBattle, buildPlayerBattleSide,
  MathCore, CLASS_CONFIG, type BattleSide
} from './mathCore.js';
import { XP_TABLE } from '../data/xpTable.js';

const CD_DURATION_MS    = 5 * 60 * 1000; // 5分钟冷却
const MAX_XP_WINS_PER_DAY = 10;
const SKIP_COST_TOKENS  = 1;

const NPC_NAMES = ['落魄游侠', '失意江湖客', '行走的剑客', '独行大盗', '贩夫走卒', '狂徒', '野路子'];
const CLASS_IDS: ClassId[] = ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D'];

function generateNPCBattleSide(playerLevel: number): { side: BattleSide; classId: ClassId; level: number; prestige: number; name: string } {
  const classId  = CLASS_IDS[Math.floor(Math.random() * CLASS_IDS.length)];
  const lvFactor = 0.7 + Math.random() * 0.6;
  const level    = Math.max(1, Math.floor(playerLevel * lvFactor));
  const base     = level * 8;
  const rnd      = () => Math.floor(base * (0.8 + Math.random() * 0.4));
  const attrs    = { strength: rnd(), intelligence: rnd(), agility: rnd(), constitution: rnd(), luck: rnd() };
  const classConf = CLASS_CONFIG[classId];
  const mainAttr  = attrs[classConf.mainStat];
  const weaponAvg = level * 3;

  const side: BattleSide = {
    hp:         MathCore.getMaxHP(attrs.constitution, level, classId),
    atk:        Math.floor(weaponAvg * (1 + mainAttr / 10)),
    critChance: MathCore.getCritChance(attrs.luck, level),
    armor:      Math.floor(base * 0.5),
    level,
  };

  return {
    side,
    classId,
    level,
    prestige: Math.max(0, Math.floor(Math.random() * 1000)),
    name: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
  };
}

/** ARENA_FIGHT: 服务端生成NPC，模拟战斗，结算状态 */
export function arenaFight(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const now   = Date.now();
  const today = getTodayCN();

  // 冷却检查
  if ((state.arenaCooldownEndTime || 0) > now) {
    const remainSec = Math.ceil(((state.arenaCooldownEndTime || 0) - now) / 1000);
    return { success: false, gameState: state, log, error: `竞技场冷却中，还需 ${remainSec} 秒` };
  }

  // 构建双方战力
  const player  = buildPlayerBattleSide(state);
  const npcInfo = generateNPCBattleSide(state.playerLevel);
  const playerWon = serverSimulateBattle(player, npcInfo.side);

  const dailyXP    = state.arenaDailyXP;
  const xpWinsToday = dailyXP.date === today ? dailyXP.wins : 0;

  let xpGain = 0, prestigeDiff = 0, coinGain = 0;

  if (playerWon) {
    if (xpWinsToday < MAX_XP_WINS_PER_DAY) {
      xpGain = Math.floor((XP_TABLE[state.playerLevel] ?? 400) * 0.05);
    }
    const prestigeGainBase = 10 + Math.floor((npcInfo.prestige - state.resources.prestige) * 0.1);
    prestigeDiff = Math.max(0, Math.floor(prestigeGainBase));
    coinGain     = Math.floor(npcInfo.level * 20 * (1 + Math.random() * 0.2));
    log.push({ type: 'reward', text: `竞技场胜利！获得 ${coinGain} 铜钱，声望 +${prestigeDiff}` });
  } else {
    prestigeDiff = -Math.max(5, Math.floor(state.resources.prestige * 0.02));
    log.push({ type: 'info', text: `竞技场落败，声望 ${prestigeDiff}` });
  }

  const { newLevel, newExp, didLevelUp } = checkLevelUp(state.playerLevel, (state.exp ?? 0) + xpGain);
  if (didLevelUp) log.push({ type: 'system', text: `🎉 升级！现在是 ${newLevel} 级` });

  const newState: GameState = {
    ...state,
    playerLevel: newLevel,
    exp:         newExp,
    arenaWins:   playerWon ? (state.arenaWins ?? 0) + 1 : (state.arenaWins ?? 0),
    arenaDailyXP:         { date: today, wins: xpWinsToday + (playerWon ? 1 : 0) },
    arenaCooldownEndTime: now + CD_DURATION_MS,
    resources: {
      ...state.resources,
      copper:   state.resources.copper + coinGain,
      prestige: Math.max(0, state.resources.prestige + prestigeDiff),
    },
    lastUpdated: now,
  };

  return {
    success: true,
    gameState: newState,
    log,
    // 把战斗结果返回给客户端做UI展示（动画用）
    data: {
      playerWon,
      npcName:     npcInfo.name,
      npcLevel:    npcInfo.level,
      npcClassId:  npcInfo.classId,
      playerHP:    player.hp,
      npcHP:       npcInfo.side.hp,
      coinGain,
      prestigeDiff,
      xpGain,
      didLevelUp,
      newLevel,
    },
  };
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
    resources:   { ...state.resources, tokens: state.resources.tokens - SKIP_COST_TOKENS },
    lastUpdated: Date.now(),
  };
  log.push({ type: 'system', text: '花费1枚通宝，竞技场冷却已跳过' });
  return { success: true, gameState: newState, log };
}
