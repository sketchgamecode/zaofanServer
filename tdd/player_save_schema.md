# ZaoFan Game 玩家存档 (GameState) 数据结构标准

本文档详细定义了 ZaoFan 项目中玩家存档（GameState）的完整结构。它是前端渲染、后端逻辑处理以及策划数值设计的核心契约。

> [!IMPORTANT]
> **存档原则**: 
> 1. 存档作为单一事实来源 (Single Source of Truth)。
> 2. `meta.stateRevision` 每次修改存档时必须自增，用于并发控制和缓存校验。
> 3. 所有时间戳统一使用 **毫秒 (ms)**，除非特别标注。
> 4. 所有比例/倍率默认使用 **万分比 (Basis Points, bp)**，例如 `5000` 代表 `50%`。

---

## 1. 顶层结构 (Root Structure)

| 字段 | 类型 | 说明 |
| :--- | :--- | :--- |
| `meta` | `MetaState` | 存档元数据（版本、时间、修订号） |
| `player` | `PlayerState` | 角色基础信息（等级、经验、职业） |
| `resources` | `ResourceState` | 玩家持有的货币和消耗品 |
| `attributes` | `AttributeState` | 五大基础属性值 |
| `inventory` | `InventoryState` | 背囊中的物品列表 |
| `equipment` | `EquipmentState` | 已穿戴的装备槽位 |
| `tavern` | `TavernState` | 酒馆系统状态（任务、体力、结算） |
| `mount` | `MountState` | 坐骑状态 |
| `blackMarket` | `BlackMarketState` | 黑市/商店状态 |
| `arena` | `ArenaState` | 竞技场状态 |
| `dungeon` | `DungeonState` | 地下城进度 |

---

## 2. 模块详述

### 2.1 MetaState (元数据)
用于存档版本控制和同步。
*   `schemaVersion`: `number` - 存档数据格式版本（当前为 **2**），用于后端执行数据迁移。
*   `stateRevision`: `number` - 存档变更版本，每次保存自增。
*   `lastDailyResetDate`: `string` - 上次执行每日重置的日期 (YYYY-MM-DD)。

### 2.2 PlayerState (角色基础)
*   `level`: `number` - 玩家等级。
*   `exp`: `number` - 当前等级积累的经验值。
*   `classId`: `PlayerClassId` - 职司标识（见 §3 枚举）。
*   `raceId`: `RaceId` - 出身标识（见 §3 枚举）。
*   `displayName?`: `string` - 玩家显示名称（创建后设置）。
*   `avatarId?`: `string` - 头像文件标识（格式 `avatar_placeholder_{000-063}`）。
*   `status`: `'PENDING_CREATION' | 'ACTIVE'` - 角色状态。新存档为 `PENDING_CREATION`，完成创建后变为 `ACTIVE`。
*   `powerFaction?`: `PowerFactionId` - 角色所属权力派系（新角色创建时按出身初始化，旧存档可为 `undefined`）。
*   `suspicion?`: `Partial<Record<PowerFactionId, number>>` - 各权力派系对玩家的疑心值（0 = 无疑心）。新角色创建时全部初始化为 `0`；旧存档可为 `undefined`，不影响现有逻辑。

### 2.3 ResourceState (资源/货币)
*   `copper`: `number` - 铜钱（基础货币）。
*   `tokens`: `number` - 令牌（高级货币，对应 S&F 蘑菇）。
*   `hourglasses`: `number` - 沙漏（加速道具）。
*   `prestige`: `number` - 声望。

### 2.4 AttributeState (基础属性)
存储的是 **裸装基础值**（含种族初始偏移）。
*   `strength`, `intelligence`, `agility`, `constitution`, `luck`: `number` - 五大主属性。
*   `bought`: `Record<AttributeKey, number>` - 玩家通过铜钱累计购买的各属性点数。用于阶梯式升级成本计算（公式见 `core_mechanics_and_formulas.md`）。

### 2.5 Inventory & Equipment (物品系统)
#### EquipmentItem (物品模板)
*   `id`: `string` - 唯一标识，格式：`eq_{slot}_{time36}_{rand16}`。
*   `name`: `string` - 物品中文显示名称（如"陌刀"、"林教头的风雪毡帽"）。
*   `description`: `string` - 黑色幽默风格的文案�#### MissionOffer 阶段1增量、阶段6增量及任务发布场所/发布人角色化 V1 字段
*   `powerContext?`: `MissionPowerContext` - 权力差事上下文（可选，阶段1新增）。
*   `targetActor?`: `MissionTargetActorPreview` - 绑定的具体世界目标角色（可选，阶段6新增）。
*   `issuerActor?`: `MissionIssuerActorPreview` - 发布任务的具体世界角色预览，其中 `actorId`, `kind`, `displayName`, `avatarId`, `level`, `faction`, `powerShare` 实时与 `world.actors` 强一致（可选，任务发布人角色化 V1 新增）。
*   以及原有 7 个零散来源字段：`sourceLocationId`, `sourceLocationName`, `sourcePositionId`, `issuerActorId`, `issuerDisplayName`, `issuerTitle`, `issuerFaction`。

#### ActiveMission 阶段1增量、阶段6增量及任务发布场所/发布人角色化 V1 字段
*   `powerContext?`: `MissionPowerContext` - 从对应 MissionOffer 携带，确保结算时不丢失。
*   `targetActor?`: `MissionTargetActorPreview` - 绑定的具体世界目标角色，从 Offer 携带以确保稳定（可选，阶段6新增）。
*   `issuerActor?`: `MissionIssuerActorPreview` - 从 Offer 携带的发布人角色预览，在返回视图时数据会与 `world.actors` 同步刷新（可选，任务发布人角色化 V1 新增）。
*   以及上述 7 个零散来源字段。

#### MissionSettlement 阶段1增量、阶段6增量及任务发布场所/发布人角色化 V1 字段
*   `powerResult?`: 结算时的权力结果（阶段1新增，成功时才存在）：
    *   `suspicionDelta`: 本次增加的疑心量。
    *   `suspicionAfter`: 结算后全量疑心。
    *   `powerTransfer`: 权柄转移详细结果（阶段5新增）。
*   `targetActor?`: `MissionTargetActorPreview` - 本次任务绑定的具体目标角色预览，成功/失败均包含（可选，阶段6新增）。
*   `issuerActor?`: `MissionIssuerActorPreview` - 从 ActiveMission 携带的发布人角色预览，成功/失败均包含，用于结算面板交差展示（可选，任务发布人角色化 V1 新增）。
*   以及上述 7 个来源字段。接寻址（需对应 ID 的专属美术图）。

### 2.6 TavernState (酒馆系统)
酒馆是当前最复杂的核心模块。
*   `thirstSecRemaining`: `number` - 剩余体力（秒）。
*   `drinksUsedToday`: `number` - 今日已饮酒次数（上限通常为 10）。
*   `missionOffers`: `MissionOffer[]` - 当前可选的 3 个任务详情。阶段1起每个 offer 含 `powerContext`，字段说明见后。
*   `activeMission`: `ActiveMission | null` - 当前进行中的任务。阶段1起含 `powerContext`，与对应 offer 一致。
*   `lastSettlement`: `MissionSettlement | null` - 上一个任务的结算快照（用于前端展示战斗结果）。

#### MissionOffer 阶段1增量、阶段6增量及任务发布场所统一化 V1 字段
*   `powerContext?`: `MissionPowerContext` - 权力差事上下文（可选，阶段1新增）。
*   `targetActor?`: `MissionTargetActorPreview` - 绑定的具体世界目标角色（可选，阶段6新增）。
*   `sourceLocationId?`: `string` - 发布场所地点 ID（可选，任务发布场所统一化 V1 新增）。
*   `sourceLocationName?`: `string` - 发布场所地点名称（可选，任务发布场所统一化 V1 新增）。
*   `sourcePositionId?`: `string` - 职务职位 ID（可选，任务发布场所统一化 V1 新增）。
*   `issuerActorId?`: `string` - 职务担任者世界角色 ID（可选，任务发布场所统一化 V1 新增）。
*   `issuerDisplayName?`: `string` - 职务担任者显示姓名（可选，任务发布场所统一化 V1 新增）。
*   `issuerTitle?`: `string` - 职务头衔名称（可选，任务发布场所统一化 V1 新增）。
*   `issuerFaction?`: `PowerFactionId` - 场所所属派系 ID（可选，任务发布场所统一化 V1 新增）。

#### ActiveMission 阶段1增量、阶段6增量及任务发布场所统一化 V1 字段
*   `powerContext?`: `MissionPowerContext` - 从对应 MissionOffer 携带，确保结算时不丢失。
*   `targetActor?`: `MissionTargetActorPreview` - 绑定的具体世界目标角色，从 Offer 携带以确保稳定（可选，阶段6新增）。
*   以及上述 7 个来源字段（从 Offer 携带，用于在任务执行和结算中透传与展示）。

#### MissionSettlement 阶段1增量、阶段6增量及任务发布场所统一化 V1 字段
*   `powerResult?`: 结算时的权力结果（阶段1新增，成功时才存在）：
    *   `suspicionDelta`: 本次增加的疑心量。
    *   `suspicionAfter`: 结算后全量疑心。
    *   `powerTransfer`: 权柄转移详细结果（阶段5新增）。
*   `targetActor?`: `MissionTargetActorPreview` - 本次任务绑定的具体目标角色预览，成功/失败均包含（可选，阶段6新增）。
*   以及上述 7 个来源字段（从 ActiveMission 携带，用于结算历史数据记录）。

---

## 3. 关键枚举与常量值

### 职业 (PlayerClassId)
遵循 `id_naming_convention.md` 抽象 ID 约定。
*   `CLASS_A`: 猛将 (Warrior) — 主属性: 力量
*   `CLASS_B`: 游侠 (Scout) — 主属性: 敏捷
*   `CLASS_C`: 谋士 (Mage) — 主属性: 智力
*   `CLASS_D`: 杀手 (Assassin) — 主属性: 敏捷
*   `CLASS_E`: 绿林好汉 (Berserker) — 主属性: 力量

### 出身 (RaceId)
遵循 `id_naming_convention.md` 抽象 ID 约定。ID 永不更改（存档兼容）。
*   `RACE_01`: 军户 — 属性修正: 0/0/0/0/0；默认派系: `border`
*   `RACE_02`: 边塞老兵 — 属性修正: -1/+2/0/-1/0；默认派系: `border`
*   `RACE_03`: 市井商贾 — 属性修正: 0/-2/-1/+2/+1；默认派系: `silver`
*   `RACE_04`: 江南牙行 — 属性修正: -2/+3/-1/-1/+1；默认派系: `silver`
*   `RACE_05`: 清流世家 — 属性修正: +1/0/-1/0/0；默认派系: `censorate`
*   `RACE_06`: 国子监生 — 属性修正: -2/+2/+1/-1/0；默认派系: `censorate`
*   `RACE_07`: 流民 — 属性修正: -2/+2/0/-1/+1；默认派系: `underworld`
*   `RACE_08`: 秘社信众 — 属性修正: +3/-1/0/+1/-3；默认派系: `underworld`

### 权力派系 (PowerFactionId)
大明体制内升迁设定中的六大权力集团，用于 `PlayerState.powerFaction` 与 `PlayerState.suspicion`。
*   `imperial` — 皇权内廷
*   `noble` — 勋贵集团
*   `censorate` — 清流科道
*   `border` — 边军武勋
*   `silver` — 工商银库
*   `underworld` — 江湖秘社

### 装备槽位 (EquipmentSlot)
`head`, `body`, `hands`, `feet`, `neck`, `belt`, `ring`, `trinket`, `weapon`, `offHand`

### 坐骑加成 (Mount Multipliers)
存储为时间缩短后的倍率（万分比）：
*   `10000`: 无坐骑 (100% 时间)
*   `9000`: 猪/马 (-10%)
*   `8000`: 猛虎 (-20%)
*   `7000`: 猛禽 (-30%)
*   `5000`: 龙/狮鹫 (-50%)

---

## 4. 逻辑计算说明 (给前端/策划 Agent)

1.  **总属性计算**: `Total = Base + EquipmentBonus + GuildBonus(如果有)`。
2.  **任务时长**: 存档中的 `actualDurationSec` 是已经应用了坐骑加成后的最终秒数。
3.  **战斗模拟**: 战斗是在后端计算的，当前唯一支持的战斗播放契约是 `BattleResultV2`。前端应根据 `battleResult.actions[].hits[]` 播放动画，不得重新计算战斗。

---
---

## 5. 2026-05-11 Combat / Arena / Replay Schema Notes

### BattleResultV2

`MissionSettlement.battleResult` stores `BattleResultV2` directly:

```typescript
type MissionSettlement = {
  missionId: string;
  offerSetId: string;
  settledAt: number;
  result: 'SUCCESS' | 'FAILED';
  rewardGranted: boolean;
  battleResult: BattleResultV2;
  canSaveReplay?: boolean;
  replayId?: string | null;
  playerDelta: PlayerDelta;
  /** 阶段1新增：权力结算结果（成功时才存在） */
  powerResult?: {
    suspicionDelta: Partial<Record<PowerFactionId, number>>;
    suspicionAfter: Partial<Record<PowerFactionId, number>>;
  };
};
```

There is no legacy `BattleResult.rounds` compatibility contract. This project follows the clean-wipe upgrade policy in `server/tdd/server_agent_common_rules.md`.

---
---

## 6. 2026-05-26 Power Faction Missions Schema Notes (阶段1)

### MissionCaseType

```typescript
type MissionCaseType =
  | 'raid'     // 突袭查抄
  | 'audit'    // 稽查账册
  | 'escort'   // 护送押运
  | 'arrest'   // 拿问捉拿
  | 'purge'    // 清洗株连
  | 'smuggle'  // 走私暗运
  | 'petition'; // 递送奏章
```

### MissionPowerContext

```typescript
type MissionPowerContext = {
  issuerFaction: PowerFactionId;  // 差事发布方
  targetFaction: PowerFactionId;  // 差事目标/对手方
  caseType: MissionCaseType;
  powerDeltaPreview?: Partial<Record<PowerFactionId, number>>; // 阶段2+使用
  suspicionDeltaPreview?: Partial<Record<PowerFactionId, number>>; // 结算时写入
};
```

`MissionOffer` and `ActiveMission` each carry an optional `powerContext?: MissionPowerContext`. On settlement success, `suspicionDeltaPreview` is applied to `state.player.suspicion`. Failure does not modify suspicion.

### Task generation rules (Phase 1)

- **slot 0 (same-faction)**: `issuerFaction = playerFaction`, low suspicion (≤ 1).
- **slot 1 (imperial)**: `issuerFaction = 'imperial'`, medium suspicion (2-5).
- **slot 2 (cross-faction)**: `issuerFaction = playerFaction`, high suspicion (3-8).
- Old saves without `powerFaction`: fallback chain `raceId → defaultFaction → 'imperial'`.
- Old saves without `suspicion`: auto-initialized to 0 for all factions on settlement.

*Last Updated: 2026-05-26*

### ArenaState

`ArenaState` now supports:

```typescript
{
  status: 'UNINITIALIZED' | 'DISABLED' | 'ACTIVE';
  honor: number;
  rank: number | null;
  dailyWins: number;      // currently mirrors daily XP wins for UI convenience
  dailyXpWins: number;
  maxDailyXpWins: number;
  fightsToday: number;
  lastDailyResetDate: string;
  cooldownEndTime: number | null;
  candidateSetId: string | null;
  candidates: ArenaOpponentPreview[];
}
```

### Replay persistence

Large historical battle replays are not embedded in `GameState`. They live in the independent `battle_replays` table as `BattleReplayRecord`. Tavern `lastSettlement` may keep the most recent replay for immediate settlement UI and manual save, but mailbox history should read from `battle_replays`.

*Last Updated: 2026-05-11*

---
---

## 7. 2026-05-26 Dungeon Power Case Schema Notes（阶段2）

### DungeonChapter 新增字段

`DungeonChapter` 新增可选字段 `powerCase`（阶段2起）：

```typescript
powerCase?: {
  issuerFaction: PowerFactionId;
  targetFactions: PowerFactionId[];
  historicalHook: string;
  suspicionDeltaOnWin?: Partial<Record<PowerFactionId, number>>;
};
```

- `powerCase` 仅在"权力清洗案件"类型章节存在，普通章节为 `undefined`。
- 胜利时 `suspicionDeltaOnWin` 写入 `state.player.suspicion`，失败不修改。
- 旧存档无 `suspicion` 字段时，自动补全六个派系为 0。

### DUNGEON_FIGHT 新增响应字段（阶段2）

- `powerCase?`: 章节权力案件包装，透传给前端。
- `powerResult?`: 权力结算结果（成功且章节有 powerCase 时存在）。

### 蓝玉案章节 (case_lanyu_purge)

| 字段 | 值 |
|------|----|
| id | case_lanyu_purge |
| name | 蓝玉案 |
| unlockLevel | 1 |
| issuerFaction | imperial |
| targetFactions | noble, border |
| suspicionDeltaOnWin | noble +2, border +1 |

Boss 10个，大明权力清洗包装，无修仙/大宋/江湖等旧词汇。

*Last Updated: 2026-05-26*

## 8. 2026-05-26 World Actor Pool (阶段 3)

### WorldState & WorldActor

新增 `GameState.world`，记录世界的 NPC 分布与权柄：

```typescript
export type WorldActor = {
  actorId: string;
  kind: 'bot' | 'player';
  displayName: string;
  raceId: RaceId;
  classId: PlayerClassId;
  faction: PowerFactionId;
  locationId: string;
  level: number;
  powerShare: number;
  combatSnapshot: PlayerCombatSnapshot;
  replacedByPlayerId?: string;
};

export type WorldState = {
  status: 'UNINITIALIZED' | 'ACTIVE';
  actors: WorldActor[];
};
```

- 地点 ID 包括：`imperial_palace`, `northern_bureau`, `divine_engine_camp`, `censorate`, `noble_mansion`, `border_command`, `salt_merchant_guild`, `weaving_bureau`, `refugee_camp`, `player_inventory`, `wine_house`, `bun_shop`, `pleasure_quarter`。
- 第一版生成 260 个 bot，六大派系和 13 个地点均有分布，`powerShare` 总和为 10000。
- 旧存档没有 `world` 对象时会自动初始化（`status: 'UNINITIALIZED'`），然后按需冷启动填充 bot。

*Last Updated: 2026-05-26*

## 9. 2026-05-27 Capital Power Map (阶段 4)

### PowerLocation & PowerLocationView

新增 `PowerLocation` 与 `PowerLocationView` 类型，用于返回权力地点网络的状态。
静态京城权力地点配置包括：
- `imperial_palace` (皇宫)
- `northern_bureau` (北镇抚司)
- `divine_engine_camp` (神机营)
- `censorate` (都察院)
- `noble_mansion` (国公府)
- `border_command` (九边都司)
- `salt_merchant_guild` (两淮盐商总会)
- `weaving_bureau` (江南织造局)
- `refugee_camp` (流民营)
- `player_inventory` (玩家随身储物空间)
- `wine_house` (京城酒楼)
- `bun_shop` (城门包子铺)
- `pleasure_quarter` (教司坊)

地点连线关系 (`connectedLocationIds`) 构成了京城权力网络。
地点的状态 (`status`) 动态计算：
- `locked`: 玩家等级不足。
- `hostile`: 玩家在地点所有派系的 suspicion 疑心值 >= 50 (未处于 locked 时，敌对状态优先级最高)。
- `favored`: 玩家所属 faction 与地点的 ownerFaction 相同 (未处于 locked/hostile 时)。
- `open`: 普通状态。

*Last Updated: 2026-05-27*

## 10. 2026-05-27 World Power Transfer (阶段 5)

### 权柄转移设计与玩家 Actor

- **玩家 Actor 同步**:
  - 系统会在世界初始化或权力结算时自动同步或在 `world.actors` 池中创建一个特殊的玩家 Actor (`actorId = player:${playerId}`)，其 `kind = 'player'`，初始 `powerShare = 0`。
  - 该玩家 Actor 会继承玩家当前最新的等级、所属阵营和战斗属性快照，并参与世界 10000 权柄额度的争夺与分配。
- **权柄守恒转移**:
  - 任务或副本胜利时，统一调用 `applyWorldPowerTransfer` 函数。
  - 普通权力任务成功结算后，根据低风险（同阵营 1 点）和高风险（跨阵营 2 点）转移规则，从目标阵营的 Bot Actor 身上扣除对应权柄并累加到玩家 Actor 上。
  - 清洗副本（蓝玉案）胜利后转移 3 点权柄。
  - 扣除时按 Bot 当前 `powerShare` 降序迭代扣除，确保任意 Bot 权柄不会被扣成负数。如果目标阵营权柄不足，则从其它阵营 Bot 备用扣除，保证权柄不凭空产生也不凭空消失，总量恒为 10000。
  - 失败时不会发生转移。

*Last Updated: 2026-05-27*

## 11. 2026-05-31 黄册实控关系 (派生视图)

### 职务实控关系说明 (controlProfile)

- **派生视图不持久化**:
  - `controlProfile`（包括人事权 `appointmentControllerLabel`、财权 `financeControllerLabel`、俸禄链 `paylineHint`、忠诚代价 `loyaltyCostHint` 等字段）是纯派生的视图数据。
  - 该属性完全由地点所属派系（`ownerFaction`）通过静态映射关系推导得出。
  - 该数据**不写入玩家存档 (player_saves)**，仅随 `WORLD_LOCATIONS_GET_STATUS` 和 `WORLD_SERVICE_POSITIONS_GET_LIST` API 渲染返回。

*Last Updated: 2026-05-31*

## 12. 2026-05-31 职位任免与考功系统 (派生视图)

### 职位KPI、控制上级及特旨强换说明 (OfficeKpiProfile / OfficeControlDetail)

- **派生视图不持久化**:
  - 职位详情中的任期与 KPI（`kpiProfile`）、控制人与拆账比（`controlDetail`）、候选任职资格诊断（`eligibility`）、以及特旨强换提示（`imperialOverrideHint`）等数据，全数由服务端通过只读规则动态派生。
  - 该属性随接口 `WORLD_SERVICE_POSITION_GET_DETAIL` 动态生成返回，**不写入持久化存档 (player_saves)**。

- **任务结算分账说明**:
  - 任务结算中的 `officeSettlement`（包括来源、受益主官、税收分账预览、权柄扣除分账等）也属于动态分账数据，不在存档中维护真实账本。

*Last Updated: 2026-05-31*

## 13. 2026-06-01 职位收益账本与 Bot 离线模拟 (阶段 V1)

### GameState.world.officeLedger & GameState.world.botSimulation

为了使官职系统表现为有油水的资产并让冷启动世界活起来，账本数据与模拟器状态设计并作为可选字段融入 `world` 对象中：

- **officeLedger**: `OfficeLedgerEntry[]`
  - 存储了全局范围内产生的收益账本流水（限制最大 200 条，防止体积无限增长）。
  - 分为 `mission_tax`, `mission_power`, `bot_tax`, `bot_power`, `shop_tax`, `stamina_tax` 和 `evaluation` 等条目类型。
- **botSimulation**: `{ lastSimulatedAt: number }`
  - 记录了上次 Bot 离线差事模拟发生的时间戳（毫秒）。
  - 若相隔上次运行时间达到 10 分钟，将自动随机并确定性模拟 3~8 个地点的离线差事，产出账本记录，并确保在北镇抚司模拟的权柄夺取事件中，扣减 Bot 权柄并加给职位主官，在全服 10000 权柄额度中守恒。

- **兼容性说明**:
  - 该改动添加为可选字段，加载无此字段的旧存档时服务端会自动在 `ensureWorldInitialized(ctx)` 时刻初始化为空结构，不会导致类型校验失败或存档损坏。

*Last Updated: 2026-06-01*

## 14. 2026-06-01 吏部任免台职位候选人与诊断 (派生视图)

### 职务候选人及评分诊断说明 (OfficeCandidateListView / ServicePositionCandidatesPreview)

- **派生视图不持久化**:
  - 候选人列表（`OfficeCandidateListView`）与详情预览（`ServicePositionCandidatesPreview`），包括评分（`score`）、评分细则（`scoreBreakdown`）、玩家诊断文案（`recommendation`）以及图谋建议（`plottingAdvice`）等数据，全数由服务端通过只读规则在 API 请求时动态派生。
  - 该属性绝**不写入物理存档 (player_saves)**，均在接口 `WORLD_SERVICE_POSITION_CANDIDATES_GET` 和 `WORLD_SERVICE_POSITION_GET_DETAIL` 触发时按需动态计算并返回。

*Last Updated: 2026-06-01*
