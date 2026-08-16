export type PlayerClassId = 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'CLASS_E';

/**
 * 权力派系标识 — 大明体制内升迁设定
 * imperial   = 皇权内廷
 * noble      = 勋贵集团
 * censorate  = 清流科道
 * border     = 边军武勋
 * silver     = 工商银库
 * underworld = 江湖秘社
 */
export type PowerFactionId =
  | 'imperial'
  | 'noble'
  | 'censorate'
  | 'border'
  | 'silver'
  | 'underworld';

export type EquipmentSlot =
  | 'weapon'
  | 'offHand'
  | 'body';

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
  // Sancai system properties
  itemId?: string;
  material?: string;
  craft?: string | null;
  shaft?: string | null;
  upgrade?: string | null;
  arrow?: string | null;
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
  /** 玩家所属权力派系（新角色创建时按出身初始化，旧存档可为 undefined） */
  powerFaction?: PowerFactionId;
  /** 各派系对玩家的疑心值，0 = 无疑心（新角色创建时全部初始化为 0） */
  suspicion?: Partial<Record<PowerFactionId, number>>;
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
    powerFaction?: PowerFactionId;
    suspicion?: Partial<Record<PowerFactionId, number>>;
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

export type CombatLoadout = {
  weapon: EquipmentItem | null;
  offHand: EquipmentItem | null;
  body: EquipmentItem | null;
  arrow?: string;
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
  loadout?: CombatLoadout;
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
  loadout?: CombatLoadout;
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
  loadout?: CombatantSnapshotLoadout;
};

export type CombatantSnapshotLoadout = {
  weapon: EquipmentItem | null;
  offHand: EquipmentItem | null;
  body: EquipmentItem | null;
  arrow?: string;
};

export type BattleSide = {
  hp: number;
  damageMin: number;
  damageMax: number;
  critChanceBp: number;
  dodgeChanceBp?: number;
  blockChanceBp?: number;
  armor: number;
  level: number;
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
  sancaiAction?: string;
  sancaiOutcome?: string;
  sancaiWeapon?: string;
  sancaiTriggers?: string[];
  actorStamina?: number;
  targetStamina?: number;
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
  winner: 'player' | 'enemy' | 'draw';
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

/**
 * 权力差事案件类型
 * raid=突袭查抄 audit=稽查账册 escort=护送押运 arrest=拿问捉拿
 * purge=清洗株连 smuggle=走私暗运 petition=递送奏章
 */
export type MissionCaseType =
  | 'raid'
  | 'audit'
  | 'escort'
  | 'arrest'
  | 'purge'
  | 'smuggle'
  | 'petition';

/**
 * 权力差事上下文 — 记录发布方、目标方、案件类型和牵连预览。
 * 所有字段都用于前端展示和结算逻辑。
 */
export type MissionPowerContext = {
  /** 差事发布方 */
  issuerFaction: PowerFactionId;
  /** 差事目标/对手方 */
  targetFaction: PowerFactionId;
  /** 案件类型 */
  caseType: MissionCaseType;
  /** 预计权柄变化（未来阶段使用，当前可为空） */
  powerDeltaPreview?: Partial<Record<PowerFactionId, number>>;
  /** 预计疑心变化（结算时按此值写入 player.suspicion） */
  suspicionDeltaPreview?: Partial<Record<PowerFactionId, number>>;
};

export type MissionTargetActorPreview = {
  actorId: string;
  kind: 'bot' | 'player';
  displayName: string;
  avatarId: string;
  level: number;
  classId: PlayerClassId;
  raceId?: RaceId;
  faction: PowerFactionId;
  locationId: string;
  locationName?: string;
  powerShare: number;
  title?: string;
  positionId?: string;
  reason: string;
};

export type MissionIssuerActorPreview = {
  actorId: string;
  kind: 'bot' | 'player';
  displayName: string;
  avatarId: string;
  level: number;
  faction: PowerFactionId;
  powerShare: number;
  title?: string;
  positionId?: string;
  locationId?: string;
  locationName?: string;
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
  /** 权力集团差事上下文（阶段1新增） */
  powerContext?: MissionPowerContext;
  /** 任务目标世界角色预览（阶段6新增） */
  targetActor?: MissionTargetActorPreview;
  /** 任务发布来源地点ID（阶段7新增） */
  sourceLocationId?: string;
  /** 任务发布来源地点名称（阶段7新增） */
  sourceLocationName?: string;
  /** 任务发布来源职务职位ID（阶段7新增） */
  sourcePositionId?: string;
  /** 任务发布人角色ID（阶段7新增） */
  issuerActorId?: string;
  /** 任务发布人姓名（阶段7新增） */
  issuerDisplayName?: string;
  /** 任务发布人职务头衔（阶段7新增） */
  issuerTitle?: string;
  /** 任务发布人势力派系ID（阶段7新增） */
  issuerFaction?: PowerFactionId;
  /** 任务发布人世界角色预览（任务发布人角色化 V1 新增） */
  issuerActor?: MissionIssuerActorPreview;
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
  /** 权力集团差事上下文（从 MissionOffer 携带过来，确保结算时不丢失） */
  powerContext?: MissionPowerContext;
  /** 任务目标世界角色预览（阶段6新增） */
  targetActor?: MissionTargetActorPreview;
  /** 任务发布来源地点ID（阶段7新增） */
  sourceLocationId?: string;
  /** 任务发布来源地点名称（阶段7新增） */
  sourceLocationName?: string;
  /** 任务发布来源职务职位ID（阶段7新增） */
  sourcePositionId?: string;
  /** 任务发布人角色ID（阶段7新增） */
  issuerActorId?: string;
  /** 任务发布人姓名（阶段7新增） */
  issuerDisplayName?: string;
  /** 任务发布人职务头衔（阶段7新增） */
  issuerTitle?: string;
  /** 任务发布人势力派系ID（阶段7新增） */
  issuerFaction?: PowerFactionId;
  /** 任务发布人世界角色预览（任务发布人角色化 V1 新增） */
  issuerActor?: MissionIssuerActorPreview;
};

export type PowerTransferResult = {
  worldPowerTotal: number;
  actorPowerDelta?: number;
  issuerFactionPowerDelta?: Partial<Record<PowerFactionId, number>>;
  targetFactionPowerDelta?: Partial<Record<PowerFactionId, number>>;
  targetActorIds?: string[];
  worldPowerAfter?: {
    byFaction: Array<{
      faction: PowerFactionId;
      actorCount: number;
      powerShare: number;
    }>;
  };
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
  /** 权力结算结果：疑心变化 + 权柄转移 + 结算后值（阶段1/5新增） */
  powerResult?: {
    suspicionDelta?: Partial<Record<PowerFactionId, number>>;
    suspicionAfter?: Partial<Record<PowerFactionId, number>>;
    powerTransfer?: PowerTransferResult;
  };
  /** 任务目标世界角色预览（阶段6新增） */
  targetActor?: MissionTargetActorPreview;
  /** 任务发布来源地点ID（阶段7新增） */
  sourceLocationId?: string;
  /** 任务发布来源地点名称（阶段7新增） */
  sourceLocationName?: string;
  /** 任务发布来源职务职位ID（阶段7新增） */
  sourcePositionId?: string;
  /** 任务发布人角色ID（阶段7新增） */
  issuerActorId?: string;
  /** 任务发布人姓名（阶段7新增） */
  issuerDisplayName?: string;
  /** 任务发布人职务头衔（阶段7新增） */
  issuerTitle?: string;
  /** 任务发布人势力派系ID（阶段7新增） */
  issuerFaction?: PowerFactionId;
  /** 任务发布人世界角色预览（任务发布人角色化 V1 新增） */
  issuerActor?: MissionIssuerActorPreview;
  /** 任务收益分账预览（职位考功 V1 新增） */
  officeSettlement?: OfficeSettlementPreview;
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
  title?: string;
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
  loadout?: CombatLoadout;
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

export type WorldActor = {
  actorId: string;
  kind: 'bot' | 'player';
  displayName: string;
  title?: string;
  raceId: RaceId;
  classId: PlayerClassId;
  faction: PowerFactionId;
  locationId: string;
  level: number;
  powerShare: number;
  combatSnapshot: PlayerCombatSnapshot;
  replacedByPlayerId?: string;
};

export type OfficeLedgerEntryType =
  | 'mission_tax'
  | 'mission_power'
  | 'bot_tax'
  | 'bot_power'
  | 'shop_tax'
  | 'stamina_tax'
  | 'evaluation'
  | 'raid_wealth'
  | 'raid_power'
  | 'raid_fame'
  | 'raid_failed'
  | 'guard_join'
  | 'guard_leave'
  | 'guard_wage'
  | 'guard_wage_shortfall'
  | 'tribute_pay'
  | 'tribute_passed'
  | 'tribute_failed'
  | 'chief_exposed_copper_change';

export type OfficeLedgerEntry = {
  entryId: string;
  createdAt: number;
  positionId: string;
  locationId: string;
  service: PowerLocationService;
  beneficiaryActorId?: string;
  beneficiaryDisplayName?: string;
  sourceActorId?: string;
  sourceActorDisplayName?: string;
  targetActorId?: string;
  targetActorDisplayName?: string;
  type: OfficeLedgerEntryType;
  taxValueDelta?: number;
  powerValueDelta?: number;
  description: string;
};

export type WorldState = {
  status: 'UNINITIALIZED' | 'ACTIVE';
  actors: WorldActor[];
  officeLedger?: OfficeLedgerEntry[];
  botSimulation?: {
    lastSimulatedAt: number;
  };
  locationTreasuries?: LocationTreasury[];
  pendingRaids?: Record<string, PendingRaidState>;
  locationGuardDuties?: LocationGuardDuty[];
  officeTributes?: OfficeTributeTerm[];
};

export type PowerLocationService = 'missions' | 'shop' | 'dungeon' | 'arena' | 'promotion' | 'intel' | 'estate' | 'stamina' | 'office_registry' | 'appointment' | 'evaluation' | 'tribute_registry';

export type OfficeKpiProfile = {
  termStartsAt: number;
  termEndsAt: number;
  taxDuePerTerm: number;
  taxDeliveredThisTerm: number;
  powerDuePerTerm: number;
  powerDeliveredThisTerm: number;
};

export type OfficeControlDetail = {
  appointmentControllerActorId?: string;
  appointmentControllerDisplayName?: string;
  financeControllerActorId?: string;
  financeControllerDisplayName?: string;
  treasurySplit: {
    imperialPrivatePct: number;
    publicTreasuryPct: number;
    officeHolderPct: number;
    superiorPct: number;
  };
};

export type OfficeEligibility = {
  canBeConsidered: boolean;
  reasons: string[];
};

export type OfficeSettlementPreview = {
  sourcePositionId?: string;
  beneficiaryActorId?: string;
  beneficiaryDisplayName?: string;
  taxValueDelta?: number;
  powerValueDelta?: number;
  routingReason: string;
};

export type OfficeCandidateScoreItem = {
  label: string;
  value: number;
  passed: boolean;
  hint: string;
};

export type OfficeCandidateView = {
  actorId: string;
  kind: 'player' | 'bot';
  displayName: string;
  avatarId: string;
  level: number;
  faction: PowerFactionId;
  powerShare: number;
  combatRating?: number;
  isCurrentPlayer: boolean;
  score: number;
  scoreBreakdown: OfficeCandidateScoreItem[];
  recommendation: string;
};

export type OfficeCandidateListView = {
  positionId: string;
  incumbent: OfficeCandidateView;
  currentPlayer?: OfficeCandidateView;
  candidates: OfficeCandidateView[];
  plottingAdvice: string[];
  currentPlayerRank?: number;
};

export type ServicePositionCandidatesPreview = {
  currentPlayerRank?: number;
  topCandidate?: OfficeCandidateView;
  advice: string[];
};

export type LocationTreasury = {
  locationId: string;
  copperBalance: number;
  goodsValue: number;
  powerValue: number;
  nextDistributionAt: number;
  guardSlotsUsed: number;
  guardSlotsMax: number;
  defenseRating: number;
  updatedAt: number;
};

export type LocationGuardDutyStatus = 'active' | 'completed' | 'abandoned';

export type LocationGuardDuty = {
  dutyId: string;
  locationId: string;
  actorId: string;
  actorDisplayName: string;
  actorAvatarId: string;
  actorKind: 'player' | 'bot';
  faction: PowerFactionId;
  level: number;
  combatRating: number;
  startsAt: number;
  endsAt: number;
  wageCopper: number;
  status: LocationGuardDutyStatus;
};

export type LocationGuardDutyView = LocationGuardDuty & {
  remainingSeconds: number;
  canClaimWage: boolean;
  canLeave: boolean;
};

export type ChiefActorView = {
  actorId: string;
  displayName: string;
  avatarId: string;
  level: number;
  faction: PowerFactionId;
  title?: string;
  personalCopperExposed: number;
};

export type LocationTreasuryView = LocationTreasury & {
  locationName: string;
  ownerFaction: PowerFactionId;
  ownerLabel: string;
  raidRiskHint: string;
  carryHint: string;
  guards: LocationGuardDutyView[];
  guardHint: string;
  chiefActor?: ChiefActorView;
};

export type LocationFinanceReportView = {
  locationId: string;
  locationName: string;
  chiefActor: {
    actorId: string;
    displayName: string;
    title?: string;
    avatarId: string;
  };
  currentExposedCopper: number;
  nextTribute?: OfficeTributeTerm;
  dailyRows: Array<{
    dayKey: string;
    peakCopper: number;
    netCopperDelta: number;
    incomeCopper: number;
    expenseCopper: number;
    raidLossCopper: number;
    guardWageCopper: number;
    tributePaidCopper: number;
  }>;
};

/** WORLD_LOCATION_CHIEF_DASHBOARD_GET — 场所主官管事面板聚合视图 */
export type LocationChiefDashboardView = {
  locationId: string;
  locationName: string;
  /** 当前主官信息 */
  chiefActor: ChiefActorView;
  /** 场所公账快照（含守卫列表） */
  treasury: LocationTreasuryView;
  /** 本期进贡任务（若有 active 状态） */
  activeTribute?: OfficeTributeTerm;
  /** 此地核心职位列表（最多 5 个主要服务职位） */
  topPositions: Array<{
    positionId: string;
    title: string;
    service: PowerLocationService;
    status: ServicePositionStatus;
    occupant: {
      actorId: string;
      kind: 'bot' | 'player';
      displayName: string;
      avatarId: string;
      level: number;
      powerShare: number;
    };
  }>;
  /** 近日账本流水（最新 10 条） */
  recentLedger: OfficeLedgerEntry[];
  /** 近 7 日财务摘要（日粒度） */
  financeSummary: Array<{
    dayKey: string;
    netCopperDelta: number;
    incomeCopper: number;
    expenseCopper: number;
    raidLossCopper: number;
    guardWageCopper: number;
    tributePaidCopper: number;
  }>;
};

export type OfficeTributeTerm = {
  tributeId: string;
  positionId: string;
  locationId: string;
  officeHolderActorId: string;
  superiorActorId: string;
  dueCopper: number;
  paidCopper: number;
  termStartsAt: number;
  termEndsAt: number;
  status: 'active' | 'passed' | 'failed';
  reviewLabel: string;
  lastPaidAt?: number;
};

export type PendingRaidState = {
  raidId: string;
  locationId: string;
  playerWon: boolean;
  settled: boolean;
  createdAt: number;
  defenderActorId: string;
  defenderDisplayName: string;
  treasurySnapshot: {
    locationId: string;
    copperBalance: number;
    goodsValue: number;
    powerValue: number;
  };
};

export type LocationRaidStartData = {
  raidId: string;
  locationId: string;
  locationName: string;
  defenderActor?: MissionTargetActorPreview;
  battleResult: BattleResultV2;
  canChooseOutcome: boolean;
  treasuryBefore: LocationTreasuryView;
};

export type PowerLocation = {
  locationId: string;
  name: string;
  ownerFaction: PowerFactionId;
  x: number;
  y: number;
  unlockLevel: number;
  services: PowerLocationService[];
  connectedLocationIds: string[];
};

export type PowerLocationStatus = 'locked' | 'open' | 'hostile' | 'favored';

export type ServicePositionStatus = 'bot_held' | 'player_held' | 'vacant' | 'locked';

export type ServicePositionControlProfile = {
  appointmentControllerLabel: string; // 谁掌人事权
  financeControllerLabel: string;     // 谁掌财权
  paylineHint: string;                // 俸禄链说明
  loyaltyCostHint: string;            // 忠诚代价
};

export type ServicePositionView = {
  positionId: string;
  locationId: string;
  title: string;
  service: PowerLocationService;
  ownerFaction: PowerFactionId;
  minLevel: number;
  incomeHint: string;
  replaceHint: string;
  status: ServicePositionStatus;
  occupant: {
    actorId: string;
    kind: 'bot' | 'player';
    displayName: string;
    avatarId: string;
    faction: PowerFactionId;
    level: number;
    powerShare: number;
  };
  controlProfile?: ServicePositionControlProfile;
};

export type PowerLocationView = {
  locationId: string;
  name: string;
  ownerFaction: PowerFactionId;
  x: number;
  y: number;
  unlockLevel: number;
  services: PowerLocationService[];
  connectedLocationIds: string[];
  travelCostSecBase?: number;
  actorCount: number;
  powerShare: number;
  status: PowerLocationStatus;
  playerRelationHint: string;
  serviceActors: Array<{
    actorId: string;
    displayName: string;
    avatarId: string;
    faction: PowerFactionId;
    title: string;
    level: number;
    powerShare: number;
    services: PowerLocationService[];
  }>;
  servicePositions: ServicePositionView[];
};

/** 任职信息摘要：在 WORLD_ACTOR_GET_DETAIL 的 positions 数组中使用 */
export type ActorPositionSummary = {
  positionId: string;
  locationId: string;
  locationName: string;
  title: string;
  service: PowerLocationService;
  serviceLabel: string;
  ownerFaction: PowerFactionId;
  ownerLabel: string;
  incomeHint: string;
  replaceHint: string;
  status: ServicePositionStatus;
};

/** WORLD_ACTOR_GET_DETAIL 返回结构 */
export type WorldActorDetailView = {
  actorId: string;
  kind: 'player' | 'bot';
  character: CharacterInfoView;
  positions: ActorPositionSummary[];
};

/** WORLD_SERVICE_POSITIONS_GET_LIST 单条职位记录 */
export type WorldServicePositionListItem = {
  positionId: string;
  locationId: string;
  locationName: string;
  title: string;
  service: PowerLocationService;
  serviceLabel: string;
  ownerFaction: PowerFactionId;
  occupant: {
    actorId: string;
    kind: 'player' | 'bot';
    displayName: string;
    avatarId: string;
    faction: PowerFactionId;
    level: number;
    powerShare: number;
  };
  incomeHint: string;
  replaceHint: string;
  status: ServicePositionStatus;
  controlProfile?: ServicePositionControlProfile;
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
  world: WorldState;
};

export function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return value === 'body'
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
  if (!isObject(value.arena) || !isObject(value.dungeon) || !isObject(value.world)) return false;
  return typeof value.meta.schemaVersion === 'number';
}
