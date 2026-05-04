# ZaoFan Game 错误代码与交互字典

本文档定义了后端可能返回的所有错误代码（ErrorCode），及其对应的含义和推荐的前端交互策略。

---

## 1. 认证与基础错误 (Auth & Base)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `UNKNOWN_ACTION` | 提交了不存在的动作名称 | 前端 Log 记录，不应出现 |
| `ACTION_DISABLED` | 动作所在的系统暂未开放 | 弹出 Toast 提示“系统维护中” |
| `INVALID_REQUEST` | 请求体格式错误 (Zod 校验失败) | 调试使用，前端应防止此类发送 |
| `CHEATS_DISABLED` | 在非测试环境下尝试执行调试动作 | 忽略或静默失败 |

---

## 2. 存档与系统状态 (Save & State)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `SAVE_READ_FAILED` | 读取存档失败 | 强提示：引导玩家重新登录或刷新 |
| `SAVE_WRITE_FAILED` | 保存存档失败 | 强提示：告知可能网络波动，提示重试 |
| `INVALID_GAME_STATE` | 存档数据损坏或逻辑严重冲突 | 引导玩家联系客服或重置存档 |

---

## 3. 资源不足错误 (Resource Errors)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `NOT_ENOUGH_COPPER` | 铜钱不足 | 弹出 Toast: "铜钱不足" |
| `NOT_ENOUGH_TOKENS` | 令牌不足 | 引导至充值页面或任务面板 |
| `NOT_ENOUGH_THIRST` | 酒馆体力不足 | 提示“你太累了，先喝杯酒吧” |
| `NOT_ENOUGH_SKIP_RESOURCE` | 缺少加速任务所需的沙漏或令牌 | 弹出购买/提示框 |

---

## 4. 酒馆与任务系统 (Tavern & Missions)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `MISSION_ALREADY_IN_PROGRESS` | 已有任务在进行中 | 自动跳转至“任务进行中”界面 |
| `MISSION_NOT_FOUND` | 尝试开始一个已过期或不存在的任务 | 刷新任务列表 |
| `OFFER_SET_MISMATCH` | 任务列表已刷新，尝试执行旧任务 | 刷新任务列表 |
| `MISSION_NOT_FINISHED` | 任务时间未到，尝试强制结算 | 显示剩余倒计时 |
| `NO_ACTIVE_MISSION` | 没有正在进行的任务 | 回到酒馆大厅 |
| `TAVERN_DRINK_LIMIT_REACHED` | 今日已喝完 10 杯酒 | 提示“今天不能再喝了” |

---

## 5. 物品与装备 (Items & Inventory)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `ITEM_NOT_FOUND` | 背囊中找不到对应的物品 ID | 刷新背囊数据 |
| `INVALID_EQUIPMENT_SLOT` | 穿戴槽位名称错误 | 代码级错误，前端核对 Slot 枚举 |
| `EQUIP_SLOT_MISMATCH` | 物品无法穿戴在指定的槽位 | 震动或红色飘字提示 |
| `EMPTY_EQUIPMENT_SLOT` | 尝试卸下本就为空的槽位 | 静默处理 |

---

## 6. 属性系统 (Attributes)

| 错误代码 (ErrorCode) | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `INVALID_ATTRIBUTE_KEY` | 提交了不存在的属性名 | 代码级错误 |

---
*Last Updated: 2026-05-04*
