import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type {
  ActiveMission,
  EnemyPreview,
  GameState,
  MissionOffer,
  MountState,
  VisibleReward,
} from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { GameError } from './errors.js';
import { createSeededRandom } from '../lib/rng.js';
import { spendResource } from './resourceService.js';
import { getGameDateString } from '../lib/time.js';

export type TavernStatus = 'IDLE' | 'IN_PROGRESS' | 'READY_TO_COMPLETE';

export type ActiveMissionView = {
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
  remainingSec: number;
  rewardPreview: {
    xp: number;
    copper: number;
    hasEquipment: boolean;
    hasDungeonKey: boolean;
    hasHourglass: boolean;
  };
  mountSnapshot: ActiveMission['mountSnapshot'];
};

export type TavernInfoData = {
  tavern: {
    status: TavernStatus;
    thirstSecRemaining: number;
    drinksUsedToday: number;
    firstMissionBonusAvailable: boolean;
    missionOffers: MissionOffer[];
    activeMission: ActiveMissionView | null;
    npcGreeting: TavernNpcGreeting | null;
  };
  mount: {
    timeMultiplierBp: number;
    expiresAt: number | null;
    name?: string;
    tier?: string;
  };
};

export type TavernSummaryView = TavernInfoData['tavern'];

const LOCATION_NAMES = ['汴京暗巷', '盐帮码头', '西市黑铺', '旧城地窖', '关外驿道', '河道栈桥'] as const;
const MISSION_TITLES = [
  ['追踪密探', '刺探口风', '潜入账房'],
  ['截获密信', '收债清账', '护送内线'],
  ['夜探仓库', '抄录名册', '伏击耳目'],
] as const;
const ENEMY_ARCHETYPES = ['逃兵', '打手', '账房', '密探', '护卫', '地痞'] as const;

/**
 * 酒馆任务发布NPC
 * 5名NPC，每人10条对话。对话基于offerSetId种子随机选取，
 * 同一批任务总显示同一条对话，刷新后换人/换话。
 */
export type TavernNpcGreeting = {
  npcId: string;
  name: string;
  dialogue: string;
};

const TAVERN_NPCS: ReadonlyArray<{ npcId: string; name: string; dialogues: readonly string[] }> = [
  {
    npcId: 'npc_laobao',
    name: '老鲍',
    dialogues: [
      '喝完这碗，跟我走，城东有笔买卖。',
      '钱的事我包了，你只管把人摆平。',
      '上头催得急，你今晚能出发么？',
      '活做得干净点，别留把柄。',
      '放心，事成之后我不会亏待你。',
      '这条路我走熟了，你跟我走准没错。',
      '汴京的水深，外来的不懂，听我的。',
      '多余的话别问，知道得越少越安全。',
      '货在码头压着，今晚就要动。',
      '这事只有你我知道，懂吗？',
    ],
  },
  {
    npcId: 'npc_cuihua',
    name: '翠花',
    dialogues: [
      '客官，有没有兴趣听一个赚钱的故事？',
      '小女子有个不情之请，望好汉莫要推辞。',
      '那几个人每天从这条街过，就是今晚了。',
      '帮了我，这里的酒以后都不收你钱。',
      '上回托的人办砸了，这回只信你。',
      '我哥的事，还得麻烦你跑一趟。',
      '他们以为我只是个卖酒的，呵。',
      '事情不大，就是要手脚快。',
      '人没出城，你现在去还来得及。',
      '酬劳这里，你先看一眼再决定。',
    ],
  },
  {
    npcId: 'npc_daoye',
    name: '刀爷',
    dialogues: [
      '你这身手，浪费了，跟我干。',
      '三天内办完，多的不说。',
      '那票货我要了，就差个跑腿的人。',
      '出了事我兜着，放手干。',
      '没人比我更清楚这一带的底细。',
      '你上回办的那件事，我听说了，不错。',
      '不用打，把东西拿回来就行。',
      '对方就两个人，你一个人足够。',
      '这消息值三十文，你信不信？',
      '做成这笔，你在这条街上就有面子了。',
    ],
  },
  {
    npcId: 'npc_mao_jiu',
    name: '茂九',
    dialogues: [
      '哥们儿，这边坐，说个事。',
      '我有一条路子，就缺个信得过的人。',
      '不是什么大事，就是有点赶。',
      '价钱好商量，你先说个数。',
      '上头那边我打过招呼了，你直接去。',
      '这活说复杂也复杂，说简单也简单。',
      '只需要你去盯两个时辰，其他不用管。',
      '之前跑这条路的人出了意外，只好找你了。',
      '别往里头多想，当跑个腿就行。',
      '事完了你直接来找我，别和别人说。',
    ],
  },
  {
    npcId: 'npc_xue_gu',
    name: '薛姑',
    dialogues: [
      '老身有件事，年轻人怕是要跑一跑腿。',
      '那条巷子里的事，只有你能帮得上。',
      '放心，老身信人，从不欠账。',
      '我儿子办不了这事，只好求到你头上。',
      '天黑前能回来最好，回不来也无妨。',
      '那边的人认识我，你带这个去就成。',
      '此事关乎一家人的生计，还请仗义。',
      '我在这里等你，哪儿也不去。',
      '事情成了，我再请你喝一碗。',
      '老了跑不动了，只能麻烦你了。',
    ],
  },
] as const;

/**
 * 根据 offerSetId 作为随机种子，从5名NPC中稳定选取一名及其对话。
 * 同一批任务（同一offerSetId）永远返回相同的NPC和对话；
 * 下一批offer刷新后，种子改变，NPC/对话会随机更换。
 */
export function buildNpcGreeting(offerSetId: string): TavernNpcGreeting {
  const rng = createSeededRandom(`${offerSetId}:npc`);
  const npc = rng.pick(TAVERN_NPCS);
  const dialogue = rng.pick(npc.dialogues);
  return {
    npcId: npc.npcId,
    name: npc.name,
    dialogue,
  };
}

function bpMul(value: number, basisPoints: number): number {
  return Math.floor((value * basisPoints) / 10000);
}

export function getCurrentMountMultiplierBp(mount: MountState, now: number): number {
  if (mount.expiresAt !== null && now >= mount.expiresAt) {
    return CLASSIC_TAVERN_RULES.mountMultiplierBp.none;
  }

  return mount.timeMultiplierBp;
}

export function getTavernStatus(state: GameState, now: number): TavernStatus {
  const active = state.tavern.activeMission;
  if (!active) return 'IDLE';
  if (now < active.endTime) return 'IN_PROGRESS';
  return 'READY_TO_COMPLETE';
}

function getDurationMinutesForLevel(level: number): number[] {
  return CLASSIC_TAVERN_RULES.lowLevelDurationMinByLevel[level] ?? [...CLASSIC_TAVERN_RULES.defaultDurationMin];
}

export function computeActualDurationSec(baseDurationSec: number, timeMultiplierBp: number): number {
  return bpMul(baseDurationSec, timeMultiplierBp);
}

import { serverGlobalConfig } from '../config/serverGlobalConfig.js';

function buildVisibleReward(level: number, durationMin: number, slotIndex: number, seed: string): VisibleReward {
  const rewardProfiles = [
    CLASSIC_TAVERN_RULES.rewardProfileWeights.xpFocused,
    CLASSIC_TAVERN_RULES.rewardProfileWeights.balanced,
    CLASSIC_TAVERN_RULES.rewardProfileWeights.copperFocused,
  ] as const;
  const profile = rewardProfiles[slotIndex] ?? rewardProfiles[1];
  const rng = createSeededRandom(`${seed}:reward:${slotIndex}`);
  const baseXp = Math.max(8, level * durationMin * 3);
  const baseCopper = Math.max(6, level * durationMin * 2);
  const xp = Math.max(1, bpMul(baseXp, profile.xpMulBp) + rng.int(0, level * 2)) * serverGlobalConfig.debugTavernXpMultiplier;
  const copper = Math.max(1, bpMul(baseCopper, profile.copperMulBp) + rng.int(0, durationMin)) * serverGlobalConfig.debugTavernCopperMultiplier;
  const hasEquipment = rng.chanceBp(CLASSIC_TAVERN_RULES.itemDropChanceBp);

  return {
    xp,
    copper,
    hasEquipment,
    equipmentPreview: hasEquipment
      ? {
          slot: rng.pick(['head', 'body', 'hands', 'feet', 'neck', 'belt', 'ring', 'trinket', 'weapon', 'offHand'] as const),
          rarity: rng.int(0, 2) as 0 | 1 | 2,
        }
      : undefined,
    hasDungeonKey: false,
    hasHourglass: false,
  };
}

function buildEnemyPreview(level: number, slotIndex: number, seed: string): EnemyPreview {
  const rng = createSeededRandom(`${seed}:enemy:${slotIndex}`);
  return {
    enemyId: `enemy_${seed}_${slotIndex}`,
    name: rng.pick(ENEMY_ARCHETYPES),
    level: Math.max(1, level + rng.int(-1, 1)),
    archetype: rng.pick(['rogue', 'guard', 'scout', 'bruiser'] as const),
  };
}

function buildMissionDescription(title: string, locationName: string, durationMin: number): string {
  return `${title}，前往${locationName}活动 ${durationMin} 分钟。`;
}

function buildOfferSetId(playerId: string, offerSeq: number, dateStr: string): string {
  return `offer_${playerId}_${dateStr}_${offerSeq}`;
}

export function generateMissionOffers(state: GameState, now: number): MissionOffer[] {
  if (getTavernStatus(state, now) !== 'IDLE') {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate mission offers while a mission is active.');
  }

  if (state.tavern.missionOffers.length > 0) {
    return state.tavern.missionOffers;
  }

  const nextOfferSeq = state.tavern.offerSeq + 1;
  const dateStr = getGameDateString(now);
  const playerId = state.player.id ?? 'anonymous';
  const offerSetId = buildOfferSetId(playerId, nextOfferSeq, dateStr);
  const rng = createSeededRandom(`${offerSetId}:${state.player.level}`);
  const durationPool = getDurationMinutesForLevel(state.player.level);
  const shuffledDurations = [...durationPool]
    .map((durationMin, index) => ({ durationMin, order: rng.next(), index }))
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);
  const mountMultiplierBp = getCurrentMountMultiplierBp(state.mount, now);

  const offers: MissionOffer[] = shuffledDurations.map(({ durationMin }, slotIndex) => {
    const title = rng.pick(MISSION_TITLES[slotIndex] ?? MISSION_TITLES[0]);
    const locationName = rng.pick(LOCATION_NAMES);
    const baseDurationSec = durationMin * 60;
    const actualDurationSec = computeActualDurationSec(baseDurationSec, mountMultiplierBp);
    const missionId = `mission_${offerSetId}_${slotIndex}`;

    return {
      offerSetId,
      missionId,
      offerSeq: nextOfferSeq,
      slotIndex: slotIndex as 0 | 1 | 2,
      title,
      description: buildMissionDescription(title, locationName, durationMin),
      locationName,
      baseDurationSec,
      actualDurationSec,
      thirstCostSec: actualDurationSec,
      visibleReward: buildVisibleReward(state.player.level, durationMin, slotIndex, offerSetId),
      enemyPreview: buildEnemyPreview(state.player.level, slotIndex, offerSetId),
      generatedAt: now,
    };
  });

  state.tavern.offerSeq = nextOfferSeq;
  state.tavern.missionOffers = offers;
  return offers;
}

export function buildActiveMissionView(activeMission: ActiveMission | null, now: number): ActiveMissionView | null {
  if (!activeMission) {
    return null;
  }

  return {
    missionId: activeMission.missionId,
    offerSetId: activeMission.offerSetId,
    offerSeq: activeMission.offerSeq,
    slotIndex: activeMission.slotIndex,
    title: activeMission.title,
    description: activeMission.description,
    locationName: activeMission.locationName,
    startedAt: activeMission.startedAt,
    endTime: activeMission.endTime,
    baseDurationSec: activeMission.baseDurationSec,
    actualDurationSec: activeMission.actualDurationSec,
    thirstCostSec: activeMission.thirstCostSec,
    remainingSec: Math.max(0, Math.ceil((activeMission.endTime - now) / 1000)),
    rewardPreview: {
      xp: activeMission.rewardSnapshot.xp,
      copper: activeMission.rewardSnapshot.copper,
      hasEquipment: activeMission.rewardSnapshot.equipment !== null,
      hasDungeonKey: activeMission.rewardSnapshot.dungeonKey !== null,
      hasHourglass: activeMission.rewardSnapshot.hourglass > 0,
    },
    mountSnapshot: activeMission.mountSnapshot,
  };
}

export function buildTavernInfoData(state: GameState, now: number): TavernInfoData {
  // 取最新一批offer的offerSetId作为NPC种子：
  // 若有活跃任务或已有offer，则使用当前offerSetId推算；
  // 若尚无offer（状态刚初始化），则npcGreeting为null。
  const currentOfferSetId = state.tavern.missionOffers[0]?.offerSetId
    ?? state.tavern.activeMission?.offerSetId
    ?? null;

  return {
    tavern: {
      status: getTavernStatus(state, now),
      thirstSecRemaining: state.tavern.thirstSecRemaining,
      drinksUsedToday: state.tavern.drinksUsedToday,
      firstMissionBonusAvailable: !state.tavern.firstMissionBonusClaimed,
      missionOffers: state.tavern.missionOffers,
      activeMission: buildActiveMissionView(state.tavern.activeMission, now),
      npcGreeting: currentOfferSetId ? buildNpcGreeting(currentOfferSetId) : null,
    },
    mount: {
      timeMultiplierBp: getCurrentMountMultiplierBp(state.mount, now),
      expiresAt: state.mount.expiresAt,
      name: state.mount.name,
      tier: state.mount.tier,
    },
  };
}

export function buildTavernSummaryView(state: GameState, now: number): TavernSummaryView {
  return buildTavernInfoData(state, now).tavern;
}

function buildTavernResponse(action: string, state: GameState, now: number): ActionSuccessResponse<TavernInfoData> {
  return {
    ok: true,
    action,
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildTavernInfoData(state, now),
  };
}

export function getTavernInfo(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (getTavernStatus(ctx.state, ctx.now) === 'IDLE' && ctx.state.tavern.missionOffers.length === 0) {
    generateMissionOffers(ctx.state, ctx.now);
    ctx.markDirty();
  }

  return buildTavernResponse('TAVERN_GET_INFO', ctx.state, ctx.now);
}

export function generateMissions(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (ctx.state.tavern.activeMission !== null) {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate missions while a mission is active.');
  }

  if (ctx.state.tavern.missionOffers.length === 0) {
    generateMissionOffers(ctx.state, ctx.now);
    ctx.markDirty();
  }

  return buildTavernResponse('GENERATE_MISSIONS', ctx.state, ctx.now);
}

export function tavernDrink(
  ctx: ActionContext,
  _payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (ctx.state.tavern.drinksUsedToday >= CLASSIC_TAVERN_RULES.maxDrinksPerDay) {
    throw new GameError('TAVERN_DRINK_LIMIT_REACHED', 'Daily tavern drink limit reached.');
  }

  if (ctx.state.resources.tokens < 1) {
    throw new GameError('NOT_ENOUGH_TOKENS', 'Not enough tokens to buy a drink.');
  }

  spendResource(ctx.state, 'tokens', 1);
  ctx.state.tavern.thirstSecRemaining += CLASSIC_TAVERN_RULES.drinkRestoreSec;
  ctx.state.tavern.drinksUsedToday += 1;
  ctx.markDirty();

  return buildTavernResponse('TAVERN_DRINK', ctx.state, ctx.now);
}
