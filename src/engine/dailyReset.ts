import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import { getGameDateString } from '../lib/time.js';
import type { GameState } from '../types/gameState.js';

export function applyDailyResetIfNeeded(state: GameState, now: number): boolean {
  const today = getGameDateString(now);
  if (state.meta.lastDailyResetDate === today) {
    return false;
  }

  state.meta.lastDailyResetDate = today;
  state.tavern.thirstSecRemaining = CLASSIC_TAVERN_RULES.baseThirstSec;
  state.tavern.drinksUsedToday = 0;
  state.tavern.firstMissionBonusClaimed = false;
  state.tavern.dailyQuestCounter = 0;

  if (state.tavern.activeMission === null) {
    state.tavern.missionOffers = [];
    state.tavern.lastSettlement = null;
  }

  state.arena.lastDailyResetDate = today;
  state.arena.dailyWins = 0;
  state.dungeon.lastDailyResetDate = today;
  state.dungeon.dailyAttemptsUsed = 0;

  return true;
}
