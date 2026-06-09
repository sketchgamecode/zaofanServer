import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import type { CharacterInfoView, PlayerClassId, PowerFactionId, RaceId, WorldActor, PowerLocation, PowerLocationView, PowerLocationService, PowerLocationStatus, ServicePositionView, ServicePositionStatus, PowerTransferResult, WorldActorDetailView, ActorPositionSummary, WorldServicePositionListItem, MissionTargetActorPreview, MissionCaseType, ServicePositionControlProfile, OfficeKpiProfile, OfficeControlDetail, OfficeEligibility, OfficeLedgerEntryType, OfficeLedgerEntry, GameState, OfficeCandidateScoreItem, OfficeCandidateView, OfficeCandidateListView, ServicePositionCandidatesPreview, LocationTreasury, LocationTreasuryView, PendingRaidState, LocationRaidStartData, EnemySnapshot, BattleResultV2, LocationGuardDuty, ChiefActorView, OfficeTributeTerm, LocationFinanceReportView, LocationChiefDashboardView } from '../types/gameState.js';
import { RACE_CONFIGS } from '../config/raceConfig.js';
import { GameError } from './errors.js';
import { getGameDateString } from '../lib/time.js';
import { buildCharacterInfoView } from './character.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { buildPlayerCombatSnapshot } from './characterCombat.js';
import { serverSimulateBattle } from './mathCore.js';

const SURNAMES = ['朱', '徐', '常', '李', '王', '张', '刘', '陈', '杨', '赵', '周', '吴', '孙', '胡', '郭', '何', '高', '林', '郑', '谢'];

const FACTION_TITLES: Record<PowerFactionId, string[]> = {
  imperial: ['掌印太监', '秉笔太监', '锦衣卫镇抚', '千户', '百户', '随堂太监'],
  noble: ['国公', '侯爵', '伯爵', '勋卫', '世子', '散骑舍人'],
  censorate: ['尚书', '侍郎', '御史', '翰林', '主事', '给事中'],
  border: ['总兵', '副将', '参将', '游击', '守备', '把总'],
  silver: ['盐商首总', '皇商', '织造局管事', '票号大掌柜', '海贸行商', '钱庄柜坊'],
  underworld: ['漕帮帮主', '堂主', '绿林总瓢把子', '白莲教首', '私盐头目', '山寨寨主'],
};

const RACES: RaceId[] = ['RACE_01', 'RACE_02', 'RACE_03', 'RACE_04', 'RACE_05', 'RACE_06', 'RACE_07', 'RACE_08'];
const CLASSES: PlayerClassId[] = ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E'];

const LOCATIONS = [
  'imperial_palace',
  'northern_bureau',
  'divine_engine_camp',
  'censorate',
  'noble_mansion',
  'border_command',
  'salt_merchant_guild',
  'weaving_bureau',
  'refugee_camp',
  'player_inventory',
  'wine_house',
  'bun_shop',
  'pleasure_quarter',
  'ministry_of_personnel',
  'ministry_of_rites',
];

const LOCATION_NAMES: Record<string, string> = {
  imperial_palace: '皇宫',
  northern_bureau: '北镇抚司',
  divine_engine_camp: '神机营',
  censorate: '都察院',
  noble_mansion: '国公府',
  border_command: '九边都司',
  salt_merchant_guild: '两淮盐商总会',
  weaving_bureau: '江南织造局',
  refugee_camp: '流民营',
  player_inventory: '玩家随身储物空间',
  wine_house: '京城酒楼',
  bun_shop: '城门包子铺',
  pleasure_quarter: '教司坊',
  ministry_of_personnel: '吏部衙门',
  ministry_of_rites: '礼部衙门',
};

const LOCATION_DEFAULT_OWNER: Record<string, PowerFactionId> = {
  imperial_palace: 'imperial',
  northern_bureau: 'imperial',
  divine_engine_camp: 'noble',
  censorate: 'censorate',
  noble_mansion: 'noble',
  border_command: 'border',
  salt_merchant_guild: 'silver',
  weaving_bureau: 'silver',
  refugee_camp: 'underworld',
  player_inventory: 'underworld',
  wine_house: 'silver',
  bun_shop: 'underworld',
  pleasure_quarter: 'silver',
  ministry_of_personnel: 'censorate',
  ministry_of_rites: 'imperial',
};

export const POWER_LOCATIONS: PowerLocation[] = [
  {
    locationId: 'imperial_palace',
    name: '皇宫',
    ownerFaction: 'imperial',
    x: 500,
    y: 300,
    unlockLevel: 1,
    services: ['promotion', 'intel'],
    connectedLocationIds: ['northern_bureau', 'censorate', 'noble_mansion', 'ministry_of_rites'],
  },
  {
    locationId: 'northern_bureau',
    name: '北镇抚司',
    ownerFaction: 'imperial',
    x: 400,
    y: 400,
    unlockLevel: 5,
    services: ['missions', 'intel'],
    connectedLocationIds: ['imperial_palace', 'divine_engine_camp', 'refugee_camp'],
  },
  {
    locationId: 'divine_engine_camp',
    name: '神机营',
    ownerFaction: 'noble',
    x: 600,
    y: 450,
    unlockLevel: 10,
    services: ['shop'],
    connectedLocationIds: ['northern_bureau', 'noble_mansion', 'border_command'],
  },
  {
    locationId: 'censorate',
    name: '都察院',
    ownerFaction: 'censorate',
    x: 300,
    y: 300,
    unlockLevel: 8,
    services: ['dungeon', 'missions'],
    connectedLocationIds: ['imperial_palace', 'refugee_camp', 'salt_merchant_guild'],
  },
  {
    locationId: 'noble_mansion',
    name: '国公府',
    ownerFaction: 'noble',
    x: 700,
    y: 300,
    unlockLevel: 12,
    services: ['arena'],
    connectedLocationIds: ['imperial_palace', 'divine_engine_camp', 'salt_merchant_guild'],
  },
  {
    locationId: 'border_command',
    name: '九边都司',
    ownerFaction: 'border',
    x: 500,
    y: 100,
    unlockLevel: 15,
    services: ['missions', 'shop'],
    connectedLocationIds: ['divine_engine_camp'],
  },
  {
    locationId: 'salt_merchant_guild',
    name: '两淮盐商总会',
    ownerFaction: 'silver',
    x: 650,
    y: 600,
    unlockLevel: 6,
    services: ['shop'],
    connectedLocationIds: ['censorate', 'noble_mansion', 'weaving_bureau'],
  },
  {
    locationId: 'weaving_bureau',
    name: '江南织造局',
    ownerFaction: 'silver',
    x: 500,
    y: 700,
    unlockLevel: 9,
    services: ['shop', 'missions'],
    connectedLocationIds: ['salt_merchant_guild', 'refugee_camp'],
  },
  {
    locationId: 'refugee_camp',
    name: '流民营',
    ownerFaction: 'underworld',
    x: 300,
    y: 650,
    unlockLevel: 1,
    services: ['intel'],
    connectedLocationIds: ['northern_bureau', 'censorate', 'weaving_bureau', 'player_inventory'],
  },
  {
    locationId: 'player_inventory',
    name: '玩家随身储物空间',
    ownerFaction: 'underworld',
    x: 100,
    y: 900,
    unlockLevel: 1,
    services: [],
    connectedLocationIds: ['refugee_camp'],
  },
  {
    locationId: 'wine_house',
    name: '京城酒楼',
    ownerFaction: 'silver',
    x: 450,
    y: 500,
    unlockLevel: 1,
    services: ['stamina'],
    connectedLocationIds: ['salt_merchant_guild', 'refugee_camp'],
  },
  {
    locationId: 'bun_shop',
    name: '城门包子铺',
    ownerFaction: 'underworld',
    x: 250,
    y: 550,
    unlockLevel: 1,
    services: ['stamina'],
    connectedLocationIds: ['refugee_camp'],
  },
  {
    locationId: 'pleasure_quarter',
    name: '教司坊',
    ownerFaction: 'silver',
    x: 550,
    y: 350,
    unlockLevel: 1,
    services: ['stamina', 'intel'],
    connectedLocationIds: ['imperial_palace', 'salt_merchant_guild'],
  },
  {
    locationId: 'ministry_of_personnel',
    name: '吏部衙门',
    ownerFaction: 'censorate',
    x: 350,
    y: 250,
    unlockLevel: 10,
    services: ['office_registry', 'appointment', 'evaluation'],
    connectedLocationIds: ['imperial_palace', 'censorate', 'ministry_of_rites'],
  },
  {
    locationId: 'ministry_of_rites',
    name: '礼部衙门',
    ownerFaction: 'imperial',
    x: 450,
    y: 200,
    unlockLevel: 10,
    services: ['tribute_registry', 'evaluation'],
    connectedLocationIds: ['imperial_palace', 'ministry_of_personnel'],
  },
];

const LOCATION_TRAVEL_COSTS: Record<string, number> = {
  imperial_palace: 5,
  northern_bureau: 8,
  divine_engine_camp: 12,
  censorate: 8,
  noble_mansion: 10,
  border_command: 20,
  salt_merchant_guild: 15,
  weaving_bureau: 15,
  refugee_camp: 5,
  player_inventory: 2,
  wine_house: 5,
  bun_shop: 5,
  pleasure_quarter: 10,
  ministry_of_personnel: 10,
  ministry_of_rites: 10,
};

const FACTIONS = Object.keys(FACTION_TITLES) as PowerFactionId[];

function mulberry32(a: number) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function ensureWorldInitialized(ctx: ActionContext) {
  // 旧存档兼容：如果没有 world 对象，则初始化
  if (!ctx.state.world) {
    ctx.state.world = { status: 'UNINITIALIZED', actors: [] };
  }

  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  if (!ctx.state.world.botSimulation) {
    ctx.state.world.botSimulation = { lastSimulatedAt: 0 };
  }
  if (!ctx.state.world.locationTreasuries) {
    ctx.state.world.locationTreasuries = [];
  }
  if (!ctx.state.world.pendingRaids) {
    ctx.state.world.pendingRaids = {};
  }
  if (!ctx.state.world.locationGuardDuties) {
    ctx.state.world.locationGuardDuties = [];
  }

  if (ctx.state.world.status === 'ACTIVE' && ctx.state.world.actors.length > 0) {
    if (ctx.state.world.locationTreasuries.length === 0) {
      initializeLocationTreasuries(ctx);
    }
    return;
  }

  // 冷启动生成 260 个 bot
  const actors: WorldActor[] = [];
  const rng = mulberry32(12345); // 固定种子保证冷启动确定性

  const ACTOR_COUNT = 260;
  const TOTAL_POWER = 10000;
  let remainingPower = TOTAL_POWER;

  const share = Math.floor(TOTAL_POWER / ACTOR_COUNT);

  // 朱由校 (reserved:emperor_tianqi)
  actors.push({
    actorId: 'reserved:emperor_tianqi',
    kind: 'bot',
    displayName: '朱由校',
    title: '大明天启皇帝',
    raceId: 'RACE_01',
    classId: 'CLASS_A',
    faction: 'imperial',
    locationId: 'imperial_palace',
    level: 80,
    powerShare: share,
    combatSnapshot: {
      level: 80,
      classId: 'CLASS_A',
      attributes: { strength: 150, intelligence: 150, agility: 150, constitution: 150, luck: 150 },
      combatStats: { hp: 1200, armor: 300, damageMin: 50, damageMax: 100, critChanceBp: 1500 },
      equipmentSummary: { itemPowerTotal: 200 }
    }
  });
  remainingPower -= share;

  // 魏忠贤 (reserved:wei_zhongxian)
  actors.push({
    actorId: 'reserved:wei_zhongxian',
    kind: 'bot',
    displayName: '魏忠贤',
    title: '司礼监秉笔太监',
    raceId: 'RACE_01',
    classId: 'CLASS_C',
    faction: 'imperial',
    locationId: 'imperial_palace',
    level: 75,
    powerShare: share,
    combatSnapshot: {
      level: 75,
      classId: 'CLASS_C',
      attributes: { strength: 120, intelligence: 200, agility: 140, constitution: 130, luck: 120 },
      combatStats: { hp: 1000, armor: 200, damageMin: 60, damageMax: 110, critChanceBp: 1200 },
      equipmentSummary: { itemPowerTotal: 180 }
    }
  });
  remainingPower -= share;

  // 生成剩余 258 个 bot
  for (let i = 0; i < ACTOR_COUNT - 2; i++) {
    const faction = FACTIONS[i % FACTIONS.length];
    const locationId = LOCATIONS[i % LOCATIONS.length];
    const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)];
    const titleList = FACTION_TITLES[faction];
    const title = titleList[Math.floor(rng() * titleList.length)];

    let powerShare = share;
    if (i === ACTOR_COUNT - 3) {
      powerShare = remainingPower;
    } else {
      remainingPower -= powerShare;
    }

    const level = 1 + Math.floor(rng() * 80); // 1-80 级
    const raceId = RACES[Math.floor(rng() * RACES.length)];
    const classId = CLASSES[Math.floor(rng() * CLASSES.length)];

    actors.push({
      actorId: `bot_actor_${i}`,
      kind: 'bot',
      displayName: `${surname}${title}`,
      raceId,
      classId,
      faction,
      locationId,
      level,
      powerShare,
      combatSnapshot: {
        level,
        classId,
        attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 10, luck: 10 },
        combatStats: { hp: 100, armor: 10, damageMin: 5, damageMax: 10, critChanceBp: 500 },
        equipmentSummary: { itemPowerTotal: 0 },
      },
    });
  }

  ctx.state.world.actors = actors;
  ctx.state.world.status = 'ACTIVE';
  initializeLocationTreasuries(ctx);
  ctx.markWorldDirty?.() ?? ctx.markDirty();
}

export function initializeLocationTreasuries(ctx: ActionContext) {
  if (!ctx.state.world.locationTreasuries) {
    ctx.state.world.locationTreasuries = [];
  }
  if (!ctx.state.world.pendingRaids) {
    ctx.state.world.pendingRaids = {};
  }
  if (!ctx.state.world.locationGuardDuties) {
    ctx.state.world.locationGuardDuties = [];
  }
  
  const treasuries = ctx.state.world.locationTreasuries;
  if (treasuries.length > 0) {
    return;
  }

  const actors = ctx.state.world.actors;
  const roleplayLocations = POWER_LOCATIONS.filter(loc => loc.services.length > 0);

  for (const loc of roleplayLocations) {
    const locActors = actors.filter(a => a.locationId === loc.locationId);
    const actorCount = locActors.length;
    const avgLevel = actorCount > 0 ? (locActors.reduce((sum, a) => sum + a.level, 0) / actorCount) : 10;
    
    const copperBalance = loc.unlockLevel * 1000 + actorCount * 200;
    const goodsValue = loc.unlockLevel * 500 + actorCount * 100;
    const powerValue = loc.unlockLevel * 10 + actorCount * 2;
    const nextDistributionAt = ctx.now + 24 * 3600 * 1000;
    const guardSlotsMax = 3;
    const guardSlotsUsed = 0;
    const defenseRating = Math.floor(avgLevel * 10);
    
    treasuries.push({
      locationId: loc.locationId,
      copperBalance,
      goodsValue,
      powerValue,
      nextDistributionAt,
      guardSlotsUsed,
      guardSlotsMax,
      defenseRating,
      updatedAt: ctx.now
    });
  }
  ctx.markWorldDirty?.() ?? ctx.markDirty();
}

export function aggregateWorldActors(actors: WorldActor[]) {
  let totalActors = 0;
  let totalPowerShare = 0;
  const byFactionMap: Record<PowerFactionId, { actorCount: number; powerShare: number }> = {
    imperial: { actorCount: 0, powerShare: 0 },
    noble: { actorCount: 0, powerShare: 0 },
    censorate: { actorCount: 0, powerShare: 0 },
    border: { actorCount: 0, powerShare: 0 },
    silver: { actorCount: 0, powerShare: 0 },
    underworld: { actorCount: 0, powerShare: 0 },
  };

  const byLocationMap: Record<string, { actorCount: number; powerShare: number }> = {};
  for (const loc of LOCATIONS) {
    byLocationMap[loc] = { actorCount: 0, powerShare: 0 };
  }

  for (const actor of actors) {
    totalActors++;
    totalPowerShare += actor.powerShare;

    if (byFactionMap[actor.faction]) {
      byFactionMap[actor.faction].actorCount++;
      byFactionMap[actor.faction].powerShare += actor.powerShare;
    }

    if (!byLocationMap[actor.locationId]) {
      byLocationMap[actor.locationId] = { actorCount: 0, powerShare: 0 };
    }
    byLocationMap[actor.locationId].actorCount++;
    byLocationMap[actor.locationId].powerShare += actor.powerShare;
  }

  return {
    totalActors,
    totalPowerShare,
    byFactionMap,
    byLocationMap,
  };
}

export async function worldActorsGetOverview(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<any>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const actors = ctx.state.world.actors;
  const { totalActors, totalPowerShare, byFactionMap, byLocationMap } = aggregateWorldActors(actors);

  const byFaction = FACTIONS.map(faction => ({
    faction,
    actorCount: byFactionMap[faction].actorCount,
    powerShare: byFactionMap[faction].powerShare,
  }));

  const byLocation = LOCATIONS.map(locationId => ({
    locationId,
    name: LOCATION_NAMES[locationId] ?? locationId,
    ownerFaction: LOCATION_DEFAULT_OWNER[locationId] ?? 'underworld',
    actorCount: byLocationMap[locationId].actorCount,
    powerShare: byLocationMap[locationId].powerShare,
  }));

  return {
    ok: true,
    action: 'WORLD_ACTORS_GET_OVERVIEW',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      totalActors,
      totalPowerShare,
      byFaction,
      byLocation,
    },
  };
}

function getActorAvatarId(actor: WorldActor, ctx: ActionContext): string {
  if (actor.kind === 'player' && ctx.state.player.avatarId) {
    return ctx.state.player.avatarId;
  }
  let hash = 0;
  const key = actor.actorId + actor.displayName;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % 64;
  return `avatar_placeholder_${String(index).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// 场所职务系统 — 静态映射表
// ---------------------------------------------------------------------------

/** 通用职务标题（兜底） */
const POSITION_TITLE_BY_SERVICE: Record<PowerLocationService, string> = {
  missions: '差事承办',
  shop: '账房掌柜',
  dungeon: '案牍书办',
  arena: '校场执事',
  promotion: '门房引见',
  intel: '消息书办',
  estate: '府邸管事',
  stamina: '补给掌柜',
  office_registry: '文选名册掌籍',
  appointment: '人事任命郎中',
  evaluation: '考功主事',
  tribute_registry: '贡纳司吏',
};

/** 定制职务标题（locationId + service → 更具风味的头衔） */
const POSITION_TITLE_CUSTOM: Partial<Record<string, string>> = {
  'northern_bureau:missions': '北镇经历司吏',
  'northern_bureau:intel': '密档书办',
  'divine_engine_camp:shop': '神机营军需官',
  'censorate:dungeon': '都察院案牍主事',
  'censorate:missions': '巡城察院吏',
  'noble_mansion:arena': '国公府校场执事',
  'border_command:missions': '边镇哨探主事',
  'border_command:shop': '军粮账房',
  'salt_merchant_guild:shop': '盐引账房总管',
  'weaving_bureau:shop': '织造局采办',
  'weaving_bureau:missions': '织造局差役',
  'refugee_camp:intel': '流民暗线探子',
  'wine_house:stamina': '酒楼掌柜',
  'bun_shop:stamina': '城门包子铺掌柜',
  'pleasure_quarter:stamina': '教司坊妈妈',
  'pleasure_quarter:intel': '坊中消息人',
  'imperial_palace:promotion': '内廷门房引见',
  'imperial_palace:intel': '内廷密探',
  'ministry_of_personnel:office_registry': '吏部文选司郎中',
  'ministry_of_personnel:appointment': '内廷批红中使',
  'ministry_of_personnel:evaluation': '吏部考功司郎中',
  'ministry_of_rites:tribute_registry': '礼部仪制司郎中',
  'ministry_of_rites:evaluation': '礼部祠祭司郎中',
};

const INCOME_HINT_BY_SERVICE: Record<PowerLocationService, string> = {
  missions: '此职可从差事承办中获得官声与派系关系，收益规则待开放。',
  shop: '此职可从本处交易中抽取少量商税，收益规则待开放。',
  dungeon: '此职可从案牍推进中获得清洗功劳，收益规则待开放。',
  arena: '此职可从考绩挑战中获得威名，收益规则待开放。',
  promotion: '此职可从晋升引荐中获得人情往来，收益规则待开放。',
  intel: '此职可掌握本处消息流，收益规则待开放。',
  estate: '此职可从府邸经营中获得产业收益，收益规则待开放。',
  stamina: '此职可从补给消费中抽取人情与银路收益，收益规则待开放。',
  office_registry: '此职管理天下官员名册，可获取铨选人情，收益规则待开放。',
  appointment: '此职代奏皇权特旨，主掌生死任免，收益规则待开放。',
  evaluation: '此职考评天下官员功过，课税与权柄指标，收益规则待开放。',
  tribute_registry: '此职掌管各职司每周上缴规矩与贡纳统计，收益规则待开放。',
};

const REPLACE_HINT = '达到等级、派系关系和地点贡献要求后，后续可争夺此职。';

const FACTION_CONTROL_PROFILES: Record<PowerFactionId, ServicePositionControlProfile> = {
  imperial: {
    appointmentControllerLabel: '上意与内廷批红',
    financeControllerLabel: '内库、司礼监与赏赐账',
    paylineHint: '银钱先入内廷账面，再按圣眷与差遣发放。',
    loyaltyCostHint: '听旨、保密、背锅，不能质疑来路。',
  },
  noble: {
    appointmentControllerLabel: '国公府门第与家将旧账',
    financeControllerLabel: '庄田、军功旧饷与门客份例',
    paylineHint: '俸禄多经府中管事转发，厚薄看门第亲疏。',
    loyaltyCostHint: '护门第、站旧功、替恩主挡清算。',
  },
  censorate: {
    appointmentControllerLabel: '座师、同年与清议名分',
    financeControllerLabel: '清贵俸银、门生馈赠与案牍经费',
    paylineHint: '账面清白，实际靠座师保举和同年周转。',
    loyaltyCostHint: '守名声、听师门、必要时递弹章。',
  },
  border: {
    appointmentControllerLabel: '总兵、把总与家丁军头',
    financeControllerLabel: '军粮、军饷、赏银与边镇私账',
    paylineHint: '饷银层层下拨，克扣与拖欠都写在边账里。',
    loyaltyCostHint: '服军令、交战功、别让中枢觉得尾大不掉。',
  },
  silver: {
    appointmentControllerLabel: '盐商首总、织造买办与牙行保人',
    financeControllerLabel: '盐引、贡品、账房银路与交易抽成',
    paylineHint: '银路由账房放款，返多少看保人和账面余银。',
    loyaltyCostHint: '纳份例、走银路、替后台遮账。',
  },
  underworld: {
    appointmentControllerLabel: '香头、脚夫帮主与暗线保人',
    financeControllerLabel: '口粮、赃货、脚钱与藏匿份子',
    paylineHint: '底层先交粮交货，回款多少全看头目分配。',
    loyaltyCostHint: '听招呼、守暗号、出事先扛雷。',
  },
};

export function getFactionControlProfile(faction: PowerFactionId): ServicePositionControlProfile {
  return FACTION_CONTROL_PROFILES[faction] ?? FACTION_CONTROL_PROFILES.imperial;
}

export function buildServicePositions(
  loc: PowerLocation,
  actors: WorldActor[],
  ctx: ActionContext,
  playerActorId: string,
): ServicePositionView[] {
  const positions: ServicePositionView[] = [];

  if (loc.services.length === 0) return positions;

  // Candidate pool: same location first, then same faction, then all
  const locCandidates = actors.filter(a => a.locationId === loc.locationId);
  const factionCandidates = actors.filter(a => a.locationId !== loc.locationId && a.faction === loc.ownerFaction);
  const allCandidates = [...locCandidates, ...factionCandidates, ...actors];

  const usedActorIds = new Set<string>();

  for (const service of loc.services) {
    const occupantActor = allCandidates.find(c => !usedActorIds.has(c.actorId)) ?? allCandidates[0]!;
    usedActorIds.add(occupantActor.actorId);

    const positionId = `${loc.locationId}:${service}`;
    const customTitle = POSITION_TITLE_CUSTOM[positionId];
    const title = customTitle ?? POSITION_TITLE_BY_SERVICE[service] ?? service;
    const avatarId = getActorAvatarId(occupantActor, ctx);
    const isPlayer = occupantActor.actorId === playerActorId;

    let posStatus: ServicePositionStatus = occupantActor.kind === 'player' ? 'player_held' : 'bot_held';
    if (isPlayer) posStatus = 'player_held';

    positions.push({
      positionId,
      locationId: loc.locationId,
      title,
      service,
      ownerFaction: loc.ownerFaction,
      minLevel: loc.unlockLevel,
      incomeHint: INCOME_HINT_BY_SERVICE[service] ?? '此职收益规则待开放。',
      replaceHint: REPLACE_HINT,
      status: posStatus,
      occupant: {
        actorId: occupantActor.actorId,
        kind: occupantActor.kind,
        displayName: occupantActor.displayName,
        avatarId,
        faction: occupantActor.faction,
        level: occupantActor.level,
        powerShare: occupantActor.powerShare,
      },
      controlProfile: getFactionControlProfile(loc.ownerFaction),
    });
  }

  return positions;
}

export async function worldLocationsGetStatus(
  ctx: ActionContext,
  payload: Record<string, unknown>
): Promise<ActionSuccessResponse<{ locations: PowerLocationView[] }>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const actors = ctx.state.world.actors;
  const { byLocationMap } = aggregateWorldActors(actors);

  const playerLevel = ctx.state.player.level;
  const playerFaction = ctx.state.player.powerFaction;
  const playerSuspicion = ctx.state.player.suspicion ?? {};
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  const locations: PowerLocationView[] = POWER_LOCATIONS.map((loc) => {
    let status: PowerLocationStatus = 'open';
    let playerRelationHint = '大明京畿之地，防守森严，可自由通行。';

    const suspicionValue = playerSuspicion[loc.ownerFaction] ?? 0;

    if (playerLevel < loc.unlockLevel) {
      status = 'locked';
      playerRelationHint = '你级别不足，尚无权限涉足此地。';
    } else if (suspicionValue >= 50) {
      status = 'hostile';
      playerRelationHint = '因你在该势力中牵连甚深，在此处备受盘查与戒备！';
    } else if (playerFaction && playerFaction === loc.ownerFaction) {
      status = 'favored';
      playerRelationHint = '你身为该势力成员，在此地如鱼得水，备受关照。';
    }

    const agg = byLocationMap[loc.locationId] ?? { actorCount: 0, powerShare: 0 };

    // ── legacy serviceActors (kept for frontend compatibility) ──
    const candidates = actors.filter(a => a.locationId === loc.locationId);
    const factionCandidates = actors.filter(a => a.locationId !== loc.locationId && a.faction === loc.ownerFaction);
    const allCandidates = [...candidates, ...factionCandidates, ...actors];

    const selectedIds = new Set<string>();
    const serviceActors: any[] = [];

    if (loc.services.length === 0) {
      const found = allCandidates.find(c => !selectedIds.has(c.actorId)) || allCandidates[0];
      if (found) {
        selectedIds.add(found.actorId);
        const title = found.kind === 'player' ? '玩家' : (found.displayName.slice(1) || '成员');
        const avatarId = getActorAvatarId(found, ctx);
        serviceActors.push({
          actorId: found.actorId,
          displayName: found.displayName,
          avatarId,
          faction: found.faction,
          title,
          level: found.level,
          powerShare: found.powerShare,
          services: [],
        });
      }
    } else {
      for (const service of loc.services) {
        const found = allCandidates.find(c => !selectedIds.has(c.actorId)) || allCandidates[0];
        if (found) {
          selectedIds.add(found.actorId);
          const title = found.kind === 'player' ? '玩家' : (found.displayName.slice(1) || '成员');
          const avatarId = getActorAvatarId(found, ctx);
          serviceActors.push({
            actorId: found.actorId,
            displayName: found.displayName,
            avatarId,
            faction: found.faction,
            title,
            level: found.level,
            powerShare: found.powerShare,
            services: [service],
          });
        }
      }
    }

    // ── new servicePositions ──
    const servicePositions = buildServicePositions(loc, actors, ctx, playerActorId);

    return {
      locationId: loc.locationId,
      name: loc.name,
      ownerFaction: loc.ownerFaction,
      x: loc.x,
      y: loc.y,
      unlockLevel: loc.unlockLevel,
      services: loc.services,
      connectedLocationIds: loc.connectedLocationIds,
      travelCostSecBase: LOCATION_TRAVEL_COSTS[loc.locationId] ?? 10,
      actorCount: agg.actorCount,
      powerShare: agg.powerShare,
      status,
      playerRelationHint,
      serviceActors,
      servicePositions,
    };
  });

  return {
    ok: true,
    action: 'WORLD_LOCATIONS_GET_STATUS',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      locations,
    },
  };
}

export function syncPlayerActor(ctx: ActionContext) {
  ensureWorldInitialized(ctx);
  
  const playerId = ctx.playerId || 'default-player';
  const actorId = `player:${playerId}`;
  
  let playerActor = ctx.state.world.actors.find(a => a.actorId === actorId);
  
  const raceId = ctx.state.player.raceId;
  const classId = ctx.state.player.classId;
  const displayName = ctx.state.player.displayName || '玩家';
  const level = ctx.state.player.level;
  
  let faction = ctx.state.player.powerFaction;
  if (!faction) {
    faction = RACE_CONFIGS[raceId]?.defaultFaction || 'imperial';
  }

  const combatSnapshot = {
    level,
    classId,
    attributes: {
      strength: ctx.state.attributes.strength,
      intelligence: ctx.state.attributes.intelligence,
      agility: ctx.state.attributes.agility,
      constitution: ctx.state.attributes.constitution,
      luck: ctx.state.attributes.luck,
    },
    combatStats: {
      hp: 100,
      armor: 10,
      damageMin: 5,
      damageMax: 10,
      critChanceBp: 500,
    },
    equipmentSummary: {
      itemPowerTotal: 0,
    },
  };

  if (!playerActor) {
    playerActor = {
      actorId,
      kind: 'player',
      displayName,
      raceId,
      classId,
      faction,
      locationId: 'player_inventory',
      level,
      powerShare: 0,
      combatSnapshot,
    };
    ctx.state.world.actors.push(playerActor);
    ctx.markWorldDirty?.() ?? ctx.markDirty();
  } else {
    playerActor.level = level;
    playerActor.faction = faction;
    playerActor.displayName = displayName;
    playerActor.classId = classId;
    playerActor.raceId = raceId;
    playerActor.combatSnapshot = combatSnapshot;
  }
}

export function applyWorldPowerTransfer(
  ctx: ActionContext,
  options: {
    amount: number;
    targetFactionId?: PowerFactionId;
    targetFactionIds?: PowerFactionId[];
    issuerFactionId: PowerFactionId;
    targetActorId?: string;
    beneficiaryActorId?: string;
  }
): PowerTransferResult {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const playerId = ctx.playerId || 'default-player';
  const playerActorId = `player:${playerId}`;
  
  const playerActor = ctx.state.world.actors.find(a => a.actorId === playerActorId);
  if (!playerActor) {
    throw new GameError('WORLD_PLAYER_ACTOR_NOT_FOUND', 'Player actor not found in world.');
  }

  const amount = options.amount;
  if (amount <= 0) {
    return {
      worldPowerTotal: 10000,
      actorPowerDelta: 0,
      issuerFactionPowerDelta: {},
      targetFactionPowerDelta: {},
      targetActorIds: [],
    };
  }

  // 1. Determine target factions
  const targetFactions = new Set<PowerFactionId>();
  if (options.targetFactionId) {
    targetFactions.add(options.targetFactionId);
  }
  if (options.targetFactionIds) {
    for (const f of options.targetFactionIds) {
      targetFactions.add(f);
    }
  }

  // 2. Capture faction-level power shares before transfer
  const getFactionPowerShares = () => {
    const shares: Record<PowerFactionId, number> = {
      imperial: 0,
      noble: 0,
      censorate: 0,
      border: 0,
      silver: 0,
      underworld: 0,
    };
    for (const actor of ctx.state.world.actors) {
      if (shares[actor.faction] !== undefined) {
        shares[actor.faction] += actor.powerShare;
      }
    }
    return shares;
  };

  const factionPowerBefore = getFactionPowerShares();

  // 3. Find bot actors belonging to the target factions with powerShare > 0
  const targetActors = ctx.state.world.actors.filter(
    a => targetFactions.has(a.faction) && a.actorId !== playerActorId && a.powerShare > 0
  );

  // Sort: if targetActorId matches options.targetActorId, it goes first. Otherwise sort by powerShare descending
  targetActors.sort((a, b) => {
    if (options.targetActorId) {
      if (a.actorId === options.targetActorId) return -1;
      if (b.actorId === options.targetActorId) return 1;
    }
    return b.powerShare - a.powerShare;
  });

  let remainingDeduct = amount;
  const targetActorIds: string[] = [];

  for (const actor of targetActors) {
    if (remainingDeduct <= 0) break;
    const deduct = Math.min(actor.powerShare, remainingDeduct);
    actor.powerShare -= deduct;
    remainingDeduct -= deduct;
    targetActorIds.push(actor.actorId);
  }

  // If still remainingDeduct > 0 (extreme fallback), deduct from any other bot actor (excluding player)
  if (remainingDeduct > 0) {
    const backupActors = ctx.state.world.actors.filter(
      a => a.actorId !== playerActorId && a.powerShare > 0 && !targetFactions.has(a.faction)
    );
    backupActors.sort((a, b) => b.powerShare - a.powerShare);
    for (const actor of backupActors) {
      if (remainingDeduct <= 0) break;
      const deduct = Math.min(actor.powerShare, remainingDeduct);
      actor.powerShare -= deduct;
      remainingDeduct -= deduct;
      targetActorIds.push(actor.actorId);
    }
  }

  const actualDeducted = amount - remainingDeduct;

  // 4. Increase player or beneficiary's powerShare by actualDeducted
  const beneficiaryActor = options.beneficiaryActorId
    ? ctx.state.world.actors.find(a => a.actorId === options.beneficiaryActorId)
    : undefined;

  if (beneficiaryActor) {
    beneficiaryActor.powerShare += actualDeducted;
  } else {
    playerActor.powerShare += actualDeducted;
  }

  // Mark state dirty
  ctx.markWorldDirty?.() ?? ctx.markDirty();

  // 5. Capture faction-level power shares after transfer
  const factionPowerAfter = getFactionPowerShares();

  // 6. Compute deltas
  const issuerFactionPowerDelta: Partial<Record<PowerFactionId, number>> = {};
  const targetFactionPowerDelta: Partial<Record<PowerFactionId, number>> = {};

  const issuer = options.issuerFactionId;
  const issuerDelta = factionPowerAfter[issuer] - factionPowerBefore[issuer];
  if (issuerDelta !== 0) {
    issuerFactionPowerDelta[issuer] = issuerDelta;
  }

  for (const f of targetFactions) {
    const delta = factionPowerAfter[f] - factionPowerBefore[f];
    if (delta !== 0) {
      targetFactionPowerDelta[f] = delta;
    }
  }

  // Form worldPowerAfter.byFaction view
  const byFaction = Object.keys(factionPowerAfter).map((fStr) => {
    const f = fStr as PowerFactionId;
    const count = ctx.state.world.actors.filter(a => a.faction === f).length;
    return {
      faction: f,
      actorCount: count,
      powerShare: factionPowerAfter[f],
    };
  });

  return {
    worldPowerTotal: 10000,
    actorPowerDelta: actualDeducted,
    issuerFactionPowerDelta,
    targetFactionPowerDelta,
    targetActorIds,
    worldPowerAfter: {
      byFaction,
    },
  };
}

// ---------------------------------------------------------------------------
// 服务标签映射（用于 API 返回）
// ---------------------------------------------------------------------------

const SERVICE_LABEL: Record<PowerLocationService, string> = {
  missions: '差事',
  shop: '商铺',
  dungeon: '副本',
  arena: '比武',
  promotion: '晋升',
  intel: '情报',
  estate: '产业',
  stamina: '补给',
  office_registry: '吏籍',
  appointment: '任免',
  evaluation: '考功',
  tribute_registry: '贡纳',
};

const FACTION_LABEL: Record<PowerFactionId, string> = {
  imperial: '皇权内廷',
  noble: '勋贵集团',
  censorate: '清流科道',
  border: '边军武勋',
  silver: '工商银库',
  underworld: '江湖秘社',
};

// ---------------------------------------------------------------------------
// 从 WorldActor 构建只读 CharacterInfoView（用于 bot / 离线玩家）
// ---------------------------------------------------------------------------

function buildCharacterInfoViewFromActor(actor: WorldActor): CharacterInfoView {
  const snap = actor.combatSnapshot;
  const attrs = snap.attributes;
  const zeroUpgradeCosts = {
    strength: 0,
    intelligence: 0,
    agility: 0,
    constitution: 0,
    luck: 0,
  };
  return {
    player: {
      level: actor.level,
      exp: 0,
      classId: actor.classId,
      raceId: actor.raceId,
      displayName: actor.displayName,
      avatarId: undefined,
      status: 'ACTIVE',
      powerFaction: actor.faction,
      suspicion: undefined,
    },
    resources: {
      copper: 0,
      tokens: 0,
      hourglasses: 0,
      prestige: 0,
    },
    attributes: {
      base: { ...attrs },
      total: { ...attrs },
      upgradeCosts: zeroUpgradeCosts,
    },
    combatPreview: {
      hp: snap.combatStats.hp,
      armor: snap.combatStats.armor,
      damageMin: snap.combatStats.damageMin,
      damageMax: snap.combatStats.damageMax,
      critChanceBp: snap.combatStats.critChanceBp,
      dodgeChanceBp: snap.combatStats.dodgeChanceBp,
      blockChanceBp: snap.combatStats.blockChanceBp,
      itemPowerTotal: snap.equipmentSummary.itemPowerTotal,
      combatRating: snap.equipmentSummary.itemPowerTotal + actor.level * 10,
    },
    equipment: {
      equipped: {
        head: null,
        body: null,
        hands: null,
        feet: null,
        neck: null,
        belt: null,
        ring: null,
        trinket: null,
        weapon: null,
        offHand: null,
      },
    },
    inventory: {
      capacity: 0,
      count: 0,
      items: [],
    },
  };
}

// ---------------------------------------------------------------------------
// 反查某 actorId 占据的所有 servicePositions
// ---------------------------------------------------------------------------

function resolveActorPositions(
  actorId: string,
  actors: WorldActor[],
  ctx: ActionContext,
  playerActorId: string,
): ActorPositionSummary[] {
  const results: ActorPositionSummary[] = [];

  for (const loc of POWER_LOCATIONS) {
    const positions = buildServicePositions(loc, actors, ctx, playerActorId);
    for (const pos of positions) {
      if (pos.occupant.actorId === actorId) {
        results.push({
          positionId: pos.positionId,
          locationId: pos.locationId,
          locationName: LOCATION_NAMES[pos.locationId] ?? pos.locationId,
          title: pos.title,
          service: pos.service,
          serviceLabel: SERVICE_LABEL[pos.service] ?? pos.service,
          ownerFaction: pos.ownerFaction,
          ownerLabel: FACTION_LABEL[pos.ownerFaction] ?? pos.ownerFaction,
          incomeHint: pos.incomeHint,
          replaceHint: pos.replaceHint,
          status: pos.status,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// WORLD_ACTOR_GET_DETAIL
// ---------------------------------------------------------------------------

export async function worldActorGetDetail(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<WorldActorDetailView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const actorId = typeof payload.actorId === 'string' ? payload.actorId.trim() : '';
  if (!actorId) {
    throw new GameError('WORLD_ACTOR_NOT_FOUND', '缺少 actorId 参数');
  }

  const actors = ctx.state.world.actors;
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  // 1. Is this the current player's actor?
  if (actorId === playerActorId) {
    const character = buildCharacterInfoView(ctx.state);
    const positions = resolveActorPositions(actorId, actors, ctx, playerActorId);
    return {
      ok: true,
      action: 'WORLD_ACTOR_GET_DETAIL',
      serverTime: ctx.now,
      stateRevision: ctx.state.meta.stateRevision,
      data: {
        actorId,
        kind: 'player',
        character,
        positions,
      },
    };
  }

  // 2. Find in world.actors pool
  const actor = actors.find(a => a.actorId === actorId);
  if (!actor) {
    throw new GameError('WORLD_ACTOR_NOT_FOUND', `actorId ${actorId} 不存在于世界角色池中`);
  }

  const character = buildCharacterInfoViewFromActor(actor);
  // For player-kind actors we still use the snapshot (no full save available)
  const avatarId = getActorAvatarId(actor, ctx);
  character.player.avatarId = avatarId;

  const positions = resolveActorPositions(actorId, actors, ctx, playerActorId);

  return {
    ok: true,
    action: 'WORLD_ACTOR_GET_DETAIL',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      actorId,
      kind: actor.kind,
      character,
      positions,
    },
  };
}

// ---------------------------------------------------------------------------
// WORLD_SERVICE_POSITIONS_GET_LIST (皇宫黄册)
// ---------------------------------------------------------------------------

export async function worldServicePositionsGetList(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{ positions: WorldServicePositionListItem[] }>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const filterLocationId = typeof payload.locationId === 'string' ? payload.locationId : undefined;
  const filterFaction = typeof payload.faction === 'string' ? payload.faction as PowerFactionId : undefined;

  const actors = ctx.state.world.actors;
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  const allPositions: WorldServicePositionListItem[] = [];

  for (const loc of POWER_LOCATIONS) {
    if (filterLocationId && loc.locationId !== filterLocationId) continue;
    if (filterFaction && loc.ownerFaction !== filterFaction) continue;

    const positions = buildServicePositions(loc, actors, ctx, playerActorId);
    for (const pos of positions) {
      const occ = pos.occupant;
      allPositions.push({
        positionId: pos.positionId,
        locationId: pos.locationId,
        locationName: LOCATION_NAMES[pos.locationId] ?? pos.locationId,
        title: pos.title,
        service: pos.service,
        serviceLabel: SERVICE_LABEL[pos.service] ?? pos.service,
        ownerFaction: pos.ownerFaction,
        occupant: {
          actorId: occ.actorId,
          kind: occ.kind,
          displayName: occ.displayName,
          avatarId: occ.avatarId,
          faction: occ.faction,
          level: occ.level,
          powerShare: occ.powerShare,
        },
        incomeHint: pos.incomeHint,
        replaceHint: pos.replaceHint,
        status: pos.status,
        controlProfile: pos.controlProfile,
      });
    }
  }

  return {
    ok: true,
    action: 'WORLD_SERVICE_POSITIONS_GET_LIST',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      positions: allPositions,
    },
  };
}

export function selectMissionTargetActor(
  ctx: ActionContext,
  targetFaction: PowerFactionId,
  playerLevel: number,
  caseType: MissionCaseType,
): MissionTargetActorPreview {
  ensureWorldInitialized(ctx);
  const actors = ctx.state.world.actors;
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  // 1. Precompute service positions to check if actor occupies one and what title they have
  const occupiedActorMap = new Map<string, { positionId: string; title: string; locationId: string }>();
  for (const loc of POWER_LOCATIONS) {
    const positions = buildServicePositions(loc, actors, ctx, playerActorId);
    for (const pos of positions) {
      occupiedActorMap.set(pos.occupant.actorId, {
        positionId: pos.positionId,
        title: pos.title,
        locationId: pos.locationId,
      });
    }
  }

  // Helper to check target faction locations
  const targetFactionLocations = new Set(
    POWER_LOCATIONS.filter(loc => loc.ownerFaction === targetFaction).map(loc => loc.locationId)
  );

  // Sorting/comparator function
  const compareActors = (a: WorldActor, b: WorldActor): number => {
    // 2. level proximity
    const diffA = Math.abs(a.level - playerLevel);
    const diffB = Math.abs(b.level - playerLevel);
    if (diffA !== diffB) {
      return diffA - diffB;
    }

    // 3. location in targetFaction locations
    const locA = targetFactionLocations.has(a.locationId);
    const locB = targetFactionLocations.has(b.locationId);
    if (locA !== locB) {
      return (locB ? 1 : 0) - (locA ? 1 : 0);
    }

    // 4. powerShare > 0
    const pA = a.powerShare > 0;
    const pB = b.powerShare > 0;
    if (pA !== pB) {
      return (pB ? 1 : 0) - (pA ? 1 : 0);
    }

    // 5. servicePosition
    const spA = occupiedActorMap.has(a.actorId);
    const spB = occupiedActorMap.has(b.actorId);
    if (spA !== spB) {
      return (spB ? 1 : 0) - (spA ? 1 : 0);
    }

    return a.actorId.localeCompare(b.actorId);
  };

  // Filter strict pool
  let pool = actors.filter(a => {
    if (a.actorId === playerActorId) return false;
    if (a.faction !== targetFaction) return false;
    if (Math.abs(a.level - playerLevel) > 15) return false;
    return true;
  });

  let fallbackType: 'none' | 'faction' | 'world' = 'none';

  if (pool.length === 0) {
    // Fallback to same faction
    pool = actors.filter(a => a.actorId !== playerActorId && a.faction === targetFaction);
    fallbackType = 'faction';
  }

  if (pool.length === 0) {
    // Fallback to any world actor
    pool = actors.filter(a => a.actorId !== playerActorId);
    fallbackType = 'world';
  }

  if (pool.length === 0) {
    throw new GameError('INVALID_GAME_STATE', 'No world actors available.');
  }

  pool.sort(compareActors);
  const chosen = pool[0]!;

  // Generate reason
  let reason = '';
  if (fallbackType === 'world') {
    // Generic reason
    const genericReasons: Record<MissionCaseType, string> = {
      raid: '行踪可疑的搜查对象',
      audit: '形迹可疑的账簿持有者',
      escort: '路途中意图不轨的窥伺者',
      arrest: '涉嫌作乱的捉拿对象',
      purge: '牵连行迹诡秘的涉案人员',
      smuggle: '暗中潜行的走私嫌疑人',
      petition: '阻碍官私信件的拦路人',
    };
    reason = genericReasons[caseType] ?? '涉案关联人员';
  } else {
    // Faction-specific reason
    const factionReasons: Record<PowerFactionId, Record<MissionCaseType, string>> = {
      imperial: {
        raid: '内廷私库案查抄关联人',
        audit: '户部库银亏空账册经手人',
        escort: '密诏押运暗中窥伺者',
        arrest: '东厂通缉钦犯',
        purge: '禁中谋逆案株连要犯',
        smuggle: '内官监出京私贩经办人',
        petition: '阻拦密折呈送的内侍心腹',
      },
      noble: {
        raid: '勋贵别业私藏兵甲牵连人',
        audit: '侵占军田账册管事',
        escort: '拦截国公府密信之人',
        arrest: '包庇京畿恶霸的国公府家奴',
        purge: '蓝党旧部余孽门丁',
        smuggle: '勋贵私运违禁铁器庄头',
        petition: '勋贵联名抗疏执笔人',
      },
      censorate: {
        raid: '弹劾折草稿抄引人',
        audit: '御史台稽查账册经手人',
        escort: '清流搜集罪证押送护卫',
        arrest: '妄议朝政御史台吏员',
        purge: '清流结党案门生',
        smuggle: '暗通京外书院的清流密使',
        petition: '都察院御史弹章经手人',
      },
      border: {
        raid: '克扣军饷倒卖物资牵连人',
        audit: '边镇粮道运饷账册心腹',
        escort: '私运塞外军资劫道者',
        arrest: '私通外敌的边将亲兵',
        purge: '割裂防线通敌案内奸',
        smuggle: '边镇粮道违禁走私头目',
        petition: '阻截边关急递的悍卒',
      },
      silver: {
        raid: '私铸劣钱工坊牵连人',
        audit: '盐引私盐账册管账人',
        escort: '商会私吞镖银劫掠人',
        arrest: '行贿朝廷官员的商会买办',
        purge: '商会偷税漏税连带掌柜',
        smuggle: '违禁私运私盐盐引贩子',
        petition: '勾结官员阻挠开市的商会心腹',
      },
      underworld: {
        raid: '香会私设官堂据点打手',
        audit: '香会堂口地下钱庄管事',
        escort: '黑市赃物押送拦截者',
        arrest: '香会暗线通缉头目',
        purge: '香会暗线分舵舵主',
        smuggle: '香会违禁走私暗线头目',
        petition: '劫夺官府告密信的刺客',
      },
    };
    reason = factionReasons[chosen.faction]?.[caseType] ?? '涉案关联人员';
  }

  const avatarId = getActorAvatarId(chosen, ctx);
  const posInfo = occupiedActorMap.get(chosen.actorId);

  return {
    actorId: chosen.actorId,
    kind: chosen.kind,
    displayName: chosen.displayName,
    avatarId,
    level: chosen.level,
    classId: chosen.classId,
    raceId: chosen.raceId,
    faction: chosen.faction,
    locationId: chosen.locationId,
    locationName: LOCATION_NAMES[chosen.locationId],
    powerShare: chosen.powerShare,
    title: posInfo?.title,
    positionId: posInfo?.positionId,
    reason,
  };
}

export function canImperialOverrideReplace(currentHolder: WorldActor, candidate: WorldActor): boolean {
  return candidate.powerShare > currentHolder.powerShare;
}

export async function worldServicePositionGetDetail(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{
  position: ServicePositionView;
  occupant: ServicePositionView['occupant'];
  location: {
    locationId: string;
    name: string;
    ownerFaction: PowerFactionId;
    unlockLevel: number;
  };
  service: PowerLocationService;
  incomeHint: string;
  replaceHint: string;
  controlProfile?: ServicePositionControlProfile;
  kpiProfile: OfficeKpiProfile;
  controlDetail: OfficeControlDetail;
  eligibility: OfficeEligibility;
  imperialOverrideHint: string;
  ledgerPreview: OfficeLedgerEntry[];
  candidatesPreview?: ServicePositionCandidatesPreview;
}>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const positionId = typeof payload.positionId === 'string' ? payload.positionId : '';
  if (!positionId) {
    throw new GameError('POSITION_ID_REQUIRED', 'Position ID is required.');
  }

  let foundPos: ServicePositionView | undefined;
  let foundLoc: PowerLocation | undefined;

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const actors = ctx.state.world.actors;

  for (const loc of POWER_LOCATIONS) {
    const positions = buildServicePositions(loc, actors, ctx, playerActorId);
    const pos = positions.find(p => p.positionId === positionId);
    if (pos) {
      foundPos = pos;
      foundLoc = loc;
      break;
    }
  }

  if (!foundPos || !foundLoc) {
    throw new GameError('POSITION_NOT_FOUND', `Position ${positionId} not found.`);
  }

  const loc = foundLoc;
  const pos = foundPos;

  // 1. KPI Profile (derived)
  const isKpiMet = pos.occupant.powerShare >= 300;
  const taxDuePerTerm = Math.max(500, loc.unlockLevel * 150);
  const taxDeliveredThisTerm = isKpiMet ? taxDuePerTerm : Math.max(100, Math.floor(taxDuePerTerm * 0.35));
  const powerDuePerTerm = Math.max(10, loc.unlockLevel * 2);
  const powerDeliveredThisTerm = isKpiMet ? powerDuePerTerm : Math.max(2, Math.floor(powerDuePerTerm * 0.2));

  const kpiProfile: OfficeKpiProfile = {
    termStartsAt: ctx.now - 3 * 24 * 3600 * 1000,
    termEndsAt: ctx.now + 4 * 24 * 3600 * 1000,
    taxDuePerTerm,
    taxDeliveredThisTerm,
    powerDuePerTerm,
    powerDeliveredThisTerm,
  };

  // 2. Control Detail (derived)
  const factionActors = actors
    .filter(a => a.faction === loc.ownerFaction)
    .sort((a, b) => b.powerShare - a.powerShare);

  const topActor = factionActors[0];
  const secondActor = factionActors[1] ?? factionActors[0];

  const treasurySplits: Record<PowerFactionId, any> = {
    imperial: { imperialPrivatePct: 50, publicTreasuryPct: 10, officeHolderPct: 20, superiorPct: 20 },
    noble: { imperialPrivatePct: 10, publicTreasuryPct: 10, officeHolderPct: 30, superiorPct: 50 },
    censorate: { imperialPrivatePct: 5, publicTreasuryPct: 45, officeHolderPct: 30, superiorPct: 20 },
    border: { imperialPrivatePct: 5, publicTreasuryPct: 15, officeHolderPct: 30, superiorPct: 50 },
    silver: { imperialPrivatePct: 15, publicTreasuryPct: 20, officeHolderPct: 30, superiorPct: 35 },
    underworld: { imperialPrivatePct: 0, publicTreasuryPct: 5, officeHolderPct: 30, superiorPct: 65 },
  };

  const treasurySplit = treasurySplits[loc.ownerFaction] ?? {
    imperialPrivatePct: 10,
    publicTreasuryPct: 30,
    officeHolderPct: 30,
    superiorPct: 30,
  };

  const controlDetail: OfficeControlDetail = {
    appointmentControllerActorId: topActor?.actorId,
    appointmentControllerDisplayName: topActor?.displayName,
    financeControllerActorId: secondActor?.actorId,
    financeControllerDisplayName: secondActor?.displayName,
    treasurySplit,
  };

  // 3. Eligibility (derived)
  const reasons: string[] = [];
  const playerActor = actors.find(a => a.actorId === playerActorId);
  const playerPower = playerActor?.powerShare ?? 0;

  if (pos.occupant.actorId === playerActorId) {
    reasons.push('您当前已担任此职，无需重复谋求。');
  }
  if (ctx.state.player.level < loc.unlockLevel) {
    reasons.push(`等级未达到职位最低等级要求（需要等级 ${loc.unlockLevel}，您当前为 ${ctx.state.player.level} 级）。`);
  }
  if (playerPower <= pos.occupant.powerShare) {
    reasons.push(`您的在野权柄不足，您的权柄（${playerPower}）必须超过当前任职者的权柄（${pos.occupant.powerShare}）才可发起弹劾或谋求任用。`);
  }

  const playerFaction = ctx.state.player.powerFaction;
  if (playerFaction !== loc.ownerFaction) {
    const requiredFactionName = FACTION_LABEL[loc.ownerFaction] ?? loc.ownerFaction;
    const currentFactionName = playerFaction ? (FACTION_LABEL[playerFaction] ?? playerFaction) : '无门派';
    reasons.push(`派系背景不符，该职位属于「${requiredFactionName}」派系，您当前派系背景为「${currentFactionName}」。`);
  }

  const canBeConsidered = reasons.length === 0;
  const eligibility: OfficeEligibility = {
    canBeConsidered,
    reasons,
  };

  // 4. Imperial override logic (天子特旨)
  const currentHolderActor = actors.find(a => a.actorId === pos.occupant.actorId);
  const canImperialOverride = currentHolderActor && playerActor
    ? canImperialOverrideReplace(currentHolderActor, playerActor)
    : false;

  const currentHolderPower = pos.occupant.powerShare;
  const imperialOverrideHint = canImperialOverride
    ? `天子特旨可用：您当前的权柄（${playerPower}）已高于现任者（${currentHolderPower}），可在吏部通过“内廷批红中使”请求皇帝特旨强换此职！`
    : `天子特旨暂不可用：您的权柄（${playerPower}）必须高于现任者（${currentHolderPower}）才可启用批红强换机制。`;

  return {
    ok: true,
    action: 'WORLD_SERVICE_POSITION_GET_DETAIL',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      position: pos,
      occupant: pos.occupant,
      location: {
        locationId: loc.locationId,
        name: loc.name,
        ownerFaction: loc.ownerFaction,
        unlockLevel: loc.unlockLevel,
      },
      service: pos.service,
      incomeHint: pos.incomeHint,
      replaceHint: pos.replaceHint,
      controlProfile: pos.controlProfile,
      kpiProfile,
      controlDetail,
      eligibility,
      imperialOverrideHint,
      ledgerPreview: (ctx.state.world.officeLedger ?? [])
        .filter((e: any) => e.positionId === positionId)
        .slice(-5)
        .reverse(),
      candidatesPreview: (() => {
        const list = buildOfficeCandidateListView(ctx, positionId, 8);
        const topCandidate = list.candidates[0];
        return {
          currentPlayerRank: list.currentPlayerRank,
          topCandidate,
          advice: list.plottingAdvice.slice(0, 3),
        };
      })(),
    },
  };
}

export function writeOfficeLedgerFromMission(
  ctx: ActionContext,
  activeMission: any,
  officeSettlement: any
) {
  ensureWorldInitialized(ctx);
  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }

  const playerDisplayName = ctx.state.player.displayName || '玩家';
  const targetDisplayName = activeMission.targetActor?.displayName || '嫌疑人';
  const beneficiaryDisplayName = officeSettlement.beneficiaryDisplayName || '主管';
  
  const locId = activeMission.sourceLocationId || '';
  const posId = officeSettlement.sourcePositionId || `${locId}:missions`;
  const customTitle = POSITION_TITLE_CUSTOM[posId];
  const posTitle = customTitle ?? POSITION_TITLE_BY_SERVICE['missions'] ?? '主管';
  const beneficiaryLabel = `${posTitle}${beneficiaryDisplayName}`;

  let description = '';
  if (officeSettlement.powerValueDelta && officeSettlement.powerValueDelta > 0) {
    const powerPct = (officeSettlement.powerValueDelta / 100).toFixed(2);
    description = `${playerDisplayName}奉命缉拿${targetDisplayName}，${beneficiaryLabel}得权柄 ${powerPct}%。`;
  } else if (officeSettlement.taxValueDelta && officeSettlement.taxValueDelta > 0) {
    description = `${playerDisplayName}完成${activeMission.title}，${beneficiaryLabel}入税钱 ${officeSettlement.taxValueDelta}。`;
  } else {
    description = `${playerDisplayName}完成${activeMission.title}，${beneficiaryLabel}所得。`;
  }

  const entry: OfficeLedgerEntry = {
    entryId: `ledger_${ctx.now}_mission_${activeMission.missionId}`,
    createdAt: ctx.now,
    positionId: posId,
    locationId: locId,
    service: 'missions',
    beneficiaryActorId: officeSettlement.beneficiaryActorId,
    beneficiaryDisplayName: officeSettlement.beneficiaryDisplayName,
    sourceActorId: `player:${ctx.playerId}`,
    sourceActorDisplayName: playerDisplayName,
    targetActorId: activeMission.targetActor?.actorId,
    targetActorDisplayName: activeMission.targetActor?.displayName,
    type: officeSettlement.powerValueDelta && officeSettlement.powerValueDelta > 0 ? 'mission_power' : 'mission_tax',
    powerValueDelta: officeSettlement.powerValueDelta || 0,
    taxValueDelta: officeSettlement.taxValueDelta || 0,
    description,
  };

  ctx.state.world.officeLedger.push(entry);
  if (ctx.state.world.officeLedger.length > 200) {
    ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
  }

  // 更新场所公账
  if (locId) {
    const treasuries = ctx.state.world.locationTreasuries;
    if (treasuries) {
      const treasury = treasuries.find(t => t.locationId === locId);
      if (treasury) {
        if (officeSettlement.powerValueDelta && officeSettlement.powerValueDelta > 0) {
          treasury.powerValue += officeSettlement.powerValueDelta;
        }
        if (officeSettlement.taxValueDelta && officeSettlement.taxValueDelta > 0) {
          treasury.copperBalance += officeSettlement.taxValueDelta;
        }
        treasury.updatedAt = ctx.now;
      }
    }
  }

  ctx.markWorldDirty?.() ?? ctx.markDirty();
}

export function simulateWorldBotOfficeActivity(state: GameState, now: number): OfficeLedgerEntry[] {
  if (!state.world.botSimulation) {
    state.world.botSimulation = { lastSimulatedAt: 0 };
  }
  
  const rng = mulberry32(now || 12345);
  function choose<T>(arr: T[]): T {
    const idx = Math.floor(rng() * arr.length);
    return arr[idx];
  }

  const locCount = 3 + Math.floor(rng() * 6); // 3 to 8
  const availableLocations = POWER_LOCATIONS.filter(loc => loc.services.length > 0);
  
  const shuffledLocs = [...availableLocations];
  for (let i = shuffledLocs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffledLocs[i];
    shuffledLocs[i] = shuffledLocs[j];
    shuffledLocs[j] = temp;
  }
  
  const selectedLocs = shuffledLocs.slice(0, Math.min(locCount, shuffledLocs.length));
  const newEntries: OfficeLedgerEntry[] = [];
  const actors = state.world.actors;
  
  let idCounter = 1;
  const generateEntryId = () => {
    return `ledger_${now}_sim_${idCounter++}`;
  };

  const tempCtx: ActionContext = {
    playerId: 'default-player',
    now,
    state,
    get dirty() { return false; },
    markDirty() {}
  };
  const playerActorId = `player:default-player`;

  for (const loc of selectedLocs) {
    const service = choose(loc.services);
    const positionId = `${loc.locationId}:${service}`;
    
    const positions = buildServicePositions(loc, actors, tempCtx, playerActorId);
    const pos = positions.find(p => p.service === service);
    if (!pos) continue;
    
    const beneficiary = pos.occupant;
    
    if (loc.locationId === 'northern_bureau' && service === 'missions') {
      const possibleTargets = actors.filter(a => a.kind === 'bot' && a.actorId !== beneficiary.actorId && a.powerShare > 10);
      if (possibleTargets.length > 0) {
        const targetActor = choose(possibleTargets);
        const powerDelta = Math.floor(rng() * 4) + 2; // 2 to 5 points
        
        const targetInWorld = actors.find(a => a.actorId === targetActor.actorId);
        const beneficiaryInWorld = actors.find(a => a.actorId === beneficiary.actorId);
        
        if (targetInWorld && beneficiaryInWorld) {
          const actualPower = Math.min(powerDelta, targetInWorld.powerShare - 1);
          if (actualPower > 0) {
            targetInWorld.powerShare -= actualPower;
            beneficiaryInWorld.powerShare += actualPower;
            
            const powerPct = (actualPower / 100).toFixed(2);
            const sourceActor = choose(actors.filter(a => a.kind === 'bot' && a.locationId === loc.locationId)) ?? choose(actors.filter(a => a.kind === 'bot'));
            
            const entry: OfficeLedgerEntry = {
              entryId: generateEntryId(),
              createdAt: now,
              positionId,
              locationId: loc.locationId,
              service,
              beneficiaryActorId: beneficiary.actorId,
              beneficiaryDisplayName: beneficiary.displayName,
              sourceActorId: sourceActor.actorId,
              sourceActorDisplayName: sourceActor.displayName,
              targetActorId: targetInWorld.actorId,
              targetActorDisplayName: targetInWorld.displayName,
              type: 'bot_power',
              powerValueDelta: actualPower,
              taxValueDelta: 0,
              description: `${sourceActor.displayName}奉命缉拿${targetInWorld.displayName}，${pos.title}${beneficiary.displayName}得权柄 ${powerPct}%。`,
            };
            newEntries.push(entry);

            const treasuries = state.world.locationTreasuries;
            if (treasuries) {
              const treasury = treasuries.find(t => t.locationId === loc.locationId);
              if (treasury) {
                treasury.powerValue += actualPower;
                treasury.updatedAt = now;
              }
            }
          }
        }
      }
    } else {
      const taxAmount = Math.floor(rng() * 150) + 10;
      const sourceActor = choose(actors.filter(a => a.kind === 'bot' && a.locationId === loc.locationId)) ?? choose(actors.filter(a => a.kind === 'bot'));
      
      let type: OfficeLedgerEntryType = 'bot_tax';
      let description = '';
      
      if (service === 'shop') {
        type = 'shop_tax';
        const actionText = choose([
          '完成交易采购',
          '采办御用珍玩',
          '交易漕运物资',
          '采办贡品物资',
          '交易盐铁货物'
        ]);
        description = `${sourceActor.displayName}${actionText}，${pos.title}${beneficiary.displayName}进税钱 ${taxAmount}。`;
      } else if (service === 'stamina') {
        type = 'stamina_tax';
        const actionText = choose([
          '享用歇息茶水',
          '享用强身药膳',
          '投宿馆驿歇脚',
          '沐浴更衣修整'
        ]);
        description = `${sourceActor.displayName}${actionText}，${pos.title}${beneficiary.displayName}进账 ${taxAmount}。`;
      } else {
        type = 'bot_tax';
        const actionText = choose([
          '完成差事巡逻',
          '筹办灾民赈济',
          '递送紧急公文',
          '修缮城门工事',
          '押运漕银税款'
        ]);
        description = `${sourceActor.displayName}${actionText}，${pos.title}${beneficiary.displayName}进税钱 ${taxAmount}。`;
      }
      
      const entry: OfficeLedgerEntry = {
        entryId: generateEntryId(),
        createdAt: now,
        positionId,
        locationId: loc.locationId,
        service,
        beneficiaryActorId: beneficiary.actorId,
        beneficiaryDisplayName: beneficiary.displayName,
        sourceActorId: sourceActor.actorId,
        sourceActorDisplayName: sourceActor.displayName,
        type,
        taxValueDelta: taxAmount,
        powerValueDelta: 0,
        description,
      };
      newEntries.push(entry);

      const treasuries = state.world.locationTreasuries;
      if (treasuries) {
        const treasury = treasuries.find(t => t.locationId === loc.locationId);
        if (treasury) {
          if (type === 'shop_tax') {
            treasury.goodsValue += taxAmount;
          } else {
            treasury.copperBalance += taxAmount;
          }
          treasury.updatedAt = now;
        }
      }
    }
  }

  return newEntries;
}

export function triggerBotSimulationIfNeeded(ctx: ActionContext) {
  ensureWorldInitialized(ctx);
  if (!ctx.state.world.botSimulation) {
    ctx.state.world.botSimulation = { lastSimulatedAt: 0 };
  }
  const now = ctx.now;
  const lastSimulatedAt = ctx.state.world.botSimulation.lastSimulatedAt;
  const SIMULATION_INTERVAL_MS = 600 * 1000; // 10 minutes
  if (now - lastSimulatedAt >= SIMULATION_INTERVAL_MS) {
    ctx.state.world.botSimulation.lastSimulatedAt = now;
    const newEntries = simulateWorldBotOfficeActivity(ctx.state, now);
    if (newEntries.length > 0) {
      if (!ctx.state.world.officeLedger) {
        ctx.state.world.officeLedger = [];
      }
      ctx.state.world.officeLedger.push(...newEntries);
      if (ctx.state.world.officeLedger.length > 200) {
        ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
      }
    }
    ctx.markWorldDirty?.() ?? ctx.markDirty();
  }
}

export async function worldServicePositionLedgerGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{ entries: OfficeLedgerEntry[] }>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const positionId = typeof payload.positionId === 'string' ? payload.positionId : undefined;
  const actorId = typeof payload.actorId === 'string' ? payload.actorId : undefined;
  const locationId = typeof payload.locationId === 'string' ? payload.locationId : undefined;
  let limit = typeof payload.limit === 'number' ? payload.limit : 20;
  if (limit <= 0) limit = 20;
  if (limit > 50) limit = 50;

  let filtered = ctx.state.world.officeLedger ?? [];

  if (positionId) {
    filtered = filtered.filter(e => e.positionId === positionId);
  }
  if (locationId) {
    filtered = filtered.filter(e => e.locationId === locationId);
  }
  if (actorId) {
    filtered = filtered.filter(e => e.beneficiaryActorId === actorId);
  }

  const entries = filtered.slice(-limit).reverse();

  return {
    ok: true,
    action: 'WORLD_SERVICE_POSITION_LEDGER_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      entries,
    },
  };
}

const FACTION_ALLIES: Record<PowerFactionId, PowerFactionId[]> = {
  imperial: ['noble'],
  noble: ['imperial'],
  censorate: ['border'],
  border: ['censorate'],
  silver: ['underworld'],
  underworld: ['silver'],
};

export function evaluateOfficeCandidate(
  candidateActor: WorldActor,
  position: ServicePositionView,
  loc: PowerLocation,
  incumbent: { actorId: string; powerShare: number },
  isCurrentPlayer: boolean,
  ctx: ActionContext
): OfficeCandidateView {
  const isIncumbent = candidateActor.actorId === incumbent.actorId;
  const isKpiMet = incumbent.powerShare >= 300;

  // 1. 等级门槛 (20分)
  const minLevel = position.minLevel;
  const levelPassed = candidateActor.level >= minLevel;
  const levelScore = levelPassed ? 20 : Math.floor((candidateActor.level / minLevel) * 20);
  const levelHint = levelPassed
    ? `等级已达标（得 20 分）`
    : `等级未达标，需达到 ${minLevel} 级（当前为 ${candidateActor.level} 级，得 ${levelScore} 分）`;

  // 2. 权柄 (30分)
  const incumbentPower = incumbent.powerShare;
  let powerScore = 0;
  let powerPassed = false;
  if (isIncumbent) {
    powerScore = 30;
    powerPassed = true;
  } else {
    powerPassed = candidateActor.powerShare >= incumbentPower;
    powerScore = powerPassed
      ? 30
      : (incumbentPower > 0 ? Math.floor((candidateActor.powerShare / incumbentPower) * 30) : 30);
  }
  const powerHint = powerPassed
    ? `在野权柄高于或等于现任者（得 30 分）`
    : `在野权柄不足，差 ${incumbentPower - candidateActor.powerShare} 点（当前为 ${candidateActor.powerShare}，现任为 ${incumbentPower}，得 ${powerScore} 分）`;

  // 3. 派系匹配 (20分)
  const isSameFaction = candidateActor.faction === position.ownerFaction;
  const isAllyFaction = !isSameFaction && FACTION_ALLIES[position.ownerFaction]?.includes(candidateActor.faction);
  const factionScore = isSameFaction ? 20 : (isAllyFaction ? 10 : 0);
  const factionPassed = isSameFaction || isAllyFaction;
  const factionHint = isSameFaction
    ? `派系完全匹配（得 20 分）`
    : (isAllyFaction
        ? `派系相近，可获折半推荐（当前为「${FACTION_LABEL[candidateActor.faction]}」，得 10 分）`
        : `派系不合，此职位归属「${FACTION_LABEL[position.ownerFaction]}」派系（当前为「${FACTION_LABEL[candidateActor.faction]}」，得 0 分）`);

  // 4. KPI 机会 (15分)
  let kpiScore = 0;
  let kpiPassed = false;
  if (isIncumbent) {
    kpiScore = isKpiMet ? 15 : 0;
    kpiPassed = isKpiMet;
  } else {
    kpiScore = isKpiMet ? 0 : 15;
    kpiPassed = !isKpiMet;
  }
  const kpiHint = isIncumbent
    ? (isKpiMet ? `现任 KPI 考核已达标，位置稳固（得 15 分）` : `现任 KPI 未达标，存在弹劾动摇（得 0 分）`)
    : (isKpiMet ? `现任官员本期 KPI 达标，暂难撬动（得 0 分）` : `现任官员本期 KPI 未达标，存在弹劾空间（得 15 分）`);

  // 5. 职务适配 (15分)
  const fitScore = Math.min(15, Math.floor((candidateActor.level / (minLevel + 5)) * 15));
  const fitPassed = fitScore >= 10;
  const fitHint = `职务适配度评估：${fitScore === 15 ? '完美适配' : fitScore >= 10 ? '高度适配' : '适配度一般'}（得 ${fitScore} 分）`;

  const totalScore = levelScore + powerScore + factionScore + kpiScore + fitScore;

  const scoreBreakdown: OfficeCandidateScoreItem[] = [
    { label: '等级门槛', value: levelScore, passed: levelPassed, hint: levelHint },
    { label: '在野权柄', value: powerScore, passed: powerPassed, hint: powerHint },
    { label: '派系匹配', value: factionScore, passed: factionPassed, hint: factionHint },
    { label: 'KPI机会', value: kpiScore, passed: kpiPassed, hint: kpiHint },
    { label: '职务适配', value: fitScore, passed: fitPassed, hint: fitHint },
  ];

  // Current player recommendation logic
  let recommendation = '';
  if (isIncumbent) {
    recommendation = '您当前已担任此职。请继续保持优异的 KPI 指标以防弹劾。';
  } else if (!levelPassed) {
    recommendation = `等级未达标，建议优先提升等级至 ${minLevel} 级。`;
  } else if (!factionPassed) {
    recommendation = `派系不合，该职位由「${FACTION_LABEL[position.ownerFaction]}」掌控，需改换门路或依附其人事主管。`;
  } else if (!powerPassed) {
    if (position.locationId === 'northern_bureau') {
      recommendation = '权柄低于现任，北镇抚司职位可通过执行该处差事削弱对手权柄。';
    } else {
      recommendation = '等级足够，但权柄低于现任，建议先去相关地点承接差事夺取权柄。';
    }
  } else if (isKpiMet) {
    recommendation = '您当前的权柄已高于现任，但现任本期 KPI 达标。可等待考功期，或在吏部寻求天子特旨强换。';
  } else {
    recommendation = '现任本期 KPI 未达标，且您的权柄已超越现任，大有可为！可在吏部寻求调换或等待每周考功弹劾。';
  }

  const combatRating = candidateActor.combatSnapshot?.equipmentSummary?.itemPowerTotal
    ? (candidateActor.combatSnapshot.equipmentSummary.itemPowerTotal + candidateActor.level * 10)
    : (candidateActor.level * 10);

  return {
    actorId: candidateActor.actorId,
    kind: candidateActor.kind,
    displayName: candidateActor.displayName,
    avatarId: getActorAvatarId(candidateActor, ctx),
    level: candidateActor.level,
    faction: candidateActor.faction,
    powerShare: candidateActor.powerShare,
    combatRating,
    isCurrentPlayer,
    score: totalScore,
    scoreBreakdown,
    recommendation,
  };
}

export function buildOfficeCandidateListView(
  ctx: ActionContext,
  positionId: string,
  limit: number = 8
): OfficeCandidateListView {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  let foundPos: ServicePositionView | undefined;
  let foundLoc: PowerLocation | undefined;

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const actors = ctx.state.world.actors;

  for (const loc of POWER_LOCATIONS) {
    const positions = buildServicePositions(loc, actors, ctx, playerActorId);
    const pos = positions.find(p => p.positionId === positionId);
    if (pos) {
      foundPos = pos;
      foundLoc = loc;
      break;
    }
  }

  if (!foundPos || !foundLoc) {
    throw new GameError('POSITION_NOT_FOUND', `Position ${positionId} not found.`);
  }

  const loc = foundLoc;
  const pos = foundPos;

  const incumbentActor = actors.find(a => a.actorId === pos.occupant.actorId) ?? actors.find(a => a.locationId === loc.locationId) ?? actors[0]!;
  const incumbentView = evaluateOfficeCandidate(incumbentActor, pos, loc, { actorId: incumbentActor.actorId, powerShare: incumbentActor.powerShare }, incumbentActor.actorId === playerActorId, ctx);

  const candidateActorsList: WorldActor[] = [];
  const addedActorIds = new Set<string>([incumbentActor.actorId]);

  const playerActor = actors.find(a => a.actorId === playerActorId);
  if (playerActor && !addedActorIds.has(playerActor.actorId)) {
    candidateActorsList.push(playerActor);
    addedActorIds.add(playerActor.actorId);
  }

  const sameLocFaction = actors.filter(a => a.locationId === loc.locationId && a.faction === loc.ownerFaction && !addedActorIds.has(a.actorId));
  for (const a of sameLocFaction) {
    candidateActorsList.push(a);
    addedActorIds.add(a.actorId);
  }

  const sameFaction = actors.filter(a => a.faction === loc.ownerFaction && !addedActorIds.has(a.actorId));
  for (const a of sameFaction) {
    candidateActorsList.push(a);
    addedActorIds.add(a.actorId);
  }

  const others = actors.filter(a => !addedActorIds.has(a.actorId));
  for (const a of others) {
    candidateActorsList.push(a);
    addedActorIds.add(a.actorId);
  }

  const evaluatedCandidates = candidateActorsList.map(actor => {
    return evaluateOfficeCandidate(actor, pos, loc, { actorId: incumbentActor.actorId, powerShare: incumbentActor.powerShare }, actor.actorId === playerActorId, ctx);
  });

  evaluatedCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.powerShare !== a.powerShare) return b.powerShare - a.powerShare;
    if (b.level !== a.level) return b.level - a.level;
    return a.actorId.localeCompare(b.actorId);
  });

  let currentPlayerView: OfficeCandidateView | undefined;
  if (playerActor) {
    if (playerActor.actorId === incumbentActor.actorId) {
      currentPlayerView = incumbentView;
    } else {
      currentPlayerView = evaluatedCandidates.find(c => c.actorId === playerActorId);
    }
  }

  const candidatesSlice = evaluatedCandidates.slice(0, limit);
  const plottingAdvice: string[] = [];
  const isKpiMet = incumbentActor.powerShare >= 300;

  if (playerActor) {
    if (playerActor.level < pos.minLevel) {
      plottingAdvice.push(`【等级提升】您的等级（${playerActor.level}）尚未达到职位门槛（${pos.minLevel}），建议优先前往酒馆或副本历练。`);
    } else {
      plottingAdvice.push(`【等级达标】您的等级已满足该职位的最低要求，候选评估基本资格已通过。`);
    }

    if (playerActor.powerShare < incumbentActor.powerShare) {
      const diff = incumbentActor.powerShare - playerActor.powerShare;
      if (loc.locationId === 'northern_bureau') {
        plottingAdvice.push(`【缇骑削权】现任者权柄高于您（差额 ${diff}），北镇抚司是夺权机器，前往北镇抚司执行差事可以直接削弱现任者。`);
      } else {
        plottingAdvice.push(`【权柄争夺】您的在野权柄不足，比现任者低 ${diff} 点。建议前往对应场所执行差事，将更多权柄收归己有。`);
      }
    } else {
      plottingAdvice.push(`【权柄领先】您的在野权柄（${playerActor.powerShare}）已超越或持平现任者（${incumbentActor.powerShare}），在权柄上占据绝对优势。`);
    }

    if (playerActor.faction !== loc.ownerFaction) {
      const factionName = FACTION_LABEL[loc.ownerFaction] ?? loc.ownerFaction;
      plottingAdvice.push(`【门路依附】您当前派系并非该地点的掌控派系「${factionName}」。可以通过依附该派系的人事/财权主管来暗中谋划。`);
    } else {
      plottingAdvice.push(`【同门推荐】您与该职位属于同一派系，天生具备任职亲和力，能得到吏部的优先推荐。`);
    }

    if (!isKpiMet) {
      plottingAdvice.push(`【考功破绽】现任官员本期 KPI 考功未达标，其职位基础动摇，在每周考功结算时面临极大的弹劾被撤换风险！`);
    } else {
      plottingAdvice.push(`【暂难撬动】现任官员本期交税及交权指标达标，其地位稳固。若要强行替换，必须寻求天子特旨（在野权柄高于现任）。`);
    }
  }

  const playerRankInCandidates = evaluatedCandidates.findIndex(c => c.actorId === playerActorId);
  const currentPlayerRank = playerRankInCandidates >= 0
    ? (playerRankInCandidates + 1)
    : (playerActorId === incumbentActor.actorId ? 1 : undefined);

  return {
    positionId,
    incumbent: incumbentView,
    currentPlayer: currentPlayerView,
    candidates: candidatesSlice,
    plottingAdvice,
    currentPlayerRank,
  };
}

export async function worldServicePositionCandidatesGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<OfficeCandidateListView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const positionId = typeof payload.positionId === 'string' ? payload.positionId : '';
  if (!positionId) {
    throw new GameError('POSITION_ID_REQUIRED', 'Position ID is required.');
  }

  let limit = typeof payload.limit === 'number' ? payload.limit : 8;
  if (limit <= 0) limit = 8;
  if (limit > 20) limit = 20;

  const data = buildOfficeCandidateListView(ctx, positionId, limit);

  return {
    ok: true,
    action: 'WORLD_SERVICE_POSITION_CANDIDATES_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data,
  };
}

function getRaidCarryMultiplier(mount: any, now: number): number {
  if (!mount || (mount.expiresAt !== null && now >= mount.expiresAt)) {
    return 1.0;
  }
  const tier = (mount.tier || '').toLowerCase();
  const name = (mount.name || '').toLowerCase();
  
  if (tier.includes('donkey') || name.includes('驴')) {
    return 1.4;
  }
  if (tier.includes('ox') || name.includes('牛')) {
    return 2.0;
  }
  if (tier.includes('horse') || name.includes('马')) {
    return 1.6;
  }
  return 1.0;
}

export function resolveChiefActor(
  loc: PowerLocation,
  actors: WorldActor[],
  ctx: ActionContext,
  playerActorId: string,
): WorldActor | undefined {
  if (loc.locationId === 'imperial_palace') {
    const wei = actors.find(a => a.actorId === 'reserved:wei_zhongxian');
    if (wei) return wei;
  }

  // Generate service positions for this location
  const positions = buildServicePositions(loc, actors, ctx, playerActorId);
  
  // Priority: missions > shop > stamina
  const priorityServices = ['missions', 'shop', 'stamina'];
  for (const svc of priorityServices) {
    const pos = positions.find(p => p.service === svc);
    if (pos && pos.occupant) {
      const actor = actors.find(a => a.actorId === pos.occupant.actorId);
      if (actor) return actor;
    }
  }

  // Other services in definition order
  for (const pos of positions) {
    if (pos.occupant) {
      const actor = actors.find(a => a.actorId === pos.occupant.actorId);
      if (actor) return actor;
    }
  }

  // Fallback to highest powerShare actor of the owner faction
  const factionActors = actors.filter(a => a.faction === loc.ownerFaction);
  if (factionActors.length > 0) {
    const sorted = [...factionActors].sort((a, b) => b.powerShare - a.powerShare);
    return sorted[0];
  }

  // Final fallback: any actor in actors list
  return actors[0];
}

export function buildLocationTreasuryView(
  ctx: ActionContext,
  treasury: LocationTreasury,
  locDef: PowerLocation
): LocationTreasuryView {
  const locationId = treasury.locationId;
  const locationName = locDef.name;
  const ownerFaction = locDef.ownerFaction;
  const ownerLabel = FACTION_LABEL[ownerFaction] ?? ownerFaction;

  const totalValue = treasury.copperBalance + treasury.goodsValue;
  let raidRiskHint = '此地防备尚可，公账财物一般，劫掠风险中等。';
  if (totalValue >= 3000) {
    raidRiskHint = `此地积聚了大量财货（公账约 ${totalValue}），防卫级别被动上升，极易招致各方觊觎。`;
  } else if (totalValue < 1000) {
    raidRiskHint = '此地目前账面较为冷清，防卫松散，油水较少。';
  }

  const mount = ctx.state.mount;
  const mult = getRaidCarryMultiplier(mount, ctx.now);
  let carryHint = `您当前徒步，每次劫掠只能搬运 100% 的财货。建议换乘牛车或毛驴以提升负重。`;
  if (mult === 1.4) {
    carryHint = `您当前骑乘毛驴，负重能力尚可，劫掠收益提升 40% (当前倍率: ${mult}x)。`;
  } else if (mult === 1.6) {
    carryHint = `您当前骑乘骏马，速度极快且负重可观，劫掠收益提升 60% (当前倍率: ${mult}x)。`;
  } else if (mult === 2.0) {
    carryHint = `您当前赶着牛车，拥有极强的财货装载能力，劫掠收益翻倍 (当前倍率: ${mult}x)！`;
  }

  const guardDuties = ctx.state.world.locationGuardDuties ?? [];
  const activeDuties = guardDuties.filter(g => g.locationId === locationId && g.status === 'active');
  const guards = activeDuties.map(g => {
    const remainingSeconds = Math.max(0, Math.ceil((g.endsAt - ctx.now) / 1000));
    const canClaimWage = ctx.now >= g.endsAt;
    const canLeave = ctx.now < g.endsAt;
    return {
      ...g,
      remainingSeconds,
      canClaimWage,
      canLeave,
    };
  });

  const guardSlotsUsed = guards.length;
  treasury.guardSlotsUsed = guardSlotsUsed;
  const guardHint = `当前有 ${guardSlotsUsed}/${treasury.guardSlotsMax} 名守卫在此值守。若遭遇劫掠，值守守卫将首当其冲。`;

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const chief = resolveChiefActor(locDef, ctx.state.world.actors ?? [], ctx, playerActorId);
  let chiefActorView: ChiefActorView | undefined;
  if (chief) {
    const avatarId = getActorAvatarId(chief, ctx);
    let title = chief.title;
    if (!title) {
      const positions = buildServicePositions(locDef, ctx.state.world.actors ?? [], ctx, playerActorId);
      const pos = positions.find(p => p.occupant?.actorId === chief.actorId);
      if (pos) {
        title = pos.title;
      }
    }
    chiefActorView = {
      actorId: chief.actorId,
      displayName: chief.displayName,
      avatarId,
      level: chief.level,
      faction: chief.faction,
      title,
      personalCopperExposed: treasury.copperBalance,
    };
  }

  return {
    ...treasury,
    locationName,
    ownerFaction,
    ownerLabel,
    raidRiskHint,
    carryHint,
    guards,
    guardHint,
    chiefActor: chiefActorView,
  };
}

export async function worldLocationTreasuryGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationTreasuryView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const locationId = typeof payload.locationId === 'string' ? payload.locationId : '';
  if (!locationId) {
    throw new GameError('LOCATION_NOT_FOUND', 'Location ID is required.');
  }

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const view = buildLocationTreasuryView(ctx, treasury, locDef);

  return {
    ok: true,
    action: 'WORLD_LOCATION_TREASURY_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: view,
  };
}

export function buildEnemySnapshotFromActor(
  targetActor: WorldActor,
  seed: string,
  ctx: ActionContext
): EnemySnapshot {
  const rngSeed = (() => {
    let hash = 0;
    const key = seed + ':enemy';
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  })();
  const rng = mulberry32(rngSeed);
  
  const hpRatioBp = 8600 + Math.floor(rng() * 800); // 8600 - 9400
  const damageRatioBp = 8400 + Math.floor(rng() * 900); // 8400 - 9300
  const armorRatioBp = 7000 + Math.floor(rng() * 2000); // 7000 - 9000

  const level = targetActor.level;
  const classId = targetActor.classId;

  const attributes = { ...targetActor.combatSnapshot.attributes };
  if (targetActor.kind === 'bot' && attributes.strength === 10 && attributes.intelligence === 10 && level > 1) {
    const base = 8 + level * 2;
    attributes.strength = base;
    attributes.intelligence = base;
    attributes.agility = base;
    attributes.constitution = Math.floor(base * 0.85);
    attributes.luck = Math.floor(base * 0.45);
    const mainStat = CLASS_CONFIG[classId].mainStat;
    attributes[mainStat] = Math.floor(base * 1.25);
  }

  const hpMultiplier = CLASS_CONFIG[classId]?.hpMultiplier ?? 1.5;
  const baseHp = Math.ceil(attributes.constitution * hpMultiplier * (level + 1));

  let baseArmor = targetActor.combatSnapshot.combatStats.armor;
  if (targetActor.kind === 'bot' || baseArmor <= 10) {
    baseArmor = Math.max(10, level * 10);
  }

  let baseDamageMin = targetActor.combatSnapshot.combatStats.damageMin;
  let baseDamageMax = targetActor.combatSnapshot.combatStats.damageMax;
  if (targetActor.kind === 'bot' || (baseDamageMin === 5 && baseDamageMax === 10)) {
    baseDamageMin = Math.max(1, Math.floor(level * 2.2));
    baseDamageMax = Math.max(baseDamageMin + 1, Math.floor(level * 3.8));
  }

  const critChanceBp = Math.floor((attributes.luck * 2.5 / Math.max(1, level)) * 100);
  const dodgeChanceBp = CLASS_CONFIG[classId]?.dodgeChanceBp ?? undefined;
  
  const avatarId = getActorAvatarId(targetActor, ctx);

  return {
    enemyId: targetActor.actorId,
    name: targetActor.displayName,
    level,
    classId,
    avatarId,
    attributes: {
      strength: Math.max(1, Math.floor(attributes.strength * hpRatioBp / 10000)),
      intelligence: Math.max(1, Math.floor(attributes.intelligence * hpRatioBp / 10000)),
      agility: Math.max(1, Math.floor(attributes.agility * damageRatioBp / 10000)),
      constitution: Math.max(1, Math.floor(attributes.constitution * hpRatioBp / 10000)),
      luck: Math.max(1, Math.floor(attributes.luck * 9000 / 10000)),
    },
    combatStats: {
      hp: Math.max(8, Math.floor(baseHp * hpRatioBp / 10000)),
      armor: Math.max(0, Math.floor(baseArmor * armorRatioBp / 10000)),
      damageMin: Math.max(1, Math.floor(baseDamageMin * damageRatioBp / 10000)),
      damageMax: Math.max(2, Math.floor(baseDamageMax * damageRatioBp / 10000)),
      critChanceBp,
      dodgeChanceBp,
    },
    enemyPowerRatioBp: damageRatioBp,
  };
}

export async function worldLocationRaidStart(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationRaidStartData>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);

  const locationId = typeof payload.locationId === 'string' ? payload.locationId : '';
  if (!locationId) {
    throw new GameError('LOCATION_NOT_FOUND', 'Location ID is required.');
  }

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const positions = buildServicePositions(locDef, ctx.state.world.actors, ctx, playerActorId);
  
  // Select defender
  let defenderActor: WorldActor | undefined;
  let isGuardDutyDefender = false;

  const guardDuties = ctx.state.world.locationGuardDuties ?? [];
  const activeGuards = guardDuties.filter(
    g => g.locationId === locationId && g.status === 'active' && g.endsAt > ctx.now && g.actorId !== playerActorId
  );
  if (activeGuards.length > 0) {
    activeGuards.sort((a, b) => {
      if (b.combatRating !== a.combatRating) {
        return b.combatRating - a.combatRating;
      }
      if (b.level !== a.level) {
        return b.level - a.level;
      }
      return a.dutyId.localeCompare(b.dutyId);
    });
    const chosenGuard = activeGuards[0];
    const actor = ctx.state.world.actors.find(a => a.actorId === chosenGuard.actorId);
    if (actor) {
      defenderActor = actor;
      isGuardDutyDefender = true;
    }
  }

  if (!defenderActor) {
    for (const pos of positions) {
      if (pos.occupant && pos.occupant.actorId !== playerActorId) {
        const occupantActor = ctx.state.world.actors.find(a => a.actorId === pos.occupant.actorId);
        if (occupantActor) {
          defenderActor = occupantActor;
          break;
        }
      }
    }
  }

  if (!defenderActor) {
    const locActors = ctx.state.world.actors.filter(a => a.locationId === locationId && a.actorId !== playerActorId);
    if (locActors.length > 0) {
      defenderActor = locActors[0];
    }
  }

  if (!defenderActor) {
    const factionActors = ctx.state.world.actors.filter(a => a.faction === locDef.ownerFaction && a.actorId !== playerActorId);
    if (factionActors.length > 0) {
      defenderActor = factionActors[0];
    }
  }

  if (!defenderActor) {
    const level = locDef.unlockLevel || 1;
    const combatSnapshot = {
      level,
      classId: 'CLASS_A' as const,
      attributes: { strength: 10 + level * 2, intelligence: 10 + level * 2, agility: 10 + level * 2, constitution: Math.floor((10 + level * 2) * 0.85), luck: Math.floor((10 + level * 2) * 0.45) },
      combatStats: {
        hp: Math.ceil(Math.floor((10 + level * 2) * 0.85) * 1.5 * (level + 1)),
        armor: level * 10,
        damageMin: Math.max(1, Math.floor(level * 2.2)),
        damageMax: Math.max(2, Math.floor(level * 3.8)),
        critChanceBp: 500,
      },
      equipmentSummary: { itemPowerTotal: 0 },
    };
    defenderActor = {
      actorId: `fallback_guard_${locationId}`,
      kind: 'bot',
      displayName: `${locDef.name}守卫`,
      raceId: 'RACE_01',
      classId: 'CLASS_A',
      faction: locDef.ownerFaction,
      locationId: locationId,
      level,
      powerShare: 0,
      combatSnapshot,
    };
  }

  const raidId = `raid_${ctx.now}_${Math.floor(Math.random() * 1000000)}`;
  const playerCombat = buildPlayerCombatSnapshot(ctx.state);
  const enemySnapshot = buildEnemySnapshotFromActor(defenderActor, raidId, ctx);

  const battleResult = serverSimulateBattle({
    player: playerCombat,
    enemy: enemySnapshot,
    seed: `${raidId}:combat`,
  });

  const locationName = locDef.name;
  const ownerFaction = locDef.ownerFaction;
  const ownerLabel = FACTION_LABEL[ownerFaction] ?? ownerFaction;

  const treasuryBefore: LocationTreasuryView = buildLocationTreasuryView(ctx, treasury, locDef);

  const defenderPreview: MissionTargetActorPreview = {
    actorId: defenderActor.actorId,
    kind: defenderActor.kind as 'bot' | 'player',
    displayName: defenderActor.displayName,
    avatarId: getActorAvatarId(defenderActor, ctx),
    level: defenderActor.level,
    classId: defenderActor.classId,
    faction: defenderActor.faction,
    powerShare: defenderActor.powerShare,
    locationId: defenderActor.locationId,
    reason: isGuardDutyDefender ? '场所值班守卫' : '场所守卫',
  };

  if (!ctx.state.world.pendingRaids) {
    ctx.state.world.pendingRaids = {};
  }
  ctx.state.world.pendingRaids[raidId] = {
    raidId,
    locationId,
    playerWon: battleResult.playerWon,
    settled: false,
    createdAt: ctx.now,
    defenderActorId: defenderActor.actorId,
    defenderDisplayName: defenderActor.displayName,
    treasurySnapshot: {
      locationId,
      copperBalance: treasury.copperBalance,
      goodsValue: treasury.goodsValue,
      powerValue: treasury.powerValue,
    },
  };
  ctx.markWorldDirty?.() ?? ctx.markDirty();

  // If player lost, write a raid_failed ledger entry immediately
  if (!battleResult.playerWon) {
    const playerDisplayName = ctx.state.player.displayName || '玩家';
    const entry: OfficeLedgerEntry = {
      entryId: `ledger_${ctx.now}_raid_${raidId}`,
      createdAt: ctx.now,
      positionId: `${locationId}:missions`,
      locationId,
      service: 'missions',
      beneficiaryActorId: undefined,
      beneficiaryDisplayName: undefined,
      sourceActorId: playerActorId,
      sourceActorDisplayName: playerDisplayName,
      targetActorId: defenderActor.actorId,
      targetActorDisplayName: defenderActor.displayName,
      type: 'raid_failed',
      description: `${playerDisplayName}欲强行打劫${locationName}公账，遭遇${defenderActor.displayName}全力反击，最终败退无功而返。`,
    };
    if (!ctx.state.world.officeLedger) {
      ctx.state.world.officeLedger = [];
    }
    ctx.state.world.officeLedger.push(entry);
    if (ctx.state.world.officeLedger.length > 200) {
      ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
    }
  }

  return {
    ok: true,
    action: 'WORLD_LOCATION_RAID_START',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      raidId,
      locationId,
      locationName,
      defenderActor: defenderPreview,
      battleResult,
      canChooseOutcome: battleResult.playerWon,
      treasuryBefore,
    },
  };
}

export async function worldLocationRaidSettle(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{
  raidId: string;
  locationId: string;
  choice: 'wealth' | 'power' | 'fame';
  rewardCopper: number;
  rewardPower: number;
  rewardPrestige: number;
  treasuryAfter: LocationTreasuryView;
}>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const raidId = typeof payload.raidId === 'string' ? payload.raidId : '';
  const choice = typeof payload.choice === 'string' ? payload.choice : '';
  if (!raidId) {
    throw new GameError('RAID_NOT_FOUND', 'Raid ID is required.');
  }
  if (choice !== 'wealth' && choice !== 'power' && choice !== 'fame') {
    throw new GameError('RAID_CANNOT_SETTLE', 'Invalid choice. Must be wealth, power, or fame.');
  }

  const pendingRaids = ctx.state.world.pendingRaids ?? {};
  const pendingRaid = pendingRaids[raidId];
  if (!pendingRaid) {
    throw new GameError('RAID_NOT_FOUND', `Raid ${raidId} not found.`);
  }
  if (pendingRaid.settled) {
    throw new GameError('RAID_CANNOT_SETTLE', `Raid ${raidId} has already been settled.`);
  }
  if (!pendingRaid.playerWon) {
    throw new GameError('RAID_CANNOT_SETTLE', `Cannot settle a failed raid.`);
  }

  const locationId = pendingRaid.locationId;
  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const playerActor = ctx.state.world.actors.find(a => a.actorId === playerActorId);
  const playerDisplayName = ctx.state.player.displayName || '玩家';

  let rewardCopper = 0;
  let rewardPower = 0;
  let rewardPrestige = 0;
  let ledgerType: OfficeLedgerEntryType = 'raid_wealth';
  let taxValueDelta = 0;
  let description = '';

  if (choice === 'wealth') {
    const deductedCopper = Math.floor(treasury.copperBalance * 0.5);
    const deductedGoods = Math.floor(treasury.goodsValue * 0.5);
    treasury.copperBalance -= deductedCopper;
    treasury.goodsValue -= deductedGoods;

    const mult = getRaidCarryMultiplier(ctx.state.mount, ctx.now);
    rewardCopper = Math.floor((deductedCopper + deductedGoods) * mult);
    ctx.state.resources.copper += rewardCopper;
    
    ledgerType = 'chief_exposed_copper_change';
    taxValueDelta = -deductedCopper;
    description = `${playerDisplayName}成功劫掠${pendingRaid.defenderDisplayName}防守的${locDef.name}公账，强行夺走财货，获得铜钱 ${rewardCopper}（含坐骑负重加成），该地主官暴露铜钱折损 ${deductedCopper}。`;
  } else if (choice === 'power') {
    const deductedPower = Math.floor(treasury.powerValue * 0.5);
    treasury.powerValue -= deductedPower;

    if (playerActor) {
      const defenderActor = ctx.state.world.actors.find(a => a.actorId === pendingRaid.defenderActorId);
      if (defenderActor) {
        rewardPower = Math.min(deductedPower, defenderActor.powerShare);
        defenderActor.powerShare -= rewardPower;
        playerActor.powerShare += rewardPower;
      } else {
        const factionBots = ctx.state.world.actors.filter(a => a.kind === 'bot' && a.faction === locDef.ownerFaction && a.powerShare > deductedPower);
        if (factionBots.length > 0) {
          factionBots[0].powerShare -= deductedPower;
          playerActor.powerShare += deductedPower;
          rewardPower = deductedPower;
        }
      }
    }

    ledgerType = 'raid_power';
    const powerPct = (rewardPower / 100).toFixed(2);
    description = `${playerDisplayName}成功劫掠${pendingRaid.defenderDisplayName}防守的${locDef.name}公账，强行夺走权势，玩家在野权柄提升 ${powerPct}%。`;
  } else {
    // choice === 'fame'
    const deductedGoods = Math.floor(treasury.goodsValue * 0.3);
    treasury.goodsValue -= deductedGoods;

    rewardPrestige = locDef.unlockLevel * 5 + Math.floor(deductedGoods / 10) + 5;
    ctx.state.resources.prestige = (ctx.state.resources.prestige ?? 0) + rewardPrestige;

    ledgerType = 'raid_fame';
    description = `${playerDisplayName}成功劫掠${locDef.name}公账，不取财物，唯将缴获物资散发给城中贫苦流民，声望大涨，获得声望 ${rewardPrestige} 点。`;
  }

  // Mark as settled
  pendingRaid.settled = true;
  treasury.updatedAt = ctx.now;

  // Write to officeLedger
  const entry: OfficeLedgerEntry = {
    entryId: `ledger_${ctx.now}_raid_${raidId}`,
    createdAt: ctx.now,
    positionId: `${locationId}:missions`,
    locationId,
    service: 'missions',
    beneficiaryActorId: playerActorId,
    beneficiaryDisplayName: playerDisplayName,
    sourceActorId: playerActorId,
    sourceActorDisplayName: playerDisplayName,
    targetActorId: pendingRaid.defenderActorId,
    targetActorDisplayName: pendingRaid.defenderDisplayName,
    type: ledgerType,
    taxValueDelta,
    powerValueDelta: rewardPower,
    description,
  };

  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  ctx.state.world.officeLedger.push(entry);
  if (ctx.state.world.officeLedger.length > 200) {
    ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
  }
  ctx.markWorldDirty?.() ?? ctx.markDirty();

  const locationName = locDef.name;
  const ownerFaction = locDef.ownerFaction;
  const ownerLabel = FACTION_LABEL[ownerFaction] ?? ownerFaction;

  const treasuryAfter: LocationTreasuryView = buildLocationTreasuryView(ctx, treasury, locDef);

  return {
    ok: true,
    action: 'WORLD_LOCATION_RAID_SETTLE',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      raidId,
      locationId,
      choice,
      rewardCopper,
      rewardPower,
      rewardPrestige,
      treasuryAfter,
    },
  };
}

export async function worldLocationGuardJoin(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationTreasuryView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const locationId = typeof payload.locationId === 'string' ? payload.locationId : '';
  if (!locationId) {
    throw new GameError('LOCATION_NOT_FOUND', 'Location ID is required.');
  }

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const guardDuties = ctx.state.world.locationGuardDuties ?? [];
  const activeDuties = guardDuties.filter(g => g.locationId === locationId && g.status === 'active');

  if (activeDuties.length >= treasury.guardSlotsMax) {
    throw new GameError('LOCATION_GUARD_SLOT_FULL', `Location guard slots are full.`);
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const hasActiveDuty = activeDuties.some(g => g.actorId === playerActorId);
  if (hasActiveDuty) {
    throw new GameError('LOCATION_GUARD_ALREADY_ACTIVE', `You are already guarding this location.`);
  }

  let durationMinutes = 60;
  const durVal = typeof payload.durationMinutes === 'number' ? payload.durationMinutes : 60;
  if (durVal <= 30) {
    durationMinutes = 30;
  } else if (durVal >= 120) {
    durationMinutes = 120;
  } else {
    durationMinutes = 60;
  }

  let baseWage = 45;
  if (durationMinutes === 30) baseWage = 20;
  else if (durationMinutes === 120) baseWage = 100;

  const bonus = Math.floor(treasury.defenseRating * 0.1);
  const wageCopper = baseWage + bonus;

  const playerActor = ctx.state.world.actors.find(a => a.actorId === playerActorId);
  if (!playerActor) {
    throw new GameError('WORLD_PLAYER_ACTOR_NOT_FOUND', 'Player actor not found in world.');
  }

  const itemPowerTotal = playerActor.combatSnapshot?.equipmentSummary?.itemPowerTotal ?? 0;
  const combatRating = itemPowerTotal + playerActor.level * 10;
  const avatarId = getActorAvatarId(playerActor, ctx);

  const dutyId = `duty_${ctx.now}_${Math.floor(Math.random() * 1000000)}`;
  const startsAt = ctx.now;
  const endsAt = ctx.now + durationMinutes * 60 * 1000;

  const newDuty: LocationGuardDuty = {
    dutyId,
    locationId,
    actorId: playerActorId,
    actorDisplayName: playerActor.displayName,
    actorAvatarId: avatarId,
    actorKind: 'player',
    faction: playerActor.faction,
    level: playerActor.level,
    combatRating,
    startsAt,
    endsAt,
    wageCopper,
    status: 'active',
  };

  if (!ctx.state.world.locationGuardDuties) {
    ctx.state.world.locationGuardDuties = [];
  }
  ctx.state.world.locationGuardDuties.push(newDuty);

  // Write to ledger
  const playerDisplayName = ctx.state.player.displayName || '玩家';
  const entry: OfficeLedgerEntry = {
    entryId: `ledger_${ctx.now}_guard_join_${dutyId}`,
    createdAt: ctx.now,
    positionId: `${locationId}:missions`,
    locationId,
    service: 'missions',
    beneficiaryActorId: playerActorId,
    beneficiaryDisplayName: playerDisplayName,
    sourceActorId: playerActorId,
    sourceActorDisplayName: playerDisplayName,
    type: 'guard_join',
    description: `${playerDisplayName}在${locDef.name}应下值守，约定值守${durationMinutes}分钟，饷银 ${wageCopper} 铜钱。`,
  };

  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  ctx.state.world.officeLedger.push(entry);
  if (ctx.state.world.officeLedger.length > 200) {
    ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
  }

  ctx.markWorldDirty?.() ?? ctx.markDirty();

  const updatedViewRes = await worldLocationTreasuryGet(ctx, { locationId });
  return updatedViewRes;
}

export async function worldLocationGuardLeave(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationTreasuryView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const dutyId = typeof payload.dutyId === 'string' ? payload.dutyId : '';
  if (!dutyId) {
    throw new GameError('LOCATION_GUARD_NOT_FOUND', 'Duty ID is required.');
  }

  const guardDuties = ctx.state.world.locationGuardDuties ?? [];
  const duty = guardDuties.find(g => g.dutyId === dutyId);
  if (!duty) {
    throw new GameError('LOCATION_GUARD_NOT_FOUND', `Guard duty ${dutyId} not found.`);
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  if (duty.actorId !== playerActorId) {
    throw new GameError('LOCATION_GUARD_NOT_OWNED', 'This guard duty does not belong to you.');
  }

  if (duty.status !== 'active') {
    throw new GameError('LOCATION_GUARD_NOT_READY', 'Cannot leave a duty that is not active.');
  }

  duty.status = 'abandoned';
  ctx.markWorldDirty?.() ?? ctx.markDirty();

  const locDef = POWER_LOCATIONS.find(l => l.locationId === duty.locationId);
  const locationName = locDef?.name ?? duty.locationId;
  const playerDisplayName = ctx.state.player.displayName || '玩家';

  const entry: OfficeLedgerEntry = {
    entryId: `ledger_${ctx.now}_guard_leave_${dutyId}`,
    createdAt: ctx.now,
    positionId: `${duty.locationId}:missions`,
    locationId: duty.locationId,
    service: 'missions',
    sourceActorId: playerActorId,
    sourceActorDisplayName: playerDisplayName,
    type: 'guard_leave',
    description: `${playerDisplayName}在${locationName}值守未满时辰便擅自离岗，饷银作废。`,
  };

  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  ctx.state.world.officeLedger.push(entry);
  if (ctx.state.world.officeLedger.length > 200) {
    ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
  }

  const updatedViewRes = await worldLocationTreasuryGet(ctx, { locationId: duty.locationId });
  return updatedViewRes;
}

export async function worldLocationGuardClaim(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{
  dutyId: string;
  locationId: string;
  wageExpected: number;
  wagePaid: number;
  shortfall: number;
  treasuryAfter: LocationTreasuryView;
}>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);

  const dutyId = typeof payload.dutyId === 'string' ? payload.dutyId : '';
  if (!dutyId) {
    throw new GameError('LOCATION_GUARD_NOT_FOUND', 'Duty ID is required.');
  }

  const guardDuties = ctx.state.world.locationGuardDuties ?? [];
  const duty = guardDuties.find(g => g.dutyId === dutyId);
  if (!duty) {
    throw new GameError('LOCATION_GUARD_NOT_FOUND', `Guard duty ${dutyId} not found.`);
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  if (duty.actorId !== playerActorId) {
    throw new GameError('LOCATION_GUARD_NOT_OWNED', 'This guard duty does not belong to you.');
  }

  if (duty.status !== 'active') {
    throw new GameError('LOCATION_GUARD_NOT_READY', 'This guard duty has already been settled or abandoned.');
  }

  if (ctx.now < duty.endsAt) {
    throw new GameError('LOCATION_GUARD_NOT_READY', 'Guard duty shift has not ended yet.');
  }

  const locationId = duty.locationId;
  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const wageExpected = duty.wageCopper;
  const wagePaid = Math.max(0, Math.min(wageExpected, treasury.copperBalance));
  const shortfall = wageExpected - wagePaid;

  treasury.copperBalance -= wagePaid;
  ctx.state.resources.copper += wagePaid;
  duty.status = 'completed';

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  const locationName = locDef?.name ?? locationId;
  const playerDisplayName = ctx.state.player.displayName || '玩家';

  let description = '';
  let ledgerType: OfficeLedgerEntryType = 'guard_wage';
  if (shortfall === 0) {
    description = `${playerDisplayName}在${locationName}守满时辰，领得值守饷银 ${wagePaid} 铜钱。`;
  } else {
    ledgerType = 'guard_wage_shortfall';
    description = `${locationName}公账告罄，${playerDisplayName}守满时辰仅得饷银 ${wagePaid} 铜钱，短发 ${shortfall} 铜钱。`;
  }

  const entry: OfficeLedgerEntry = {
    entryId: `ledger_${ctx.now}_guard_claim_${dutyId}`,
    createdAt: ctx.now,
    positionId: `${locationId}:missions`,
    locationId,
    service: 'missions',
    beneficiaryActorId: playerActorId,
    beneficiaryDisplayName: playerDisplayName,
    sourceActorId: playerActorId,
    sourceActorDisplayName: playerDisplayName,
    type: ledgerType,
    taxValueDelta: -wagePaid,
    description,
  };

  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  ctx.state.world.officeLedger.push(entry);
  if (ctx.state.world.officeLedger.length > 200) {
    ctx.state.world.officeLedger = ctx.state.world.officeLedger.slice(-200);
  }

  ctx.markWorldDirty?.() ?? ctx.markDirty();

  const treasuryAfterRes = await worldLocationTreasuryGet(ctx, { locationId });
  const treasuryAfter = treasuryAfterRes.data;

  return {
    ok: true,
    action: 'WORLD_LOCATION_GUARD_CLAIM',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      dutyId,
      locationId,
      wageExpected,
      wagePaid,
      shortfall,
      treasuryAfter,
    },
  };
}

export function getWeekRange(nowMs: number): { startsAt: number; endsAt: number } {
  const d = new Date(nowMs);
  const day = d.getDay(); // 0: Sunday, 1: Monday, ... 6: Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  
  return {
    startsAt: monday.getTime(),
    endsAt: sunday.getTime(),
  };
}

export function updateOfficeTributes(ctx: ActionContext) {
  if (!ctx.state.world) return;
  if (!ctx.state.world.officeTributes) {
    ctx.state.world.officeTributes = [];
  }
  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }

  const tributes = ctx.state.world.officeTributes;
  const now = ctx.now;
  let dirty = false;

  // 1. Process expired active terms
  for (const term of tributes) {
    if (term.status === 'active' && now > term.termEndsAt) {
      dirty = true;
      if (term.paidCopper >= term.dueCopper) {
        term.status = 'passed';
        term.reviewLabel = '已足额';
        
        // Write to ledger
        const entry: OfficeLedgerEntry = {
          entryId: `ledger_tribute_passed_${term.tributeId}`,
          createdAt: now,
          positionId: term.positionId,
          locationId: term.locationId,
          service: 'evaluation',
          type: 'tribute_passed',
          description: `本期缴贡已截止，主官 ${term.officeHolderActorId} 足额缴纳 ${term.paidCopper}/${term.dueCopper}，考核评定为【已足额】。`,
        };
        ctx.state.world.officeLedger.push(entry);
      } else {
        term.status = 'failed';
        term.reviewLabel = '欠贡';
        
        // Write to ledger
        const entry: OfficeLedgerEntry = {
          entryId: `ledger_tribute_failed_${term.tributeId}`,
          createdAt: now,
          positionId: term.positionId,
          locationId: term.locationId,
          service: 'evaluation',
          type: 'tribute_failed',
          description: `本期缴贡已截止，主官 ${term.officeHolderActorId} 欠缴，实际仅缴纳 ${term.paidCopper}/${term.dueCopper}，考核评定为【欠贡】。`,
        };
        ctx.state.world.officeLedger.push(entry);
      }
    }
  }

  // 2. Generate active terms for this week
  const { startsAt, endsAt } = getWeekRange(now);
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  for (const loc of POWER_LOCATIONS) {
    if (loc.locationId === 'imperial_palace' || loc.locationId === 'player_inventory') {
      continue;
    }

    const hasActiveTerm = tributes.some(t => 
      t.locationId === loc.locationId && 
      t.status === 'active' && 
      t.termStartsAt >= startsAt && 
      t.termStartsAt <= endsAt
    );

    if (!hasActiveTerm) {
      // Find the chief actor for this location
      const chief = resolveChiefActor(loc, ctx.state.world.actors ?? [], ctx, playerActorId);
      if (!chief) continue;

      // Find primary positionId for this location: missions > shop > stamina > first position
      const positions = buildServicePositions(loc, ctx.state.world.actors ?? [], ctx, playerActorId);
      let positionId = `${loc.locationId}:missions`;
      const primarySvc = ['missions', 'shop', 'stamina'].find(svc => positions.some(p => p.service === svc));
      if (primarySvc) {
        positionId = `${loc.locationId}:${primarySvc}`;
      } else if (positions.length > 0) {
        positionId = positions[0].positionId;
      }

      const dueCopper = 1000 + loc.unlockLevel * 100;
      const tributeId = `tribute:${loc.locationId}:${startsAt}`;

      tributes.push({
        tributeId,
        positionId,
        locationId: loc.locationId,
        officeHolderActorId: chief.actorId,
        superiorActorId: 'reserved:wei_zhongxian',
        dueCopper,
        paidCopper: 0,
        termStartsAt: startsAt,
        termEndsAt: endsAt,
        status: 'active',
        reviewLabel: '本周未考',
      });
      dirty = true;
    }
  }

  if (dirty) {
    ctx.markWorldDirty?.() ?? ctx.markDirty();
  }
}

export async function worldOfficeTributeGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{ terms: OfficeTributeTerm[] }>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);
  updateOfficeTributes(ctx);

  const locationId = typeof payload.locationId === 'string' ? payload.locationId : undefined;
  const positionId = typeof payload.positionId === 'string' ? payload.positionId : undefined;
  const actorId = typeof payload.actorId === 'string' ? payload.actorId : undefined;
  const includeHistory = !!payload.includeHistory;

  let terms = ctx.state.world.officeTributes ?? [];

  if (!includeHistory) {
    terms = terms.filter(t => t.status === 'active');
  }

  if (locationId) {
    terms = terms.filter(t => t.locationId === locationId);
  }
  if (positionId) {
    terms = terms.filter(t => t.positionId === positionId);
  }
  if (actorId) {
    terms = terms.filter(t => t.officeHolderActorId === actorId);
  }

  return {
    ok: true,
    action: 'WORLD_OFFICE_TRIBUTE_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      terms,
    },
  };
}

export async function worldOfficeTributePay(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<{ term: OfficeTributeTerm; copperBefore: number; copperAfter: number }>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);
  updateOfficeTributes(ctx);

  const tributeId = typeof payload.tributeId === 'string' ? payload.tributeId : '';
  const amount = Number(payload.amountCopper);

  if (!tributeId) {
    throw new GameError('OFFICE_TRIBUTE_NOT_FOUND', 'Tribute ID is required.');
  }
  if (isNaN(amount) || amount <= 0) {
    throw new GameError('OFFICE_TRIBUTE_INVALID_AMOUNT', 'Tribute payment amount must be greater than 0.');
  }

  const tributes = ctx.state.world.officeTributes ?? [];
  const term = tributes.find(t => t.tributeId === tributeId);
  if (!term) {
    throw new GameError('OFFICE_TRIBUTE_NOT_FOUND', `Tribute term ${tributeId} not found.`);
  }

  if (term.status !== 'active') {
    throw new GameError('OFFICE_TRIBUTE_CLOSED', 'This tribute term is closed and cannot be paid.');
  }

  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  if (term.officeHolderActorId !== playerActorId) {
    throw new GameError('OFFICE_TRIBUTE_FORBIDDEN', 'You cannot pay tribute for another officer.');
  }

  const currentCopper = ctx.state.resources.copper ?? 0;
  if (currentCopper < amount) {
    throw new GameError('OFFICE_TRIBUTE_INSUFFICIENT_COPPER', 'You do not have enough copper.');
  }

  // Deduct player copper
  ctx.state.resources.copper = currentCopper - amount;
  term.paidCopper += amount;
  term.lastPaidAt = ctx.now;

  // Add to superior's location treasury (imperial_palace)
  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const palaceTreasury = treasuries.find(t => t.locationId === 'imperial_palace');
  if (palaceTreasury) {
    palaceTreasury.copperBalance += amount;
  }

  // Double ledger entry logging
  const payerEntry: OfficeLedgerEntry = {
    entryId: `ledger_tribute_pay_payer_${term.tributeId}_${ctx.now}`,
    createdAt: ctx.now,
    positionId: term.positionId,
    locationId: term.locationId,
    service: 'tribute_registry',
    sourceActorId: playerActorId,
    sourceActorDisplayName: ctx.state.player.displayName,
    targetActorId: term.superiorActorId,
    targetActorDisplayName: '魏忠贤',
    type: 'tribute_pay',
    taxValueDelta: -amount,
    description: `${ctx.state.player.displayName}本周向司礼监缴纳铜钱 ${amount}。`,
  };
  
  if (!ctx.state.world.officeLedger) {
    ctx.state.world.officeLedger = [];
  }
  const ledger = ctx.state.world.officeLedger;
  ledger.push(payerEntry);

  const receiverEntry: OfficeLedgerEntry = {
    entryId: `ledger_tribute_pay_receiver_${term.tributeId}_${ctx.now}`,
    createdAt: ctx.now,
    positionId: 'imperial_palace:promotion',
    locationId: 'imperial_palace',
    service: 'promotion',
    sourceActorId: playerActorId,
    sourceActorDisplayName: ctx.state.player.displayName,
    targetActorId: term.superiorActorId,
    targetActorDisplayName: '魏忠贤',
    type: 'tribute_pay',
    taxValueDelta: amount,
    description: `${ctx.state.player.displayName}本周向司礼监缴纳铜钱 ${amount}。`,
  };
  ledger.push(receiverEntry);

  if (ledger.length > 200) {
    ctx.state.world.officeLedger = ledger.slice(-200);
  }

  ctx.markWorldDirty?.() ?? ctx.markDirty();

  return {
    ok: true,
    action: 'WORLD_OFFICE_TRIBUTE_PAY',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: {
      term,
      copperBefore: currentCopper,
      copperAfter: ctx.state.resources.copper,
    },
  };
}

export async function worldLocationFinanceReportGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationFinanceReportView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);
  updateOfficeTributes(ctx);

  const locationId = typeof payload.locationId === 'string' ? payload.locationId : '';
  if (!locationId) {
    throw new GameError('LOCATION_NOT_FOUND', 'Location ID is required.');
  }

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Location treasury for ${locationId} not found.`);
  }

  const daysCount = typeof payload.days === 'number' ? Math.min(30, Math.max(1, payload.days)) : 7;
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;

  // Resolve chief actor
  const chief = resolveChiefActor(locDef, ctx.state.world.actors ?? [], ctx, playerActorId);
  const chiefView = chief ? {
    actorId: chief.actorId,
    displayName: chief.displayName,
    title: chief.title || (buildServicePositions(locDef, ctx.state.world.actors ?? [], ctx, playerActorId).find(p => p.occupant?.actorId === chief.actorId)?.title),
    avatarId: getActorAvatarId(chief, ctx),
  } : {
    actorId: 'unknown',
    displayName: '无',
    avatarId: 'avatar_default',
  };

  const tributes = ctx.state.world.officeTributes ?? [];
  const nextTribute = tributes.find(t => t.locationId === locationId && t.status === 'active');

  // Build daily rows using reverse balance calculations
  const daysList: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const ms = ctx.now - i * 24 * 60 * 60 * 1000;
    daysList.push(getGameDateString(ms));
  }

  const officeLedger = ctx.state.world.officeLedger ?? [];
  const sortedEntries = officeLedger
    .filter(e => e.locationId === locationId)
    .sort((a, b) => b.createdAt - a.createdAt);

  let runningBalance = treasury.copperBalance;
  const dailyRowsList = daysList.map(dk => {
    return {
      dayKey: dk,
      peakCopper: 0,
      netCopperDelta: 0,
      incomeCopper: 0,
      expenseCopper: 0,
      raidLossCopper: 0,
      guardWageCopper: 0,
      tributePaidCopper: 0,
      hasEntries: false,
    };
  });

  for (const row of dailyRowsList) {
    const dayEntries = sortedEntries.filter(e => getGameDateString(e.createdAt) === row.dayKey);
    if (dayEntries.length > 0) {
      row.hasEntries = true;
      row.peakCopper = runningBalance;
      for (const entry of dayEntries) {
        const delta = entry.taxValueDelta || 0;
        row.netCopperDelta += delta;
        if (delta > 0) {
          row.incomeCopper += delta;
        } else if (delta < 0) {
          const absDelta = Math.abs(delta);
          row.expenseCopper += absDelta;
          if (entry.type === 'chief_exposed_copper_change' || entry.type === 'raid_wealth') {
            row.raidLossCopper += absDelta;
          } else if (entry.type === 'guard_wage' || entry.type === 'guard_wage_shortfall') {
            row.guardWageCopper += absDelta;
          } else if (entry.type === 'tribute_pay') {
            row.tributePaidCopper += absDelta;
          }
        }
        runningBalance -= delta;
        row.peakCopper = Math.max(row.peakCopper, runningBalance);
      }
    } else {
      row.peakCopper = runningBalance;
    }
  }

  const report: LocationFinanceReportView = {
    locationId,
    locationName: locDef.name,
    chiefActor: chiefView,
    currentExposedCopper: treasury.copperBalance,
    nextTribute,
    dailyRows: dailyRowsList.map(({ hasEntries, ...rest }) => rest),
  };

  return {
    ok: true,
    action: 'WORLD_LOCATION_FINANCE_REPORT_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: report,
  };
}

/**
 * WORLD_LOCATION_CHIEF_DASHBOARD_GET
 * 聚合场所主官管事面板所需全部数据：主官信息、公账、进贡期、核心职位、近日账本流水及财务摘要。
 * 此接口为只读接口，前端无需再并发请求多个接口来组合面板数据。
 */
export async function worldLocationChiefDashboardGet(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): Promise<ActionSuccessResponse<LocationChiefDashboardView>> {
  ensureWorldInitialized(ctx);
  syncPlayerActor(ctx);
  triggerBotSimulationIfNeeded(ctx);
  updateOfficeTributes(ctx);

  // ── 1. 解析 locationId ──────────────────────────────────────────────────
  const locationId = typeof payload.locationId === 'string' ? payload.locationId : '';
  if (!locationId) {
    throw new GameError('LOCATION_NOT_FOUND', 'Location ID is required.');
  }

  const locDef = POWER_LOCATIONS.find(l => l.locationId === locationId);
  if (!locDef) {
    throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
  }

  const treasuries = ctx.state.world.locationTreasuries ?? [];
  const treasury = treasuries.find(t => t.locationId === locationId);
  if (!treasury) {
    throw new GameError('LOCATION_NOT_FOUND', `Treasury for ${locationId} not found.`);
  }

  // ── 2. 构建公账视图（含守卫、主官） ─────────────────────────────────────
  const treasuryView = buildLocationTreasuryView(ctx, treasury, locDef);

  // ── 3. 主官信息（必填，不允许为空） ─────────────────────────────────────
  const chiefActorView: ChiefActorView = treasuryView.chiefActor ?? {
    actorId: 'unknown',
    displayName: '暂无主官',
    avatarId: 'avatar_default',
    level: 0,
    faction: locDef.ownerFaction,
    personalCopperExposed: treasury.copperBalance,
  };

  // ── 4. 本期进贡（active） ────────────────────────────────────────────────
  const tributes = ctx.state.world.officeTributes ?? [];
  const activeTribute = tributes.find(t => t.locationId === locationId && t.status === 'active');

  // ── 5. 核心职位（最多取前 5 个主要服务职位） ──────────────────────────────
  const playerActorId = `player:${ctx.playerId || 'default-player'}`;
  const actors = ctx.state.world.actors ?? [];
  const allPositions = buildServicePositions(locDef, actors, ctx, playerActorId);
  // 按服务类型优先级排序：missions > shop > stamina > dungeon > arena > office_registry > ...
  const SERVICE_PRIORITY: PowerLocationService[] = ['missions', 'shop', 'stamina', 'dungeon', 'arena', 'office_registry', 'appointment', 'evaluation', 'tribute_registry', 'promotion', 'intel', 'estate'];
  const sortedPositions = [...allPositions].sort((a, b) => {
    const ai = SERVICE_PRIORITY.indexOf(a.service);
    const bi = SERVICE_PRIORITY.indexOf(b.service);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const topPositions = sortedPositions.slice(0, 5).map(p => ({
    positionId: p.positionId,
    title: p.title,
    service: p.service,
    status: p.status,
    occupant: {
      actorId: p.occupant.actorId,
      kind: p.occupant.kind,
      displayName: p.occupant.displayName,
      avatarId: p.occupant.avatarId,
      level: p.occupant.level,
      powerShare: p.occupant.powerShare,
    },
  }));

  // ── 6. 近日账本流水（最新 10 条） ────────────────────────────────────────
  const officeLedger = ctx.state.world.officeLedger ?? [];
  const locationLedger = officeLedger
    .filter(e => e.locationId === locationId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const recentLedger = locationLedger.slice(0, 10);

  // ── 7. 近 7 日财务摘要（日粒度，与 WORLD_LOCATION_FINANCE_REPORT_GET 同算法） ──
  const daysCount = 7;
  const daysList: string[] = [];
  for (let i = 0; i < daysCount; i++) {
    const ms = ctx.now - i * 24 * 60 * 60 * 1000;
    daysList.push(getGameDateString(ms));
  }

  const sortedForFinance = locationLedger; // already sorted desc
  const financeSummary = daysList.map(dk => {
    const dayEntries = sortedForFinance.filter(e => getGameDateString(e.createdAt) === dk);
    let netCopperDelta = 0;
    let incomeCopper = 0;
    let expenseCopper = 0;
    let raidLossCopper = 0;
    let guardWageCopper = 0;
    let tributePaidCopper = 0;

    for (const entry of dayEntries) {
      const delta = entry.taxValueDelta || 0;
      netCopperDelta += delta;
      if (delta > 0) {
        incomeCopper += delta;
      } else if (delta < 0) {
        const abs = Math.abs(delta);
        expenseCopper += abs;
        if (entry.type === 'chief_exposed_copper_change' || entry.type === 'raid_wealth') {
          raidLossCopper += abs;
        } else if (entry.type === 'guard_wage' || entry.type === 'guard_wage_shortfall') {
          guardWageCopper += abs;
        } else if (entry.type === 'tribute_pay') {
          tributePaidCopper += abs;
        }
      }
    }

    return {
      dayKey: dk,
      netCopperDelta,
      incomeCopper,
      expenseCopper,
      raidLossCopper,
      guardWageCopper,
      tributePaidCopper,
    };
  });

  // ── 8. 组装并返回 ──────────────────────────────────────────────────────
  const dashboard: LocationChiefDashboardView = {
    locationId,
    locationName: locDef.name,
    chiefActor: chiefActorView,
    treasury: treasuryView,
    activeTribute,
    topPositions,
    recentLedger,
    financeSummary,
  };

  return {
    ok: true,
    action: 'WORLD_LOCATION_CHIEF_DASHBOARD_GET',
    serverTime: ctx.now,
    stateRevision: ctx.state.meta.stateRevision,
    data: dashboard,
  };
}
