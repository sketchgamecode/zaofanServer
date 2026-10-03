import { Router, Request, Response } from 'express';
import { serverGlobalConfig } from '../config/serverGlobalConfig.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { loadOrCreateGameState, saveGameState, resetGameStateForPlayer } from '../lib/gameStateStore.js';
import { loadOrCreateWorldState } from '../lib/worldStateStore.js';
import { getNow } from '../lib/time.js';
import {
  baseWeapons,
  armors,
  shields,
  materials,
  shaftMaterials,
  armorMaterialUpgrades,
  arrows,
  getWeaponFinal,
  getArmorFinal,
  getShieldFinal,
} from '../lib/equipmentData.js';
import type {
  EquipmentItem,
  EquipmentSlot,
  GameState,
  ItemRarity,
  PlayerClassId,
  BaseAttributeValues,
} from '../types/gameState.js';

const router = Router();

// ==========================================
// 辅助函数：生成自定义/指定装备物品
// ==========================================
function buildCustomItem(params: {
  playerLevel: number;
  slot: EquipmentSlot;
  itemId: string;
  name?: string;
  rarity?: ItemRarity;
  material?: string;
  craft?: string | null;
  shaft?: string | null;
  upgrade?: string | null;
  arrow?: string | null;
  bonusAttributes?: Partial<BaseAttributeValues>;
}): EquipmentItem {
  const {
    slot,
    itemId,
    rarity = 2,
    material = 'chaogang',
    craft = null,
    shaft = null,
    upgrade = null,
    arrow = 'normal',
    bonusAttributes = {},
  } = params;

  let name = params.name || '';
  let desc = '';
  let subType: 'weapon' | 'shield' | 'none' = 'none';
  let armorVal: number | undefined;
  let weaponDamageVal: { min: number; max: number } | undefined;

  if (slot === 'weapon') {
    subType = 'weapon';
    const finalW = getWeaponFinal(itemId, material, craft, shaft, arrow);
    weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };
    if (!name) {
      const base = baseWeapons.find((w) => w.id === itemId);
      const matName = materials.find((m) => m.id === material)?.name ?? '';
      const craftName = craft ? craft : '';
      const shaftName = shaft ? shaftMaterials.find((s) => s.id === shaft)?.name.slice(0, 3) ?? '' : '';
      name = `${craftName}${shaftName}${matName}${base?.name || '兵刃'}`;
    }
    desc = `攻击力: ${weaponDamageVal.min}，破甲: P${getWeaponFinal(itemId, material, craft, shaft, arrow).p}，耗体: ${getWeaponFinal(itemId, material, craft, shaft, arrow).cost}`;
  } else if (slot === 'body') {
    subType = 'none';
    const finalA = getArmorFinal(itemId, upgrade);
    armorVal = finalA.reduce;
    if (!name) {
      const base = armors.find((a) => a.id === itemId);
      const upName = upgrade ? armorMaterialUpgrades.find((u) => u.id === upgrade)?.name ?? '' : '';
      name = `${upName}${base?.name || '甲胄'}`;
    }
    desc = `防护级: A${getArmorFinal(itemId, upgrade).a}，减伤: ${armorVal}，闪避: +${getArmorFinal(itemId, upgrade).dodge}%`;
  } else {
    // offHand: 盾牌 或 双持武器
    const isShield = shields.some((s) => s.id === itemId);
    if (isShield) {
      subType = 'shield';
      armorVal = 0;
      const finalS = getShieldFinal(itemId);
      if (!name) {
        const base = shields.find((s) => s.id === itemId);
        name = `精装${base?.name || '盾牌'}`;
      }
      desc = `格挡加成: +${Math.round(finalS.blockMod * 100)}%，格挡耗体修正: ${finalS.blockCostMod}`;
    } else {
      subType = 'weapon';
      const finalW = getWeaponFinal(itemId, material, craft, null, null);
      weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };
      if (!name) {
        const base = baseWeapons.find((w) => w.id === itemId);
        const matName = materials.find((m) => m.id === material)?.name ?? '';
        name = `${matName}${base?.name || '短兵'}·副手`;
      }
      desc = `双持副手武器：伤害 ${weaponDamageVal.min}，破甲 P${finalW.p}`;
    }
  }

  const id = `debug_${slot}_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;

  return {
    id,
    name,
    description: desc,
    slot,
    rarity,
    sellPrice: 100 * (rarity + 1),
    bonusAttributes: bonusAttributes as Record<string, number>,
    itemId,
    subType,
    armor: armorVal,
    weaponDamage: weaponDamageVal,
    material,
    craft,
    shaft,
    upgrade,
    arrow,
  };
}

// ==========================================
// API: 获取元数据（所有装备/材料/词条列表）
// ==========================================
router.get('/items-meta', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      weapons: baseWeapons,
      armors,
      shields,
      materials,
      shaftMaterials,
      armorMaterialUpgrades,
      arrows,
    },
  });
});

// ==========================================
// API: 获取玩家列表
// ==========================================
router.get('/players', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data: saves, error: savesError } = await supabaseAdmin
      .from('player_saves')
      .select('player_id, updated_at, save_version, game_state')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (savesError) {
      res.status(500).json({ ok: false, error: savesError.message });
      return;
    }

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, qq_name, created_at, last_login_at')
      .limit(100);

    const profileMap = new Map<string, any>();
    (profiles || []).forEach((p) => profileMap.set(p.id, p));

    const playerList = (saves || []).map((s) => {
      const gs = s.game_state as GameState | undefined;
      const prof = profileMap.get(s.player_id);
      return {
        playerId: s.player_id,
        displayName: gs?.player?.displayName || prof?.display_name || prof?.qq_name || '未命名角色',
        level: gs?.player?.level ?? 1,
        classId: gs?.player?.classId ?? 'CLASS_A',
        copper: gs?.resources?.copper ?? 0,
        tokens: gs?.resources?.tokens ?? 0,
        hourglasses: gs?.resources?.hourglasses ?? 0,
        updatedAt: s.updated_at,
      };
    });

    // 把 profiles 中有但 saves 中还没有的也合并展示
    (profiles || []).forEach((p) => {
      if (!playerList.some((item) => item.playerId === p.id)) {
        playerList.push({
          playerId: p.id,
          displayName: p.display_name || p.qq_name || '新注册未建角',
          level: 1,
          classId: 'CLASS_A',
          copper: 0,
          tokens: 0,
          hourglasses: 0,
          updatedAt: p.created_at,
        });
      }
    });

    res.json({ ok: true, players: playerList });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 获取指定玩家完整存档
// ==========================================
router.get('/player/:id', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const globalWorld = await loadOrCreateWorldState(now);
    loadResult.state.world = globalWorld;

    res.json({
      ok: true,
      data: {
        state: loadResult.state,
        created: loadResult.created,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 修改玩家资源
// ==========================================
router.post('/player/:id/resources', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();
  const { copper, tokens, hourglasses, prestige } = req.body;

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const state = loadResult.state;

    if (typeof copper === 'number') state.resources.copper = Math.max(0, Math.floor(copper));
    if (typeof tokens === 'number') state.resources.tokens = Math.max(0, Math.floor(tokens));
    if (typeof hourglasses === 'number') state.resources.hourglasses = Math.max(0, Math.floor(hourglasses));
    if (typeof prestige === 'number') state.resources.prestige = Math.max(0, Math.floor(prestige));

    await saveGameState(playerId, state, now);

    res.json({
      ok: true,
      message: '资源修改成功',
      resources: state.resources,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 修改玩家等级与五维属性
// ==========================================
router.post('/player/:id/attributes', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();
  const { level, exp, classId, displayName, attributes } = req.body;

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const state = loadResult.state;

    if (typeof level === 'number') state.player.level = Math.max(1, Math.min(100, Math.floor(level)));
    if (typeof exp === 'number') state.player.exp = Math.max(0, Math.floor(exp));
    if (typeof classId === 'string') state.player.classId = classId as PlayerClassId;
    if (typeof displayName === 'string' && displayName.trim()) state.player.displayName = displayName.trim();

    if (attributes && typeof attributes === 'object') {
      if (typeof attributes.strength === 'number') state.attributes.strength = Math.max(1, Math.floor(attributes.strength));
      if (typeof attributes.intelligence === 'number') state.attributes.intelligence = Math.max(1, Math.floor(attributes.intelligence));
      if (typeof attributes.agility === 'number') state.attributes.agility = Math.max(1, Math.floor(attributes.agility));
      if (typeof attributes.constitution === 'number') state.attributes.constitution = Math.max(1, Math.floor(attributes.constitution));
      if (typeof attributes.luck === 'number') state.attributes.luck = Math.max(1, Math.floor(attributes.luck));
    }

    await saveGameState(playerId, state, now);

    res.json({
      ok: true,
      message: '角色属性修改成功',
      player: state.player,
      attributes: state.attributes,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 发放/生成装备道具
// ==========================================
router.post('/player/:id/grant-item', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();
  const {
    slot,
    itemId,
    name,
    rarity = 2,
    material = 'chaogang',
    craft = null,
    shaft = null,
    upgrade = null,
    arrow = 'normal',
    bonusAttributes = {},
    equipNow = false,
  } = req.body;

  if (!slot || !itemId) {
    res.status(400).json({ ok: false, error: '缺少必需参数: slot, itemId' });
    return;
  }

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const state = loadResult.state;

    const newItem = buildCustomItem({
      playerLevel: state.player.level,
      slot,
      itemId,
      name,
      rarity: Number(rarity) as ItemRarity,
      material,
      craft,
      shaft,
      upgrade,
      arrow,
      bonusAttributes,
    });

    if (equipNow) {
      // 直接穿戴
      state.equipment.equipped[slot as EquipmentSlot] = newItem;
    } else {
      // 放入背包
      state.inventory.items ??= [];
      state.inventory.items.push(newItem);
    }

    await saveGameState(playerId, state, now);

    res.json({
      ok: true,
      message: equipNow ? `装备【${newItem.name}】已直接穿戴` : `道具【${newItem.name}】已放入背包`,
      item: newItem,
      inventoryCount: state.inventory.items.length,
      equipped: state.equipment.equipped,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 一键快捷作弊预设 (Presets)
// ==========================================
router.post('/player/:id/grant-preset', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();
  const { preset } = req.body;

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const state = loadResult.state;
    state.inventory.items ??= [];

    if (preset === 'max_resources') {
      state.resources.copper = 10000000;
      state.resources.tokens = 9999;
      state.resources.hourglasses = 9999;
      state.resources.prestige = 50000;
    } else if (preset === 'max_level_stats') {
      state.player.level = 80;
      state.player.exp = 0;
      state.attributes.strength = 999;
      state.attributes.intelligence = 999;
      state.attributes.agility = 999;
      state.attributes.constitution = 999;
      state.attributes.luck = 999;
      state.resources.copper = 10000000;
      state.resources.tokens = 9999;
      state.resources.hourglasses = 9999;
    } else if (preset === 'god_gear_blade') {
      // 镔铁柳叶双刀 + 镔铁明光铠
      const w1 = buildCustomItem({
        playerLevel: 80,
        slot: 'weapon',
        itemId: 'dao_liuye',
        rarity: 4,
        material: 'bintie',
        craft: 'guangang',
        name: '镔铁灌钢柳叶双刀·主',
        bonusAttributes: { strength: 30, agility: 50 },
      });
      const w2 = buildCustomItem({
        playerLevel: 80,
        slot: 'offHand',
        itemId: 'dao_liuye',
        rarity: 4,
        material: 'bintie',
        craft: 'guangang',
        name: '镔铁灌钢柳叶双刀·副',
        bonusAttributes: { agility: 50, luck: 30 },
      });
      const body = buildCustomItem({
        playerLevel: 80,
        slot: 'body',
        itemId: 'mingguang',
        rarity: 4,
        upgrade: 'bintie',
        name: '西域镔铁百炼明光铠',
        bonusAttributes: { constitution: 80 },
      });
      state.equipment.equipped.weapon = w1;
      state.equipment.equipped.offHand = w2;
      state.equipment.equipped.body = body;
    } else if (preset === 'god_gear_spear') {
      // 镔铁大枪 + 明光铠
      const spear = buildCustomItem({
        playerLevel: 80,
        slot: 'weapon',
        itemId: 'qiang_daqiang',
        rarity: 4,
        material: 'bintie',
        craft: 'guangang',
        shaft: 'jizhu',
        name: '镔铁积竹百炼大枪',
        bonusAttributes: { strength: 60, agility: 40 },
      });
      const body = buildCustomItem({
        playerLevel: 80,
        slot: 'body',
        itemId: 'mingguang',
        rarity: 4,
        upgrade: 'bintie',
        name: '西域镔铁百炼明光铠',
        bonusAttributes: { constitution: 80 },
      });
      state.equipment.equipped.weapon = spear;
      state.equipment.equipped.offHand = null;
      state.equipment.equipped.body = body;
    } else if (preset === 'god_gear_blunt') {
      // 镔铁骨朵锤 + 铁装藤牌 + 锁子甲
      const blunt = buildCustomItem({
        playerLevel: 80,
        slot: 'weapon',
        itemId: 'chui_guduo',
        rarity: 4,
        material: 'bintie',
        craft: 'guangang',
        name: '镔铁重装骨朵锤',
        bonusAttributes: { strength: 80 },
      });
      const shield = buildCustomItem({
        playerLevel: 80,
        slot: 'offHand',
        itemId: 'tengpai',
        rarity: 4,
        name: '百炼铁装大藤牌',
        bonusAttributes: { constitution: 50 },
      });
      const body = buildCustomItem({
        playerLevel: 80,
        slot: 'body',
        itemId: 'suozi',
        rarity: 4,
        upgrade: 'bintie',
        name: '名器镔铁锁子软甲',
        bonusAttributes: { constitution: 70 },
      });
      state.equipment.equipped.weapon = blunt;
      state.equipment.equipped.offHand = shield;
      state.equipment.equipped.body = body;
    } else if (preset === 'all_weapons') {
      // 赠送全 14 种武器各一把
      baseWeapons.forEach((w) => {
        if (w.id === 'tushou') return;
        const item = buildCustomItem({
          playerLevel: state.player.level,
          slot: 'weapon',
          itemId: w.id,
          rarity: 3,
          material: 'jinggang',
          craft: 'guangang',
          shaft: w.class === 'spear' ? 'baila' : null,
          arrow: w.class === 'bow' ? 'pierce' : null,
        });
        state.inventory.items.push(item);
      });
    } else if (preset === 'all_armors') {
      // 赠送全 11 种铠甲与盾牌各一件
      armors.forEach((a) => {
        if (a.id === 'buyi') return;
        const item = buildCustomItem({
          playerLevel: state.player.level,
          slot: 'body',
          itemId: a.id,
          rarity: 3,
          upgrade: 'bailian',
        });
        state.inventory.items.push(item);
      });
      shields.forEach((s) => {
        const item = buildCustomItem({
          playerLevel: state.player.level,
          slot: 'offHand',
          itemId: s.id,
          rarity: 3,
        });
        state.inventory.items.push(item);
      });
    } else if (preset === 'clear_inventory') {
      state.inventory.items = [];
    }

    await saveGameState(playerId, state, now);

    res.json({
      ok: true,
      message: `预设【${preset}】已生效`,
      state,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 删除/卸下装备
// ==========================================
router.delete('/player/:id/item/:itemId', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const targetItemId = String(req.params.itemId);
  const now = getNow();

  try {
    const loadResult = await loadOrCreateGameState(playerId, now);
    const state = loadResult.state;

    // 检查是否在装备栏中
    if (state.equipment.equipped.weapon?.id === targetItemId) state.equipment.equipped.weapon = null;
    if (state.equipment.equipped.offHand?.id === targetItemId) state.equipment.equipped.offHand = null;
    if (state.equipment.equipped.body?.id === targetItemId) state.equipment.equipped.body = null;

    // 检查背包
    if (state.inventory?.items) {
      state.inventory.items = state.inventory.items.filter((item) => item.id !== targetItemId);
    }

    await saveGameState(playerId, state, now);

    res.json({
      ok: true,
      message: '物品已移除',
      equipped: state.equipment.equipped,
      inventoryCount: state.inventory.items?.length ?? 0,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 直接覆盖保存自定义 GameState JSON
// ==========================================
router.post('/player/:id/save-raw', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();
  const { rawState } = req.body;

  if (!rawState || typeof rawState !== 'object') {
    res.status(400).json({ ok: false, error: 'rawState 必须是有效的 GameState JSON 对象' });
    return;
  }

  try {
    await saveGameState(playerId, rawState as GameState, now);
    res.json({ ok: true, message: '原始 GameState 存档已成功保存' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// API: 重置玩家存档为初始状态
// ==========================================
router.post('/player/:id/reset', async (req: Request, res: Response): Promise<void> => {
  const playerId = String(req.params.id);
  const now = getNow();

  try {
    const newState = await resetGameStateForPlayer(playerId, now);
    res.json({ ok: true, message: '玩家存档已重置为初始状态', state: newState });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// ==========================================
// 遗留 API: 全局测试配置
// ==========================================
router.get('/config', (_req, res) => {
  res.json({
    ok: true,
    config: {
      ...serverGlobalConfig,
      initialPlayerState: {
        copper: 5000,
        tokens: 10,
        startingWeapons: [
          { itemId: 'dao_hengdao', name: '凡级横刀' },
          { itemId: 'jian_danshou', name: '凡级单手剑' },
          { itemId: 'bian_tiebian', name: '凡级铁鞭' },
          { itemId: 'gong_mugong', name: '凡级木弓' },
        ],
      },
    },
  });
});

router.post('/config', (req, res) => {
  const { debugTavernXpMultiplier, debugTavernCopperMultiplier } = req.body;
  if (typeof debugTavernXpMultiplier === 'number') {
    serverGlobalConfig.debugTavernXpMultiplier = debugTavernXpMultiplier;
  }
  if (typeof debugTavernCopperMultiplier === 'number') {
    serverGlobalConfig.debugTavernCopperMultiplier = debugTavernCopperMultiplier;
  }
  res.json({ ok: true, config: serverGlobalConfig });
});

// ==========================================
// Web GUI: 单页面可视化调试管理控制台
// ==========================================
router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:;");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>大宋造反模拟器 · 开发者调试控制台</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151d30;
      --card-border: #232f48;
      --accent: #f59e0b;
      --accent-hover: #d97706;
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --success: #10b981;
      --danger: #ef4444;
      --cyan: #06b6d4;
      --purple: #8b5cf6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 20px;
    }
    .header h1 { font-size: 22px; color: var(--accent); display: flex; align-items: center; gap: 8px; }
    .header .subtitle { font-size: 13px; color: var(--text-muted); }
    
    .player-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .player-bar select, .player-bar input {
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      min-width: 260px;
    }
    .btn {
      background: var(--accent);
      color: #000;
      font-weight: 600;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-secondary { background: #334155; color: #fff; }
    .btn-secondary:hover { background: #475569; }
    .btn-danger { background: var(--danger); color: #fff; }
    .btn-danger:hover { background: #dc2626; }
    .btn-success { background: var(--success); color: #fff; }
    .btn-success:hover { background: #059669; }
    .btn-purple { background: var(--purple); color: #fff; }
    .btn-purple:hover { background: #7c3aed; }
    .btn-sm { padding: 4px 10px; font-size: 12px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 8px;
    }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }
    .form-group input, .form-group select {
      width: 100%;
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: #fff;
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 13px;
    }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }

    .preset-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .item-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 280px;
      overflow-y: auto;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      border: 1px solid var(--card-border);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
    }
    .item-info { display: flex; flex-direction: column; gap: 2px; }
    .item-name { font-weight: 600; color: #38bdf8; }
    .item-desc { font-size: 11px; color: var(--text-muted); }
    .rarity-4 { color: #f59e0b !important; }
    .rarity-3 { color: #c084fc !important; }
    .rarity-2 { color: #60a5fa !important; }
    .rarity-1 { color: #4ade80 !important; }
    .rarity-0 { color: #94a3b8 !important; }

    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #1e293b;
      color: #fff;
      padding: 12px 20px;
      border-radius: 8px;
      border-left: 4px solid var(--success);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.3s;
      z-index: 1000;
    }
    .toast.show { transform: translateY(0); opacity: 1; }
    .toast.error { border-left-color: var(--danger); }

    textarea {
      width: 100%;
      height: 180px;
      background: #0f172a;
      border: 1px solid var(--card-border);
      color: #38bdf8;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 6px;
      resize: vertical;
    }
    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #334155;
      color: #94a3b8;
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>⚔️ 大宋造反模拟器 · 开发者调试控制台</h1>
      <div class="subtitle">免登录鉴权 · 自由修改玩家资源、等级、五维属性与自定义械斗神装道具</div>
    </div>
    <div>
      <span class="badge" id="serverTimeBadge">Server Ready</span>
    </div>
  </div>

  <!-- 玩家选择条 -->
  <div class="player-bar">
    <label style="font-weight:600;font-size:13px;color:var(--accent)">👤 选择存档:</label>
    <select id="playerSelect" onchange="onPlayerSelected(this.value)">
      <option value="">-- 加载中... --</option>
    </select>
    <button class="btn btn-secondary btn-sm" onclick="loadPlayers()">🔄 刷新列表</button>
    <input type="text" id="manualPlayerId" placeholder="或直接输入 Player ID..." style="min-width:220px">
    <button class="btn btn-sm" onclick="loadPlayerManual()">⚡ 加载指定玩家</button>
  </div>

  <div id="dashboard" style="display:none">
    
    <!-- 顶部核心状态栏 -->
    <div style="background:var(--card-bg);border:1px solid var(--card-border);padding:12px 16px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <span style="font-size:16px;font-weight:bold;color:#38bdf8" id="curName">-</span>
        <span class="badge" style="margin-left:8px" id="curClass">-</span>
        <span class="badge" id="curLevel">-</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:12px" id="curId">-</span>
      </div>
      <div>
        <button class="btn btn-danger btn-sm" onclick="resetCurPlayer()">🗑️ 重置为初始存档</button>
      </div>
    </div>

    <!-- 栅格卡片 -->
    <div class="grid">

      <!-- 卡片 1: 资源修改 -->
      <div class="card">
        <div class="card-title">
          <span>💰 资源修改</span>
          <button class="btn btn-sm btn-success" onclick="saveResources()">💾 保存资源</button>
        </div>
        <div class="row-2">
          <div class="form-group">
            <label>铜钱 (Copper)</label>
            <input type="number" id="resCopper" value="0">
          </div>
          <div class="form-group">
            <label>令牌/蘑菇 (Tokens)</label>
            <input type="number" id="resTokens" value="0">
          </div>
        </div>
        <div class="row-2">
          <div class="form-group">
            <label>沙漏 (Hourglasses)</label>
            <input type="number" id="resHourglasses" value="0">
          </div>
          <div class="form-group">
            <label>声望 (Prestige)</label>
            <input type="number" id="resPrestige" value="0">
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
          <button class="btn btn-secondary btn-sm" onclick="addRes('resCopper', 100000)">+10万铜钱</button>
          <button class="btn btn-secondary btn-sm" onclick="addRes('resCopper', 1000000)">+100万铜钱</button>
          <button class="btn btn-secondary btn-sm" onclick="addRes('resTokens', 500)">+500令牌</button>
          <button class="btn btn-secondary btn-sm" onclick="addRes('resHourglasses', 500)">+500沙漏</button>
        </div>
      </div>

      <!-- 卡片 2: 等级与五维属性修改 -->
      <div class="card">
        <div class="card-title">
          <span>⚡ 等级与基础五维属性</span>
          <button class="btn btn-sm btn-success" onclick="saveAttributes()">💾 保存属性</button>
        </div>
        <div class="row-3">
          <div class="form-group">
            <label>等级 (Level 1-80)</label>
            <input type="number" id="attrLevel" value="1">
          </div>
          <div class="form-group">
            <label>经验值 (EXP)</label>
            <input type="number" id="attrExp" value="0">
          </div>
          <div class="form-group">
            <label>职业 (Class)</label>
            <select id="attrClass">
              <option value="CLASS_A">猛将 (Warrior/力)</option>
              <option value="CLASS_B">游侠 (Scout/敏)</option>
              <option value="CLASS_C">谋士 (Mage/智)</option>
              <option value="CLASS_D">杀手 (Assassin/敏)</option>
              <option value="CLASS_E">绿林好汉 (Berserker/力)</option>
            </select>
          </div>
        </div>
        <div class="row-3">
          <div class="form-group">
            <label>力量 (Strength)</label>
            <input type="number" id="attrStr" value="10">
          </div>
          <div class="form-group">
            <label>敏捷 (Agility)</label>
            <input type="number" id="attrAgi" value="10">
          </div>
          <div class="form-group">
            <label>智力 (Intelligence)</label>
            <input type="number" id="attrInt" value="10">
          </div>
        </div>
        <div class="row-2">
          <div class="form-group">
            <label>体质 (Constitution/决定血量)</label>
            <input type="number" id="attrCon" value="10">
          </div>
          <div class="form-group">
            <label>幸运 (Luck/决定暴击)</label>
            <input type="number" id="attrLuk" value="10">
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-secondary btn-sm" onclick="setAllStats(100)">全五维设为 100</button>
          <button class="btn btn-secondary btn-sm" onclick="setAllStats(999)">全五维设为 999 (满神)</button>
        </div>
      </div>

      <!-- 卡片 3: 一键作弊与测试套件 -->
      <div class="card">
        <div class="card-title">
          <span>👑 快捷测试预设套件 (One-Click Cheats)</span>
        </div>
        <div class="preset-grid">
          <button class="btn btn-purple btn-sm" onclick="applyPreset('max_level_stats')">🌟 一键满级满属性+满资源</button>
          <button class="btn btn-sm" onclick="applyPreset('max_resources')">💎 满资源 (1000万铜钱/9999令)</button>
          <button class="btn btn-secondary btn-sm" onclick="applyPreset('god_gear_blade')">🗡️ 镔铁双刀流神装 (双柳叶+明光)</button>
          <button class="btn btn-secondary btn-sm" onclick="applyPreset('god_gear_spear')">🔱 镔铁破阵枪霸套 (大枪+明光)</button>
          <button class="btn btn-secondary btn-sm" onclick="applyPreset('god_gear_blunt')">🔨 破甲钝击震伤套 (骨朵+盾+锁子)</button>
          <button class="btn btn-secondary btn-sm" onclick="applyPreset('all_weapons')">📦 发放全 14 种兵刃到背包</button>
          <button class="btn btn-secondary btn-sm" onclick="applyPreset('all_armors')">🛡️ 发放全 11 种甲胄/盾到背包</button>
          <button class="btn btn-danger btn-sm" onclick="applyPreset('clear_inventory')">🧹 清空背包全部道具</button>
        </div>
      </div>

      <!-- 卡片 4: 装备道具定制与发放器 -->
      <div class="card">
        <div class="card-title">
          <span>🛠️ 道具/装备定制生成器</span>
          <button class="btn btn-sm" onclick="grantCustomItem(false)">📥 放入背包</button>
          <button class="btn btn-sm btn-success" onclick="grantCustomItem(true)">⚡ 直接穿戴</button>
        </div>
        <div class="row-3">
          <div class="form-group">
            <label>装备部位 (Slot)</label>
            <select id="makeSlot" onchange="onSlotChanged(this.value)">
              <option value="weapon">武器 (Weapon)</option>
              <option value="body">防具 (Body)</option>
              <option value="offHand">副手/盾牌 (OffHand)</option>
            </select>
          </div>
          <div class="form-group">
            <label>装备模板 (Base Item)</label>
            <select id="makeItem"></select>
          </div>
          <div class="form-group">
            <label>品质 (Rarity)</label>
            <select id="makeRarity">
              <option value="4">名器 (Rarity 4 · 金)</option>
              <option value="3" selected>绝品 (Rarity 3 · 紫)</option>
              <option value="2">精良 (Rarity 2 · 蓝)</option>
              <option value="1">良好 (Rarity 1 · 绿)</option>
              <option value="0">凡品 (Rarity 0 · 白)</option>
            </select>
          </div>
        </div>

        <div class="row-3">
          <div class="form-group">
            <label>主要材质 (Material)</label>
            <select id="makeMaterial">
              <option value="bintie" selected>镔铁 (Tier 5 · 花纹管制)</option>
              <option value="jinggang">精钢百炼 (Tier 4)</option>
              <option value="chaogang">炒钢 (Tier 3 · 基准)</option>
              <option value="shutie">熟铁 (Tier 2)</option>
              <option value="shengtie">生铁 (Tier 1)</option>
              <option value="qingtong">青铜 (Tier 0)</option>
            </select>
          </div>
          <div class="form-group">
            <label>复合工艺 (Craft - 武器)</label>
            <select id="makeCraft">
              <option value="guangang" selected>灌钢 (P+1, 伤害+5%)</option>
              <option value="baogang">包钢</option>
              <option value="jiagang">夹钢</option>
              <option value="">无</option>
            </select>
          </div>
          <div class="form-group">
            <label>枪杆/柄材 (Shaft - 长枪)</label>
            <select id="makeShaft">
              <option value="jizhu" selected>积竹木柲 (命中+4, 耗体-2)</option>
              <option value="baila">白蜡杆 (命中+2, 耗体-1)</option>
              <option value="zaomu">枣木黄杨 (基准)</option>
              <option value="zamu">杂木杨木</option>
            </select>
          </div>
        </div>

        <div class="row-2">
          <div class="form-group">
            <label>防具材质升级 (Upgrade - 铠甲)</label>
            <select id="makeUpgrade">
              <option value="bintie" selected>镔铁加固 (减伤+3, 耐久+45)</option>
              <option value="bailian">百炼精钢 (减伤+2, 耐久+30)</option>
              <option value="jinggang">精钢加固 (减伤+1, 耐久+15)</option>
              <option value="">无强化</option>
            </select>
          </div>
          <div class="form-group">
            <label>箭矢类型 (Arrow - 弓)</label>
            <select id="makeArrow">
              <option value="pierce" selected>穿甲箭 (P+1, 穿透增强)</option>
              <option value="heavy">重箭</option>
              <option value="normal">普通箭</option>
            </select>
          </div>
        </div>
      </div>

    </div>

    <!-- 装备栏与背包查看 -->
    <div class="grid">
      <!-- 已穿戴装备 -->
      <div class="card">
        <div class="card-title">
          <span>🥋 当前已穿戴装备 (Equipped)</span>
        </div>
        <div id="equippedList" class="item-list"></div>
      </div>

      <!-- 背包列表 -->
      <div class="card">
        <div class="card-title">
          <span>🎒 背包物品清单 (<span id="invCount">0</span> 件)</span>
        </div>
        <div id="invList" class="item-list"></div>
      </div>
    </div>

    <!-- 原始存档 JSON 编辑器 -->
    <div class="card">
      <div class="card-title">
        <span>📝 原始存档 GameState JSON 编辑与查看</span>
        <div>
          <button class="btn btn-secondary btn-sm" onclick="formatRawJson()">🔍 格式化</button>
          <button class="btn btn-success btn-sm" onclick="saveRawJson()">💾 覆盖保存 JSON</button>
        </div>
      </div>
      <textarea id="rawJsonText"></textarea>
    </div>

  </div>

  <div id="toast" class="toast">操作成功</div>

  <script>
    let meta = { weapons: [], armors: [], shields: [] };
    let curState = null;
    let curPlayerId = '';

    function showToast(msg, isError = false) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.className = isError ? 'toast show error' : 'toast show';
      setTimeout(() => t.className = 'toast', 3000);
    }

    async function loadMeta() {
      try {
        const res = await fetch('/api/debug/items-meta');
        const json = await res.json();
        if (json.ok) {
          meta = json.data;
          onSlotChanged('weapon');
        }
      } catch (e) { console.error(e); }
    }

    function onSlotChanged(slot) {
      const sel = document.getElementById('makeItem');
      sel.innerHTML = '';
      if (slot === 'weapon') {
        meta.weapons.forEach(w => {
          if (w.id === 'tushou') return;
          const opt = document.createElement('option');
          opt.value = w.id;
          opt.innerText = \`\${w.name} (\${w.class} · 基础伤害 \${w.dmg})\`;
          sel.appendChild(opt);
        });
      } else if (slot === 'body') {
        meta.armors.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.innerText = \`\${a.name} (甲阶 A\${a.a} · 减伤 \${a.reduce})\`;
          sel.appendChild(opt);
        });
      } else {
        // offHand
        meta.shields.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.innerText = \`[盾牌] \${s.name} (格挡 +\${s.block_mod*100}%)\`;
          sel.appendChild(opt);
        });
        meta.weapons.filter(w => w.dual_allowed || w.class === 'blade').forEach(w => {
          const opt = document.createElement('option');
          opt.value = w.id;
          opt.innerText = \`[双持副手] \${w.name}\`;
          sel.appendChild(opt);
        });
      }
    }

    async function loadPlayers() {
      try {
        const res = await fetch('/api/debug/players');
        const json = await res.json();
        const sel = document.getElementById('playerSelect');
        sel.innerHTML = '<option value="">-- 请选择玩家存档 --</option>';
        if (json.ok && json.players) {
          json.players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.playerId;
            opt.innerText = \`\${p.displayName} (Lv.\${p.level} · 铜钱 \${p.copper}) - ID: \${p.playerId.slice(0, 10)}...\`;
            sel.appendChild(opt);
          });
          if (curPlayerId) sel.value = curPlayerId;
        }
      } catch (err) {
        showToast('获取玩家列表失败', true);
      }
    }

    async function loadPlayerData(id) {
      if (!id) return;
      curPlayerId = id;
      try {
        const res = await fetch(\`/api/debug/player/\${encodeURIComponent(id)}\`);
        const json = await res.json();
        if (json.ok && json.data?.state) {
          curState = json.data.state;
          renderDashboard();
          showToast('存档加载成功');
        } else {
          showToast(json.error || '加载失败', true);
        }
      } catch (err) {
        showToast('请求出错: ' + err.message, true);
      }
    }

    function onPlayerSelected(id) {
      if (id) loadPlayerData(id);
    }

    function loadPlayerManual() {
      const id = document.getElementById('manualPlayerId').value.trim();
      if (id) loadPlayerData(id);
      else showToast('请输入 Player ID', true);
    }

    function renderDashboard() {
      if (!curState) return;
      document.getElementById('dashboard').style.display = 'block';

      // 顶部
      document.getElementById('curName').innerText = curState.player?.displayName || '无名好汉';
      document.getElementById('curClass').innerText = curState.player?.classId || 'CLASS_A';
      document.getElementById('curLevel').innerText = \`Lv.\${curState.player?.level || 1}\`;
      document.getElementById('curId').innerText = \`ID: \${curPlayerId}\`;

      // 资源
      document.getElementById('resCopper').value = curState.resources?.copper ?? 0;
      document.getElementById('resTokens').value = curState.resources?.tokens ?? 0;
      document.getElementById('resHourglasses').value = curState.resources?.hourglasses ?? 0;
      document.getElementById('resPrestige').value = curState.resources?.prestige ?? 0;

      // 属性
      document.getElementById('attrLevel').value = curState.player?.level ?? 1;
      document.getElementById('attrExp').value = curState.player?.exp ?? 0;
      document.getElementById('attrClass').value = curState.player?.classId ?? 'CLASS_A';
      document.getElementById('attrStr').value = curState.attributes?.strength ?? 10;
      document.getElementById('attrAgi').value = curState.attributes?.agility ?? 10;
      document.getElementById('attrInt').value = curState.attributes?.intelligence ?? 10;
      document.getElementById('attrCon').value = curState.attributes?.constitution ?? 10;
      document.getElementById('attrLuk').value = curState.attributes?.luck ?? 10;

      // 装备
      renderEquipped();
      renderInventory();

      // 原始 JSON
      document.getElementById('rawJsonText').value = JSON.stringify(curState, null, 2);
    }

    function renderEquipped() {
      const el = document.getElementById('equippedList');
      el.innerHTML = '';
      const slots = [
        { key: 'weapon', label: '主手兵刃' },
        { key: 'offHand', label: '副手/盾牌' },
        { key: 'body', label: '身穿甲胄' }
      ];
      slots.forEach(s => {
        const item = curState.equipment?.equipped?.[s.key];
        const row = document.createElement('div');
        row.className = 'item-row';
        if (item) {
          row.innerHTML = \`
            <div class="item-info">
              <div><span class="badge">\${s.label}</span> <span class="item-name rarity-\${item.rarity || 0}">\${item.name}</span></div>
              <div class="item-desc">\${item.description || ''}</div>
            </div>
            <div>
              <button class="btn btn-danger btn-sm" onclick="removeItem('\${item.id}')">卸下</button>
            </div>
          \`;
        } else {
          row.innerHTML = \`
            <div class="item-info">
              <div><span class="badge">\${s.label}</span> <span style="color:var(--text-muted)">[未装备]</span></div>
            </div>
          \`;
        }
        el.appendChild(row);
      });
    }

    function renderInventory() {
      const el = document.getElementById('invList');
      el.innerHTML = '';
      const items = curState.inventory?.items || [];
      document.getElementById('invCount').innerText = items.length;

      if (items.length === 0) {
        el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px">背包空空如也</div>';
        return;
      }

      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = \`
          <div class="item-info">
            <div><span class="badge">\${item.slot}</span> <span class="item-name rarity-\${item.rarity || 0}">\${item.name}</span></div>
            <div class="item-desc">\${item.description || ''}</div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-success" onclick="equipFromInv('\${item.id}')">穿上</button>
            <button class="btn btn-danger btn-sm" onclick="removeItem('\${item.id}')">删除</button>
          </div>
        \`;
        el.appendChild(row);
      });
    }

    function addRes(fieldId, count) {
      const el = document.getElementById(fieldId);
      el.value = (parseInt(el.value) || 0) + count;
    }

    function setAllStats(val) {
      document.getElementById('attrStr').value = val;
      document.getElementById('attrAgi').value = val;
      document.getElementById('attrInt').value = val;
      document.getElementById('attrCon').value = val;
      document.getElementById('attrLuk').value = val;
    }

    async function saveResources() {
      if (!curPlayerId) return;
      const payload = {
        copper: parseInt(document.getElementById('resCopper').value) || 0,
        tokens: parseInt(document.getElementById('resTokens').value) || 0,
        hourglasses: parseInt(document.getElementById('resHourglasses').value) || 0,
        prestige: parseInt(document.getElementById('resPrestige').value) || 0,
      };
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/resources\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        showToast('资源保存成功');
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    async function saveAttributes() {
      if (!curPlayerId) return;
      const payload = {
        level: parseInt(document.getElementById('attrLevel').value) || 1,
        exp: parseInt(document.getElementById('attrExp').value) || 0,
        classId: document.getElementById('attrClass').value,
        attributes: {
          strength: parseInt(document.getElementById('attrStr').value) || 10,
          agility: parseInt(document.getElementById('attrAgi').value) || 10,
          intelligence: parseInt(document.getElementById('attrInt').value) || 10,
          constitution: parseInt(document.getElementById('attrCon').value) || 10,
          luck: parseInt(document.getElementById('attrLuk').value) || 10,
        }
      };
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/attributes\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        showToast('属性修改成功');
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    async function grantCustomItem(equipNow) {
      if (!curPlayerId) return;
      const payload = {
        slot: document.getElementById('makeSlot').value,
        itemId: document.getElementById('makeItem').value,
        rarity: parseInt(document.getElementById('makeRarity').value) || 2,
        material: document.getElementById('makeMaterial').value,
        craft: document.getElementById('makeCraft').value || null,
        shaft: document.getElementById('makeShaft').value || null,
        upgrade: document.getElementById('makeUpgrade').value || null,
        arrow: document.getElementById('makeArrow').value || null,
        equipNow,
      };
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/grant-item\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.ok) {
        showToast(json.message);
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    async function applyPreset(preset) {
      if (!curPlayerId) return;
      if (preset === 'clear_inventory' && !confirm('确定要清空此玩家背包吗？')) return;
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/grant-preset\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset })
      });
      const json = await res.json();
      if (json.ok) {
        showToast(json.message);
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    async function removeItem(itemId) {
      if (!curPlayerId) return;
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/item/\${encodeURIComponent(itemId)}\`, {
        method: 'DELETE'
      });
      const json = await res.json();
      if (json.ok) {
        showToast('物品已移除');
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    async function equipFromInv(itemId) {
      if (!curPlayerId || !curState) return;
      const item = curState.inventory?.items?.find(i => i.id === itemId);
      if (!item) return;
      // 穿戴
      curState.equipment.equipped[item.slot] = item;
      curState.inventory.items = curState.inventory.items.filter(i => i.id !== itemId);
      saveRawJsonFromState();
    }

    async function resetCurPlayer() {
      if (!curPlayerId) return;
      if (!confirm('⚠️ 警告：确定要重置当前玩家的存档为初始状态吗？所有进度将丢失！')) return;
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/reset\`, { method: 'POST' });
      const json = await res.json();
      if (json.ok) {
        showToast('存档已重置');
        loadPlayerData(curPlayerId);
      } else showToast(json.error, true);
    }

    function formatRawJson() {
      try {
        const obj = JSON.parse(document.getElementById('rawJsonText').value);
        document.getElementById('rawJsonText').value = JSON.stringify(obj, null, 2);
      } catch (e) { showToast('JSON 解析失败', true); }
    }

    async function saveRawJson() {
      if (!curPlayerId) return;
      try {
        const rawState = JSON.parse(document.getElementById('rawJsonText').value);
        const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/save-raw\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawState })
        });
        const json = await res.json();
        if (json.ok) {
          showToast('原始 JSON 存档已更新');
          loadPlayerData(curPlayerId);
        } else showToast(json.error, true);
      } catch (e) { showToast('JSON 格式错误: ' + e.message, true); }
    }

    async function saveRawJsonFromState() {
      if (!curPlayerId || !curState) return;
      const res = await fetch(\`/api/debug/player/\${encodeURIComponent(curPlayerId)}/save-raw\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawState: curState })
      });
      const json = await res.json();
      if (json.ok) {
        showToast('装备更新成功');
        loadPlayerData(curPlayerId);
      }
    }

    // 初始化
    loadMeta();
    loadPlayers();
  </script>
</body>
</html>`;

  res.send(html);
});

export default router;

