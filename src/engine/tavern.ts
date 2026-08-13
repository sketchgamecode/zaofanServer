import { CLASSIC_TAVERN_RULES } from '../config/classicTavernRules.js';
import type { ActionSuccessResponse } from '../types/action.js';
import type {
  ActiveMission,
  EnemyPreview,
  GameState,
  MissionOffer,
  MissionPowerContext,
  MissionTargetActorPreview,
  MountState,
  PowerFactionId,
  RaceId,
  VisibleReward,
  MissionIssuerActorPreview,
  WorldActor,
} from '../types/gameState.js';
import type { ActionContext } from './actionContext.js';
import { selectMissionTargetActor, POWER_LOCATIONS, buildServicePositions } from './world.js';
import { GameError } from './errors.js';
import { createSeededRandom } from '../lib/rng.js';
import { spendResource } from './resourceService.js';
import { getGameDateString } from '../lib/time.js';
import { RACE_CONFIGS } from '../config/raceConfig.js';

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
  /** 权力集团差事上下文（阶段1新增） */
  powerContext?: MissionPowerContext;
  /** 任务目标世界角色（阶段6新增） */
  targetActor?: MissionTargetActorPreview;
  // 任务发布场所来源（任务发布场所统一化 V1 新增）
  sourceLocationId?: string;
  sourceLocationName?: string;
  sourcePositionId?: string;
  issuerActorId?: string;
  issuerDisplayName?: string;
  issuerTitle?: string;
  issuerFaction?: PowerFactionId;
  // 任务发布人世界角色预览（任务发布人角色化 V1 新增）
  issuerActor?: MissionIssuerActorPreview;
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

// ---------------------------------------------------------------------------
// 权力差事模板
// ---------------------------------------------------------------------------

type PowerMissionTemplate = {
  title: string;
  locationName: string;
  caseType: MissionPowerContext['caseType'];
  /** 目标派系（牵连方） */
  targetFaction: PowerFactionId;
  /** 简短地点/背景描述 */
  contextHint: string;
};

/** 各派系作为发布方时的差事模板列表（同阵营任务） */
const FACTION_OWN_MISSION_TEMPLATES: Record<PowerFactionId, readonly PowerMissionTemplate[]> = {
  imperial: [
    { title: '密旨清查盐引账册', locationName: '户部仓廒', caseType: 'audit', targetFaction: 'silver', contextHint: '内廷密旨，查核盐引流向' },
    { title: '奉旨押解文书入京', locationName: '通惠河码头', caseType: 'escort', targetFaction: 'imperial', contextHint: '护送廷寄入京，不得有失' },
    { title: '传递御前密谕', locationName: '皇城西苑', caseType: 'petition', targetFaction: 'imperial', contextHint: '御前差事，只可你知我知' },
  ],
  noble: [
    { title: '替侯府收讨田租债账', locationName: '城东庄园', caseType: 'audit', targetFaction: 'noble', contextHint: '勋贵产业，催讨积欠租粮' },
    { title: '押运侯府秘密财货', locationName: '崇文门外', caseType: 'escort', targetFaction: 'noble', contextHint: '贵人私货，低调搬运勿声张' },
    { title: '夜探庄园驱散刁民', locationName: '侯府庄田', caseType: 'raid', targetFaction: 'noble', contextHint: '替侯爷平息庄丁闹事' },
  ],
  censorate: [
    { title: '查核贡院舞弊名册', locationName: '贡院东门', caseType: 'audit', targetFaction: 'censorate', contextHint: '科道差事，核查科考漏题' },
    { title: '递送弹劾底稿', locationName: '都察院值房', caseType: 'petition', targetFaction: 'censorate', contextHint: '清流奏折，不可落入他人之手' },
    { title: '暗中调查同僚腐行', locationName: '六科廊房', caseType: 'audit', targetFaction: 'noble', contextHint: '清查勋贵子弟捐官' },
  ],
  border: [
    { title: '押送辽饷过关', locationName: '居庸关外', caseType: 'escort', targetFaction: 'border', contextHint: '边军饷银，一分不得短少' },
    { title: '夜剿边墙马匪', locationName: '长城烽火台', caseType: 'raid', targetFaction: 'border', contextHint: '扫除边境马匪，保境安民' },
    { title: '护送军功奏报入京', locationName: '蓟镇大营', caseType: 'escort', targetFaction: 'border', contextHint: '军报入京，须经手无误' },
  ],
  silver: [
    { title: '护送盐引账本', locationName: '盐帮会馆', caseType: 'escort', targetFaction: 'silver', contextHint: '商会差事，账本安全第一' },
    { title: '追讨织造亏空', locationName: '苏州织造局', caseType: 'audit', targetFaction: 'silver', contextHint: '追回被挪用的织造款项' },
    { title: '暗中押运私盐', locationName: '运河渡口', caseType: 'smuggle', targetFaction: 'silver', contextHint: '商会生意，切勿声张' },
  ],
  underworld: [
    { title: '香会暗线递信', locationName: '旧城茶馆', caseType: 'petition', targetFaction: 'underworld', contextHint: '秘社暗信，不为外人所知' },
    { title: '替人灭口封账', locationName: '南城客栈', caseType: 'purge', targetFaction: 'underworld', contextHint: '黑道事，做完就忘' },
    { title: '走私违禁器械', locationName: '城外荒庙', caseType: 'smuggle', targetFaction: 'underworld', contextHint: '秘密搬运，天知地知' },
  ],
};

/** 皇权/中枢发布的高奖励任务（对其他阵营打压） */
const IMPERIAL_MISSION_TEMPLATES: Record<PowerFactionId, readonly PowerMissionTemplate[]> = {
  imperial: [
    { title: '奉旨拿问军功旧党', locationName: '五军都督府', caseType: 'arrest', targetFaction: 'noble', contextHint: '皇命拿问，不得有误' },
    { title: '密查清流党羽', locationName: '翰林院南门', caseType: 'audit', targetFaction: 'censorate', contextHint: '内廷指令，暗查科道结党' },
  ],
  noble: [
    { title: '奉旨追查走私盐道', locationName: '淮安盐运司', caseType: 'audit', targetFaction: 'silver', contextHint: '皇命清查，盐引流向见底' },
    { title: '宫廷密令缉拿江湖叛逆', locationName: '西城兵马司', caseType: 'arrest', targetFaction: 'underworld', contextHint: '皇命辑捕，不拘手段' },
  ],
  censorate: [
    { title: '密旨审核边军冒饷', locationName: '兵部档房', caseType: 'audit', targetFaction: 'border', contextHint: '皇命追责，查实边军虚报' },
    { title: '奉旨抄查勋贵家产', locationName: '勋贵府邸', caseType: 'raid', targetFaction: 'noble', contextHint: '内廷密旨，家产查扣' },
  ],
  border: [
    { title: '奉旨查封私通商路', locationName: '关外货栈', caseType: 'raid', targetFaction: 'silver', contextHint: '皇命封锁，商道断绝' },
    { title: '皇命清查江湖流寇据点', locationName: '城外荒村', caseType: 'purge', targetFaction: 'underworld', contextHint: '奉旨清剿，不留后患' },
  ],
  silver: [
    { title: '密旨稽查清流贪腐', locationName: '礼部库房', caseType: 'audit', targetFaction: 'censorate', contextHint: '皇命清查，科道实况' },
    { title: '奉旨抄检边军私库', locationName: '边关驿站', caseType: 'raid', targetFaction: 'border', contextHint: '皇命彻查，边军藏货一律没收' },
  ],
  underworld: [
    { title: '内廷密令除掉眼线', locationName: '城北小院', caseType: 'purge', targetFaction: 'censorate', contextHint: '秘密清除清流安插的线人' },
    { title: '皇命押送要犯', locationName: '刑部大牢', caseType: 'escort', targetFaction: 'imperial', contextHint: '奉皇命押送，不得有失' },
  ],
};

/** 跨阵营任务（发布方打压/竞争其他阵营，奖励波动，牵连最明显） */
const CROSS_FACTION_MISSION_TEMPLATES: Record<PowerFactionId, readonly PowerMissionTemplate[]> = {
  imperial: [
    { title: '截查边军私运物资', locationName: '蓟门关道', caseType: 'raid', targetFaction: 'border', contextHint: '内廷介入，截查边军走私' },
    { title: '暗中监视商会账房', locationName: '顺天商会', caseType: 'audit', targetFaction: 'silver', contextHint: '内廷耳目，暗中盯梢商会' },
  ],
  noble: [
    { title: '打压清流上疏弹劾', locationName: '通政使司', caseType: 'arrest', targetFaction: 'censorate', contextHint: '截拿弹劾奏章，消灭隐患' },
    { title: '暗中破坏盐商账册', locationName: '盐商大宅', caseType: 'raid', targetFaction: 'silver', contextHint: '勋贵打压商会，夺盐道控制' },
  ],
  censorate: [
    { title: '弹劾边军走私勾连', locationName: '蓟镇行辕', caseType: 'audit', targetFaction: 'border', contextHint: '清流弹劾，揪出边将劣迹' },
    { title: '上书揭发江湖秘社', locationName: '刑部大堂', caseType: 'petition', targetFaction: 'underworld', contextHint: '递送弹劾底稿，牵连江湖' },
  ],
  border: [
    { title: '截断商会走私通道', locationName: '关外货运道', caseType: 'raid', targetFaction: 'silver', contextHint: '边军介入，掌控走私路线' },
    { title: '打压科道监军干预', locationName: '监军行辕', caseType: 'arrest', targetFaction: 'censorate', contextHint: '清除清流监军，边军自主' },
  ],
  silver: [
    { title: '秘密渗透边军粮草供应', locationName: '蓟镇后勤营', caseType: 'smuggle', targetFaction: 'border', contextHint: '商会控粮，把持边军命脉' },
    { title: '买通勋贵打压竞争对手', locationName: '勋贵中间人', caseType: 'smuggle', targetFaction: 'noble', contextHint: '银库渗透，借刀杀人' },
  ],
  underworld: [
    { title: '暗中破坏勋贵聚会', locationName: '勋贵私宴', caseType: 'raid', targetFaction: 'noble', contextHint: '江湖介入，搅乱贵人聚会' },
    { title: '截劫清流传递的密信', locationName: '城郊驿道', caseType: 'arrest', targetFaction: 'censorate', contextHint: '秘社手段，截断清流联络' },
  ],
};

/**
 * 根据玩家 powerFaction 确定差事发布阵营，旧存档 fallback 链：
 * state.player.powerFaction → raceConfig[raceId].defaultFaction → 'imperial'
 */
function resolvePlayerFaction(state: GameState): PowerFactionId {
  if (state.player.powerFaction) {
    return state.player.powerFaction;
  }
  const raceId = state.player.raceId as RaceId;
  if (RACE_CONFIGS[raceId]?.defaultFaction) {
    return RACE_CONFIGS[raceId].defaultFaction;
  }
  return 'imperial';
}

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
          slot: rng.pick(['weapon', 'offHand', 'body'] as const),
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

const LOCATION_MISSION_TEMPLATES: Record<string, Array<{ title: string; desc: string }>> = {
  northern_bureau: [
    { title: '诏狱严审重犯', desc: '奉命前往北镇抚司诏狱，严加审讯新收押的重要案犯，获取口供。' },
    { title: '密查百官行迹', desc: '密查京中官员暗地往来，抄录其私下会面名单与密信。' },
    { title: '缉拿潜逃钦犯', desc: '根据密报，前往嫌犯藏身处进行雷霆缉拿，押解回北镇抚司。' },
    { title: '抄没违禁私财', desc: '奉旨查抄涉案府邸，将其隐匿的非法财物登记造册并予抄没。' },
  ],
  censorate: [
    { title: '巡按地方清查账册', desc: '奉都察院差遣，对地方州县的钱粮账目进行严密查账，防范贪墨。' },
    { title: '撰拟折草弹劾权贵', desc: '搜集百官不法证据，在都察院撰写弹劾奏折，纠弹不法勋贵。' },
    { title: '巡按御史微服私访', desc: '作为巡按随从密查民间疾苦与地方官绅勾结，搜集第一手证言。' },
    { title: '清查科道舞弊案', desc: '核查贡院试卷与考官往来书信，彻查科场舞弊线索。' },
  ],
  divine_engine_camp: [
    { title: '押运新型神机火器', desc: '护送神机营研制的最新火器至西郊靶场，严防中途被截。' },
    { title: '追查失窃军需火药', desc: '神机营火药库部分黑火药流失，奉命暗中追查私贩火药的内鬼。' },
    { title: '整饬军械修造工坊', desc: '监视神机营军械修造工匠，严查偷工减料与私造火器的行径。' },
  ],
  border_command: [
    { title: '查办边军粮饷克扣', desc: '九边饷银屡被克扣，前往边关都司查办冒领粮饷的贪将。' },
    { title: '追缉军户逃籍私贩', desc: '清查逃亡军户，防范其勾结塞外私贩，将其悉数捕回。' },
    { title: '平息边镇聚众械斗', desc: '边境屯军与当地豪强发生恶性械斗，代表都司前往弹压平息。' },
  ],
  refugee_camp: [
    { title: '调解街面流民纠纷', desc: '流民营附近发生地痞抢夺地盘冲突，前往平息街面纠纷。' },
    { title: '暗中跑腿打探风声', desc: '潜入流民营深处，跑腿买通眼线，打听京城各方势力的动向。' },
    { title: '盘查无帖黑户流民', desc: '配合官府在流民营周遭盘查无路引黑户，防范盗匪潜伏。' },
  ],
  bun_shop: [
    { title: '包子铺街面纠纷调解', desc: '城门包子铺前发生争执，前去调解纠纷并探听市井小道消息。' },
    { title: '包子铺接头跑腿打探', desc: '在城门包子铺与眼线接头，跑腿传递绝密市井口信。' },
    { title: '暗中盘查店铺黑户', desc: '包子铺常有行脚商人歇脚，前去暗中盘查可疑无帖人员。' },
  ],
  salt_merchant_guild: [
    { title: '核查两淮盐税账册', desc: '协助总会核对本季盐引与税银账册，清查私自漏报的税项。' },
    { title: '密查私盐夹带走私', desc: '商税重地，奉命暗查夹带走私盐货的行商，查扣无引私盐。' },
    { title: '清理商会往来违禁账目', desc: '暗中核对盐商与朝中达官显贵的往来账目，剔除隐患账册。' },
  ],
  weaving_bureau: [
    { title: '催收江南织造商税', desc: '前往江南织造局催收拖欠的贡缎与商税，核实官商勾结漏税。' },
    { title: '清查违禁私货染料', desc: '织造工坊出现大批来源不明的私货染料，前去查封并讯问来源。' },
    { title: '彻查织造内耗账目', desc: '江南织造局账目亏空严重，奉命彻查内部中饱私囊的管事。' },
  ],
};

function generateLocationBasedTitleAndDescription(
  locationId: string,
  caseType: string,
  slotIndex: number,
  _rng: ReturnType<typeof createSeededRandom>,
): { title: string; desc: string } {
  const defaultTemplates = [
    { title: '探查京城隐秘', desc: '受托前往指定地点，暗中查探可疑行径，搜集情报。' },
    { title: '护送重要人员', desc: '奉命护送该处的线人或财物前往安全地点，确保沿途安全。' },
    { title: '解决突发争端', desc: '出面调解此地发生的利益冲突或武装摩擦，平息事态。' },
  ];

  const list = LOCATION_MISSION_TEMPLATES[locationId] || defaultTemplates;
  return list[slotIndex % list.length];
}

function getActorAvatarId(actor: WorldActor, state: GameState): string {
  if (actor.kind === 'player' && state.player.avatarId) {
    return state.player.avatarId;
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

function refreshIssuerActor(
  issuerActor: MissionIssuerActorPreview | undefined,
  state: GameState,
): MissionIssuerActorPreview | undefined {
  if (!issuerActor) return undefined;
  const current = state.world?.actors?.find(a => a.actorId === issuerActor.actorId);
  if (!current) return issuerActor;

  return {
    ...issuerActor,
    displayName: current.displayName,
    avatarId: getActorAvatarId(current, state),
    level: current.level,
    faction: current.faction,
    powerShare: current.powerShare,
  };
}

export function generateMissionOffers(
  state: GameState,
  now: number,
  locationId?: string,
  servicePositionId?: string,
  issuerActorId?: string,
): MissionOffer[] {
  if (getTavernStatus(state, now) !== 'IDLE') {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate mission offers while a mission is active.');
  }

  // Clear offers if requested location is different from existing offers
  const existingOffer = state.tavern.missionOffers[0];
  if (existingOffer && existingOffer.sourceLocationId !== locationId) {
    state.tavern.missionOffers = [];
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

  // 解析玩家所属阵营（含旧存档 fallback）
  const playerFaction = resolvePlayerFaction(state);

  // 解析场所来源数据
  let loc: any = undefined;
  let sourceLocationId: string | undefined = undefined;
  let sourceLocationName: string | undefined = undefined;
  let sourcePositionId: string | undefined = undefined;
  let resolvedIssuerActorId: string | undefined = undefined;
  let issuerDisplayName: string | undefined = undefined;
  let issuerTitle: string | undefined = undefined;
  let issuerFaction: PowerFactionId | undefined = undefined;
  let issuerActor: MissionIssuerActorPreview | undefined = undefined;

  let resolvedLocId = locationId;
  if (!resolvedLocId && issuerActorId) {
    const act = state.world?.actors?.find(a => a.actorId === issuerActorId);
    if (act) {
      resolvedLocId = act.locationId;
    }
  }

  if (resolvedLocId) {
    loc = POWER_LOCATIONS.find(l => l.locationId === resolvedLocId);
    if (!loc) {
      if (locationId) {
        throw new GameError('LOCATION_NOT_FOUND', `Location ${locationId} not found.`);
      }
    }
    if (loc && !loc.services.includes('missions')) {
      if (locationId) {
        throw new GameError('LOCATION_MISSIONS_NOT_AVAILABLE', `Missions are not available at ${loc.name}.`);
      }
    }

    const actionCtx: ActionContext = {
      playerId,
      now,
      state,
      dirty: false,
      markDirty: () => {}
    };
    
    const positions = loc ? buildServicePositions(loc, state.world.actors, actionCtx, playerId) : [];
    const pos = positions.find(p => p.service === 'missions');

    let chosenActor: WorldActor | undefined = undefined;
    if (issuerActorId) {
      chosenActor = state.world.actors?.find(a => a.actorId === issuerActorId);
    }
    if (!chosenActor && pos?.occupant.actorId) {
      chosenActor = state.world.actors?.find(a => a.actorId === pos.occupant.actorId);
    }

    if (chosenActor) {
      const actorPos = positions.find(p => p.occupant.actorId === chosenActor.actorId);
      issuerActor = {
        actorId: chosenActor.actorId,
        kind: chosenActor.kind,
        displayName: chosenActor.displayName,
        avatarId: getActorAvatarId(chosenActor, state),
        level: chosenActor.level,
        faction: chosenActor.faction,
        powerShare: chosenActor.powerShare,
        title: actorPos?.title || pos?.title,
        positionId: actorPos?.positionId || pos?.positionId,
        locationId: loc?.locationId,
        locationName: loc?.name,
      };

      sourceLocationId = loc?.locationId;
      sourceLocationName = loc?.name;
      sourcePositionId = actorPos?.positionId || pos?.positionId;
      resolvedIssuerActorId = chosenActor.actorId;
      issuerDisplayName = chosenActor.displayName;
      issuerTitle = actorPos?.title || pos?.title;
      issuerFaction = loc?.ownerFaction;
    }
  } else if (issuerActorId) {
    const chosenActor = state.world.actors?.find(a => a.actorId === issuerActorId);
    if (chosenActor) {
      issuerActor = {
        actorId: chosenActor.actorId,
        kind: chosenActor.kind,
        displayName: chosenActor.displayName,
        avatarId: getActorAvatarId(chosenActor, state),
        level: chosenActor.level,
        faction: chosenActor.faction,
        powerShare: chosenActor.powerShare,
      };
      resolvedIssuerActorId = chosenActor.actorId;
      issuerDisplayName = chosenActor.displayName;
      issuerFaction = chosenActor.faction;
    }
  }

  const baseFaction: PowerFactionId = loc ? (loc.ownerFaction as PowerFactionId) : playerFaction;

  const offers: MissionOffer[] = shuffledDurations.map(({ durationMin }, slotIndex) => {
    const baseDurationSec = durationMin * 60;
    const actualDurationSec = computeActualDurationSec(baseDurationSec, mountMultiplierBp);
    const missionId = `mission_${offerSetId}_${slotIndex}`;

    // -----------------------------------------------------------------------
    // 权力差事生成：3个任务按阵营角色分配
    // slot 0: 同阵营任务（奖励普通，牵连低）
    // slot 1: 皇权/中枢任务（奖励较高，有目标阵营牵连）
    // slot 2: 跨阵营任务（奖励波动，牵连最明显）
    // -----------------------------------------------------------------------
    let powerContext: MissionPowerContext | undefined;
    let title: string;
    let locationName: string;

    if (slotIndex === 0) {
      // 同阵营任务
      const templates = FACTION_OWN_MISSION_TEMPLATES[baseFaction];
      const tmpl = rng.pick(templates);
      title = tmpl.title;
      locationName = tmpl.locationName;
      powerContext = {
        issuerFaction: baseFaction,
        targetFaction: tmpl.targetFaction,
        caseType: tmpl.caseType,
        // 同阵营任务牵连低，给目标阵营加 1-3 疑心
        suspicionDeltaPreview:
          tmpl.targetFaction !== baseFaction
            ? { [tmpl.targetFaction]: 1 }
            : undefined,
      };
    } else if (slotIndex === 1) {
      // 皇权/中枢任务
      const imperialTemplates = IMPERIAL_MISSION_TEMPLATES[baseFaction];
      const tmpl = rng.pick(imperialTemplates);
      title = tmpl.title;
      locationName = tmpl.locationName;
      powerContext = {
        issuerFaction: locationId ? baseFaction : 'imperial',
        targetFaction: tmpl.targetFaction,
        caseType: tmpl.caseType,
        // 皇权任务对目标阵营加 2-5 疑心
        suspicionDeltaPreview: { [tmpl.targetFaction]: rng.int(2, 5) },
      };
    } else {
      // 跨阵营任务
      const crossTemplates = CROSS_FACTION_MISSION_TEMPLATES[baseFaction];
      const tmpl = rng.pick(crossTemplates);
      title = tmpl.title;
      locationName = tmpl.locationName;
      powerContext = {
        issuerFaction: baseFaction,
        targetFaction: tmpl.targetFaction,
        caseType: tmpl.caseType,
        // 跨阵营任务牵连最明显：目标阵营 3-8 疑心
        suspicionDeltaPreview: { [tmpl.targetFaction]: rng.int(3, 8) },
      };
    }

    if (locationId) {
      const flavor = generateLocationBasedTitleAndDescription(locationId, powerContext.caseType, slotIndex, rng);
      title = flavor.title;
      locationName = loc.name;
    }

    let targetActor: MissionTargetActorPreview | undefined;
    if (powerContext) {
      const actionCtx: ActionContext = {
        playerId,
        now,
        state,
        dirty: false,
        markDirty: () => {}
      };
      targetActor = selectMissionTargetActor(actionCtx, powerContext.targetFaction, state.player.level, powerContext.caseType);
    }

    const description = locationId
      ? `${generateLocationBasedTitleAndDescription(locationId, powerContext!.caseType, slotIndex, rng).desc}（前往${loc.name}活动 ${durationMin} 分钟）`
      : buildMissionDescription(title, locationName, durationMin);

    return {
      offerSetId,
      missionId,
      offerSeq: nextOfferSeq,
      slotIndex: slotIndex as 0 | 1 | 2,
      title,
      description,
      locationName,
      baseDurationSec,
      actualDurationSec,
      thirstCostSec: actualDurationSec,
      visibleReward: buildVisibleReward(state.player.level, durationMin, slotIndex, offerSetId),
      enemyPreview: buildEnemyPreview(state.player.level, slotIndex, offerSetId),
      generatedAt: now,
      powerContext,
      targetActor,
      // 来源字段
      sourceLocationId,
      sourceLocationName,
      sourcePositionId,
      issuerActorId: resolvedIssuerActorId,
      issuerDisplayName,
      issuerTitle,
      issuerFaction,
      // 新增 issuerActor
      issuerActor,
    };
  });

  state.tavern.offerSeq = nextOfferSeq;
  state.tavern.missionOffers = offers;
  return offers;
}

export function buildActiveMissionView(
  activeMission: ActiveMission | null,
  now: number,
  state?: GameState,
): ActiveMissionView | null {
  if (!activeMission) {
    return null;
  }

  const refreshedIssuer = state ? refreshIssuerActor(activeMission.issuerActor, state) : activeMission.issuerActor;

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
    powerContext: activeMission.powerContext,
    targetActor: activeMission.targetActor,
    // 来源字段
    sourceLocationId: activeMission.sourceLocationId,
    sourceLocationName: activeMission.sourceLocationName,
    sourcePositionId: activeMission.sourcePositionId,
    issuerActorId: activeMission.issuerActorId,
    issuerDisplayName: activeMission.issuerDisplayName,
    issuerTitle: activeMission.issuerTitle,
    issuerFaction: activeMission.issuerFaction,
    // 新增 issuerActor
    issuerActor: refreshedIssuer,
  };
}

export function buildTavernInfoData(state: GameState, now: number): TavernInfoData {
  // 取最新一批offer的offerSetId作为NPC种子：
  // 若有活跃任务或已有offer，则使用当前offerSetId推算；
  // 若尚无offer（状态刚初始化），则npcGreeting为null。
  const currentOfferSetId = state.tavern.missionOffers[0]?.offerSetId
    ?? state.tavern.activeMission?.offerSetId
    ?? null;

  const refreshedOffers = state.tavern.missionOffers.map(offer => ({
    ...offer,
    issuerActor: refreshIssuerActor(offer.issuerActor, state),
  }));

  return {
    tavern: {
      status: getTavernStatus(state, now),
      thirstSecRemaining: state.tavern.thirstSecRemaining,
      drinksUsedToday: state.tavern.drinksUsedToday,
      firstMissionBonusAvailable: !state.tavern.firstMissionBonusClaimed,
      missionOffers: refreshedOffers,
      activeMission: buildActiveMissionView(state.tavern.activeMission, now, state),
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
  payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  const locationId = payload.locationId !== undefined ? String(payload.locationId) : undefined;
  const servicePositionId = payload.servicePositionId !== undefined ? String(payload.servicePositionId) : undefined;
  const issuerActorId = payload.issuerActorId !== undefined ? String(payload.issuerActorId) : undefined;

  if (getTavernStatus(ctx.state, ctx.now) === 'IDLE') {
    const needsRegen = ctx.state.tavern.missionOffers.length === 0 ||
                      ctx.state.tavern.missionOffers[0]?.sourceLocationId !== locationId ||
                      ctx.state.tavern.missionOffers[0]?.sourcePositionId !== servicePositionId ||
                      ctx.state.tavern.missionOffers[0]?.issuerActorId !== issuerActorId;
    if (needsRegen) {
      generateMissionOffers(ctx.state, ctx.now, locationId, servicePositionId, issuerActorId);
      ctx.markDirty();
    }
  }

  return buildTavernResponse('TAVERN_GET_INFO', ctx.state, ctx.now);
}

export function generateMissions(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<TavernInfoData> {
  if (ctx.state.tavern.activeMission !== null) {
    throw new GameError('INVALID_TAVERN_STATE', 'Cannot generate missions while a mission is active.');
  }

  const locationId = payload.locationId !== undefined ? String(payload.locationId) : undefined;
  const servicePositionId = payload.servicePositionId !== undefined ? String(payload.servicePositionId) : undefined;
  const issuerActorId = payload.issuerActorId !== undefined ? String(payload.issuerActorId) : undefined;

  const needsRegen = ctx.state.tavern.missionOffers.length === 0 ||
                    ctx.state.tavern.missionOffers[0]?.sourceLocationId !== locationId ||
                    ctx.state.tavern.missionOffers[0]?.sourcePositionId !== servicePositionId ||
                    ctx.state.tavern.missionOffers[0]?.issuerActorId !== issuerActorId;

  if (needsRegen) {
    generateMissionOffers(ctx.state, ctx.now, locationId, servicePositionId, issuerActorId);
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
