export const CORE_SCHEMA_VERSION = 1;
export const CORE_TIMEZONE = 'Asia/Shanghai';

export const INITIAL_PLAYER_LEVEL = 1;

export const INITIAL_ATTRIBUTES = {
  strength: 10,
  intelligence: 10,
  agility: 10,
  constitution: 10,
  luck: 10,
  unspentPoints: 0,
} as const;

export const INITIAL_RESOURCES = {
  copper: 0,
  tokens: 50,
  hourglasses: 50,
  prestige: 0,
} as const;

export const INITIAL_TAVERN_STATE = {
  thirstSecRemaining: 100 * 60,
  drinksUsedToday: 0,
  firstMissionBonusClaimed: false,
  dailyQuestCounter: 0,
  offerSeq: 0,
} as const;

export const INITIAL_MOUNT_STATE = {
  timeMultiplierBp: 10000,
  expiresAt: null,
} as const;
