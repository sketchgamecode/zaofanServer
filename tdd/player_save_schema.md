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
*   `schemaVersion`: `number` - 存档数据格式版本，用于后端执行数据迁移。
*   `stateRevision`: `number` - 存档变更版本，每次保存自增。
*   `lastDailyResetDate`: `string` - 上次执行每日重置的日期 (YYYY-MM-DD)。

### 2.2 PlayerState (角色基础)
*   `level`: `number` - 玩家等级。
*   `exp`: `number` - 当前等级积累的经验值。
*   `classId`: `CLASS_A | CLASS_B | CLASS_C | CLASS_D` - 职业标识。
*   `displayName`: `string` - 玩家显示名称。

### 2.3 ResourceState (资源/货币)
*   `copper`: `number` - 铜钱（基础货币）。
*   `tokens`: `number` - 令牌（高级货币，对应 S&F 蘑菇）。
*   `hourglasses`: `number` - 沙漏（加速道具）。
*   `prestige`: `number` - 声望。

### 2.4 AttributeState (基础属性)
存储的是 **裸装基础值**。
*   `strength`, `intelligence`, `agility`, `constitution`, `luck`: `number` - 五大主属性。

### 2.5 Inventory & Equipment (物品系统)
#### EquipmentItem (物品模板)
*   `id`: `string` - 唯一标识，格式：`eq_{slot}_{time36}_{rand16}`。
*   `name`: `string` - 物品中文显示名称（如"陌刀"、"林教头的风雪毡帽"）。
*   `description`: `string` - 黑色幽默风格的文案描述（非空）。
*   `slot`: `EquipmentSlot` - 槽位（head, body, hands, feet, neck, belt, ring, trinket, weapon, offHand）。
*   `rarity`: `0-4` - 品质（0:普通, 1:优秀, 2:史诗, 3:传说, 4:神器）。
*   `subType`: `'weapon' | 'shield' | 'none'` - 物品子类型（影响 icon 与音效选择）。
*   `armor?`: `number` - 防护值（仅 head/body/hands/feet/belt 槽位存在）。
*   `weaponDamage?`: `{ min: number, max: number }` - 武器伤害区间（仅 weapon 槽及高品质 offHand 存在）。
*   `price?`: `number` - 购买价格（铜钱），后端生成时计算好，前端直接展示。
*   `bonusAttributes`: `Partial<AttributeState>` - 装备提供的属性加成（只包含非零属性）。

> [!NOTE]
> **前端图标寻址规则**（配合 `Asset_Naming_Convention.md` § 3.1）：
> - `rarity 0-1`（普通/优秀）：图标路径 = `item_{slot}_{index}.png`，`index` 由 `parseInt(id.slice(-4), 16) % N + 1` 计算（N = 该槽位的变体图标数量）。
> - `rarity 2+`（史诗/传说/神器）：图标路径 = `item_{id}.png` 直接寻址（需对应 ID 的专属美术图）。

### 2.6 TavernState (酒馆系统)
酒馆是当前最复杂的核心模块。
*   `thirstSecRemaining`: `number` - 剩余体力（秒）。
*   `drinksUsedToday`: `number` - 今日已饮酒次数（上限通常为 10）。
*   `missionOffers`: `MissionOffer[]` - 当前可选的 3 个任务详情。
*   `activeMission`: `ActiveMission | null` - 当前进行中的任务。如果为空则处于空闲状态。
*   `lastSettlement`: `MissionSettlement | null` - 上一个任务的结算快照（用于前端展示战斗结果）。

---

## 3. 关键枚举与常量值

### 职业 (PlayerClassId)
*   `CLASS_A`: 战士 (Warrior)
*   `CLASS_B`: 法师 (Mage)
*   `CLASS_C`: 射手 (Scout)
*   `CLASS_D`: 刺客 (Assassin)

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
3.  **战斗模拟**: 战斗是在后端计算的，存档中的 `battleResult.rounds` 包含了每一回合的攻击者、伤害和剩余血量，前端应根据此数组播放动画。

---
*Last Updated: 2026-05-04*
