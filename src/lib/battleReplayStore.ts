import type { BattleReplayRecord, BattleContext } from '../types/gameState.js';
import { GameError } from '../engine/errors.js';

const memoryReplays = new Map<string, BattleReplayRecord>();

function shouldUseMemoryStore(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NODE_ENV === 'test';
}

async function getSupabase() {
  const module = await import('./supabase.js');
  return module.supabaseAdmin;
}

export function createReplayId(context: BattleContext, now: number, salt: string): string {
  let hash = 2166136261;
  for (let i = 0; i < salt.length; i += 1) {
    hash ^= salt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `battle_${context.toLowerCase()}_${now.toString(36)}_${(hash >>> 0).toString(16).slice(0, 6)}`;
}

export async function insertBattleReplay(record: BattleReplayRecord): Promise<BattleReplayRecord> {
  if (shouldUseMemoryStore()) {
    memoryReplays.set(record.replayId, record);
    return record;
  }

  const supabase = await getSupabase();
  const { error } = await supabase.from('battle_replays').insert({
    replay_id: record.replayId,
    owner_player_id: record.ownerPlayerId,
    context: record.context,
    created_at_ms: record.createdAt,
    expires_at_ms: record.expiresAt ?? null,
    is_read: record.isRead,
    is_saved_by_player: record.isSavedByPlayer ?? false,
    related_player_id: record.relatedPlayerId ?? null,
    source_id: record.sourceId ?? null,
    title: record.title,
    opponent_name: record.opponentName,
    preview: record.preview,
    battle_result: record.battleResult,
  });

  if (error) throw new GameError('BATTLE_REPLAY_WRITE_FAILED', `Failed to write battle replay: ${error.message}`);
  return record;
}

export async function listBattleReplays(ownerPlayerId: string, limit = 50): Promise<BattleReplayRecord[]> {
  if (shouldUseMemoryStore()) {
    return [...memoryReplays.values()]
      .filter((record) => record.ownerPlayerId === ownerPlayerId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('battle_replays')
    .select('*')
    .eq('owner_player_id', ownerPlayerId)
    .order('created_at_ms', { ascending: false })
    .limit(limit);
  if (error) throw new GameError('BATTLE_REPLAY_READ_FAILED', `Failed to read battle replays: ${error.message}`);
  return (data ?? []).map(rowToReplayRecord);
}

export async function getBattleReplay(ownerPlayerId: string, replayId: string): Promise<BattleReplayRecord | null> {
  if (shouldUseMemoryStore()) {
    const record = memoryReplays.get(replayId);
    return record?.ownerPlayerId === ownerPlayerId ? record : null;
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('battle_replays')
    .select('*')
    .eq('owner_player_id', ownerPlayerId)
    .eq('replay_id', replayId)
    .maybeSingle();
  if (error) throw new GameError('BATTLE_REPLAY_READ_FAILED', `Failed to read battle replay: ${error.message}`);
  return data ? rowToReplayRecord(data) : null;
}

export async function findBattleReplayBySource(ownerPlayerId: string, context: BattleContext, sourceId: string): Promise<BattleReplayRecord | null> {
  const records = await listBattleReplays(ownerPlayerId, 200);
  return records.find((record) => record.context === context && record.sourceId === sourceId) ?? null;
}

export async function deleteBattleReplay(ownerPlayerId: string, replayId: string): Promise<void> {
  if (shouldUseMemoryStore()) {
    const record = memoryReplays.get(replayId);
    if (record?.ownerPlayerId === ownerPlayerId) memoryReplays.delete(replayId);
    return;
  }

  const supabase = await getSupabase();
  const { error } = await supabase
    .from('battle_replays')
    .delete()
    .eq('owner_player_id', ownerPlayerId)
    .eq('replay_id', replayId);
  if (error) throw new GameError('BATTLE_REPLAY_WRITE_FAILED', `Failed to delete battle replay: ${error.message}`);
}

function rowToReplayRecord(row: any): BattleReplayRecord {
  return {
    replayId: row.replay_id,
    ownerPlayerId: row.owner_player_id,
    context: row.context,
    createdAt: row.created_at_ms,
    expiresAt: row.expires_at_ms,
    isRead: row.is_read,
    isSavedByPlayer: row.is_saved_by_player,
    relatedPlayerId: row.related_player_id,
    sourceId: row.source_id,
    title: row.title,
    opponentName: row.opponent_name,
    preview: row.preview,
    battleResult: row.battle_result,
  };
}
