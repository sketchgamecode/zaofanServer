/**
 * wipeAllSaves.ts - destructive full-player wipe for clean-wipe upgrades.
 *
 * Usage:
 *   npm run wipe:all
 *   npm run wipe:saves
 *
 * This deletes all player-owned server data and Supabase Auth users.
 * It intentionally does not preserve old accounts, saves, replays, or resources.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.FORCE_WIPE !== 'true') {
  console.error('Refusing production wipe without FORCE_WIPE=true.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type WipeTableSpec = {
  table: string;
  keyColumn: string;
  impossibleValue: string;
};

const PUBLIC_TABLES: WipeTableSpec[] = [
  { table: 'admin_actions', keyColumn: 'id', impossibleValue: '00000000-0000-0000-0000-000000000000' },
  { table: 'battle_replays', keyColumn: 'replay_id', impossibleValue: '__impossible_replay_id__' },
  { table: 'player_saves', keyColumn: 'player_id', impossibleValue: '00000000-0000-0000-0000-000000000000' },
  { table: 'player_resources', keyColumn: 'player_id', impossibleValue: '00000000-0000-0000-0000-000000000000' },
  { table: 'profiles', keyColumn: 'id', impossibleValue: '00000000-0000-0000-0000-000000000000' },
];

async function countRecords(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.warn(`Could not count ${table}: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

async function countAuthUsers(): Promise<number> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.warn(`Could not count auth users: ${error.message}`);
    return -1;
  }
  return data.total ?? data.users.length;
}

async function wipeTable(spec: WipeTableSpec): Promise<number> {
  const { data, error } = await supabase
    .from(spec.table)
    .delete()
    .neq(spec.keyColumn, spec.impossibleValue)
    .select(spec.keyColumn);

  if (error) {
    if (error.message.includes(`Could not find the table 'public.${spec.table}'`)) {
      console.warn(`Skipping missing table ${spec.table}. Apply database schema before using related features.`);
      return 0;
    }
    throw new Error(`Failed to wipe ${spec.table}: ${error.message}`);
  }

  return data?.length ?? 0;
}

async function listAllAuthUserIds(): Promise<string[]> {
  const ids: string[] = [];
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    ids.push(...data.users.map((user) => user.id));
    if (data.users.length < perPage) break;
  }

  return ids;
}

async function deleteAuthUsers(): Promise<number> {
  const userIds = await listAllAuthUserIds();
  let deleted = 0;

  for (const userId of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Failed to delete auth user ${userId}: ${error.message}`);
    }
    deleted += 1;
  }

  return deleted;
}

async function waitForConfirmation(): Promise<void> {
  if (process.env.CI === 'true' || process.env.CONFIRM_WIPE === 'true') return;

  console.log('');
  console.log('This will permanently delete all Supabase Auth users and all player data.');
  console.log('Type WIPE_ALL to continue:');

  const answer = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => resolve(data.toString().trim()));
  });

  if (answer !== 'WIPE_ALL') {
    throw new Error('Wipe cancelled.');
  }
}

async function run(): Promise<void> {
  console.log('ZaoFan full clean-wipe tool');
  console.log(`Target: ${supabaseUrl}`);
  console.log('-'.repeat(50));

  const counts = await Promise.all(PUBLIC_TABLES.map(async (spec) => [spec.table, await countRecords(spec.table)] as const));
  const authUserCount = await countAuthUsers();

  for (const [table, count] of counts) {
    console.log(`${table}: ${count}`);
  }
  console.log(`auth.users: ${authUserCount}`);

  await waitForConfirmation();

  console.log('');
  console.log('Wiping public player data...');
  for (const spec of PUBLIC_TABLES) {
    const deleted = await wipeTable(spec);
    console.log(`Deleted ${deleted} from ${spec.table}`);
  }

  console.log('');
  console.log('Deleting Supabase Auth users...');
  const deletedAuthUsers = await deleteAuthUsers();
  console.log(`Deleted ${deletedAuthUsers} auth users`);

  console.log('');
  console.log('Full clean-wipe complete.');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
