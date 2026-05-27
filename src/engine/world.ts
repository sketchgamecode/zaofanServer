import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import type { CharacterInfoView, PlayerClassId, PowerFactionId, RaceId, WorldActor, PowerLocation, PowerLocationView, PowerLocationService, PowerLocationStatus, ServicePositionView, ServicePositionStatus, PowerTransferResult, WorldActorDetailView, ActorPositionSummary, WorldServicePositionListItem } from '../types/gameState.js';
import { RACE_CONFIGS } from '../config/raceConfig.js';
import { GameError } from './errors.js';
import { buildCharacterInfoView } from './character.js';

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
    connectedLocationIds: ['northern_bureau', 'censorate', 'noble_mansion'],
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

  if (ctx.state.world.status === 'ACTIVE' && ctx.state.world.actors.length > 0) {
    return;
  }

  // 冷启动生成 260 个 bot
  const actors: WorldActor[] = [];
  const rng = mulberry32(12345); // 固定种子保证冷启动确定性

  const ACTOR_COUNT = 260;
  const TOTAL_POWER = 10000;
  let remainingPower = TOTAL_POWER;

  for (let i = 0; i < ACTOR_COUNT; i++) {
    const faction = FACTIONS[i % FACTIONS.length];
    const locationId = LOCATIONS[i % LOCATIONS.length];
    const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)];
    const titleList = FACTION_TITLES[faction];
    const title = titleList[Math.floor(rng() * titleList.length)];

    // 分配 powerShare：前 259 个尽量平分，最后一个拿剩下的
    let powerShare = Math.floor(TOTAL_POWER / ACTOR_COUNT);
    if (i === ACTOR_COUNT - 1) {
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
  ctx.markDirty();
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
};

const REPLACE_HINT = '达到等级、派系关系和地点贡献要求后，后续可争夺此职。';

function buildServicePositions(
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
    ctx.markDirty();
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

  // Sort by powerShare descending
  targetActors.sort((a, b) => b.powerShare - a.powerShare);

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

  // 4. Increase player's powerShare by actualDeducted
  playerActor.powerShare += actualDeducted;

  // Mark state dirty
  ctx.markDirty();

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
