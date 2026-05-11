/**
 * createCharacter.ts — 角色创建 Action Handler
 *
 * 实现 CREATE_CHARACTER 动作：
 *   处理玩家首次职业/种族/昵称/头像初始化。
 *   只能在 status === 'PENDING_CREATION' 时调用一次。
 */

import type { ActionSuccessResponse } from '../types/action.js';
import type { ActionContext } from './actionContext.js';
import type { CreateCharacterPayload, CharacterInfoView, PlayerClassId, RaceId } from '../types/gameState.js';
import { GameError } from './errors.js';
import { RACE_CONFIGS, isValidRaceId } from '../config/raceConfig.js';
import { CLASS_CONFIG } from './mathCore.js';
import { ATTRIBUTE_KEYS } from '../config/characterRules.js';
import { buildCharacterInfoView } from './character.js';

// ---------------------------------------------------------------------------
// 验证辅助
// ---------------------------------------------------------------------------

const VALID_CLASS_IDS = new Set<string>(Object.keys(CLASS_CONFIG));

function isValidClassId(value: unknown): value is PlayerClassId {
  return typeof value === 'string' && VALID_CLASS_IDS.has(value);
}

function isValidNickname(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 12;
}

function isValidAvatarId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return /^avatar_placeholder_\d{3}$/.test(value);
}

// ---------------------------------------------------------------------------
// CREATE_CHARACTER
// ---------------------------------------------------------------------------

export function createCharacter(
  ctx: ActionContext,
  payload: Record<string, unknown>,
): ActionSuccessResponse<CharacterInfoView> {
  const { nickname, classId, raceId, avatarId } = payload as CreateCharacterPayload;
  const { state, now } = ctx;

  // 1. 状态校验：只能在 PENDING_CREATION 时创建
  if (state.player.status !== 'PENDING_CREATION') {
    throw new GameError('CHARACTER_ALREADY_CREATED', '角色已创建，不可重复执行。');
  }

  // 2. 输入校验
  if (!isValidNickname(nickname)) {
    throw new GameError('INVALID_NICKNAME', '昵称长度须在 2-12 字符之间。');
  }
  if (!isValidClassId(classId)) {
    throw new GameError('INVALID_CLASS', `无效的职业 ID：${String(classId)}`);
  }
  if (!isValidRaceId(raceId)) {
    throw new GameError('INVALID_RACE', `无效的种族 ID：${String(raceId)}`);
  }
  if (!isValidAvatarId(avatarId)) {
    throw new GameError('INVALID_AVATAR', `无效的头像 ID：${String(avatarId)}`);
  }

  // 3. 应用种族属性修正
  const raceConfig = RACE_CONFIGS[raceId as RaceId];
  for (const key of ATTRIBUTE_KEYS) {
    state.attributes[key] += raceConfig.modifiers[key];
  }

  // 4. 设置角色信息
  state.player.classId = classId as PlayerClassId;
  state.player.raceId = raceId as RaceId;
  state.player.displayName = (nickname as string).trim();
  state.player.avatarId = avatarId as string;
  state.player.status = 'ACTIVE';

  // 5. 重置初始资源（设计稿：初始金钱、经验设为 0）
  state.player.exp = 0;
  state.resources.copper = 0;

  ctx.markDirty();

  return {
    ok: true,
    action: 'CREATE_CHARACTER',
    serverTime: now,
    stateRevision: state.meta.stateRevision,
    data: buildCharacterInfoView(state),
  };
}
