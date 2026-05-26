import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import type { PlayerClassId, PowerFactionId, RaceId, WorldActor } from '../types/gameState.js';

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

export async function worldActorsGetOverview(ctx: ActionContext, payload: Record<string, unknown>): Promise<ActionSuccessResponse<any>> {
  ensureWorldInitialized(ctx);

  const actors = ctx.state.world.actors;
  
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

    byFactionMap[actor.faction].actorCount++;
    byFactionMap[actor.faction].powerShare += actor.powerShare;

    if (!byLocationMap[actor.locationId]) {
      byLocationMap[actor.locationId] = { actorCount: 0, powerShare: 0 };
    }
    byLocationMap[actor.locationId].actorCount++;
    byLocationMap[actor.locationId].powerShare += actor.powerShare;
  }

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
