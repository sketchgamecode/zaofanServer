export type PlayerClassId = 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D';

export type EquipmentSlot =
  | 'head'
  | 'body'
  | 'hands'
  | 'feet'
  | 'neck'
  | 'belt'
  | 'ring'
  | 'trinket'
  | 'weapon'
  | 'offHand';

export type ItemRarity = 0 | 1 | 2 | 3 | 4;

export type AttributeState = {
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  luck: number;
  unspentPoints?: number;
};

export type EquipmentItem = {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  subType?: 'weapon' | 'shield' | 'none';
  armor?: number;
  weaponDamage?: { min: number; max: number };
  price?: number;
  bonusAttributes: Partial<AttributeState>;
};

export type MetaState = {
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  lastDailyResetDate: string;
  stateRevision: number;
};

export type PlayerState = {
  id?: string;
  level: number;
  exp: number;
  classId: PlayerClassId;
  displayName?: string;
};

export type ResourceState = {
  copper: number;
  tokens: number;
  hourglasses: number;
  prestige: number;
};

export type InventoryState = {
  items: EquipmentItem[];
  capacity?: number;
};

export type EquipmentState = {
  equipped: Record<EquipmentSlot, EquipmentItem | null>;
};

export type VisibleReward = {
  xp: number;
  copper: number;
  hasEquipment: boolean;
  equipmentPreview?: {
    slot: EquipmentSlot;
    rarity: ItemRarity;
    name?: string;
  };
  hasDungeonKey: boolean;
  dungeonKeyPreview?: {
    dungeonId: string;
    name: string;
  };
  hasHourglass?: boolean;
};

export type EnemyPreview = {
  enemyId: string;
  name: string;
  level: number;
  archetype?: string;
};

export type MountSnapshot = {
  timeMultiplierBp: number;
  name?: string;
  tier?: string;
  capturedAt: number;
};

export type PlayerCombatSnapshot = {
  level: number;
  classId?: PlayerClassId;
  attributes: Omit<AttributeState, 'unspentPoints'>;
  combatStats: {
    hp: number;
    armor: number;
    damageMin: number;
    damageMax: number;
    critChanceBp: number;
    dodgeChanceBp?: number;
    blockChanceBp?: number;
  };
  equipmentSummary: {
    weaponId?: string;
    offHandId?: string;
    itemPowerTotal: number;
  };
};

export type EnemySnapshot = {
  enemyId: string;
  name: string;
  level: number;
  attributes: Omit<AttributeState, 'unspentPoints'>;
  combatStats: {
    hp: number;
    armor: number;
    damageMin: number;
    damageMax: number;
    critChanceBp: number;
    dodgeChanceBp?: number;
  };
  enemyPowerRatioBp: number;
};

export type DungeonKey = {
  dungeonId: string;
  name: string;
};

export type RewardSnapshot = {
  xp: number;
  copper: number;
  tokens: number;
  equipment: EquipmentItem | null;
  dungeonKey: DungeonKey | null;
  hourglass: number;
  firstMissionBonusApplied: boolean;
  hiddenRolls: {
    rewardSeed: string;
    equipmentRollSeed?: string;
    dungeonKeyRollSeed?: string;
  };
};

export type GrantedReward = {
  xp: number;
  copper: number;
  tokens: number;
  hourglass: number;
  equipment?: EquipmentItem;
  dungeonKey?: DungeonKey;
};

export type BattleRound = {
  attacker: 'player' | 'enemy';
  damage: number;
  targetHpAfter: number;
  wasCrit?: boolean;
};

export type BattleResult = {
  playerWon: boolean;
  rounds: BattleRound[];
  playerHpEnd: number;
  enemyHpEnd: number;
  totalRounds: number;
};

export type PlayerDelta = {
  levelBefore: number;
  levelAfter: number;
  xpBefore: number;
  xpAfter: number;
  copperBefore: number;
  copperAfter: number;
  tokensBefore: number;
  tokensAfter: number;
  hourglassesBefore: number;
  hourglassesAfter: number;
  prestigeBefore: number;
  prestigeAfter: number;
};

export type MissionOffer = {
  offerSetId: string;
  missionId: string;
  offerSeq: number;
  slotIndex: 0 | 1 | 2;
  title: string;
  description: string;
  locationName?: string;
  baseDurationSec: number;
  actualDurationSec: number;
  thirstCostSec: number;
  visibleReward: VisibleReward;
  enemyPreview: EnemyPreview;
  generatedAt: number;
};

export type ActiveMission = {
  missionId: string;
  offerSetId: string;
  offerSeq: number;
  slotIndex: 0 | 1 | 2;
  title: string;
  description: string;
  locationName?: string;
  startedAt: number;
  endTime: number;
  baseDurationSec: number;
  actualDurationSec: number;
  thirstCostSec: number;
  mountSnapshot: MountSnapshot;
  playerCombatSnapshot: PlayerCombatSnapshot;
  enemySnapshot: EnemySnapshot;
  rewardSnapshot: RewardSnapshot;
  combatSeed: string;
  rewardSeed: string;
  settlementStatus: 'UNSETTLED' | 'SETTLED';
  rewardGranted: boolean;
};

export type MissionSettlement = {
  missionId: string;
  offerSetId: string;
  settledAt: number;
  result: 'SUCCESS' | 'FAILED';
  rewardGranted: boolean;
  rewardSnapshot: RewardSnapshot;
  grantedReward: GrantedReward;
  battleResult: BattleResult;
  playerDelta: PlayerDelta;
};

export type TavernState = {
  thirstSecRemaining: number;
  drinksUsedToday: number;
  firstMissionBonusClaimed: boolean;
  dailyQuestCounter: number;
  offerSeq: number;
  missionOffers: MissionOffer[];
  activeMission: ActiveMission | null;
  lastSettlement: MissionSettlement | null;
};

export type MountState = {
  timeMultiplierBp: 10000 | 9000 | 8000 | 7000 | 5000;
  expiresAt: number | null;
  name?: string;
  tier?: string;
};

export type BlackMarketState = {
  status: 'UNINITIALIZED' | 'DISABLED' | 'ACTIVE';
  items: EquipmentItem[];
  lastRefreshAt: number | null;
};

export type ArenaState = {
  status: 'UNINITIALIZED' | 'DISABLED' | 'ACTIVE';
  dailyWins: number;
  lastDailyResetDate: string;
  cooldownEndTime: number | null;
};

export type DungeonState = {
  status: 'UNINITIALIZED' | 'DISABLED' | 'ACTIVE';
  progress: Record<string, number>;
  keys: DungeonKey[];
  dailyAttemptsUsed: number;
  lastDailyResetDate: string;
};

export type GameState = {
  meta: MetaState;
  player: PlayerState;
  resources: ResourceState;
  attributes: AttributeState;
  inventory: InventoryState;
  equipment: EquipmentState;
  tavern: TavernState;
  mount: MountState;
  blackMarket: BlackMarketState;
  arena: ArenaState;
  dungeon: DungeonState;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isGameState(value: unknown): value is GameState {
  if (!isObject(value)) return false;
  if (!isObject(value.meta) || !isObject(value.player) || !isObject(value.resources)) return false;
  if (!isObject(value.attributes) || !isObject(value.inventory) || !isObject(value.equipment)) return false;
  if (!isObject(value.tavern) || !isObject(value.mount) || !isObject(value.blackMarket)) return false;
  if (!isObject(value.arena) || !isObject(value.dungeon)) return false;
  return typeof value.meta.schemaVersion === 'number';
}
