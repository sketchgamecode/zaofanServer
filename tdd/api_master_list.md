# ZaoFan Game Server API Master List

本文档是 ZaoFan 项目 Server 端的 API 总查询表，包含所有已实现的接口、功能说明、请求格式及返回示例。

> [!NOTE]
> 本文档由 Server Agent 维护，随项目更新而更新。便于前后端及 AI Agent 查询调用。

---

## 1. 基础信息

*   **Base URL**: `http://<server-host>:<port>` (本地开发通常为 `http://localhost:3001`)
*   **认证方式**: 
    *   大部分接口需要通过 Header 携带 Supabase Auth Token。
    *   Header 格式: `Authorization: Bearer <token>`
*   **通用响应格式**:
    *   成功: `{ ok: true, action: string, serverTime: number, stateRevision: number, data: { ... } }`
    *   失败: `{ ok: false, errorCode: string, message: string, ... }`

---

## 2. 通用接口 (General APIs)

### 2.1 健康检查
*   **Endpoint**: `GET /health`
*   **说明**: 检查服务器运行状态、版本信息及运行环境。
*   **Auth**: 不需要
*   **返回示例**:
    ```json
    {
      "status": "ok",
      "timestamp": "2026-05-04T12:00:00.000Z",
      "service": "zaofan-server",
      "env": "development",
      "releaseTag": "v1.0.0"
    }
    ```

### 2.2 读取/创建存档
*   **Endpoint**: `GET /api/save/`
*   **说明**: 加载当前玩家的存档（GameState）。如果玩家是首次登录，将自动创建一个初始化的存档。
*   **Auth**: 必须
*   **返回示例**:
    ```json
    {
      "save": { ...GameState... },
      "saveVersion": 1,
      "updatedAt": "2026-05-04T12:00:00.000Z"
    }
    ```

---

## 3. 管理员接口 (Admin APIs)

> [!IMPORTANT]
> 此类接口要求调用者具备管理员权限。

### 3.1 获取玩家列表
*   **Endpoint**: `GET /api/admin/players`
*   **Query Params**: `search` (可选，按显示名或QQ名模糊匹配)
*   **说明**: 分页获取（前50名）玩家的基础简报。

### 3.2 获取指定玩家资源
*   **Endpoint**: `GET /api/admin/players/:id/resources`
*   **说明**: 查看指定玩家的资源状态（铜钱、令牌、沙漏等）。

### 3.3 补发资源 (暂时不可用)
*   **Endpoint**: `POST /api/admin/players/:id/grant`
*   **Payload**: `{ "tokens": number, "hourglasses": number, "reason": "原因说明" }`
*   **状态**: 503 Service Unavailable (等待重构)。

---

## 4. 游戏动作接口 (Action System)

所有游戏内的逻辑交互（如升级、换装、酒馆任务）都通过一个统一的入口进行分发。

*   **Endpoint**: `POST /api/action/`
*   **Auth**: 必须
*   **请求 Body**:
    ```json
    {
      "action": "ACTION_NAME",
      "payload": { ... }
    }
    ```

### 4.1 动作列表 (Active Actions)

| 动作名 (Action) | 说明 | Payload 示例 | 返回 Data 类型 |
| :--- | :--- | :--- | :--- |
| `PLAYER_GET_INFO` | 获取详细的角色面板信息 | `{}` | `CharacterInfoView` |
| `CREATE_CHARACTER` | 首次创建角色（职业/种族/昵称/头像） | `{"nickname":"宋江","classId":"CLASS_A","raceId":"RACE_01","avatarId":"avatar_placeholder_003"}` | `CharacterInfoView` |
| `UPGRADE_ATTRIBUTE` | 消耗铜钱升级属性 | `{"attribute": "strength"}` | `CharacterInfoView` |
| `EQUIP_ITEM` | 穿戴背囊中的装备 | `{"itemId": "item_uuid"}` | `CharacterInfoView` |
| `UNEQUIP_ITEM` | 卸下已穿戴的装备 | `{"slot": "head"}` | `CharacterInfoView` |
| `TAVERN_GET_INFO` | 获取酒馆状态和任务列表 | `{"locationId?: "northern_bureau", "servicePositionId"?: "northern_bureau:missions", "issuerActorId"?: "actor_uuid"}` | `TavernInfoData` |
| `GENERATE_MISSIONS` | 强制重新生成可选任务 | `{"locationId?: "northern_bureau", "servicePositionId"?: "northern_bureau:missions", "issuerActorId"?: "actor_uuid"}` | `TavernInfoData` |
| `TAVERN_DRINK` | 消耗令牌喝啤酒（增加体力）| `{}` | `TavernInfoData` |
| `START_MISSION` | 开始一个酒馆任务 | `{"missionId": "id"}` | `TavernInfoData` |
| `COMPLETE_MISSION` | 结算当前已完成的任务 | `{}` | `CompleteMissionData` |
| `SKIP_MISSION` | 使用沙漏或令牌跳过任务等待 | `{}` | `CompleteMissionData` |
| `REFRESH_BLACKMARKET` | 刷新黑市商品（自动或消耗令牌手动刷新） | `{"force": false}` | `BlackMarketView` |
| `BUY_AND_EQUIP_ITEM` | 购买黑市商品并立即穿戴至对应槽位 | `{"itemId": "eq_xxx"}` | `BuyAndEquipView` |
| `BUY_ITEM` | 购买黑市商品并存入背囊 | `{"itemId": "eq_xxx"}` | `BuyItemView` |
| `SELL_ITEM` | 出售物品（支持背囊或身上已穿戴的物品） | `{"itemId": "eq_xxx"}` | `SellItemView` |
| `DEBUG_RESET_SAVE` | **(仅开发)** 重置存档 | `{}` | `{ "reset": true }` |

### 4.2 废弃动作 (Deprecated — 请勿新接)
调用以下动作将返回带有 `DISABLED` 状态的响应（旧 API 兼容保留，**Client Agent 应改用上方新名称**）：
`BLACK_MARKET_REFRESH` → 请改用 `REFRESH_BLACKMARKET`
`BLACK_MARKET_BUY` → 请改用 `BUY_AND_EQUIP_ITEM`

### 4.3 暂未实现的动作 (Disabled Actions)
调用以下动作将返回 `503` 或带有 `DISABLED` 状态的响应：
`GUARD_WORK_START`, `GUARD_WORK_CLAIM`.

---

## 5. 重要数据结构参考

### CharacterInfoView
角色面板完整视图，包含基础属性、总属性、升级消耗、战斗力预览、装备及背囊。

### TavernInfoData
酒馆状态：
*   `status`: `IDLE` (空闲), `IN_PROGRESS` (任务中), `READY_TO_COMPLETE` (待结算)。
*   `thirstSecRemaining`: 剩余体力（秒）。
*   `missionOffers`: 3个可选任务。
*   `activeMission`: 当前进行中的任务详情。
*   `npcGreeting`: 当前酒馆 NPC 的打招呼信息（包含名字和对话）。

### CompleteMissionData
任务结算结果：
*   `result`: `SUCCESS` (成功) 或 `FAILED` (失败)。
*   `battleResult`: `BattleResultV2`，用于战斗播放与手动保存酒馆任务回放；不再提供旧 `BattleResult.rounds`。
*   `grantedReward`: 实际获得的奖励内容。
*   `playerDelta`: 玩家资源变动前后的对比。
*   `powerResult?`: 权力结算结果（阶段1/5新增，成功时才存在）：
    ```typescript
    {
      suspicionDelta?: Partial<Record<PowerFactionId, number>>; // 本次增加的疑心
      suspicionAfter?: Partial<Record<PowerFactionId, number>>; // 结算后全量疑心
      powerTransfer?: {
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
    }
    ```
    失败时 `powerResult` 不存在，不修改 suspicion 与权柄。

### BlackMarketView
`REFRESH_BLACKMARKET` 的返回 data：
```typescript
{
  status: 'ACTIVE';
  items: EquipmentItem[];        // 兵器铺(6) + 奇珍阁(6) = 共12件，前端按 slot 类型过滤分组展示
  nextAutoRefreshMs: number;     // 距下次免费刷新的剩余毫秒数，0 表示可立即刷新
}
```

### BuyAndEquipView
`BUY_AND_EQUIP_ITEM` 的返回 data：
```typescript
{
  purchasedItemId: string;         // 已购商品 id
  copperSpent: number;             // 实际扣除的铜钱数
  unequippedItem: EquipmentItem | null; // 被替换下的旧装备（已自动入背包），无则 null
  remainingItems: EquipmentItem[]; // 购买后黑市剩余商品
  nextAutoRefreshMs: number;
}
```

### TavernNpcGreeting (NPC 招呼)
```typescript
{
  npcId: string;    // NPC 唯一标识 (如 npc_laobao, npc_cuihua)
  name: string;     // NPC 显示名字
  dialogue: string; // 随机选取的对话文本
}
```

### MissionCaseType (差事案件类型) — 阶段1新增
```typescript
type MissionCaseType =
  | 'raid'      // 突袭查抄
  | 'audit'     // 稽查账册
  | 'escort'    // 护送押运
  | 'arrest'    // 拿问捉拿
  | 'purge'     // 清洗株连
  | 'smuggle'   // 走私暗运
  | 'petition'; // 递送奏章
```

### MissionPowerContext (权力差事上下文) — 阶段1新增
```typescript
type MissionPowerContext = {
  issuerFaction: PowerFactionId;                         // 差事发布方
  targetFaction: PowerFactionId;                         // 差事目标/对手方
  caseType: MissionCaseType;                             // 案件类型
  powerDeltaPreview?: Partial<Record<PowerFactionId, number>>; // 预计权柄变化（阶段2+使用）
  suspicionDeltaPreview?: Partial<Record<PowerFactionId, number>>; // 预计疑心变化（结算时写入）
};
```

说明：
- `MissionOffer`、`ActiveMissionView` 与 `CompleteMissionData`（结算）均已扩展 `issuerActor` 属性，用以支持任务发布人角色化 V1：
  - `issuerActor?: MissionIssuerActorPreview;`（内含 `actorId`, `kind`, `displayName`, `avatarId`, `level`, `faction`, `powerShare`, `title?`, `positionId?`, `locationId?`, `locationName?`，且个人属性部分与 `world.actors` 保持实时强一致）。
  - 保留原有 7 个零散字段作为兼容字段（`sourceLocationId`, `sourceLocationName`, `sourcePositionId`, `issuerActorId`, `issuerDisplayName`, `issuerTitle`, `issuerFaction`）。
- `MissionOffer.powerContext?` 在任务列表中携带此字段。
- `MissionOffer.targetActor?` 在任务列表中携带目标角色预览。
- `ActiveMissionView.powerContext?` 在任务进行中也返回此字段。
- `ActiveMissionView.targetActor?` 在任务进行中也返回目标角色预览。
- 任务生成规则（扩展支持地点 `locationId` 模式）：
  - **常规（不传 locationId）**：基于玩家自身派系生成差事。
  - **地点（传入 locationId）**：
    - 校验地点是否支持 `missions` 服务，若不支持抛出 `LOCATION_MISSIONS_NOT_AVAILABLE` 错误。
    - 以该地点的 `ownerFaction` 代替玩家所属派系作为 `baseFaction`，解析获得该职务的任职 occupant actor 作为 `issuerActorId` 等来源字段。
    - 生成风味标题与描述，例如：北镇抚司诏狱、都察院查账等。
    - `powerContext.issuerFaction` 会设为该地点的 `ownerFaction`，确保最终结算权柄按该场所的势力参与扣减与转移。
  - **slot 0（同阵营）**：`issuerFaction = baseFaction`，牵连低（`suspicionDeltaPreview` ≤ 1）。
  - **slot 1（皇权中枢）**：`issuerFaction = baseFaction`（若有 locationId）或 `'imperial'`，奖励较高，`suspicionDeltaPreview` 2-5。
  - **slot 2（跨阵营）**：`issuerFaction = baseFaction`，牵连最明显，`suspicionDeltaPreview` 3-8。
  - 生成任务时，会根据 `MissionPowerContext.targetFaction` 从 `world.actors` 筛选出一个目标 actor 绑定至 `targetActor` 字段，一经生成即锁定，后续战斗和结算均基于该固定目标。
- 旧存档无 `powerFaction` 时，fallback 链：`raceId → RACE_CONFIGS[raceId].defaultFaction → 'imperial'`。

### DungeonChapter (副本章节) — 阶段2新增字段

`DungeonChapter` 类型新增可选字段 `powerCase`：
```typescript
interface DungeonChapter {
  id: string;
  name: string;
  unlockLevel: number;
  bosses: DungeonBoss[];
  /** 阶段2新增：权力案件包装（仅权力清洗章节存在） */
  powerCase?: {
    issuerFaction: PowerFactionId;
    targetFactions: PowerFactionId[];
    historicalHook: string;
    suspicionDeltaOnWin?: Partial<Record<PowerFactionId, number>>;
  };
}
```

### 蓝玉案内置章节 (case_lanyu_purge)

- **id**: `case_lanyu_purge`
- **name**: 蓝玉案
- **unlockLevel**: 1（新手可挑战）
- **powerCase.issuerFaction**: `imperial`
- **powerCase.targetFactions**: `['noble', 'border']`
- **powerCase.historicalHook**: 皇权清洗军功集团，查抄、拿问、追捕牺连旧部。洪武年间，蓝玉以谋反之名被诵，株连万五千人，勋贵、边将无不自危。
- **suspicionDeltaOnWin**: `{ noble: 2, border: 1 }`
- **Boss 包装**: 大明权力清洗主题（蓝党旧将、国公府亲兵、边镇粮道心腹、军功旧部、牺连供状经手人等）
```typescript
{
  id: string;           // 唯一标识，格式：eq_{slot}_{time36}_{rand16}
  name: string;         // 物品显示名称（中文）
  description: string;  // 黑色幽默风格文案
  slot: EquipmentSlot;  // 'head'|'body'|'hands'|'feet'|'neck'|'belt'|'ring'|'trinket'|'weapon'|'offHand'
  rarity: 0|1|2|3|4;   // 品质：0普通/1优秀/2史诗/3传说/4神器
  subType: 'weapon'|'shield'|'none';
  armor?: number;       // 仅 head/body/hands/feet/belt 槽位有值
  weaponDamage?: { min: number; max: number }; // 仅 weapon 槽（及高品质 offHand）有值
  price: number;        // 购买价格（铜钱）
  bonusAttributes: Partial<AttributeState>; // 各属性加成（只列出非零值）
}
```

---

## 6. 调用示例 (cURL)

**开始一个任务:**
```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "START_MISSION",
    "payload": { "missionId": "mission_offer_0" }
  }'
```

**刷新黑市 (首次 / 冷却到期):**
```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "REFRESH_BLACKMARKET", "payload": {"force": false}}'
```

**手动刷新黑市 (消耗 1 令牌):**
```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "REFRESH_BLACKMARKET", "payload": {"force": true}}'
```

**购买并穿戴装备:**
```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "BUY_AND_EQUIP_ITEM", "payload": {"itemId": "eq_weapon_abc123_ff"}}'
```

---
---

## 7. 2026-05-11 Combat / Arena / Replay API Update

### New active actions

| Action | Payload | Return data |
| :--- | :--- | :--- |
| `ARENA_GET_INFO` | `{}` | `{ arena, playerSummary }` |
| `ARENA_REFRESH_CANDIDATES` | `{}` | `{ candidateSetId, candidates }` |
| `ARENA_FIGHT` | `{ "targetPlayerId": "id", "candidateSetId": "optional" }` | `BattleResultV2`, `replayId`, honor/rank/reward deltas, cooldown, next candidates |
| `ARENA_SKIP_COOLDOWN` | `{}` | `{ cooldownEndTime: null, spent: "hourglasses" \| "tokens" }` |
| `MAIL_GET_BATTLE_REPLAYS` | `{ "limit": 50 }` | replay list items without the large `battleResult` payload |
| `MAIL_GET_BATTLE_REPLAY` | `{ "replayId": "battle_..." }` | full `BattleReplayRecord` with `BattleResultV2` |
| `MAIL_SAVE_MISSION_REPLAY` | `{}` | saves latest tavern settlement replay once; repeated calls return `alreadySaved: true` |
| `MAIL_DELETE_BATTLE_REPLAY` | `{ "replayId": "battle_..." }` | `{ deleted: true, replayId }` |
| `DUNGEON_FIGHT` | `{ "chapterId": "optional" }` | `BattleResultV2`, `replayId`, progress and reward deltas |

Hall of Fame / 英雄谱 list, search, rank-location, and player mirror detail APIs are not part of this handoff. Client work for Hall of Fame should stay as a placeholder or static entry until explicit server actions are added.

### BattleResultV2

All combat responses now use `BattleResultV2` directly. Tavern mission settlement returns `battleResult: BattleResultV2`; there is no legacy `BattleResult.rounds` compatibility contract. V2 stores frozen combatant snapshots, HP maxima/end values, per-action hit arrays, crit/block/dodge flags, armor reduction, rage multiplier, and `endedBy`.

### Replay storage

Battle replay archives are stored in the independent Supabase table `battle_replays`. Arena replays are saved automatically. Tavern mission replays are saved only through `MAIL_SAVE_MISSION_REPLAY`.

*Last Updated: 2026-05-11*

---

## 8. Client Agent Integration Contract - Combat, Arena, Dungeon, Mail Replays

This section is the authoritative short-form contract for the client agent after the 2026-05-11 combat backend update. All APIs below use the common `POST /api/action/` envelope:

```typescript
type ActionResponse<T> =
  | { ok: true; action: string; serverTime: number; stateRevision: number; data: T }
  | { ok: false; action: string; serverTime: number; stateRevision?: number; errorCode: string; message: string };
```

### 8.1 New / Updated Active Actions

| Action | Payload | Success data |
| :--- | :--- | :--- |
| `ARENA_GET_INFO` | `{}` | `ArenaGetInfoData` |
| `ARENA_REFRESH_CANDIDATES` | `{}` | `ArenaRefreshCandidatesData` |
| `ARENA_FIGHT` | `{ targetPlayerId: string; candidateSetId?: string }` | `ArenaFightData` |
| `ARENA_SKIP_COOLDOWN` | `{}` | `ArenaSkipCooldownData` |
| `DUNGEON_FIGHT` | `{ chapterId?: string }` | `DungeonFightData` |
| `MAIL_GET_BATTLE_REPLAYS` | `{ limit?: number }` | `MailBattleReplayListData` |
| `MAIL_GET_BATTLE_REPLAY` | `{ replayId: string }` | `MailBattleReplayData` |
| `MAIL_SAVE_MISSION_REPLAY` | `{}` | `MailSaveMissionReplayData` |
| `MAIL_DELETE_BATTLE_REPLAY` | `{ replayId: string }` | `MailDeleteBattleReplayData` |

### 8.2 BattleResultV2

Client combat playback must use `BattleResultV2`. Tavern mission settlement also returns `battleResult: BattleResultV2` directly.

```typescript
type PlayerClassId = 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'CLASS_E';
type BattleContext = 'MISSION' | 'ARENA' | 'DUNGEON' | 'FORTRESS_ATTACK' | 'FORTRESS_DEFENSE';

type BaseAttributeValues = {
  strength: number;
  intelligence: number;
  agility: number;
  constitution: number;
  luck: number;
};

type CombatantSnapshot = {
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

type BattleHitEvent = {
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

type BattleActionEvent = {
  actionIndex: number;
  roundNumber: number;
  attacker: 'player' | 'enemy';
  hits: BattleHitEvent[];
};

type BattleResultV2 = {
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
```

Playback notes:

- Render one `BattleActionEvent` at a time; each action can contain multiple hits.
- `CLASS_D` player/enemy actions have 2 hits.
- `CLASS_E` actions can have 1 to 15 hits.
- `damage = 0` with `wasBlocked` or `wasDodged` should show a defense event, not a normal hit.
- `CLASS_C` hits should not show block/dodge and have `armorReductionBp = 0`.
- Do not recompute combat from current save. Use `BattleResultV2.player/enemy.snapshot` for historical playback UI.

### 8.3 Tavern Mission Settlement

`COMPLETE_MISSION` and `SKIP_MISSION` return `CompleteMissionData`.

```typescript
type CompleteMissionData = {
  result: 'SUCCESS' | 'FAILED' | 'ALREADY_SETTLED';
  missionId: string;
  offerSetId: string;
  battleResult: BattleResultV2;
  canSaveReplay: boolean;
  replayId: string | null;
  rewardGranted: boolean;
  grantedReward: GrantedReward;
  playerDelta: PlayerDelta;
  nextMissionOffers: MissionOffer[];
  tavern: TavernSummaryView;
};
```

Client behavior:

- Use `battleResult` directly as `BattleResultV2`.
- Show "save replay" for tavern missions when `canSaveReplay === true`.
- Call `MAIL_SAVE_MISSION_REPLAY` after the user clicks save.
- Repeated `COMPLETE_MISSION` / `SKIP_MISSION` can return `ALREADY_SETTLED`; do not grant rewards client-side.

### 8.4 Arena APIs

```typescript
type ArenaOpponentPreview = {
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

type ArenaState = {
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

type ArenaGetInfoData = {
  arena: ArenaState;
  playerSummary: {
    honor: number;
    rank: number | null;
    dailyXpWins: number;
    maxDailyXpWins: number;
    cooldownRemainingMs: number;
  };
};

type ArenaRefreshCandidatesData = {
  candidateSetId: string | null;
  candidates: ArenaOpponentPreview[];
};

type ArenaFightData = {
  result: 'WIN' | 'LOSE';
  battleResult: BattleResultV2;
  replayId: string;
  honorDelta: number;
  honorBefore: number;
  honorAfter: number;
  rankBefore: number | null;
  rankAfter: number | null;
  rankDelta: number | null;
  grantedReward: { xp: number; copper: number };
  dailyXpWinsAfter: number;
  cooldownEndTime: number | null;
  nextCandidates: ArenaOpponentPreview[];
};

type ArenaSkipCooldownData = {
  cooldownEndTime: null;
  spent: 'hourglasses' | 'tokens';
};
```

Arena client flow:

1. Call `ARENA_GET_INFO` when opening the arena page.
2. Use `arena.candidates` if present; otherwise call `ARENA_REFRESH_CANDIDATES`.
3. On fight, send the selected `targetPlayerId` and current `candidateSetId`.
4. If success, play `data.battleResult`, show `honorDelta`, `rankDelta`, rewards, and store/open `data.replayId`.
5. If `ARENA_COOLDOWN_ACTIVE`, show cooldown UI and optionally call `ARENA_SKIP_COOLDOWN`.

Hall of Fame / 英雄谱 is intentionally out of scope for this server handoff. Do not implement real server-backed list/search/detail flows until new action contracts are added.

Arena errors:

| ErrorCode | Meaning |
| :--- | :--- |
| `ARENA_COOLDOWN_ACTIVE` | fight attempted while cooldown is active |
| `ARENA_TARGET_NOT_FOUND` | target missing or candidate set expired |
| `ARENA_SELF_TARGET` | target is current player |
| `ARENA_DISABLED` | arena system disabled |
| `INSUFFICIENT_PREMIUM_RESOURCE` | no hourglass/token to skip cooldown |

### 8.5 Dungeon API

```typescript
### DUNGEON_FIGHT
副本战斗结果：
*   `result`: `WIN` | `LOSE`
*   `chapterId`, `bossId`, `progressAfter`: 进度跟踪。
*   `battleResult`: `BattleResultV2`。
*   `grantedReward`: `{ xp, copper }`，失败时为 0。
*   `powerCase?`: 章节权力案件包装（阶段2新增，仅存在于权力案件章节）：
    ```typescript
    {
      issuerFaction: PowerFactionId;       // 案件发起方
      targetFactions: PowerFactionId[];    // 案件目标方（可多方）
      historicalHook: string;              // 史实钩子，前端展示案件背景
      suspicionDeltaOnWin?: Partial<Record<PowerFactionId, number>>; // 胜利疑心预览
    }
    ```
*   `powerResult?`: 权力结算结果（阶段2/5新增，成功且章节有 powerCase 时存在）：
    ```typescript
    {
      suspicionDelta?: Partial<Record<PowerFactionId, number>>; // 本次增加的疑心
      suspicionAfter?: Partial<Record<PowerFactionId, number>>; // 结算后全量疑心
      powerTransfer?: {
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
    }
    ```
    失败时 `powerResult` 不存在，不修改 suspicion 与权柄。
};

type DungeonChapter = {
  chapterId: string;
  powerCase?: {
    issuerFaction: PowerFactionId;
    targetFactions: PowerFactionId[];
  };
};
```

Client behavior:

- `chapterId` is optional. If omitted, server uses the first unlocked chapter it finds.
- Victory advances `progressAfter` and grants reward.
- Defeat still returns `battleResult` and `replayId`, but rewards are zero.
- Dungeon replays are auto-saved to mailbox.

### 8.6 Mail Battle Replay APIs

```typescript
type BattleReplayRecord = {
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

type BattleReplayListItem = Omit<BattleReplayRecord, 'battleResult'>;

type MailBattleReplayListData = {
  replays: BattleReplayListItem[];
};

type MailBattleReplayData = {
  replay: BattleReplayRecord;
};

type MailSaveMissionReplayData = {
  replay: BattleReplayRecord;
  alreadySaved: boolean;
};

type MailDeleteBattleReplayData = {
  deleted: true;
  replayId: string;
};
```

Replay storage rules:

- `ARENA_FIGHT`: automatically creates `BattleReplayRecord`.
- `DUNGEON_FIGHT`: automatically creates `BattleReplayRecord`.
- Tavern mission settlement: does not auto-save. Use `MAIL_SAVE_MISSION_REPLAY`.
- `MAIL_GET_BATTLE_REPLAYS` intentionally omits `battleResult` for list performance.
- Use `MAIL_GET_BATTLE_REPLAY` before opening playback from mailbox.

Replay errors:

| ErrorCode | Meaning |
| :--- | :--- |
| `BATTLE_REPLAY_NOT_FOUND` | replay does not exist or belongs to another player |
| `BATTLE_REPLAY_READ_FAILED` | backend failed to read replay storage |
| `BATTLE_REPLAY_WRITE_FAILED` | backend failed to save/delete replay |
| `MISSION_REPLAY_NOT_AVAILABLE` | no latest tavern settlement replay can be saved |

### 8.7 cURL Examples

```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"ARENA_GET_INFO","payload":{}}'
```

```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"ARENA_FIGHT","payload":{"targetPlayerId":"bot_arena_set_x_0","candidateSetId":"arena_set_x"}}'
```

```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"MAIL_GET_BATTLE_REPLAYS","payload":{"limit":50}}'
```

```bash
curl -X POST http://localhost:3001/api/action/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"MAIL_SAVE_MISSION_REPLAY","payload":{}}'
```

*Last Updated: 2026-05-11*

### 8.7 World Actor Pool (阶段 3)

### WORLD_ACTORS_GET_OVERVIEW

获取大明权力地图世界角色分布概览。用于冷启动或前端展现世界格局。
**Request Payload**: `{}`
**Response Data**:
```typescript
{
  totalActors: number; // 260
  totalPowerShare: number; // 10000
  byFaction: Array<{
    faction: PowerFactionId;
    actorCount: number;
    powerShare: number;
  }>;
  byLocation: Array<{
    locationId: string;
    name: string;
    ownerFaction: PowerFactionId;
    actorCount: number;
    powerShare: number;
  }>;
}
```

### 8.8 Capital Power Map Status (阶段 4)

### WORLD_LOCATIONS_GET_STATUS

获取京城权力地图中各个地点的状态与聚合数据。
**Request Payload**: `{}`
**Response Data**:
```typescript
{
  locations: Array<{
    locationId: string;
    name: string;
    ownerFaction: PowerFactionId;
    x: number;
    y: number;
    unlockLevel: number;
    services: Array<'missions' | 'shop' | 'dungeon' | 'arena' | 'promotion' | 'intel' | 'estate' | 'stamina'>;
    connectedLocationIds: string[];
    travelCostSecBase?: number;
    actorCount: number;
    powerShare: number;
    status: 'locked' | 'open' | 'hostile' | 'favored';
    playerRelationHint: string;
    // 旧字段，保留兼容
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
    // 新字段：场所职务系统 V1
    servicePositions: Array<{
      positionId: string;         // 格式：locationId:service，如 "northern_bureau:missions"
      locationId: string;
      title: string;              // 风味化职务头衔，如 "北镇经历司吏"
      service: PowerLocationService;
      ownerFaction: PowerFactionId;
      minLevel: number;           // 等于 location.unlockLevel
      incomeHint: string;         // 提示文案，第一版只展示，不产生实际收益
      replaceHint: string;        // 争夺提示文案
      status: 'bot_held' | 'player_held' | 'vacant' | 'locked';
      occupant: {
        actorId: string;
        kind: 'bot' | 'player';
        displayName: string;
        avatarId: string;
        faction: PowerFactionId;
        level: number;
        powerShare: number;
      };
    }>;
  }>;
}
```

**场所职务系统说明**:
- 每个地点的每个 service 对应一个 `servicePosition`。
- `positionId` 格式为 `locationId:service`。
- 任职者选择优先级：同 locationId > 同 ownerFaction > 全局兜底，同地点内不重复选用同一 actor。
- 职务标题使用定制映射表（如"北镇经历司吏"），无定制时退化为服务通用标题（如"差事承办"）。
- 第一版职务收益/争夺系统仅返回提示文案，不产生实际结算。
- 世界权柄总量始终守恒为 10000。

*Last Updated: 2026-05-27*

---

### WORLD_ACTOR_GET_DETAIL

按 `actorId` 查询任意角色详情。适用于当前玩家自身、世界角色池中的 bot 以及离线玩家 actor。

**Request Payload**:
```typescript
{ actorId: string }
```

**Response Data**:
```typescript
{
  actorId: string;
  kind: 'player' | 'bot';
  character: CharacterInfoView;  // 完全复用前端 CharacterPanel 可消费的结构
  positions: Array<{
    positionId: string;       // "locationId:service"
    locationId: string;
    locationName: string;     // 中文场所名
    title: string;            // 职务头衔
    service: PowerLocationService;
    serviceLabel: string;     // 中文服务标签（差事/商铺/副本…）
    ownerFaction: PowerFactionId;
    ownerLabel: string;       // 中文派系名（皇权内廷/勋贵集团…）
    incomeHint: string;
    replaceHint: string;
    status: 'bot_held' | 'player_held' | 'vacant' | 'locked';
  }>;
}
```

**说明**:
- 查询当前玩家自身（`player:<playerId>`）：返回完整真实 `CharacterInfoView`。
- 查询其他 player 类型 actor 或 bot：从 `combatSnapshot` 派生只读 `CharacterInfoView`，资源/背包均为 0/空。
- `positions` 通过反查全量 `servicePositions` 得到，列出该 actor 当前占据的所有职务。
- 找不到 actorId 时返回错误码 `WORLD_ACTOR_NOT_FOUND`。

**错误码**:
- `WORLD_ACTOR_NOT_FOUND`: actorId 为空或不在世界角色池中。

*Last Updated: 2026-05-27*

---

### WORLD_SERVICE_POSITIONS_GET_LIST

列出全部场所职务（皇宫黄册），支持按 `locationId` 和/或 `faction` 过滤。

**Request Payload**:
```typescript
{
  locationId?: string;        // 可选：只返回该地点的职务
  faction?: PowerFactionId;   // 可选：只返回该派系拥有地点的职务
}
```

**Response Data**:
```typescript
{
  positions: Array<{
    positionId: string;
    locationId: string;
    locationName: string;
    title: string;
    service: PowerLocationService;
    serviceLabel: string;     // 差事/商铺/副本/比武/晋升/情报/产业/补给
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
    status: 'bot_held' | 'player_held' | 'vacant' | 'locked';
  }>;
}
```

**说明**:
- 无过滤参数时返回全部 locations 的所有职务（按 POWER_LOCATIONS 顺序排列）。
- `locationId` 与 `faction` 可单独或组合使用；不匹配时返回空数组。
- 前端"皇宫黄册"页面可直接消费此接口，点击 CharacterPortraitCard 后调用 `WORLD_ACTOR_GET_DETAIL` 打开统一 CharacterPanel。

*Last Updated: 2026-05-27*
