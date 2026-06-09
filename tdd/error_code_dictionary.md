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
---

## 7. 竞技场与战斗回放

| ErrorCode | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `ARENA_COOLDOWN_ACTIVE` | 竞技场冷却未结束 | 显示剩余时间和跳过冷却入口 |
| `ARENA_TARGET_NOT_FOUND` | 目标不存在、候选过期或不在当前候选集中 | 刷新候选列表 |
| `ARENA_SELF_TARGET` | 玩家尝试挑战自己 | 禁用自身挑战入口 |
| `ARENA_DISABLED` | 竞技场系统关闭 | 显示系统维护提示 |
| `INSUFFICIENT_PREMIUM_RESOURCE` | 跳过冷却所需沙漏/令牌不足 | 引导获取资源 |
| `BATTLE_REPLAY_NOT_FOUND` | 邮箱回放不存在或不属于当前玩家 | 刷新回放列表 |
| `BATTLE_REPLAY_READ_FAILED` | 回放读取失败 | 提示重试 |
| `BATTLE_REPLAY_WRITE_FAILED` | 回放写入/删除失败 | 提示重试，避免前端标记成功 |
| `MISSION_REPLAY_NOT_AVAILABLE` | 当前没有可手动保存的酒馆任务回放 | 隐藏或禁用保存按钮 |

*Last Updated: 2026-05-26*

---

## 8. 角色创建 (Character Creation)

| ErrorCode | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `CHARACTER_ALREADY_CREATED` | 角色已创建，不可重复执行 | 静默跳转角色主界面 |
| `INVALID_NICKNAME` | 昵称不合法（长度不符或含非法字符） | 提示"昵称须在 2-12 字符之间" |
| `INVALID_CLASS` | 无效的职司 ID | 代码级错误，前端核对 PlayerClassId 枚举 |
| `INVALID_RACE` | 无效的出身 ID | 代码级错误，前端核对 RaceId 枚举 |
| `INVALID_AVATAR` | 无效的头像 ID | 代码级错误，前端核对头像格式 |

---

## 9. 权力与世界系统 (Power & World Systems)

| ErrorCode | 含义 | 推荐交互策略 |
| :--- | :--- | :--- |
| `WORLD_PLAYER_ACTOR_NOT_FOUND` | 世界角色池中未找到与玩家关联的 Actor 节点 | 前端提示“世界地图连接异常，请重试” |
| `WORLD_ACTOR_NOT_FOUND` | 指定 actorId 不存在于世界角色池中，或 actorId 参数为空 | 前端提示"角色不存在或已离开世界地图" |
| `LOCATION_NOT_FOUND` | 指定的地点不存在 | 前端提示“该地点无法找到” |
| `LOCATION_MISSIONS_NOT_AVAILABLE` | 指定的地点不提供 missions 差事服务 | 禁用该地点的接取差事功能并 Toast 提示“该职位当前不发布差事” |
| `POSITION_NOT_FOUND` | 职位 ID 不存在或该地点未配置该服务职位 | 弹出 Toast 提示“找不到对应的职司” |
| `POSITION_ID_REQUIRED` | 未提供职位 ID | 前端 Log 错误，不应发送空值 |
| `RAID_NOT_FOUND` | 指定的劫掠战局 ID 不存在 | 前端提示"该劫掠战局已过期或不存在" |
| `RAID_CANNOT_SETTLE` | 劫掠记录无法结算（例如已被结算、或是失败的战局） | 前端置灰结算选项并提示"此劫掠战局无法进行结算" |
| `LOCATION_GUARD_SLOT_FULL` | 场所守卫席位已满 (上限 3 名) | Toast 提示“值守人数已满，请换个场所值勤” |
| `LOCATION_GUARD_ALREADY_ACTIVE` | 玩家已在此地点申请了活跃的值守任务 | Toast 提示“您已在此地值岗，请勿重复申请” |
| `LOCATION_GUARD_NOT_FOUND` | 指定的值勤记录 ID 不存在 | 弹出 Toast 提示“找不到相应的值勤记录” |
| `LOCATION_GUARD_NOT_OWNED` | 值守记录不属于当前玩家 | 弹出 Toast 提示“这并不是您的值勤任务” |
| `LOCATION_GUARD_NOT_READY` | 值勤时长未结束，不可领取工钱；或者任务非 active 状态 | 禁用领取并提示“值守时辰未满” |
| `OFFICE_TRIBUTE_NOT_FOUND` | 未找到指定的主官期贡债务记录 | Toast 提示“找不到对应的上缴账目” |
| `OFFICE_TRIBUTE_FORBIDDEN` | 尝试替其他职司的主官代缴期贡债务 | Toast 提示“您非该职位主官，无权缴纳该项债务” |
| `OFFICE_TRIBUTE_CLOSED` | 期贡已到期结转，缴款通道已关闭 | Toast 提示“本周缴期已截止，无法补缴” |
| `OFFICE_TRIBUTE_INVALID_AMOUNT` | 缴贡金额小于等于零或非有效数字 | 提示“请输入合法的缴款金额” |
| `OFFICE_TRIBUTE_INSUFFICIENT_COPPER` | 玩家身上的铜钱余额不足以完成支付 | 提示“身上铜钱不足，快去跑几趟差事吧” |

*Last Updated: 2026-06-02*
