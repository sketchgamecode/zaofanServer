# ZaoFan Game 核心机制与数值公式手册

本文档定义了游戏内的核心战斗、成长及资源计算公式。前后端逻辑必须严格遵守此公式，以保证数值的一致性。

> [!IMPORTANT]
> 战斗系统的完整 server/client 实现规格见 `docs/design/04_system_specs/Combat_System_Spec_V1.md`。本文保留核心公式速查；当需要实现回合流程、职业特性、回放字段和竞技场接入时，以该规格为准。

---

## 1. 角色属性与生存 (Attributes & Survival)

### 1.1 最大生命值 (Max HP)
$$MaxHP = Constitution \times ClassHPMultiplier \times (Level + 1)$$

*注：Constitution 是包含装备加成后的总属性值。*

| 职业 (ClassId) | 职业名 | 生命倍率 (HPMultiplier) |
| :--- | :--- | :--- |
| `CLASS_A` | 猛将 (Warrior) | 5 |
| `CLASS_B` | 游侠 (Scout) | 4 |
| `CLASS_C` | 谋士 (Mage) | 2 |
| `CLASS_D` | 杀手 (Assassin) | 4 |
| `CLASS_E` | 绿林好汉 (Berserker) | 4 |

### 1.2 暴击率 (Crit Chance)
$$CritChance = \min(50\%, \frac{Luck \times 2.5}{EnemyLevel \times 100})$$
*注：暴击倍率首版采用 S&F 基础值 **2.0倍**。旧 placeholder 中的 1.75 倍需要替换。*

### 1.3 闪避率 (Dodge Chance)
*仅游侠 (CLASS_B) 拥有 50% 基础闪避率。*

---

## 2. 攻击与伤害 (Combat & Damage)

### 2.1 职业主属性 (Main Stat)
| 职业 | 主属性 | 武器系数 |
| :--- | :--- | :--- |
| 猛将 (CLASS_A) | 力量 (`strength`) | 2.0 |
| 游侠 (CLASS_B) | 敏捷 (`agility`) | 2.5 |
| 谋士 (CLASS_C) | 智力 (`intelligence`) | 4.5 |
| 杀手 (CLASS_D) | 敏捷 (`agility`) | 2.0 |
| 绿林好汉 (CLASS_E) | 力量 (`strength`) | 2.0 |

### 2.2 基础伤害加成 (AttrFactor)
$$AttrFactor = 1 + \frac{\max(\frac{OwnMainStat}{2}, OwnMainStat - \frac{EnemyMainStat}{2})}{10}$$
*设计意义：自身主属性越高伤害越高；提升副属性可抵消敌方主属性加成，减免受到伤害。*

### 2.3 护甲减伤 (Armor Reduction)
$$ArmorReduction\% = \min(ClassMaxReduction, \frac{ArmorValue}{AttackerLevel})$$

*注：`ArmorValue / AttackerLevel` 的结果按百分比理解。例如护甲 1500、攻击方等级 50 时为 30% 减伤。最终伤害使用 `(1 - ArmorReduction)`。*

| 职业 | 护甲上限系数 (ClassArmorCap) | 最大减伤% |
| :--- | :--- | :--- |
| 猛将 | 50 | 50% |
| 游侠 / 杀手 | 25 | 25% |
| 谋士 | 10 | 10% |
| 绿林好汉 | 25 | 25%（护甲值参与计算前额外减半） |

*注：谋士攻击绕过护甲减伤且必中（无视格挡和闪避）。*

### 2.4 职业战斗特性 (Class Combat Traits)
| 职业 | 特殊能力 | 数值 |
| :--- | :--- | :--- |
| 猛将 | 盾牌格挡 | 25% 格挡率 |
| 游侠 | 闪避 | 50% 闪避率 |
| 谋士 | 绕甲必中 | 攻击无视护甲、格挡、闪避 |
| 杀手 | 双持连击 | 每回合 2 次攻击（单次 0.625 倍率） |
| 绿林好汉 | 嗜血连击 | 50% 概率追加攻击，单次行动最多 15 次；护甲减半 |

### 2.5 怒气倍率 (Rage Multiplier)
$$RageMultiplier = 1 + \frac{RoundNumber}{6}$$

*注：首轮使用 `RoundNumber = 0`，即 1.0 倍。刺客双持和绿林好汉连击属于同一次行动，不单独递增怒气。*

---

## 3. 成长与消耗 (Progression & Costs)

### 3.1 属性升级消耗 (Attribute Upgrade Cost)
$$Cost = \max(1, \lfloor Level \times (0.2 + BoughtCount \times 0.05) \rfloor)$$
*   `Level` = 玩家当前等级
*   `BoughtCount` = 该属性已通过铜钱**累计购买**的点数（存储在 `attributes.bought[attr]`）
*   保底为 1 铜钱（防止低等级时成本为 0）

### 3.2 经验值表 (XP Table)
升级所需经验存储于 `server/src/data/xpTable.ts`。当 `CurrentXP >= RequiredXP` 时触发升级。

---

## 4. 种族属性修正 (Race Attribute Modifiers)

创建角色时根据种族应用一次性属性偏移，叠加到 10/10/10/10/10 基础值上。

| 种族 ID | 名称 | STR / AGI / INT / CON / LCK |
| :--- | :--- | :--- |
| `RACE_01` | 中原人士 | 0 / 0 / 0 / 0 / 0 |
| `RACE_02` | 蓬莱仙客 | -1 / +2 / 0 / -1 / 0 |
| `RACE_03` | 漠北蛮族 | 0 / -2 / -1 / +2 / +1 |
| `RACE_04` | 苗岭童子 | -2 / +3 / -1 / -1 / +1 |
| `RACE_05` | 契丹豪勇 | +1 / 0 / -1 / 0 / 0 |
| `RACE_06` | 西夏一品堂 | -2 / +2 / +1 / -1 / 0 |
| `RACE_07` | 岭南流寇 | -2 / +2 / 0 / -1 / +1 |
| `RACE_08` | 摩尼教徒 | +3 / -1 / 0 / +1 / -3 |

---

## 5. 逻辑校验说明 (给 AI Agent)

1.  **后端校验**: 在执行 `UPGRADE_ATTRIBUTE` 动作时，必须使用上述公式校验玩家是否有足够的 `copper`，并同时递增 `bought[attr]`。
2.  **前端显示**: 前端在显示"暴击率"或"减伤率"时，应根据当前玩家等级和主属性，使用上述公式进行实时换算显示。
3.  **万分比 (bp)**: 代码中存储的百分比（如 `critChanceBp`）通常是万分制（1% = 100bp）。
4.  **角色创建**: `CREATE_CHARACTER` 仅在 `status === 'PENDING_CREATION'` 时可调用，完成后种族属性修正应用到基础值上。

---
*Last Updated: 2026-05-10*
