export type PlayerClassId = 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'CLASS_E';

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
export type AttributeKey = 'strength' | 'intelligence' | 'agility' | 'constitution' | 'luck';

export type RaceId =
  | 'RACE_01' | 'RACE_02' | 'RACE_03' | 'RACE_04'
  | 'RACE_05' | 'RACE_06' | 'RACE_07' | 'RACE_08';

/** 纯五属性数值（不含 bought / unspentPoints） */
export type BaseAttributeValues = {
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  luck: number;
};

export type AttributeState = {
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  luck: number;
  unspentPoints?: number;
  /** 玩家通过铜钱累计购买的各属性点数（用于阶梯式成本计算） */
  bought: Record<AttributeKey, number>;
};

export type EquipmentItem = {
  id: string;
  name: string;
  description: string;
  slot: EquipmentSlot;
  rarity: ItemRarity;
  iconId?: string;
  subType?: 'weapon' | 'shield' | 'none';
  armor?: number;
  weaponDamage?: { min: number; max: number };
  price?: number;
  sellPrice: number;
  bonusAttributes: Partial<BaseAttributeValues>;
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
  raceId: RaceId;
  displayName?: string;
  avatarId?: string;
  status: 'PENDING_CREATION' | 'ACTIVE';
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

export type UpgradeCostsView = Record<AttributeKey, number>;

export type CombatPreviewView = {
  hp: number;
  armor: number;
  damageMin: number;
  damageMax: number;
  critChanceBp: number;
  dodgeChanceBp?: number;
  blockChanceBp?: number;
  itemPowerTotal: number;
  combatRating: number;
};

export type CharacterInfoView = {
  player: {
    level: number;
    exp: number;
    classId: PlayerClassId;
    raceId: RaceId;
    displayName?: string;
    avatarId?: string;
    status: 'PENDING_CREATION' | 'ACTIVE';
  };
  resources: ResourceState;
  attributes: {
    base: BaseAttributeValues;
    total: BaseAttributeValues;
    upgradeCosts: UpgradeCostsView;
  };
  combatPreview: CombatPreviewView;
  equipment: {
    equipped: EquipmentState['equipped'];
  };
  inventory: {
    capacity?: number;
    count: number;
    items: EquipmentItem[];
  };
};

export type EquipItemPayload = {
  itemId: string;
};

export type UnequipItemPayload = {
  slot: EquipmentSlot;
};

export type UpgradeAttributePayload = {
  attribute: AttributeKey;
};

export type RefreshBlackMarketPayload = {
  /** true = 消耗1令牌立即手动刷新；false / 缺省 = 仅在1小时冷却到期后刷新 */
  force?: boolean;
};

export type BuyAndEquipPayload = {
  /** 要购买并穿戴的商品 id，必须存在于 blackMarket.items 中 */
  itemId: string;
};

export type BuyItemPayload = {
  /** 要购买到背包的商品 id */
  itemId: string;
};

export type SellItemPayload = {
  /** 要出售的物品 id（支持背包或已穿戴） */
  itemId: string;
};

export type CreateCharacterPayload = {
  /** 角色昵称，2-12 字符 */
  nickname: string;
  /** 职业 ID */
  classId: PlayerClassId;
  /** 种族 ID */
  raceId: RaceId;
  /** 头像 ID，如 "avatar_placeholder_003" */
  avatarId: string;
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
  playerId?: string;
  displayName?: string;
  avatarId?: string;
  level: number;
  classId?: PlayerClassId;
  attributes: BaseAttributeValues;
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
  classId?: PlayerClassId;
  avatarId?: string;
  attributes: BaseAttributeValues;
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

export type BattleContext =
  | 'MISSION'
  | 'ARENA'
  | 'DUNGEON'
  | 'FORTRESS_ATTACK'
  | 'FORTRESS_DEFENSE';

export type CombatantSnapshot = {
  id: string;
  displayName: string;
  level: number;
  classId: PlayerClassId;
  attributes: BaseAttributeValues;
  hpMax?: number;
  armor: number;
  weaponDamage: { min: number; max: number };
  honor?: number;
  rank?: number | null;
  avatarId?: string;
  equipmentSummary?: {
    weaponId?: string;
    offHandId?: string;
    itemPowerTotal: number;
  };
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

export type BattleHitEvent = {
  hitIndex: number;
  attacker: 'player' | 'enemy';
  defender: 'player' | 'enemy';
  attackerClassId: PlayerClassId;
  defenderClassId: PlayerClassId;
  rawWeaponRoll: number;
  damage: number;
  targetHpAfter: number;
  wasCrit: boolean;
  wasBlocked: boolean;
  wasDodged: boolean;
  armorReductionBp: number;
  rageMultiplierBp: number;
};

export type BattleActionEvent = {
  actionIndex: number;
  roundNumber: number;
  attacker: 'player' | 'enemy';
  hits: BattleHitEvent[];
};

export type BattleResultV2 = {
  schemaVersion: 2;
  context: BattleContext;
  seedPublicHash: string;
  winner: 'player' | 'enemy';
  playerWon: boolean;
  player: {
    id: string;
    name: string;
    level: number;
    classId: PlayerClassId;
    hpMax: number;
    hpEnd: number;
    avatarId?: string;
    snapshot: CombatantSnapshot;
  };
  enemy: {
    id: string;
    name: string;
    level: number;
    classId: PlayerClassId;
    hpMax: number;
    hpEnd: number;
    avatarId?: string;
    snapshot: CombatantSnapshot;
  };
  actions: BattleActionEvent[];
  totalActions: number;
  totalRounds: number;
  endedBy: 'KNOCKOUT' | 'ROUND_LIMIT';
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
  battleResult: BattleResultV2;
  canSaveReplay?: boolean;
  replayId?: string | null;
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
  honor?: number;
  rank?: number | null;
  dailyXpWins?: number;
  maxDailyXpWins?: number;
  fightsToday?: number;
  lastDailyResetDate: string;
  cooldownEndTime: number | null;
  candidateSetId?: string | null;
  candidates?: ArenaOpponentPreview[];
};

export type ArenaOpponentPreview = {
  candidateId: string;
  playerId: string;
  displayName: string;
  avatarId?: string;
  level: number;
  classId: PlayerClassId;
  raceId?: RaceId;
  honor: number;
  rank: number;
  guildName?: string;
  attributes: BaseAttributeValues;
  combatPreview: {
    hp: number;
    armor: number;
    damageMin: number;
    damageMax: number;
    critChanceBp: number;
    blockChanceBp?: number;
    dodgeChanceBp?: number;
  };
};

export type BattleReplayRecord = {
  replayId: string;
  ownerPlayerId: string;
  context: BattleContext;
  createdAt: number;
  expiresAt?: number | null;
  isRead: boolean;
  isSavedByPlayer?: boolean;
  relatedPlayerId?: string | null;
  sourceId?: string | null;
  title: string;
  opponentName: string;
  preview: {
    type: 'PLAYER' | 'DUNGEON' | 'QUEST';
    result: 'WIN' | 'LOSE';
    playerName: string;
    enemyName: string;
    playerAvatarId?: string;
    enemyAvatarId?: string;
    enemyLevel: number;
  };
  battleResult: BattleResultV2;
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

export function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return value === 'head'
    || value === 'body'
    || value === 'hands'
    || value === 'feet'
    || value === 'neck'
    || value === 'belt'
    || value === 'ring'
    || value === 'trinket'
    || value === 'weapon'
    || value === 'offHand';
}

export function isAttributeKey(value: unknown): value is AttributeKey {
  return value === 'strength'
    || value === 'intelligence'
    || value === 'agility'
    || value === 'constitution'
    || value === 'luck';
}

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
