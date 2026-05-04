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
| `UPGRADE_ATTRIBUTE` | 消耗铜钱升级属性 | `{"attribute": "strength"}` | `CharacterInfoView` |
| `EQUIP_ITEM` | 穿戴背囊中的装备 | `{"itemId": "item_uuid"}` | `CharacterInfoView` |
| `UNEQUIP_ITEM` | 卸下已穿戴的装备 | `{"slot": "head"}` | `CharacterInfoView` |
| `TAVERN_GET_INFO` | 获取酒馆状态和任务列表 | `{}` | `TavernInfoData` |
| `GENERATE_MISSIONS` | 强制重新生成可选任务 | `{}` | `TavernInfoData` |
| `TAVERN_DRINK` | 消耗令牌喝啤酒（增加体力）| `{}` | `TavernInfoData` |
| `START_MISSION` | 开始一个酒馆任务 | `{"missionId": "id"}` | `TavernInfoData` |
| `COMPLETE_MISSION` | 结算当前已完成的任务 | `{}` | `CompleteMissionData` |
| `SKIP_MISSION` | 使用沙漏或令牌跳过任务等待 | `{}` | `CompleteMissionData` |
| `DEBUG_RESET_SAVE` | **(仅开发)** 重置存档 | `{}` | `{ "reset": true }` |

### 4.2 暂未实现的动作 (Disabled Actions)
调用以下动作将返回 `503` 或带有 `DISABLED` 状态的响应：
`BLACK_MARKET_REFRESH`, `BLACK_MARKET_BUY`, `ARENA_FIGHT`, `ARENA_SKIP_COOLDOWN`, `GUARD_WORK_START`, `GUARD_WORK_CLAIM`, `DUNGEON_FIGHT`.

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

### CompleteMissionData
任务结算结果：
*   `result`: `SUCCESS` (成功) 或 `FAILED` (失败)。
*   `battleResult`: 详细的战斗回放（回合数据、伤害等）。
*   `grantedReward`: 实际获得的奖励内容。
*   `playerDelta`: 玩家资源变动前后的对比。

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

---
*Last Updated: 2026-05-04*
