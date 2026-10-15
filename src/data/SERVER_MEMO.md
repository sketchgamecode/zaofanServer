# 《大宋造反模拟器》服务端开发准则与机制演进备忘 (SERVER_MEMO.md)
> 本文档定义了服务端研发与联调的核心约束、红线原则及各版本特性裁决。
> 任何参与本项目逻辑、协议或客户端对接的开发者/Agent，均须以本文档规则为准。

---

## 1. 核心红线与研发铁律 (Strict Constraints)

1. **存档兼容性策略**：
   - **【严禁兼容老存档】**：测试与开发阶段，服务端不编写任何旧数据迁移脚本、旧字段兜底或双版本兼容逻辑。
   - 每次协议升级或机制调整，统一执行 `POST /api/debug/wipe-all-saves`（或运行 `npm run wipe:all`）全服清档重建。
   - 客户端必须支持清档后重新创建角色流程。

2. **Unity 序列化与类型安全约定**：
   - Unity 客户端采用 `JsonUtility` 反序列化。在 C# 原生结构中，缺失的 `float`/`int`/`bool` 会直接反序列化为默认值（如 `0` 或 `false`），**无法通过 null 判定**。
   - **禁止使用可选数值下发**（如 `chancePercent?: number`）。
   - **必须提供显式布尔存在标记**：例如 `{ "hasChancePercent": true, "chancePercent": 20, "hasFixedDamage": false, "fixedDamage": 0 }`。

3. **战斗数据源唯一真实性**：
   - 战斗外装备详情（`combatProfile`）、角色穿戴总览（`combatSummary`）与战中模拟器（`combatSimulator.ts`）**必须共享同一套计算逻辑入口**。
   - 严禁在展示层另写估算公式。

---

## 2. 当前版本机制裁决与范围控制 (Current Feature Scope)

1. **副手与盾牌机制（当前裁决：方案 A）**：
   - **产出完全屏蔽**：当前游戏内部（商店、任务奖励、掉落、竞技场候选人等）**完全不产出副手武器（双持短刀）和盾牌**。
   - **槽位聚焦**：角色仅使用【主手兵刃 (weapon)】与【甲胄 (body)】两个核心槽位，降低玩家前期认知负荷并减少客户端冲突。
   - **底层架构保留**：底层战斗模拟器保留双持与持盾结算代码，以备未来特定进阶职业开放时平滑启用。

2. **体力与破绽机制**：
   - **调息恢复**：调息仅恢复规定数量的体力（静息回体 `regen`），不是直接回满体力。
   - **出招轮半量回体**：攻击回合的体力恢复减半为 `floor(regen / 2)`。
   - **破绽状态（Exposed）**：当体力跌至 `<= 0` 时陷入破绽；为防止连续破绽，体力在陷入破绽时重置为 `40`。

3. **战斗特性准确口径**：
   - **追击连斩 (COMBO)**：攻击命中且对手存活未被格挡时，独立判定追加攻击，追加攻击不能再次连击。
   - **招架反击 (PARRY_COUNTER)**：防守方承受伤害存活且未被震慑时触发，**反击不免除受击伤害**。
   - **钝击透甲 (BLUNT_SHOCK)**：钝器未破甲时造成 8 点固定震伤；被盾牌格挡依然造成 5 点余震伤害。钝器自带破甲加成已直接融入破甲级 P，客户端不可重复累加。
   - **破甲压制 (IGNORE_REDUCE)**：四棱锏等武器贯穿护甲时，忽略目标护甲指定的固定减伤值（`ignoreArmorReduce`）。
   - **盾击推撞 (SHIELD_BASH_PUSH)**：必须且仅在**守方真正装备盾牌 (`dfd.shield`)** 且格挡成功后才有 30% 概率触发。徒手/主手武器的基础架招格挡 (`DEF_BASE_BLOCK`) 严禁触发盾击推撞失衡。
   - **缺省装备 (Fallback Loadout)**：`getFallbackLoadout` 同步移除副手与盾牌，确保缺省 NPC 或未配装敌人不会携盾入场。

4. **职业体系与动态配置机制 (Class System & Live Hot-Reload)**：
   - **数据源与持久化**：职业底层数据集中于 `src/data/equipment_data.json` 的 `classes` 数组中，受快照与版本管理保护，全服清档不影响职业基础配置。
   - **运行时动态响应**：`CLASS_CONFIG` 与武器生成映射 `CLASS_WEAPON_CLASSES` 采用 Proxy 动态代理，通过 Debug 控制台保存后即刻热重载，无需重启服务。
   - **核心属性与计算口径**：
     - **职业名称与描述文本**：支持自定义（如 CLASS_A「猛将」, CLASS_B「游侠」, CLASS_C「军策」, CLASS_D「义士」, CLASS_E「绿林好汉」）。
     - **主要属性与用词**：可配置主要属性类型（力量、身法、智谋、根骨、机缘）及界面展示用词。
     - **生命成长**：公式为 $\text{MaxHP} = \text{根骨} \times \text{hpMultiplier} \times (\text{等级} + 1)$。
     - **被动格挡/闪避**：通过万分比基点设置基础格挡率 `blockChanceBp` 与基础闪避率 `dodgeChanceBp`。
     - **可用武器类别池**：通过 `allowedWeaponClasses` 限制各职业武器掉落（如刀、剑、枪、钝器、弓等）。
   - **API 接口**：`GET /api/debug/config/classes`（查询配置）、`POST /api/debug/config/classes`（保存并热重载）。

---

## 3. 核心协议与接口标准

1. **战斗回放协议**：
   - 唯一回放协议：`Timeline V3`（`battleResult.timelineEvents[]`）。
   - 每次出手独立分配 `actionId`，连击/反击拥有独立 `actionId` 并通过 `parentEventId` 关联前置事件。

2. **战前详情数据**：
   - 装备项携带：`item.combatProfile`（版本号 `profileVersion: 1`）。
   - 角色信息携带：`characterInfoView.combatSummary`（版本号 `summaryVersion: 1`），包含精准 `hpMax`、`staminaMax`、体力收支净差额及有效套装词条。

---

## 4. 演进备忘历史 (Changelog)

- **2026-10-15 (3)**：在 Debug 控制台上线「🥋 职业配置与机制说明」可视化管理面板，支持实时编辑全职业名称、主属性用词、血量系数、格挡/闪避被动及可用武器池，支持一键保存并无缝热重载。
- **2026-10-15 (2)**：修复战斗模拟器中基础格挡误判为“盾击”导致推撞失衡的 BUG，盾牌推撞增加 `dfd.shield` 强校验；清洗缺省装备表 `getFallbackLoadout` 与竞技场候选人对战快照副手栏位。
- **2026-10-15 (1)**：实施方案 A，全服各生成入口（黑市、差事奖励、竞技场机器人）屏蔽副手与盾牌生成，简化客户端前期交互；在 Debug 控制台内置持久化备忘文档与一键下载端点。
- **2026-10-12**：完成第一阶段（Phase 1）战前装备详情与角色面板画像（`combatProfile` / `combatSummary`），全面实施 Unity `JsonUtility` 显式布尔安全标准。
- **2026-10-10**：战斗回放事件流升级至 Timeline V3，消除旧 hits 歧义，规范状态生命周期。
