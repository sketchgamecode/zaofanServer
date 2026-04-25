import type { GameState, ActionResult, ActiveMission, MissionType } from '../types/gameState.js';
import { XP_TABLE } from '../data/xpTable.js';

const MISSION_TEMPLATES = [
  { type: 'A' as MissionType, names: ['深夜行刺', '暗杀贪官', '潜入州府'], minT: 120, maxT: 600, minF: 10, maxF: 20, coinMult: 0.5, expMult: 2.0, drop: 0.2 },
  { type: 'B' as MissionType, names: ['劫掠商队', '黑吃黑', '打劫富绅'], minT: 60,  maxT: 300, minF: 5,  maxF: 15, coinMult: 2.0, expMult: 0.5, drop: 0.1 },
  { type: 'C' as MissionType, names: ['传递密信', '打探消息', '接应同僚'], minT: 30,  maxT: 120, minF: 1,  maxF: 5,  coinMult: 1.0, expMult: 1.0, drop: 0.02 },
];

const MAX_DAILY_DRINKS = 10;
const DRINK_ENERGY_GAIN = 20;
const DRINK_TOKEN_COST = 1;
const MAX_ENERGY = 100;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** TAVERN_DRINK：花费通宝买酒恢复精力 */
export function tavernDrink(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];
  const today = todayStr();
  const drinksToday = state.tavernDailyDrinks.date === today ? state.tavernDailyDrinks.count : 0;

  if (drinksToday >= MAX_DAILY_DRINKS) {
    return { success: false, gameState: state, log, error: '今日已达购买上限！' };
  }
  if (state.resources.tokens < DRINK_TOKEN_COST) {
    return { success: false, gameState: state, log, error: '通宝不足！' };
  }
  if (state.resources.rations >= MAX_ENERGY) {
    return { success: false, gameState: state, log, error: '精力已满！' };
  }

  const gained = Math.min(DRINK_ENERGY_GAIN, MAX_ENERGY - state.resources.rations);
  const newState: GameState = {
    ...state,
    resources: {
      ...state.resources,
      rations: state.resources.rations + gained,
      tokens: state.resources.tokens - DRINK_TOKEN_COST,
    },
    tavernDailyDrinks: { date: today, count: drinksToday + 1 },
    lastUpdated: Date.now(),
  };

  log.push({ type: 'info', text: `花费了 ${DRINK_TOKEN_COST} 通宝，喝了一杯烈酒。` });
  log.push({ type: 'system', text: `精力恢复了 ${gained} 点。` });

  return { success: true, gameState: newState, log };
}

/** GENERATE_MISSIONS：生成可选任务列表 */
export function generateMissions(state: GameState, _payload: Record<string, unknown>): ActionResult {
  const log: ActionResult['log'] = [];

  // 如果已经有可选任务，不重复生成（防止刷任务）
  if (state.availableMissions.length > 0) {
    return { success: true, gameState: state, log };
  }

  const baseXp = XP_TABLE[state.playerLevel] ?? 400;
  const baseCoin = state.playerLevel * 50;
  const newMissions: ActiveMission[] = [];

  const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);

  for (let i = 0; i < 3; i++) {
    const tpl = shuffled[i] ?? MISSION_TEMPLATES[i];
    const name = tpl.names[Math.floor(Math.random() * tpl.names.length)];
    const durationSec = Math.floor(Math.random() * (tpl.maxT - tpl.minT + 1) + tpl.minT);
    const foodCost = Math.floor(Math.random() * (tpl.maxF - tpl.minF + 1) + tpl.minF);
    const f = 0.9 + Math.random() * 0.2;
    const expReward = Math.floor(baseXp * tpl.expMult * f * 0.15);
    const coinReward = Math.floor(baseCoin * tpl.coinMult * f);
    
    newMissions.push({
      id: `m_${Date.now()}_${i}`,
      type: tpl.type,
      name,
      durationSec,
      foodCost,
      expReward,
      coinReward,
      dropRate: tpl.drop,
      endTime: 0, // 尚未接取
    });
  }

  const newState: GameState = {
    ...state,
    availableMissions: newMissions,
    lastUpdated: Date.now(),
  };

  return { success: true, gameState: newState, log };
}
