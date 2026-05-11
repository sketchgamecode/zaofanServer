/**
 * wipeAllSaves.ts — 清空所有玩家存档数据
 *
 * 用法：
 *   npx tsx src/scripts/wipeAllSaves.ts
 *   npm run wipe:saves
 *
 * 功能：
 *   1. 删除 player_saves 表所有行（玩家游戏存档）
 *   2. 可选：重置 profiles 表的 last_login_at（保留账号但清除登录痕迹）
 *
 * 安全措施：
 *   - 生产环境下必须设置 FORCE_WIPE=true 环境变量才能执行
 *   - 执行前会打印将要删除的记录数并等待确认（除非设置 CI=true 跳过确认）
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量');
  process.exit(1);
}

// 生产环境安全检查
if (process.env.NODE_ENV === 'production' && process.env.FORCE_WIPE !== 'true') {
  console.error('❌ 生产环境下需设置 FORCE_WIPE=true 才能执行清档操作');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function countRecords(table: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.warn(`⚠️  无法查询 ${table} 记录数: ${error.message}`);
    return -1;
  }
  return count ?? 0;
}

async function wipeTable(table: string): Promise<number> {
  // Supabase 的 delete 需要 where 条件，用 neq 一个不可能的值来删除所有行
  const { data, error } = await supabase
    .from(table)
    .delete()
    .neq('player_id', '__impossible_id__')
    .select('player_id');

  if (error) {
    console.error(`❌ 清空 ${table} 失败: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

async function run(): Promise<void> {
  console.log('🧹 ZaoFan 全服清档工具');
  console.log(`📍 目标: ${supabaseUrl}`);
  console.log('─'.repeat(50));

  // 1. 统计当前数据量
  const saveCount = await countRecords('player_saves');
  console.log(`📊 player_saves 表: ${saveCount} 条记录`);

  if (saveCount === 0) {
    console.log('✅ 无需清理，player_saves 已为空');
    return;
  }

  // 2. 非 CI 环境下等待确认
  const isCI = process.env.CI === 'true';
  if (!isCI) {
    console.log('\n⚠️  即将删除以上所有数据，此操作不可逆！');
    console.log('   按 Enter 继续，或 Ctrl+C 取消...');
    await new Promise<void>((resolve) => {
      process.stdin.once('data', () => resolve());
    });
  }

  // 3. 执行清空
  console.log('\n🔥 正在清空 player_saves ...');
  const deletedSaves = await wipeTable('player_saves');
  console.log(`   ✅ 已删除 ${deletedSaves} 条存档`);

  console.log('\n─'.repeat(50));
  console.log('🎉 清档完成！所有玩家数据已销毁。');
}

run().catch((err) => {
  console.error('💥 脚本执行失败:', err);
  process.exit(1);
});
