-- ============================================================
-- 大宋造反模拟器 — Supabase 数据库初始化 SQL
-- 在 Supabase 控制台 → SQL Editor 中整段运行
-- ============================================================

-- 扩展：生成 UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. profiles 表（玩家档案）────────────────────────────────────────────────
-- 关联 Supabase Auth 的 auth.users 表，id 与 auth 的 user id 一致
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '无名好汉',
  qq_name     TEXT,
  wechat_name TEXT,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned', 'deleted')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- 新用户注册后自动创建 profile（通过触发器）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', '无名好汉'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. player_resources 表（关键经济资源，服务端权威）────────────────────────
CREATE TABLE IF NOT EXISTS player_resources (
  player_id   UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  copper      INT NOT NULL DEFAULT 0 CHECK (copper >= 0),
  prestige    INT NOT NULL DEFAULT 0 CHECK (prestige >= 0),
  rations     INT NOT NULL DEFAULT 100 CHECK (rations >= 0 AND rations <= 100),
  tokens      INT NOT NULL DEFAULT 0 CHECK (tokens >= 0),      -- 通宝（付费核心）
  hourglasses INT NOT NULL DEFAULT 0 CHECK (hourglasses >= 0), -- 沙漏（加速核心）
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. player_saves 表（完整 GameState 云存档）───────────────────────────────
CREATE TABLE IF NOT EXISTS player_saves (
  player_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  game_state   JSONB NOT NULL DEFAULT '{}',
  save_version INT NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. admin_actions 表（后台操作审计日志）──────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_actions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id       UUID REFERENCES profiles(id),     -- 操作管理员
  target_player_id  UUID REFERENCES profiles(id),     -- 被操作玩家
  action_type       TEXT NOT NULL,                    -- 操作类型（如 grant_resources）
  before_snapshot   JSONB,                            -- 操作前快照
  after_snapshot    JSONB,                            -- 操作后快照
  reason            TEXT,                             -- 操作原因
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. Row Level Security（RLS）──────────────────────────────────────────────
-- 玩家只能读写自己的数据，管理员通过 service_role 绕过 RLS

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- profiles：玩家可以读写自己的 profile
CREATE POLICY "profile_self_access" ON profiles
  FOR ALL USING (auth.uid() = id);

-- player_saves：玩家可以读写自己的存档
CREATE POLICY "save_self_access" ON player_saves
  FOR ALL USING (auth.uid() = player_id);

-- player_resources：玩家只能读自己的资源（写必须走服务端 service_role）
CREATE POLICY "resources_self_read" ON player_resources
  FOR SELECT USING (auth.uid() = player_id);

-- admin_actions：玩家不可见（只有 service_role 可操作）
-- 不需要创建 policy，RLS 开启后默认拒绝所有非 service_role 访问

-- ── 完成提示 ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ 大宋造反模拟器数据库初始化完成';
  RAISE NOTICE '   表已创建: profiles, player_resources, player_saves, admin_actions';
  RAISE NOTICE '   触发器已创建: 新用户自动建 profile';
  RAISE NOTICE '   RLS 已启用: 玩家数据隔离保护';
END $$;
