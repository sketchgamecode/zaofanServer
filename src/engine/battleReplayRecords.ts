import type { BattleContext, BattleReplayRecord, BattleResultV2 } from '../types/gameState.js';
import { createReplayId } from '../lib/battleReplayStore.js';

export function buildBattleReplayRecord(input: {
  ownerPlayerId: string;
  context: BattleContext;
  now: number;
  battleResult: BattleResultV2;
  sourceId?: string | null;
  relatedPlayerId?: string | null;
  isSavedByPlayer?: boolean;
  title?: string;
}): BattleReplayRecord {
  const opponentName = input.battleResult.enemy.name;
  const result = input.battleResult.playerWon ? 'WIN' : 'LOSE';
  return {
    replayId: createReplayId(input.context, input.now, `${input.ownerPlayerId}:${input.sourceId ?? ''}:${input.battleResult.seedPublicHash}`),
    ownerPlayerId: input.ownerPlayerId,
    context: input.context,
    createdAt: input.now,
    expiresAt: null,
    isRead: false,
    isSavedByPlayer: input.isSavedByPlayer ?? input.context === 'MISSION',
    relatedPlayerId: input.relatedPlayerId ?? null,
    sourceId: input.sourceId ?? null,
    title: input.title ?? `${input.context} vs ${opponentName}`,
    opponentName,
    preview: {
      type: input.context === 'MISSION' ? 'QUEST' : input.context === 'DUNGEON' ? 'DUNGEON' : 'PLAYER',
      result,
      playerName: input.battleResult.player.name,
      enemyName: input.battleResult.enemy.name,
      playerAvatarId: input.battleResult.player.avatarId,
      enemyAvatarId: input.battleResult.enemy.avatarId,
      enemyLevel: input.battleResult.enemy.level,
    },
    battleResult: input.battleResult,
  };
}
