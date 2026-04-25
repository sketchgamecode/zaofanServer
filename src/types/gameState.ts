/**
 * GameState 类型定义 — 服务端权威版本
 * 这是整个游戏的数据契约，所有客户端必须遵守此接口。
 */

export type EquipmentSlot = 'head' | 'chest' | 'hands' | 'feet' | 'neck' | 'belt' | 'ring' | 'trinket' | 'mainHand' | 'offHand';
export type ItemQuality = 'white' | 'green' | 'blue';
export type MissionType = 'A' | 'B' | 'C';
export type ClassId = 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D';

export interface ActiveMission {
  id: string;
  type: MissionType;
  name: string;
  durationSec: number;
  foodCost: number;
  expReward: number;
  coinReward: number;
  dropRate: number;
  endTime: number;
}

export interface Equipment {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  quality: ItemQuality;
  subType?: 'weapon' | 'shield' | 'none';
  armor?: number;
  weaponDamage?: { min: number; max: number };
  price?: number;
  bonusAttributes: {
    strength?: number;
    intelligence?: number;
    agility?: number;
    constitution?: number;
    luck?: number;
  };
}

export interface PlayerAttributes {
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  luck: number;
}

export interface PlayerResources {
  copper: number;
  prestige: number;
  rations: number;
  tokens: number;
  hourglasses: number;
}

export interface GameState {
  playerLevel: number;
  classId: ClassId;
  exp: number;
  attributes: PlayerAttributes;
  resources: PlayerResources;
  equipped: Record<EquipmentSlot, Equipment | null>;
  inventory: Equipment[];
  activeMission: ActiveMission | null;
  availableMissions: ActiveMission[];
  blackMarket: { items: (Equipment | null)[]; lastRefresh: number };
  dungeonProgress: Record<string, number>;
  dungeonDailyAttempt: { date: string; used: number };
  lastRationsRefill: number;
  arenaWins: number;
  arenaDailyXP: { date: string; wins: number };
  arenaCooldownEndTime: number;
  tavernDailyDrinks: { date: string; count: number };
  activeGuardWork: { endTime: number; coinReward: number } | null;
  lastUpdated: number;
}

export function getInitialGameState(): GameState {
  return {
    playerLevel: 1,
    classId: 'CLASS_A',
    exp: 0,
    attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 10, luck: 10 },
    resources: { copper: 0, prestige: 0, rations: 100, tokens: 50, hourglasses: 50 },
    equipped: {
      head: null, chest: null, hands: null, feet: null,
      neck: null, belt: null, ring: null, trinket: null,
      mainHand: null, offHand: null,
    },
    inventory: [],
    activeMission: null,
    availableMissions: [],
    blackMarket: { items: Array(6).fill(null), lastRefresh: 0 },
    dungeonProgress: { chapter_1: 0 },
    dungeonDailyAttempt: { date: '', used: 0 },
    lastRationsRefill: Date.now(),
    arenaWins: 0,
    arenaDailyXP: { date: '', wins: 0 },
    arenaCooldownEndTime: 0,
    tavernDailyDrinks: { date: '', count: 0 },
    activeGuardWork: null,
    lastUpdated: Date.now(),
  };
}

/** 客户端发送的 Action 结构 */
export interface GameAction {
  action: string;
  payload?: Record<string, unknown>;
}

/** 服务端统一响应结构 */
export interface ActionResult {
  success: boolean;
  gameState: GameState;
  log: { type: 'info' | 'reward' | 'combat' | 'error' | 'system'; text: string }[];
  error?: string;
  data?: any; // 可选的附加数据，如具体奖励数值
}
