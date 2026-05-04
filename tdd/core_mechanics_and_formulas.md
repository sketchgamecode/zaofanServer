# ZaoFan Game 核心机制与数值公式手册

本文档定义了游戏内的核心战斗、成长及资源计算公式。前后端逻辑必须严格遵守此公式，以保证数值的一致性。

---

## 1. 角色属性与生存 (Attributes & Survival)

### 1.1 最大生命值 (Max HP)
$$MaxHP = Constitution \times Level \times ClassHPMultiplier$$

| 职业 (ClassId) | 职业名 | 生命倍率 (HPMultiplier) |
| :--- | :--- | :--- |
| `CLASS_A` | 猛将 (Warrior) | 5 |
| `CLASS_B` | 游侠 (Scout) | 4 |
| `CLASS_C` | 谋士 (Mage) | 2 |
| `CLASS_D` | 刺客 (Assassin) | 4 |

### 1.2 暴击率 (Crit Chance)
$$CritChance = \min(50\%, \frac{Luck \times 5}{EnemyLevel \times 2} \times 0.01)$$
*注：暴击倍率为固定的 **1.75倍**。*

### 1.3 闪避率 (Dodge Chance)
$$DodgeChance = \min(25\%, Agility \times 0.0015)$$
*注：法师（谋士）无法闪避攻击。*

---

## 2. 攻击与伤害 (Combat & Damage)

### 2.1 基础伤害区间 (Damage Range)
每个职业有一个 **主属性 (MainStat)**：
*   战士 -> 力量 (`strength`)
*   游侠/刺客 -> 敏捷 (`agility`)
*   谋士 -> 智力 (`intelligence`)

$$DamageMin = \lfloor WeaponAvg \times 0.8 \times (1 + \frac{MainStat}{10}) \rfloor$$
$$DamageMax = \lfloor WeaponAvg \times 1.2 \times (1 + \frac{MainStat}{10}) \rfloor$$
*WeaponAvg 为武器伤害区间的平均值。*

### 2.2 护甲与减伤 (Armor & Mitigation)
$$MitigatedDamage = \max(1, \lfloor RawDamage - Armor \times 0.25 \rfloor)$$

**护甲上限 (Armor Cap)**：
每个等级有护甲生效上限，超出部分无效。
$$ArmorCap = Level \times ClassArmorCap$$

| 职业 | 护甲上限系数 (ClassArmorCap) |
| :--- | :--- |
| 猛将 | 50 |
| 游侠/刺客 | 25 |
| 谋士 | 10 |

---

## 3. 成长与消耗 (Progression & Costs)

### 3.1 属性升级消耗 (Attribute Upgrade Cost)
$$Cost(Copper) = 10 + CurrentAttributeValue \times 5$$

### 3.2 经验值表 (XP Table)
升级所需经验存储于 `server/src/data/xpTable.ts`。当 `CurrentXP >= RequiredXP` 时触发升级。

---

## 4. 逻辑校验说明 (给 AI Agent)

1.  **后端校验**: 在执行 `UPGRADE_ATTRIBUTE` 动作时，必须使用上述公式校验玩家是否有足够的 `copper`。
2.  **前端显示**: 前端在显示“暴击率”或“减伤率”时，应根据当前玩家等级和主属性，使用上述公式进行实时换算显示。
3.  **万分比 (bp)**: 代码中存储的百分比（如 `critChanceBp`）通常是万分制（1% = 100bp）。

---
*Last Updated: 2026-05-04*
