# ZaoFan Server ID 命名约定

本文档定义了服务端所有标识符（ID）的命名规则。所有 Agent 在开发和扩展时**必须**遵循本约定。

> [!IMPORTANT]
> **核心原则：服务端 ID 必须是抽象的、与语言无关的。**
> 我们的服务器未来会对接不同题材包装的客户端（如大宋题材、西幻题材等），因此 ID 中**绝对不能出现**具有语义确定性的词语（如 `warrior`、`mage`、`human` 等）。
> 
> 所有"人类可读的名称"都通过服务端的**默认配置映射表**来提供。客户端通过读取该映射表来展示对应的本地化文案。

---

## 1. 职业 ID (PlayerClassId)

使用 `CLASS_` 前缀 + 大写字母序号。

| ID | 默认映射名称 (大宋题材) | S&F 原型 |
| :--- | :--- | :--- |
| `CLASS_A` | 猛将 (Warrior) | Warrior |
| `CLASS_B` | 游侠 (Scout) | Scout |
| `CLASS_C` | 谋士 (Mage) | Mage |
| `CLASS_D` | 杀手 (Assassin) | Assassin |
| `CLASS_E` | 绿林好汉 (Berserker) | Berserker |

> [!NOTE]
> 后续高级职业扩展时，继续使用 `CLASS_F`, `CLASS_G` ... 依次递增。

---

## 2. 种族 ID (RaceId)

使用 `RACE_` 前缀 + 两位数字序号。

| ID | 默认映射名称 (大宋题材) | S&F 原型 |
| :--- | :--- | :--- |
| `RACE_01` | 中原人士 (Central Plains) | Human |
| `RACE_02` | 蓬莱仙客 (Penglai Immortal) | Elf |
| `RACE_03` | 漠北蛮族 (Northern Barbarian) | Dwarf |
| `RACE_04` | 苗岭童子 (Miaoling Child) | Gnome |
| `RACE_05` | 契丹豪勇 (Khitan Brave) | Orc |
| `RACE_06` | 西夏一品堂 (Western Xia) | Dark Elf |
| `RACE_07` | 岭南流寇 (Lingnan Bandit) | Goblin |
| `RACE_08` | 摩尼教徒 (Manichaean) | Demon |

---

## 3. 默认配置映射（服务端提供）

服务端应提供一个配置接口或配置文件，将抽象 ID 映射到当前题材的显示名称。示例结构：

```typescript
// config/themeConfig.ts (示例)
export const CLASS_DISPLAY_NAMES: Record<PlayerClassId, string> = {
  CLASS_A: '猛将',
  CLASS_B: '游侠',
  CLASS_C: '谋士',
  CLASS_D: '杀手',
  CLASS_E: '绿林好汉',
};

export const RACE_DISPLAY_NAMES: Record<RaceId, string> = {
  RACE_01: '中原人士',
  RACE_02: '蓬莱仙客',
  // ...
};
```

> [!TIP]
> 未来切换题材时，只需更换此映射表，客户端即可自动适配新名称，无需修改任何逻辑代码。

---

## 4. 其他 ID 命名规则

| 类别 | 格式 | 示例 |
| :--- | :--- | :--- |
| 装备 ID | `eq_{slot}_{time36}_{rand16}` | `eq_weapon_m1abc_ff3a` |
| 任务 ID | `mission_{uuid}` | `mission_offer_0` |
| 地下城 ID | `dungeon_{序号}` | `dungeon_01` |

---
*Last Updated: 2026-05-10*
