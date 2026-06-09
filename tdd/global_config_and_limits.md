# ZaoFan Game 全局配置与硬限制表

本文档记录了游戏内的各种数值限制、初始状态及全局常量。这是各系统逻辑校验的硬性准则。

---

## 1. 初始状态 (Initial State)

当新玩家进入游戏时，初始数据如下：

| 类别 | 字段 | 初始值 |
| :--- | :--- | :--- |
| **基础** | 等级 (Level) | 1 |
| **属性** | 五大属性 (Strength, etc.) | 10 |
| **资源** | 铜钱 (Copper) | 0 |
| **资源** | 令牌 (Tokens) | 50 |
| **资源** | 沙漏 (Hourglasses) | 50 |
| **酒馆** | 体力 (Thirst) | 100 分钟 (6000s) |

---

## 2. 酒馆系统限制 (Tavern Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `maxDrinksPerDay` | 每日最大饮酒次数 | 10 |
| `drinkRestoreSec` | 每瓶酒恢复的体力（秒） | 1200s (20分钟) |
| `baseThirstSec` | 每日重置后的体力上限（秒） | 6000s (100分钟) |
| `itemDropChanceBp` | 任务奖励产出装备的概率 | 700 bp (7%) |
| `firstMissionBonusTokens` | 每日首个任务额外奖励令牌数 | 1 |

---

## 3. 坐骑倍率与加速 (Mount Multipliers)

倍率以万分比 (bp) 表示，代表任务所需时间的百分比。

| 坐骑级别 | 倍率 (bp) | 时间缩短效果 |
| :--- | :--- | :--- |
| `none` (无) | 10000 | 无加速 |
| `tier1` (猪/马) | 9000 | -10% 时间 |
| `tier2` (虎) | 8000 | -20% 时间 |
| `tier3` (禽) | 7000 | -30% 时间 |
| `tier4` (狮鹫/龙) | 5000 | -50% 时间 |

---

## 4. 任务时长规则 (Mission Durations)

任务的时长池取决于玩家等级：

*   **1-11级 (新手期)**: 使用特定的缩短时长池（见 `classicTavernRules.ts`）。
*   **12级及以后 (标准期)**: 固定为 `[5, 10, 15, 20]` 分钟。

---

## 5. 存储与性能限制 (Storage Limits)

*   **背囊容量 (Inventory)**: 初始为 30 格（由前端和后端逻辑共同维护）。
*   **Action 负载**: `/api/action/` 的 Body 限制为 **2MB**。
*   **状态修订号**: `stateRevision` 达到 `Number.MAX_SAFE_INTEGER` 前无需担心溢出。

---

## 6. 其他重要常量

*   **时区**: `Asia/Shanghai` (UTC+8)
*   **每日重置时间**: 每日 00:00:00 (基于服务器时区)

---
*Last Updated: 2026-05-04*

---

## 7. 权柄总量系统限制 (Power Share Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `WORLD_POWER_TOTAL` | 世界权力总量上限 (100.00%) | 10000 |
| `missionLowRiskTransfer` | 同阵营权力任务结算成功时权柄转移额度 | 1 |
| `missionHighRiskTransfer` | 跨阵营权力任务结算成功时权柄转移额度 | 2 |
| `dungeonPurgeTransfer` | 权力副本（蓝玉案）结算胜利时权柄转移额度 | 3 |

*Last Updated: 2026-05-27*

---

## 8. 职位收益账本与 Bot 模拟限制 (Ledger & Simulation Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `maxOfficeLedgerEntries` | 全局职位收益账本最大保留条目数 | 200 |
| `botSimulationIntervalMs` | Bot 离线模拟的触发最小间隔时间（毫秒） | 600,000 ms (10分钟) |
| `minBotSimulatedLocations` | 每次 Bot 模拟最少挑选的地点数 | 3 |
| `maxBotSimulatedLocations` | 每次 Bot 模拟最多挑选的地点数 | 8 |
| `defaultLedgerQueryLimit` | 收益账本查询 API 默认返回条目数 | 20 |
| `maxLedgerQueryLimit` | 收益账本查询 API 最大返回条目数限制 | 50 |

*Last Updated: 2026-06-01*

---

## 9. 吏部任免台候选人限制 (Office Candidates Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `defaultCandidateLimit` | 吏部任免台候选人列表查询默认返回数量 | 8 |
| `maxCandidateLimit` | 吏部任免台候选人列表查询最大返回数量限制 | 20 |

*Last Updated: 2026-06-01*

---

## 10. 场所公账与劫掠系统限制 (Location Treasury & Raid Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `raidChoiceWealthDeduction` | 选择“夺财”时扣除场所公账金钱/物资的比例 | 50% |
| `raidChoicePowerDeduction` | 选择“夺权”时扣除场所公账权势的比例 | 50% |
| `raidChoiceFameDeduction` | 选择“扬名”时扣除场所公账物资的比例 | 30% |
| `raidMountCarryMultiplierNone` | 徒步或未识别坐骑的物货搬运倍率 | 1.0 |
| `raidMountCarryMultiplierDonkey` | 骑乘毛驴的物货搬运倍率 | 1.4 |
| `raidMountCarryMultiplierHorse` | 骑乘骏马的物货搬运倍率 | 1.6 |
| `raidMountCarryMultiplierOx` | 赶着牛车的物货搬运倍率 | 2.0 |

*Last Updated: 2026-06-01*

---

## 11. 场所守卫值守系统限制 (Location Guard Duty Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `guardSlotsMax` | 单个场所最大守卫值岗席位数 | 3 |
| `guardDutyDurationTiers` | 值岗站岗时长允许的档位级别（分钟） | 30 / 60 / 120 (默认 60) |
| `guardBaseWage30Min` | 30分钟档位值守基准铜钱饷银 | 20 |
| `guardBaseWage60Min` | 60分钟档位值守基准铜钱饷银 | 45 |
| `guardBaseWage120Min` | 120分钟档位值守基准铜钱饷银 | 100 |
| `guardWageDefenseBonusRatio` | 基于场所 defenseRating 给予饷银的防务比例加成 | `Math.floor(defenseRating * 0.1)` |

*Last Updated: 2026-06-01*

---

## 12. 主官私人公账与每周上缴限制 (Weekly Tribute Limits)

| 常量名 | 说明 | 数值 |
| :--- | :--- | :--- |
| `dueCopperBase` | 每周上缴的基准铜钱金额 | 1000 |
| `dueCopperLevelFactor` | 基于地点解锁等级的周贡递增乘数 | 100 |
| `weeklyTributeRecipients` | 缴期债务的上级收款人 ID | `reserved:wei_zhongxian` |

*Last Updated: 2026-06-02*


