import { Router, Request, Response } from 'express';
import { serverGlobalConfig } from '../config/serverGlobalConfig.js';
import { supabaseAdmin } from '../lib/supabase.js';
import { loadOrCreateGameState, saveGameState, resetGameStateForPlayer } from '../lib/gameStateStore.js';
import { loadOrCreateWorldState } from '../lib/worldStateStore.js';
import { getNow } from '../lib/time.js';
import {
  equipmentData,
  baseWeapons,
  armors,
  shields,
  materials,
  shaftMaterials,
  armorMaterialUpgrades,
  arrows,
  honorTitles,
  crafts,
  resolveItemIconId,
  composeItemName,
  getWeaponFinal,
  getArmorFinal,
  getShieldFinal,
  saveEquipmentData,
  createSnapshot,
  listSnapshots,
  rollbackSnapshot,
  deleteSnapshot,
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
      name = composeItemName({ slot: 'weapon', itemId, material, craft, shaft, arrow });
    }
    desc = `攻击力: ${weaponDamageVal.min}，破甲: P${getWeaponFinal(itemId, material, craft, shaft, arrow).p}，耗体: ${getWeaponFinal(itemId, material, craft, shaft, arrow).cost}`;
  } else if (slot === 'body') {
    subType = 'none';
    const finalA = getArmorFinal(itemId, upgrade);
    armorVal = finalA.reduce;
    if (!name) {
      name = composeItemName({ slot: 'body', itemId, upgrade });
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
        name = composeItemName({ slot: 'offHand', itemId });
      }
      desc = `格挡加成: +${Math.round(finalS.blockMod * 100)}%，格挡耗体修正: ${finalS.blockCostMod}`;
    } else {
      subType = 'weapon';
      const finalW = getWeaponFinal(itemId, material, craft, null, null);
      weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };
      if (!name) {
        name = composeItemName({ slot: 'offHand', itemId, material, craft });
      }
      desc = `双持副手武器：伤害 ${weaponDamageVal.min}，破甲 P${finalW.p}`;
    }
  }

  const id = `debug_${slot}_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
  const iconId = resolveItemIconId({ slot, itemId, id });

  return {
    id,
    name,
    description: desc,
    slot,
    rarity,
    iconId,
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
      crafts,
      shaftMaterials,
      armorMaterialUpgrades,
      arrows,
      honorTitles,
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
// API: 全服一键清档 (Wipe All Saves)
// ==========================================
router.post('/wipe-all-saves', async (_req: Request, res: Response): Promise<void> => {
  try {
    const p1 = supabaseAdmin.from('player_saves').delete().neq('player_id', '00000000-0000-0000-0000-000000000000');
    const p2 = supabaseAdmin.from('battle_replays').delete().neq('replay_id', '');
    const [res1, res2] = await Promise.all([p1, p2]);
    if (res1.error) throw new Error(`清空 player_saves 失败: ${res1.error.message}`);
    if (res2.error) throw new Error(`清空 battle_replays 失败: ${res2.error.message}`);

    res.json({
      ok: true,
      message: '全服玩家存档及战斗回放已彻底清空！下次登录将生成最新格式初始存档。',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '清档操作失败' });
  }
});

// ==========================================
// API: 装备配置数据读取与保存
// ==========================================
router.get('/config/equipment', (_req: Request, res: Response): void => {
  res.json({
    ok: true,
    data: equipmentData,
  });
});

router.post('/config/equipment', (req: Request, res: Response): void => {
  try {
    const newData = req.body;
    if (!newData || typeof newData !== 'object') {
      res.status(400).json({ ok: false, error: '无效的装备配置数据' });
      return;
    }
    saveEquipmentData(newData);
    res.json({
      ok: true,
      message: '装备数值配置已保存并实时热重载生效！',
      data: equipmentData,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '保存配置失败' });
  }
});

// ==========================================
// API: 数值配置快照与回滚
// ==========================================
router.get('/config/snapshots', (_req: Request, res: Response): void => {
  try {
    const snapshots = listSnapshots();
    res.json({ ok: true, snapshots });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '获取快照失败' });
  }
});

router.post('/config/snapshot', (req: Request, res: Response): void => {
  try {
    const { note } = req.body;
    const snap = createSnapshot(note || '手动备份');
    res.json({ ok: true, message: `配置快照【${snap.note}】已备份成功！`, snapshot: snap });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '创建快照失败' });
  }
});

router.post('/config/rollback', (req: Request, res: Response): void => {
  try {
    const { snapshotId } = req.body;
    if (!snapshotId) {
      res.status(400).json({ ok: false, error: '缺少 snapshotId' });
      return;
    }
    rollbackSnapshot(snapshotId);
    res.json({ ok: true, message: `已成功回滚到快照【${snapshotId}】，最新数值已热重载生效！` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '回滚快照失败' });
  }
});

router.delete('/config/snapshot/:id', (req: Request, res: Response): void => {
  try {
    const id = String(req.params.id);
    deleteSnapshot(id);
    res.json({ ok: true, message: '快照文件已删除' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : '删除快照失败' });
  }
});

// ==========================================
// Web GUI: 单页面可视化调试管理控制台
// ==========================================
router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:;");

  const html = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>大宋造反模拟器 · 开发者控制台</title>\n  <style>\n    :root {\n      --bg: #0b0f19;\n      --card-bg: #151d30;\n      --card-border: #232f48;\n      --accent: #f59e0b;\n      --accent-hover: #d97706;\n      --text: #e2e8f0;\n      --text-muted: #94a3b8;\n      --success: #10b981;\n      --danger: #ef4444;\n      --cyan: #06b6d4;\n      --purple: #8b5cf6;\n      --blue: #3b82f6;\n    }\n    * { box-sizing: border-box; margin: 0; padding: 0; }\n    body {\n      font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n      background: var(--bg);\n      color: var(--text);\n      line-height: 1.5;\n      padding: 20px;\n    }\n    .header {\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      padding-bottom: 16px;\n      border-bottom: 1px solid var(--card-border);\n      margin-bottom: 16px;\n    }\n    .header h1 { font-size: 22px; color: var(--accent); display: flex; align-items: center; gap: 8px; }\n    .header .subtitle { font-size: 13px; color: var(--text-muted); }\n    \n    /* 顶部主导航 Tab */\n    .main-tabs {\n      display: flex;\n      gap: 8px;\n      margin-bottom: 20px;\n      border-bottom: 2px solid var(--card-border);\n      padding-bottom: 4px;\n    }\n    .main-tab-btn {\n      background: transparent;\n      border: none;\n      color: var(--text-muted);\n      font-size: 15px;\n      font-weight: 600;\n      padding: 10px 18px;\n      cursor: pointer;\n      border-radius: 6px 6px 0 0;\n      transition: all 0.2s;\n      display: flex;\n      align-items: center;\n      gap: 6px;\n    }\n    .main-tab-btn:hover {\n      color: var(--text);\n      background: rgba(255,255,255,0.05);\n    }\n    .main-tab-btn.active {\n      color: var(--accent);\n      background: var(--card-bg);\n      border-bottom: 2px solid var(--accent);\n      margin-bottom: -6px;\n    }\n\n    .tab-content { display: none; }\n    .tab-content.active { display: block; }\n\n    /* 通用栅格与卡片 */\n    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }\n    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }\n    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }\n    .card {\n      background: var(--card-bg);\n      border: 1px solid var(--card-border);\n      border-radius: 8px;\n      padding: 16px;\n      margin-bottom: 16px;\n    }\n    .card-title {\n      font-size: 15px;\n      font-weight: 600;\n      color: var(--accent);\n      margin-bottom: 12px;\n      display: flex;\n      align-items: center;\n      justify-content: space-between;\n    }\n    .form-group { margin-bottom: 12px; }\n    .form-group label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 4px; }\n    .form-row { display: flex; gap: 10px; align-items: center; }\n    \n    input, select, textarea {\n      width: 100%;\n      background: #0f1523;\n      border: 1px solid var(--card-border);\n      border-radius: 4px;\n      padding: 8px 10px;\n      color: var(--text);\n      font-size: 13px;\n      outline: none;\n      transition: border-color 0.2s;\n    }\n    input:focus, select:focus, textarea:focus { border-color: var(--accent); }\n    textarea { font-family: monospace; resize: vertical; }\n\n    .btn {\n      display: inline-flex;\n      align-items: center;\n      justify-content: center;\n      gap: 6px;\n      background: var(--accent);\n      color: #000;\n      font-weight: 600;\n      border: none;\n      border-radius: 4px;\n      padding: 8px 14px;\n      cursor: pointer;\n      font-size: 13px;\n      transition: all 0.2s;\n    }\n    .btn:hover { background: var(--accent-hover); }\n    .btn-secondary { background: #2d3748; color: #fff; }\n    .btn-secondary:hover { background: #4a5568; }\n    .btn-danger { background: var(--danger); color: #fff; }\n    .btn-danger:hover { background: #dc2626; }\n    .btn-success { background: var(--success); color: #000; }\n    .btn-success:hover { background: #059669; }\n    .btn-cyan { background: var(--cyan); color: #000; }\n    .btn-cyan:hover { background: #0891b2; }\n    .btn-purple { background: var(--purple); color: #fff; }\n    .btn-purple:hover { background: #7c3aed; }\n    .btn-sm { padding: 4px 8px; font-size: 12px; }\n\n    /* 表格 */\n    .table-container {\n      overflow-x: auto;\n      max-height: 600px;\n      border: 1px solid var(--card-border);\n      border-radius: 6px;\n      background: #0f1523;\n    }\n    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; }\n    th {\n      background: #182238;\n      color: var(--accent);\n      padding: 10px;\n      font-weight: 600;\n      position: sticky;\n      top: 0;\n      z-index: 2;\n      border-bottom: 1px solid var(--card-border);\n      white-space: nowrap;\n    }\n    td {\n      padding: 8px 10px;\n      border-bottom: 1px solid rgba(255,255,255,0.05);\n      vertical-align: middle;\n      white-space: nowrap;\n    }\n    tr:hover { background: rgba(255,255,255,0.02); }\n    td input, td select {\n      padding: 4px 6px;\n      font-size: 12px;\n      background: #151d30;\n      min-width: 60px;\n    }\n\n    .badge {\n      display: inline-block;\n      padding: 2px 6px;\n      border-radius: 4px;\n      font-size: 11px;\n      font-weight: bold;\n      background: rgba(255,255,255,0.1);\n    }\n    .badge-cyan { background: rgba(6, 182, 212, 0.2); color: var(--cyan); border: 1px solid var(--cyan); }\n    .badge-amber { background: rgba(245, 158, 11, 0.2); color: var(--accent); border: 1px solid var(--accent); }\n    .badge-purple { background: rgba(139, 92, 246, 0.2); color: var(--purple); border: 1px solid var(--purple); }\n\n    /* 装备列表/物品条 */\n    .item-row {\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      padding: 8px 10px;\n      border-bottom: 1px solid rgba(255,255,255,0.05);\n      background: rgba(0,0,0,0.15);\n      border-radius: 4px;\n      margin-bottom: 6px;\n    }\n    .item-info { display: flex; flex-direction: column; gap: 2px; }\n    .item-name { font-weight: bold; }\n    .item-desc { font-size: 11px; color: var(--text-muted); }\n    \n    .rarity-0 { color: #94a3b8; }\n    .rarity-1 { color: #10b981; }\n    .rarity-2 { color: #06b6d4; }\n    .rarity-3 { color: #a855f7; }\n    .rarity-4 { color: #f59e0b; font-weight: bold; }\n\n    .toast {\n      position: fixed;\n      bottom: 24px;\n      right: 24px;\n      background: var(--card-bg);\n      border: 1px solid var(--accent);\n      color: #fff;\n      padding: 12px 20px;\n      border-radius: 6px;\n      box-shadow: 0 10px 25px rgba(0,0,0,0.5);\n      display: none;\n      z-index: 9999;\n      font-size: 14px;\n    }\n    .player-bar {\n      display: flex;\n      gap: 12px;\n      align-items: center;\n      background: var(--card-bg);\n      border: 1px solid var(--card-border);\n      padding: 14px;\n      border-radius: 8px;\n      margin-bottom: 16px;\n    }\n  </style>\n</head>\n<body>\n\n  <!-- 头部 -->\n  <div class=\"header\">\n    <div>\n      <h1>⚔️ 大宋造反模拟器 · 开发者控制台</h1>\n      <div class=\"subtitle\">三才战斗数值体系 · 装备配置中心 · 版本快照与存档管理</div>\n    </div>\n    <div style=\"display: flex; gap: 10px;\">\n      <button class=\"btn btn-danger\" onclick=\"wipeAllSaves()\">🧨 全服一键清档</button>\n    </div>\n  </div>\n\n  <!-- 主导航 Tabs -->\n  <div class=\"main-tabs\">\n    <button class=\"main-tab-btn active\" onclick=\"switchMainTab('tab-saves')\">🎮 存档与作弊调试</button>\n    <button class=\"main-tab-btn\" onclick=\"switchMainTab('tab-config')\">🛠️ 装备与图标在线配置表</button>\n    <button class=\"main-tab-btn\" onclick=\"switchMainTab('tab-snapshots')\">📸 数值版本快照与回滚</button>\n  </div>\n\n  <!-- ==================== TAB 1: 存档与作弊调试 ==================== -->\n  <div id=\"tab-saves\" class=\"tab-content active\">\n    <!-- 玩家选择栏 -->\n    <div class=\"player-bar\">\n      <span style=\"font-weight: 600; color: var(--accent);\">选择目标玩家:</span>\n      <select id=\"playerSelect\" style=\"max-width: 380px;\" onchange=\"onPlayerChange()\">\n        <option value=\"\">加载玩家列表中...</option>\n      </select>\n      <button class=\"btn btn-secondary btn-sm\" onclick=\"loadPlayers()\">🔄 刷新列表</button>\n      <span id=\"playerStatus\" style=\"font-size: 13px; color: var(--cyan); margin-left: auto;\"></span>\n      <button class=\"btn btn-danger btn-sm\" onclick=\"resetCurPlayer()\">⚠️ 重置当前玩家为初始</button>\n    </div>\n\n    <!-- 快捷预设作弊栏 -->\n    <div class=\"card\">\n      <div class=\"card-title\">⚡ 一键极速作弊预设 (针对当前选中玩家)</div>\n      <div style=\"display: flex; gap: 10px; flex-wrap: wrap;\">\n        <button class=\"btn btn-cyan btn-sm\" onclick=\"applyPreset('max_resources')\">💰 资源暴富 (千万铜钱/万抽)</button>\n        <button class=\"btn btn-purple btn-sm\" onclick=\"applyPreset('max_level_stats')\">🌟 满级真神 (80级 + 全属性999)</button>\n        <button class=\"btn btn-success btn-sm\" onclick=\"applyPreset('god_gear_blade')\">🗡️ 神装：双持柳叶镔铁双刀+明光铠</button>\n        <button class=\"btn btn-success btn-sm\" onclick=\"applyPreset('god_gear_spear')\">🔱 神装：百炼大枪+明光铠</button>\n        <button class=\"btn btn-success btn-sm\" onclick=\"applyPreset('god_gear_blunt')\">🔨 神装：重装骨朵锤+藤牌+锁子甲</button>\n        <button class=\"btn btn-secondary btn-sm\" onclick=\"applyPreset('all_weapons')\">🎒 赠送全套武器 (各一把)</button>\n        <button class=\"btn btn-secondary btn-sm\" onclick=\"applyPreset('all_armors')\">🛡️ 赠送全套铠甲与盾牌</button>\n        <button class=\"btn btn-danger btn-sm\" onclick=\"applyPreset('clear_inventory')\">🗑️ 清空背包</button>\n      </div>\n    </div>\n\n    <div class=\"grid-2\">\n      <!-- 资源修改 -->\n      <div class=\"card\">\n        <div class=\"card-title\">💰 基础资源修改</div>\n        <div class=\"grid-2\">\n          <div class=\"form-group\">\n            <label>铜钱 (Copper):</label>\n            <input type=\"number\" id=\"resCopper\" value=\"0\">\n            <div style=\"margin-top:4px; display:flex; gap:4px;\">\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resCopper', 10000)\">+1万</button>\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resCopper', 1000000)\">+100万</button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label>代币/令箭 (Tokens):</label>\n            <input type=\"number\" id=\"resTokens\" value=\"0\">\n            <div style=\"margin-top:4px; display:flex; gap:4px;\">\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resTokens', 100)\">+100</button>\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resTokens', 1000)\">+1000</button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label>沙漏/加速券 (Hourglasses):</label>\n            <input type=\"number\" id=\"resHourglasses\" value=\"0\">\n            <div style=\"margin-top:4px; display:flex; gap:4px;\">\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resHourglasses', 50)\">+50</button>\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resHourglasses', 500)\">+500</button>\n            </div>\n          </div>\n          <div class=\"form-group\">\n            <label>声望 (Prestige):</label>\n            <input type=\"number\" id=\"resPrestige\" value=\"0\">\n            <div style=\"margin-top:4px; display:flex; gap:4px;\">\n              <button class=\"btn btn-secondary btn-sm\" onclick=\"addRes('resPrestige', 1000)\">+1000</button>\n            </div>\n          </div>\n        </div>\n        <button class=\"btn btn-accent\" style=\"width:100%; margin-top:10px;\" onclick=\"saveResources()\">💾 保存资源数值</button>\n      </div>\n\n      <!-- 等级与五维属性 -->\n      <div class=\"card\">\n        <div class=\"card-title\">🥋 角色等级与五维属性</div>\n        <div class=\"grid-3\">\n          <div class=\"form-group\">\n            <label>等级 (Level):</label>\n            <input type=\"number\" id=\"attrLevel\" min=\"1\" max=\"100\" value=\"1\">\n          </div>\n          <div class=\"form-group\">\n            <label>经验值 (Exp):</label>\n            <input type=\"number\" id=\"attrExp\" value=\"0\">\n          </div>\n          <div class=\"form-group\">\n            <label>流派 (Class):</label>\n            <select id=\"attrClass\">\n              <option value=\"CLASS_A\">猛将 (猛力型)</option>\n              <option value=\"CLASS_B\">游侠 (灵动型)</option>\n              <option value=\"CLASS_C\">军策 (谋略型)</option>\n              <option value=\"CLASS_D\">义士 (坚忍型)</option>\n            </select>\n          </div>\n        </div>\n        <div class=\"grid-3\">\n          <div class=\"form-group\">\n            <label>力量 (Strength):</label>\n            <input type=\"number\" id=\"attrStr\" value=\"10\">\n          </div>\n          <div class=\"form-group\">\n            <label>敏捷 (Agility):</label>\n            <input type=\"number\" id=\"attrAgi\" value=\"10\">\n          </div>\n          <div class=\"form-group\">\n            <label>智力 (Intelligence):</label>\n            <input type=\"number\" id=\"attrInt\" value=\"10\">\n          </div>\n          <div class=\"form-group\">\n            <label>体魄 (Constitution):</label>\n            <input type=\"number\" id=\"attrCon\" value=\"10\">\n          </div>\n          <div class=\"form-group\">\n            <label>机缘 (Luck):</label>\n            <input type=\"number\" id=\"attrLuk\" value=\"10\">\n          </div>\n          <div class=\"form-group\" style=\"display:flex; align-items:flex-end;\">\n            <button class=\"btn btn-secondary btn-sm\" style=\"width:100%; height:35px;\" onclick=\"setAllStats(100)\">全设为 100</button>\n          </div>\n        </div>\n        <button class=\"btn btn-accent\" style=\"width:100%; margin-top:10px;\" onclick=\"saveAttributes()\">💾 保存属性数值</button>\n      </div>\n    </div>\n\n    <!-- 自定义装备生成与发放 -->\n    <div class=\"card\">\n      <div class=\"card-title\">🎁 自定义指定装备/词条发放</div>\n      <div class=\"grid-4\">\n        <div class=\"form-group\">\n          <label>装备部位 (Slot):</label>\n          <select id=\"makeSlot\" onchange=\"onMakeSlotChange()\">\n            <option value=\"weapon\">主手武器 (Weapon)</option>\n            <option value=\"offHand\">副手 (盾牌 / 短兵双持)</option>\n            <option value=\"body\">护甲 (Body Armor)</option>\n          </select>\n        </div>\n        <div class=\"form-group\">\n          <label>基础品类 (Base Item):</label>\n          <select id=\"makeItem\" onchange=\"onMakeItemChange()\"></select>\n        </div>\n        <div class=\"form-group\">\n          <label>品质稀有度 (Rarity):</label>\n          <select id=\"makeRarity\">\n            <option value=\"0\">凡品 (白色 0)</option>\n            <option value=\"1\">良品 (绿色 1)</option>\n            <option value=\"2\" selected>精品 (蓝色 2)</option>\n            <option value=\"3\">名器 (紫色 3)</option>\n            <option value=\"4\">传世神兵 (金橙色 4)</option>\n          </select>\n        </div>\n        <div class=\"form-group\" id=\"groupMaterial\">\n          <label>金属/材质 (Material):</label>\n          <select id=\"makeMaterial\"></select>\n        </div>\n      </div>\n      <div class=\"grid-4\">\n        <div class=\"form-group\" id=\"groupCraft\">\n          <label>锻造工艺 (Craft):</label>\n          <select id=\"makeCraft\">\n            <option value=\"\">无特殊工艺</option>\n            <option value=\"guangang\">灌钢 (破甲+1, 伤害+10%)</option>\n            <option value=\"cuiri\">淬日 (暴击伤害提升)</option>\n            <option value=\"bailian\">百炼 (基础数值提升)</option>\n          </select>\n        </div>\n        <div class=\"form-group\" id=\"groupShaft\">\n          <label>枪柄木料 (Spear Shaft):</label>\n          <select id=\"makeShaft\"></select>\n        </div>\n        <div class=\"form-group\" id=\"groupUpgrade\">\n          <label>护甲甲片淬炼 (Armor Upgrade):</label>\n          <select id=\"makeUpgrade\"></select>\n        </div>\n        <div class=\"form-group\" id=\"groupArrow\">\n          <label>箭矢类型 (Arrow Type):</label>\n          <select id=\"makeArrow\"></select>\n        </div>\n      </div>\n      <div style=\"display:flex; gap:10px; justify-content:flex-end;\">\n        <button class=\"btn btn-secondary\" onclick=\"grantCustomItem(false)\">📥 放入背包</button>\n        <button class=\"btn btn-success\" onclick=\"grantCustomItem(true)\">⚡ 直接穿戴到角色身上</button>\n      </div>\n    </div>\n\n    <!-- 当前穿戴与背包 -->\n    <div class=\"grid-2\">\n      <div class=\"card\">\n        <div class=\"card-title\">🛡️ 当前穿戴的装备 (Equipped)</div>\n        <div id=\"equippedContainer\">\n          <div style=\"color:var(--text-muted); font-size:13px;\">请选择玩家查看穿戴情况</div>\n        </div>\n      </div>\n      <div class=\"card\">\n        <div class=\"card-title\">🎒 玩家背包物品列表 (Inventory)</div>\n        <div id=\"inventoryContainer\" style=\"max-height: 380px; overflow-y: auto;\">\n          <div style=\"color:var(--text-muted); font-size:13px;\">请选择玩家查看背包</div>\n        </div>\n      </div>\n    </div>\n\n    <!-- 原始 GameState JSON 编辑器 -->\n    <div class=\"card\">\n      <div class=\"card-title\">\n        <span>📝 原始 GameState 存档 JSON 编辑</span>\n        <button class=\"btn btn-secondary btn-sm\" onclick=\"formatRawJson()\">格式化 JSON</button>\n      </div>\n      <textarea id=\"rawJsonText\" rows=\"12\" style=\"font-size:12px;\"></textarea>\n      <div style=\"display:flex; justify-content:flex-end; gap:10px; margin-top:10px;\">\n        <button class=\"btn btn-accent\" onclick=\"saveRawJson()\">💾 覆盖保存原始 JSON 存档</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ==================== TAB 2: 装备数值与图标在线配置表 ==================== -->\n  <div id=\"tab-config\" class=\"tab-content\">\n    <div class=\"card\">\n      <div class=\"card-title\" style=\"margin-bottom:0;\">\n        <div style=\"display:flex; align-items:center; gap:12px; flex-wrap:wrap;\">\n          <span>🛠️ 装备数值与图标在线配置表</span>\n          <div style=\"display:flex; gap:4px; font-size:13px; flex-wrap:wrap;\">\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-w\" onclick=\"switchConfigSubTab('weapons')\">🗡️ 武器 (Weapons)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-a\" onclick=\"switchConfigSubTab('armors')\">🛡️ 防具 (Armors)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-s\" onclick=\"switchConfigSubTab('shields')\">🔰 盾牌 (Shields)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-c\" onclick=\"switchConfigSubTab('crafts')\">🔨 锻造工艺 (Crafts)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-m\" onclick=\"switchConfigSubTab('materials')\">✨ 金属材质 (Materials)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-sh\" onclick=\"switchConfigSubTab('shafts')\">🪵 枪柄木料 (Shafts)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-u\" onclick=\"switchConfigSubTab('upgrades')\">🪖 甲片淬炼 (Upgrades)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-t\" onclick=\"switchConfigSubTab('titles')\">🏆 霸气段位 (Titles)</button>\n            <button class=\"btn btn-secondary btn-sm\" id=\"subtab-raw\" onclick=\"switchConfigSubTab('raw')\">📋 完整 JSON</button>\n          </div>\n        </div>\n        <div style=\"display:flex; gap:8px;\">\n          <button class=\"btn btn-cyan btn-sm\" onclick=\"addRowCurrentSubTab()\">➕ 新增一行</button>\n          <button class=\"btn btn-secondary btn-sm\" onclick=\"loadEquipmentConfig()\">🔄 重新读取</button>\n          <button class=\"btn btn-success btn-sm\" onclick=\"saveEquipmentConfig()\">💾 保存并实时热重载</button>\n        </div>\n      </div>\n    </div>\n\n    <!-- 武器配置子表格 -->\n    <div id=\"subview-weapons\" class=\"card\" style=\"padding:0;\">\n      <div class=\"table-container\">\n        <table id=\"tableWeapons\">\n          <thead>\n            <tr>\n              <th style=\"width:120px;\">武器 ID</th>\n              <th style=\"width:130px;\">武器名称</th>\n              <th style=\"width:180px; color:var(--cyan);\">客户端图标 (iconId)</th>\n              <th style=\"width:100px;\">兵器类型</th>\n              <th style=\"width:70px;\">伤害</th>\n              <th style=\"width:70px;\">攻速</th>\n              <th style=\"width:70px;\">耗体</th>\n              <th style=\"width:70px;\">命中%</th>\n              <th style=\"width:70px;\">破甲修正</th>\n              <th style=\"width:70px;\">固定破甲</th>\n              <th style=\"width:70px;\">双手</th>\n              <th style=\"width:70px;\">可副手</th>\n              <th style=\"width:70px;\">先攻</th>\n              <th style=\"width:70px;\">连击</th>\n              <th style=\"width:70px;\">击退</th>\n              <th style=\"width:70px;\">眩晕</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 防具配置子表格 -->\n    <div id=\"subview-armors\" class=\"card\" style=\"padding:0; display:none;\">\n      <div class=\"table-container\">\n        <table id=\"tableArmors\">\n          <thead>\n            <tr>\n              <th style=\"width:120px;\">护甲 ID</th>\n              <th style=\"width:140px;\">护甲名称</th>\n              <th style=\"width:180px; color:var(--cyan);\">客户端图标 (iconId)</th>\n              <th style=\"width:80px;\">防护等级 (A)</th>\n              <th style=\"width:80px;\">减伤值</th>\n              <th style=\"width:80px;\">体力上限</th>\n              <th style=\"width:80px;\">闪避加成%</th>\n              <th style=\"width:80px;\">回体速率</th>\n              <th style=\"width:80px;\">基础耐久</th>\n              <th style=\"width:80px;\">磨损率</th>\n              <th style=\"width:140px;\">特殊特性 (Trait)</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 盾牌配置子表格 -->\n    <div id=\"subview-shields\" class=\"card\" style=\"padding:0; display:none;\">\n      <div class=\"table-container\">\n        <table id=\"tableShields\">\n          <thead>\n            <tr>\n              <th style=\"width:130px;\">盾牌 ID</th>\n              <th style=\"width:150px;\">盾牌名称</th>\n              <th style=\"width:180px; color:var(--cyan);\">客户端图标 (iconId)</th>\n              <th style=\"width:100px;\">格挡加成 (0~1)</th>\n              <th style=\"width:100px;\">格挡耗体修正</th>\n              <th style=\"width:100px;\">闪避修正</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 锻造工艺子表格 -->\n    <div id=\"subview-crafts\" class=\"card\" style=\"padding:0; display:none;\">\n      <div style=\"padding:10px 16px; background:#0f1523; border-bottom:1px solid var(--card-border); color:var(--text-muted); font-size:12px;\">\n        💡 锻造工艺前缀词条（如“灌钢”、“包钢”、“淬日”、“百炼”）。此处的名称会作为兵刃生成时的汉字前缀。\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableCrafts\">\n          <thead>\n            <tr>\n              <th style=\"width:150px;\">工艺 ID (craft)</th>\n              <th style=\"width:200px; color:var(--accent);\">工艺名称 (前缀文案)</th>\n              <th style=\"width:300px;\">说明 / 效果</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 金属材质子表格 -->\n    <div id=\"subview-materials\" class=\"card\" style=\"padding:0; display:none;\">\n      <div style=\"padding:10px 16px; background:#0f1523; border-bottom:1px solid var(--card-border); color:var(--text-muted); font-size:12px;\">\n        💡 金属材质前缀（如“青铜”、“生铁”、“熟铁”、“炒钢”、“镔铁”）。此处的名称会拼装在装备名称中。\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableMaterials\">\n          <thead>\n            <tr>\n              <th style=\"width:120px;\">材质 ID (material)</th>\n              <th style=\"width:160px; color:var(--accent);\">材质名称 (前缀文案)</th>\n              <th style=\"width:80px;\">等阶 (Tier)</th>\n              <th style=\"width:100px;\">伤害倍率</th>\n              <th style=\"width:100px;\">耐久倍率</th>\n              <th style=\"width:260px;\">特殊规则</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 枪柄木料子表格 -->\n    <div id=\"subview-shafts\" class=\"card\" style=\"padding:0; display:none;\">\n      <div style=\"padding:10px 16px; background:#0f1523; border-bottom:1px solid var(--card-border); color:var(--text-muted); font-size:12px;\">\n        💡 枪柄木料前缀（如“白蜡杆”、“积竹木柲”）。长枪类兵刃会自动携带此木料前缀。\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableShafts\">\n          <thead>\n            <tr>\n              <th style=\"width:140px;\">木料 ID (shaft)</th>\n              <th style=\"width:180px; color:var(--accent);\">木料名称 (前缀文案)</th>\n              <th style=\"width:100px;\">命中修正</th>\n              <th style=\"width:100px;\">耗体修正</th>\n              <th style=\"width:100px;\">耐久倍率</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 甲片淬炼子表格 -->\n    <div id=\"subview-upgrades\" class=\"card\" style=\"padding:0; display:none;\">\n      <div style=\"padding:10px 16px; background:#0f1523; border-bottom:1px solid var(--card-border); color:var(--text-muted); font-size:12px;\">\n        💡 护甲甲片淬炼前缀（如“精钢”、“百炼精钢”、“镔铁”）。铠甲会自动携带此淬炼前缀。\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableUpgrades\">\n          <thead>\n            <tr>\n              <th style=\"width:140px;\">淬炼 ID (upgrade)</th>\n              <th style=\"width:180px; color:var(--accent);\">淬炼名称 (前缀文案)</th>\n              <th style=\"width:100px;\">减伤加成</th>\n              <th style=\"width:100px;\">耐久加成</th>\n              <th style=\"width:100px;\">磨损修正</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 霸气段位称号配置子表格 -->\n    <div id=\"subview-titles\" class=\"card\" style=\"padding:0; display:none;\">\n      <div style=\"padding:10px 16px; background:#0f1523; border-bottom:1px solid var(--card-border); color:var(--text-muted); font-size:12px;\">\n        💡 段位称号仅由玩家霸气 (Honor) 数值区间推导判定。在此修改文案或上下限区间后点击保存即可立即全服热生效。\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableTitles\">\n          <thead>\n            <tr>\n              <th style=\"width:150px;\">霸气下限 (minHonor)</th>\n              <th style=\"width:150px;\">霸气上限 (maxHonor)</th>\n              <th style=\"width:250px; color:var(--accent);\">段位称号显示文案 (title)</th>\n              <th style=\"width:80px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <!-- 完整 JSON 编辑 -->\n    <div id=\"subview-raw\" class=\"card\" style=\"display:none;\">\n      <div style=\"margin-bottom:10px; color:var(--text-muted); font-size:13px;\">\n        可直接编辑 <code>equipment_data.json</code> 的完整定义（含材料、升级词条等），点击保存后自动校验并热重载。\n      </div>\n      <textarea id=\"equipmentRawJson\" rows=\"18\"></textarea>\n      <div style=\"display:flex; justify-content:flex-end; gap:10px; margin-top:10px;\">\n        <button class=\"btn btn-secondary\" onclick=\"formatConfigJson()\">格式化 JSON</button>\n        <button class=\"btn btn-success\" onclick=\"saveEquipmentConfigFromRaw()\">💾 保存并生效</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- ==================== TAB 3: 数值版本快照与回滚 ==================== -->\n  <div id=\"tab-snapshots\" class=\"tab-content\">\n    <div class=\"card\">\n      <div class=\"card-title\">📸 备份当前数值配置为新快照</div>\n      <div class=\"form-row\">\n        <input type=\"text\" id=\"snapNote\" placeholder=\"填写本次快照备注 (例如: 调高双手刀破甲数值并绑定正确的客户端图标)\" style=\"flex:1;\">\n        <button class=\"btn btn-purple\" onclick=\"createSnapshotBackup()\">📸 创建数值快照备份</button>\n      </div>\n    </div>\n\n    <div class=\"card\" style=\"padding:0;\">\n      <div style=\"padding:14px 16px; border-bottom:1px solid var(--card-border); display:flex; justify-content:space-between; align-items:center;\">\n        <span style=\"font-weight:600; color:var(--accent);\">📜 历史配置版本快照列表 (可随时一键回滚)</span>\n        <button class=\"btn btn-secondary btn-sm\" onclick=\"loadSnapshots()\">🔄 刷新快照列表</button>\n      </div>\n      <div class=\"table-container\">\n        <table id=\"tableSnapshots\">\n          <thead>\n            <tr>\n              <th style=\"width:200px;\">快照标识 (ID)</th>\n              <th style=\"width:280px;\">备份说明 / 备注</th>\n              <th style=\"width:160px;\">创建时间</th>\n              <th style=\"width:100px;\">兵器数</th>\n              <th style=\"width:100px;\">护甲数</th>\n              <th style=\"width:100px;\">文件大小</th>\n              <th style=\"width:180px;\">操作</th>\n            </tr>\n          </thead>\n          <tbody>\n            <tr><td colspan=\"7\" style=\"text-align:center; color:var(--text-muted); padding:20px;\">正在读取快照数据...</td></tr>\n          </tbody>\n        </table>\n      </div>\n    </div>\n  </div>\n\n  <!-- Toast 弹窗 -->\n  <div id=\"toast\" class=\"toast\"></div>\n\n  <script>\n    let curPlayerId = '';\n    let curState = null;\n    let meta = null;\n    let cachedEquipmentData = null;\n    let currentConfigSubTab = 'weapons';\n\n    function showToast(msg, isError = false) {\n      const t = document.getElementById('toast');\n      t.innerText = msg;\n      t.style.borderColor = isError ? 'var(--danger)' : 'var(--accent)';\n      t.style.display = 'block';\n      setTimeout(() => { t.style.display = 'none'; }, 3500);\n    }\n\n    // 页面主 Tab 切换\n    function switchMainTab(tabId) {\n      document.querySelectorAll('.main-tab-btn').forEach(btn => btn.classList.remove('active'));\n      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));\n      \n      const target = document.getElementById(tabId);\n      if (target) target.classList.add('active');\n      event.currentTarget.classList.add('active');\n\n      if (tabId === 'tab-config') {\n        loadEquipmentConfig();\n      } else if (tabId === 'tab-snapshots') {\n        loadSnapshots();\n      }\n    }\n\n    // 配置子 Tab 切换\n    function switchConfigSubTab(sub) {\n      currentConfigSubTab = sub;\n      ['w', 'a', 's', 'c', 'm', 'sh', 'u', 't', 'raw'].forEach(k => {\n        const btn = document.getElementById('subtab-' + k);\n        if (btn) btn.classList.remove('btn-accent');\n      });\n      ['weapons', 'armors', 'shields', 'crafts', 'materials', 'shafts', 'upgrades', 'titles', 'raw'].forEach(k => {\n        const view = document.getElementById('subview-' + k);\n        if (view) view.style.display = 'none';\n      });\n\n      const activeBtnMap = {\n        weapons: 'subtab-w',\n        armors: 'subtab-a',\n        shields: 'subtab-s',\n        crafts: 'subtab-c',\n        materials: 'subtab-m',\n        shafts: 'subtab-sh',\n        upgrades: 'subtab-u',\n        titles: 'subtab-t',\n        raw: 'subtab-raw'\n      };\n      document.getElementById(activeBtnMap[sub])?.classList.add('btn-accent');\n      document.getElementById('subview-' + sub).style.display = 'block';\n    }\n\n    // ==========================================\n    // TAB 1: 存档与作弊逻辑\n    // ==========================================\n    async function loadMeta() {\n      const res = await fetch('/api/debug/items-meta');\n      const json = await res.json();\n      if (json.ok) {\n        meta = json.data;\n        initMakeDropdowns();\n      }\n    }\n\n    function initMakeDropdowns() {\n      if (!meta) return;\n      // 材质\n      const matSel = document.getElementById('makeMaterial');\n      matSel.innerHTML = meta.materials.map(m => `<option value=\"${m.id}\">${m.name} (T${m.tier} 倍率${m.dmg_scale})</option>`).join('');\n      // 工艺\n      const craftSel = document.getElementById('makeCraft');\n      if (craftSel) {\n        craftSel.innerHTML = '<option value=\"\">无特殊工艺</option>' + (meta.crafts || []).map(c => `<option value=\"${c.id}\">${c.name} (${c.desc || c.id})</option>`).join('');\n      }\n      // 枪柄\n      const shaftSel = document.getElementById('makeShaft');\n      shaftSel.innerHTML = '<option value=\"\">默认普通木柄</option>' + meta.shaftMaterials.map(s => `<option value=\"${s.id}\">${s.name}</option>`).join('');\n      // 甲片\n      const upSel = document.getElementById('makeUpgrade');\n      upSel.innerHTML = '<option value=\"\">无淬炼附加</option>' + meta.armorMaterialUpgrades.map(u => `<option value=\"${u.id}\">${u.name} (减伤+${u.reduce_mod})</option>`).join('');\n      // 箭矢\n      const arrSel = document.getElementById('makeArrow');\n      arrSel.innerHTML = meta.arrows.map(a => `<option value=\"${a.id}\">${a.name}</option>`).join('');\n\n      onMakeSlotChange();\n    }\n\n    function onMakeSlotChange() {\n      const slot = document.getElementById('makeSlot').value;\n      const itemSel = document.getElementById('makeItem');\n      if (!meta) return;\n\n      if (slot === 'weapon') {\n        itemSel.innerHTML = meta.weapons.map(w => `<option value=\"${w.id}\">${w.name} (${w.class}, 伤${w.dmg})</option>`).join('');\n        document.getElementById('groupMaterial').style.display = 'block';\n        document.getElementById('groupCraft').style.display = 'block';\n        document.getElementById('groupShaft').style.display = 'block';\n        document.getElementById('groupUpgrade').style.display = 'none';\n        document.getElementById('groupArrow').style.display = 'block';\n      } else if (slot === 'body') {\n        itemSel.innerHTML = meta.armors.map(a => `<option value=\"${a.id}\">${a.name} (A${a.a}, 减伤${a.reduce})</option>`).join('');\n        document.getElementById('groupMaterial').style.display = 'none';\n        document.getElementById('groupCraft').style.display = 'none';\n        document.getElementById('groupShaft').style.display = 'none';\n        document.getElementById('groupUpgrade').style.display = 'block';\n        document.getElementById('groupArrow').style.display = 'none';\n      } else {\n        // offHand: 盾牌 + 短兵\n        const dualWeapons = meta.weapons.filter(w => w.dual_allowed);\n        let opts = '<optgroup label=\"盾牌\">';\n        opts += meta.shields.map(s => `<option value=\"${s.id}\">${s.name} (格挡+${Math.round(s.block_mod*100)}%)</option>`).join('');\n        opts += '</optgroup><optgroup label=\"可双持副手兵刃\">';\n        opts += dualWeapons.map(w => `<option value=\"${w.id}\">${w.name} (${w.class})</option>`).join('');\n        opts += '</optgroup>';\n        itemSel.innerHTML = opts;\n        document.getElementById('groupMaterial').style.display = 'block';\n        document.getElementById('groupCraft').style.display = 'block';\n        document.getElementById('groupShaft').style.display = 'none';\n        document.getElementById('groupUpgrade').style.display = 'none';\n        document.getElementById('groupArrow').style.display = 'none';\n      }\n    }\n\n    function onMakeItemChange() {}\n\n    async function loadPlayers() {\n      const select = document.getElementById('playerSelect');\n      select.innerHTML = '<option value=\"\">加载中...</option>';\n      try {\n        const res = await fetch('/api/debug/players');\n        const json = await res.json();\n        if (json.ok && json.players.length > 0) {\n          select.innerHTML = json.players.map(p => \n            `<option value=\"${p.playerId}\">${p.displayName} (Lv.${p.level} / 铜钱:${p.copper}) - ${p.playerId.slice(0, 8)}...</option>`\n          ).join('');\n          curPlayerId = json.players[0].playerId;\n          loadPlayerData(curPlayerId);\n        } else {\n          select.innerHTML = '<option value=\"\">暂无玩家存档 (请先在游戏客户端登录创建)</option>';\n        }\n      } catch (e) {\n        select.innerHTML = '<option value=\"\">加载玩家失败</option>';\n      }\n    }\n\n    function onPlayerChange() {\n      curPlayerId = document.getElementById('playerSelect').value;\n      if (curPlayerId) loadPlayerData(curPlayerId);\n    }\n\n    async function loadPlayerData(playerId) {\n      document.getElementById('playerStatus').innerText = '正在加载存档...';\n      try {\n        const res = await fetch(`/api/debug/player/${encodeURIComponent(playerId)}`);\n        const json = await res.json();\n        if (json.ok) {\n          curState = json.data.state;\n          renderPlayerState(curState);\n          document.getElementById('playerStatus').innerText = '存档读取就绪';\n        } else {\n          document.getElementById('playerStatus').innerText = '读取失败: ' + json.error;\n        }\n      } catch (e) {\n        document.getElementById('playerStatus').innerText = '网络异常';\n      }\n    }\n\n    function renderPlayerState(state) {\n      document.getElementById('resCopper').value = state.resources?.copper || 0;\n      document.getElementById('resTokens').value = state.resources?.tokens || 0;\n      document.getElementById('resHourglasses').value = state.resources?.hourglasses || 0;\n      document.getElementById('resPrestige').value = state.resources?.prestige || 0;\n\n      document.getElementById('attrLevel').value = state.player?.level || 1;\n      document.getElementById('attrExp').value = state.player?.exp || 0;\n      document.getElementById('attrClass').value = state.player?.classId || 'CLASS_A';\n\n      document.getElementById('attrStr').value = state.attributes?.strength || 10;\n      document.getElementById('attrAgi').value = state.attributes?.agility || 10;\n      document.getElementById('attrInt').value = state.attributes?.intelligence || 10;\n      document.getElementById('attrCon').value = state.attributes?.constitution || 10;\n      document.getElementById('attrLuk').value = state.attributes?.luck || 10;\n\n      renderEquipped(state.equipment?.equipped || {});\n      renderInventory(state.inventory?.items || []);\n\n      document.getElementById('rawJsonText').value = JSON.stringify(state, null, 2);\n    }\n\n    function renderEquipped(equipped) {\n      const el = document.getElementById('equippedContainer');\n      el.innerHTML = '';\n      const slots = [\n        { key: 'weapon', label: '主手武器 (weapon)' },\n        { key: 'offHand', label: '副手装备 (offHand)' },\n        { key: 'body', label: '护甲身防 (body)' }\n      ];\n\n      slots.forEach(s => {\n        const item = equipped[s.key];\n        const row = document.createElement('div');\n        row.className = 'item-row';\n        if (item) {\n          row.innerHTML = `\n            <div class=\"item-info\">\n              <div><span class=\"badge badge-amber\">${s.label}</span> <span class=\"item-name rarity-${item.rarity || 0}\">${item.name}</span></div>\n              <div class=\"item-desc\">${item.description || ''}</div>\n            </div>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"removeItem('${item.id}')\">卸下</button>\n          `;\n        } else {\n          row.innerHTML = `\n            <div class=\"item-info\">\n              <div><span class=\"badge\">${s.label}</span> <span style=\"color:var(--text-muted); font-size:12px;\">(空)</span></div>\n            </div>\n          `;\n        }\n        el.appendChild(row);\n      });\n    }\n\n    function renderInventory(items) {\n      const el = document.getElementById('inventoryContainer');\n      el.innerHTML = '';\n      if (!items || items.length === 0) {\n        el.innerHTML = '<div style=\"color:var(--text-muted); font-size:13px; padding:10px;\">背包空空如也</div>';\n        return;\n      }\n      items.forEach(item => {\n        const row = document.createElement('div');\n        row.className = 'item-row';\n        row.innerHTML = `\n          <div class=\"item-info\">\n            <div><span class=\"badge\">${item.slot}</span> <span class=\"item-name rarity-${item.rarity || 0}\">${item.name}</span></div>\n            <div class=\"item-desc\">${item.description || ''}</div>\n          </div>\n          <div style=\"display:flex;gap:4px\">\n            <button class=\"btn btn-sm btn-success\" onclick=\"equipFromInv('${item.id}')\">穿上</button>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"removeItem('${item.id}')\">删除</button>\n          </div>\n        `;\n        el.appendChild(row);\n      });\n    }\n\n    function addRes(fieldId, count) {\n      const el = document.getElementById(fieldId);\n      el.value = (parseInt(el.value) || 0) + count;\n    }\n\n    function setAllStats(val) {\n      document.getElementById('attrStr').value = val;\n      document.getElementById('attrAgi').value = val;\n      document.getElementById('attrInt').value = val;\n      document.getElementById('attrCon').value = val;\n      document.getElementById('attrLuk').value = val;\n    }\n\n    async function saveResources() {\n      if (!curPlayerId) return;\n      const payload = {\n        copper: parseInt(document.getElementById('resCopper').value) || 0,\n        tokens: parseInt(document.getElementById('resTokens').value) || 0,\n        hourglasses: parseInt(document.getElementById('resHourglasses').value) || 0,\n        prestige: parseInt(document.getElementById('resPrestige').value) || 0,\n      };\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/resources`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast('资源保存成功');\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    async function saveAttributes() {\n      if (!curPlayerId) return;\n      const payload = {\n        level: parseInt(document.getElementById('attrLevel').value) || 1,\n        exp: parseInt(document.getElementById('attrExp').value) || 0,\n        classId: document.getElementById('attrClass').value,\n        attributes: {\n          strength: parseInt(document.getElementById('attrStr').value) || 10,\n          agility: parseInt(document.getElementById('attrAgi').value) || 10,\n          intelligence: parseInt(document.getElementById('attrInt').value) || 10,\n          constitution: parseInt(document.getElementById('attrCon').value) || 10,\n          luck: parseInt(document.getElementById('attrLuk').value) || 10,\n        }\n      };\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/attributes`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast('属性修改成功');\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    async function grantCustomItem(equipNow) {\n      if (!curPlayerId) return;\n      const payload = {\n        slot: document.getElementById('makeSlot').value,\n        itemId: document.getElementById('makeItem').value,\n        rarity: parseInt(document.getElementById('makeRarity').value) || 2,\n        material: document.getElementById('makeMaterial').value,\n        craft: document.getElementById('makeCraft').value || null,\n        shaft: document.getElementById('makeShaft').value || null,\n        upgrade: document.getElementById('makeUpgrade').value || null,\n        arrow: document.getElementById('makeArrow').value || null,\n        equipNow,\n      };\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/grant-item`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload)\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast(json.message);\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    async function applyPreset(preset) {\n      if (!curPlayerId) return;\n      if (preset === 'clear_inventory' && !confirm('确定要清空此玩家背包吗？')) return;\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/grant-preset`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ preset })\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast(json.message);\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    async function removeItem(itemId) {\n      if (!curPlayerId) return;\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/item/${encodeURIComponent(itemId)}`, {\n        method: 'DELETE'\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast('物品已移除');\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    async function equipFromInv(itemId) {\n      if (!curPlayerId || !curState) return;\n      const item = curState.inventory?.items?.find(i => i.id === itemId);\n      if (!item) return;\n      curState.equipment.equipped[item.slot] = item;\n      curState.inventory.items = curState.inventory.items.filter(i => i.id !== itemId);\n      saveRawJsonFromState();\n    }\n\n    async function resetCurPlayer() {\n      if (!curPlayerId) return;\n      if (!confirm('⚠️ 警告：确定要重置当前玩家的存档为初始状态吗？所有进度将丢失！')) return;\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/reset`, { method: 'POST' });\n      const json = await res.json();\n      if (json.ok) {\n        showToast('存档已重置');\n        loadPlayerData(curPlayerId);\n      } else showToast(json.error, true);\n    }\n\n    function formatRawJson() {\n      try {\n        const obj = JSON.parse(document.getElementById('rawJsonText').value);\n        document.getElementById('rawJsonText').value = JSON.stringify(obj, null, 2);\n      } catch (e) { showToast('JSON 解析失败', true); }\n    }\n\n    async function saveRawJson() {\n      if (!curPlayerId) return;\n      try {\n        const rawState = JSON.parse(document.getElementById('rawJsonText').value);\n        const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/save-raw`, {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({ rawState })\n        });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('原始 JSON 存档已更新');\n          loadPlayerData(curPlayerId);\n        } else showToast(json.error, true);\n      } catch (e) { showToast('JSON 格式错误: ' + e.message, true); }\n    }\n\n    async function saveRawJsonFromState() {\n      if (!curPlayerId || !curState) return;\n      const res = await fetch(`/api/debug/player/${encodeURIComponent(curPlayerId)}/save-raw`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ rawState: curState })\n      });\n      const json = await res.json();\n      if (json.ok) {\n        showToast('装备更新成功');\n        loadPlayerData(curPlayerId);\n      }\n    }\n\n    // ==========================================\n    // 全服一键清档\n    // ==========================================\n    async function wipeAllSaves() {\n      const conf1 = confirm('⚠️⚠️⚠️ 警告：确定要执行【全服一键清档】吗？\\n所有玩家的角色进度、金钱、背包装备、PVP防守记录以及战斗回放将被彻底物理清除！');\n      if (!conf1) return;\n      const conf2 = prompt('请输入 DELETE 确认彻底清档：');\n      if (conf2 !== 'DELETE') {\n        showToast('已取消清档');\n        return;\n      }\n\n      try {\n        const res = await fetch('/api/debug/wipe-all-saves', { method: 'POST' });\n        const json = await res.json();\n        if (json.ok) {\n          showToast(json.message);\n          loadPlayers();\n        } else {\n          showToast('清档失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('网络异常: ' + e.message, true);\n      }\n    }\n\n    // ==========================================\n    // TAB 2: 装备数值与图标在线配置表\n    // ==========================================\n    async function loadEquipmentConfig() {\n      try {\n        const res = await fetch('/api/debug/config/equipment');\n        const json = await res.json();\n        if (json.ok) {\n          cachedEquipmentData = json.data;\n          renderConfigTables();\n          showToast('装备配置表已读取就绪');\n        } else {\n          showToast('获取配置失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('读取配置网络异常', true);\n      }\n    }\n\n    function renderConfigTables() {\n      if (!cachedEquipmentData) return;\n      renderWeaponsTable(cachedEquipmentData.weapons || []);\n      renderArmorsTable(cachedEquipmentData.armors || []);\n      renderShieldsTable(cachedEquipmentData.shields || []);\n      renderCraftsTable(cachedEquipmentData.crafts || []);\n      renderMaterialsTable(cachedEquipmentData.materials || []);\n      renderShaftsTable(cachedEquipmentData.shaft_materials || []);\n      renderUpgradesTable(cachedEquipmentData.armor_material_upgrades || []);\n      renderTitlesTable(cachedEquipmentData.honor_titles || []);\n      document.getElementById('equipmentRawJson').value = JSON.stringify(cachedEquipmentData, null, 2);\n    }\n\n    function renderWeaponsTable(weapons) {\n      const tbody = document.querySelector('#tableWeapons tbody');\n      tbody.innerHTML = '';\n      weapons.forEach((w, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-w-id\" value=\"${w.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-w-name\" value=\"${w.name || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-w-icon\" placeholder=\"如 icon_sword_01\" value=\"${w.iconId || ''}\" style=\"color:var(--cyan);font-weight:600;\"></td>\n          <td>\n            <select class=\"cfg-w-class\">\n              <option value=\"blade\" ${w.class === 'blade' ? 'selected' : ''}>刀 (blade)</option>\n              <option value=\"sword\" ${w.class === 'sword' ? 'selected' : ''}>剑 (sword)</option>\n              <option value=\"spear\" ${w.class === 'spear' ? 'selected' : ''}>枪 (spear)</option>\n              <option value=\"blunt\" ${w.class === 'blunt' ? 'selected' : ''}>钝 (blunt)</option>\n              <option value=\"bow\" ${w.class === 'bow' ? 'selected' : ''}>弓 (bow)</option>\n              <option value=\"fist\" ${w.class === 'fist' ? 'selected' : ''}>拳 (fist)</option>\n            </select>\n          </td>\n          <td><input type=\"number\" class=\"cfg-w-dmg\" value=\"${w.dmg ?? 10}\"></td>\n          <td><input type=\"number\" step=\"0.1\" class=\"cfg-w-interval\" value=\"${w.interval ?? 1}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-cost\" value=\"${w.cost ?? 6}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-hit\" value=\"${w.hit ?? 100}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-pmod\" value=\"${w.p_mod ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-pfixed\" value=\"${w.p_fixed ?? 0}\"></td>\n          <td><input type=\"checkbox\" class=\"cfg-w-grip\" ${w.grip === 'twohand' ? 'checked' : ''}></td>\n          <td><input type=\"checkbox\" class=\"cfg-w-dual\" ${w.dual_allowed ? 'checked' : ''}></td>\n          <td><input type=\"checkbox\" class=\"cfg-w-first\" ${w.first ? 'checked' : ''}></td>\n          <td><input type=\"number\" class=\"cfg-w-combo\" value=\"${w.combo ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-repel\" value=\"${w.repel ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-w-stun\" value=\"${w.stun ?? 0}\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteWeaponRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderArmorsTable(armorsList) {\n      const tbody = document.querySelector('#tableArmors tbody');\n      tbody.innerHTML = '';\n      armorsList.forEach((a, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-a-id\" value=\"${a.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-a-name\" value=\"${a.name || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-a-icon\" placeholder=\"如 icon_armor_01\" value=\"${a.iconId || ''}\" style=\"color:var(--cyan);font-weight:600;\"></td>\n          <td><input type=\"number\" class=\"cfg-a-a\" value=\"${a.a ?? 1}\"></td>\n          <td><input type=\"number\" class=\"cfg-a-reduce\" value=\"${a.reduce ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-a-stamina\" value=\"${a.stamina ?? 100}\"></td>\n          <td><input type=\"number\" class=\"cfg-a-dodge\" value=\"${a.dodge ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-a-regen\" value=\"${a.regen ?? 5}\"></td>\n          <td><input type=\"number\" class=\"cfg-a-durability\" value=\"${a.durability ?? 100}\"></td>\n          <td><input type=\"number\" step=\"0.01\" class=\"cfg-a-decay\" value=\"${a.repair_decay ?? 0.1}\"></td>\n          <td><input type=\"text\" class=\"cfg-a-trait\" placeholder=\"如 blunt_weak_1\" value=\"${a.trait || ''}\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteArmorRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderShieldsTable(shieldsList) {\n      const tbody = document.querySelector('#tableShields tbody');\n      tbody.innerHTML = '';\n      shieldsList.forEach((s, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-s-id\" value=\"${s.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-s-name\" value=\"${s.name || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-s-icon\" placeholder=\"如 icon_shield_01\" value=\"${s.iconId || ''}\" style=\"color:var(--cyan);font-weight:600;\"></td>\n          <td><input type=\"number\" step=\"0.01\" class=\"cfg-s-block\" value=\"${s.block_mod ?? 0.5}\"></td>\n          <td><input type=\"number\" class=\"cfg-s-cost\" value=\"${s.block_cost_mod ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-s-dodge\" value=\"${s.dodge_mod ?? 0}\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteShieldRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderCraftsTable(craftsList) {\n      const tbody = document.querySelector('#tableCrafts tbody');\n      if (!tbody) return;\n      tbody.innerHTML = '';\n      craftsList.forEach((c, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-c-id\" value=\"${c.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-c-name\" value=\"${c.name || ''}\" style=\"color:var(--accent);font-weight:600;\"></td>\n          <td><input type=\"text\" class=\"cfg-c-desc\" value=\"${c.desc || ''}\" placeholder=\"描述说明\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteCraftRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderMaterialsTable(materialsList) {\n      const tbody = document.querySelector('#tableMaterials tbody');\n      if (!tbody) return;\n      tbody.innerHTML = '';\n      materialsList.forEach((m, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-m-id\" value=\"${m.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-m-name\" value=\"${m.name || ''}\" style=\"color:var(--accent);font-weight:600;\"></td>\n          <td><input type=\"number\" class=\"cfg-m-tier\" value=\"${m.tier ?? 0}\"></td>\n          <td><input type=\"number\" step=\"0.05\" class=\"cfg-m-dmg\" value=\"${m.dmg_scale ?? 1.0}\"></td>\n          <td><input type=\"number\" step=\"0.05\" class=\"cfg-m-dur\" value=\"${m.durability_scale ?? 1.0}\"></td>\n          <td><input type=\"text\" class=\"cfg-m-rule\" value=\"${m.rule || ''}\" placeholder=\"特殊规则备注\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteMaterialRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderShaftsTable(shaftsList) {\n      const tbody = document.querySelector('#tableShafts tbody');\n      if (!tbody) return;\n      tbody.innerHTML = '';\n      shaftsList.forEach((sh, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-sh-id\" value=\"${sh.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-sh-name\" value=\"${sh.name || ''}\" style=\"color:var(--accent);font-weight:600;\"></td>\n          <td><input type=\"number\" class=\"cfg-sh-hit\" value=\"${sh.hit_mod ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-sh-cost\" value=\"${sh.cost_mod ?? 0}\"></td>\n          <td><input type=\"number\" step=\"0.1\" class=\"cfg-sh-dur\" value=\"${sh.durability_scale ?? 1.0}\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteShaftRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderUpgradesTable(upgradesList) {\n      const tbody = document.querySelector('#tableUpgrades tbody');\n      if (!tbody) return;\n      tbody.innerHTML = '';\n      upgradesList.forEach((u, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"text\" class=\"cfg-u-id\" value=\"${u.id || ''}\"></td>\n          <td><input type=\"text\" class=\"cfg-u-name\" value=\"${u.name || ''}\" style=\"color:var(--accent);font-weight:600;\"></td>\n          <td><input type=\"number\" class=\"cfg-u-reduce\" value=\"${u.reduce_mod ?? 1}\"></td>\n          <td><input type=\"number\" class=\"cfg-u-dur\" value=\"${u.durability_mod ?? 15}\"></td>\n          <td><input type=\"number\" step=\"0.01\" class=\"cfg-u-decay\" value=\"${u.repair_decay_mod ?? -0.02}\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteUpgradeRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function renderTitlesTable(titlesList) {\n      const tbody = document.querySelector('#tableTitles tbody');\n      if (!tbody) return;\n      tbody.innerHTML = '';\n      titlesList.forEach((t, idx) => {\n        const tr = document.createElement('tr');\n        tr.dataset.idx = idx;\n        tr.innerHTML = `\n          <td><input type=\"number\" class=\"cfg-t-min\" value=\"${t.minHonor ?? 0}\"></td>\n          <td><input type=\"number\" class=\"cfg-t-max\" value=\"${t.maxHonor ?? 999999}\"></td>\n          <td><input type=\"text\" class=\"cfg-t-title\" value=\"${t.title || ''}\" style=\"color:var(--accent);font-weight:600;\"></td>\n          <td>\n            <button class=\"btn btn-danger btn-sm\" onclick=\"deleteTitleRow(${idx})\">删除</button>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    function addRowCurrentSubTab() {\n      if (!cachedEquipmentData) return;\n      if (currentConfigSubTab === 'weapons') {\n        cachedEquipmentData.weapons.push({\n          id: 'new_weapon_' + Date.now().toString(36),\n          name: '新兵刃',\n          iconId: 'icon_weapon_default',\n          class: 'blade',\n          dmg: 15,\n          interval: 1.0,\n          cost: 8,\n          hit: 100,\n          p_mod: 0\n        });\n      } else if (currentConfigSubTab === 'armors') {\n        cachedEquipmentData.armors.push({\n          id: 'new_armor_' + Date.now().toString(36),\n          name: '新甲胄',\n          iconId: 'icon_armor_default',\n          a: 2,\n          reduce: 3,\n          stamina: 90,\n          dodge: 5,\n          regen: 4,\n          durability: 80,\n          repair_decay: 0.1\n        });\n      } else if (currentConfigSubTab === 'shields') {\n        cachedEquipmentData.shields.push({\n          id: 'new_shield_' + Date.now().toString(36),\n          name: '新盾牌',\n          iconId: 'icon_shield_default',\n          block_mod: 0.5,\n          block_cost_mod: 0,\n          dodge_mod: -5\n        });\n      } else if (currentConfigSubTab === 'crafts') {\n        if (!cachedEquipmentData.crafts) cachedEquipmentData.crafts = [];\n        cachedEquipmentData.crafts.push({\n          id: 'new_craft_' + Date.now().toString(36),\n          name: '新工艺',\n          desc: '新工艺效果'\n        });\n      } else if (currentConfigSubTab === 'materials') {\n        if (!cachedEquipmentData.materials) cachedEquipmentData.materials = [];\n        cachedEquipmentData.materials.push({\n          id: 'new_mat_' + Date.now().toString(36),\n          name: '新材质',\n          tier: 1,\n          dmg_scale: 1.0,\n          durability_scale: 1.0,\n          rule: ''\n        });\n      } else if (currentConfigSubTab === 'shafts') {\n        if (!cachedEquipmentData.shaft_materials) cachedEquipmentData.shaft_materials = [];\n        cachedEquipmentData.shaft_materials.push({\n          id: 'new_shaft_' + Date.now().toString(36),\n          name: '新木料',\n          hit_mod: 0,\n          cost_mod: 0,\n          durability_scale: 1.0\n        });\n      } else if (currentConfigSubTab === 'upgrades') {\n        if (!cachedEquipmentData.armor_material_upgrades) cachedEquipmentData.armor_material_upgrades = [];\n        cachedEquipmentData.armor_material_upgrades.push({\n          id: 'new_up_' + Date.now().toString(36),\n          name: '新淬炼',\n          reduce_mod: 1,\n          durability_mod: 15,\n          repair_decay_mod: -0.02\n        });\n      } else if (currentConfigSubTab === 'titles') {\n        if (!cachedEquipmentData.honor_titles) cachedEquipmentData.honor_titles = [];\n        cachedEquipmentData.honor_titles.push({\n          minHonor: 0,\n          maxHonor: 999999,\n          title: '新称号'\n        });\n      }\n      renderConfigTables();\n      showToast('已新增一行，请填写后点击保存');\n    }\n\n    function deleteWeaponRow(idx) {\n      if (!confirm('确定删除此武器配置吗？')) return;\n      cachedEquipmentData.weapons.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteArmorRow(idx) {\n      if (!confirm('确定删除此防具配置吗？')) return;\n      cachedEquipmentData.armors.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteShieldRow(idx) {\n      if (!confirm('确定删除此盾牌配置吗？')) return;\n      cachedEquipmentData.shields.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteCraftRow(idx) {\n      if (!confirm('确定删除此锻造工艺吗？')) return;\n      cachedEquipmentData.crafts.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteMaterialRow(idx) {\n      if (!confirm('确定删除此金属材质吗？')) return;\n      cachedEquipmentData.materials.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteShaftRow(idx) {\n      if (!confirm('确定删除此枪柄木料吗？')) return;\n      cachedEquipmentData.shaft_materials.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteUpgradeRow(idx) {\n      if (!confirm('确定删除此甲片淬炼吗？')) return;\n      cachedEquipmentData.armor_material_upgrades.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function deleteTitleRow(idx) {\n      if (!confirm('确定删除此称号配置吗？')) return;\n      cachedEquipmentData.honor_titles.splice(idx, 1);\n      renderConfigTables();\n    }\n\n    function collectConfigFromDOM() {\n      if (!cachedEquipmentData) return null;\n      // 收集武器\n      const wRows = document.querySelectorAll('#tableWeapons tbody tr');\n      const weapons = [];\n      wRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-w-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-w-name').value.trim(),\n          iconId: tr.querySelector('.cfg-w-icon').value.trim() || undefined,\n          class: tr.querySelector('.cfg-w-class').value,\n          dmg: parseFloat(tr.querySelector('.cfg-w-dmg').value) || 0,\n          interval: parseFloat(tr.querySelector('.cfg-w-interval').value) || 1,\n          cost: parseFloat(tr.querySelector('.cfg-w-cost').value) || 0,\n          hit: parseFloat(tr.querySelector('.cfg-w-hit').value) || 100,\n        };\n        const pmod = parseFloat(tr.querySelector('.cfg-w-pmod').value);\n        if (pmod) item.p_mod = pmod;\n        const pfixed = parseFloat(tr.querySelector('.cfg-w-pfixed').value);\n        if (pfixed) item.p_fixed = pfixed;\n        if (tr.querySelector('.cfg-w-grip').checked) item.grip = 'twohand';\n        if (tr.querySelector('.cfg-w-dual').checked) item.dual_allowed = true;\n        if (tr.querySelector('.cfg-w-first').checked) item.first = true;\n        const combo = parseInt(tr.querySelector('.cfg-w-combo').value);\n        if (combo) item.combo = combo;\n        const repel = parseInt(tr.querySelector('.cfg-w-repel').value);\n        if (repel) item.repel = repel;\n        const stun = parseInt(tr.querySelector('.cfg-w-stun').value);\n        if (stun) item.stun = stun;\n        weapons.push(item);\n      });\n\n      // 收集防具\n      const aRows = document.querySelectorAll('#tableArmors tbody tr');\n      const armors = [];\n      aRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-a-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-a-name').value.trim(),\n          iconId: tr.querySelector('.cfg-a-icon').value.trim() || undefined,\n          a: parseInt(tr.querySelector('.cfg-a-a').value) || 1,\n          reduce: parseFloat(tr.querySelector('.cfg-a-reduce').value) || 0,\n          stamina: parseFloat(tr.querySelector('.cfg-a-stamina').value) || 100,\n          dodge: parseFloat(tr.querySelector('.cfg-a-dodge').value) || 0,\n          regen: parseFloat(tr.querySelector('.cfg-a-regen').value) || 5,\n          durability: parseFloat(tr.querySelector('.cfg-a-durability').value) || 100,\n          repair_decay: parseFloat(tr.querySelector('.cfg-a-decay').value) || 0.1,\n        };\n        const trait = tr.querySelector('.cfg-a-trait').value.trim();\n        if (trait) item.trait = trait;\n        armors.push(item);\n      });\n\n      // 收集盾牌\n      const sRows = document.querySelectorAll('#tableShields tbody tr');\n      const shields = [];\n      sRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-s-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-s-name').value.trim(),\n          iconId: tr.querySelector('.cfg-s-icon').value.trim() || undefined,\n          block_mod: parseFloat(tr.querySelector('.cfg-s-block').value) || 0.5,\n          block_cost_mod: parseFloat(tr.querySelector('.cfg-s-cost').value) || 0,\n          dodge_mod: parseFloat(tr.querySelector('.cfg-s-dodge').value) || 0,\n        };\n        shields.push(item);\n      });\n\n      // 收集锻造工艺\n      const cRows = document.querySelectorAll('#tableCrafts tbody tr');\n      const crafts = [];\n      cRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-c-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-c-name').value.trim(),\n          desc: tr.querySelector('.cfg-c-desc').value.trim()\n        };\n        crafts.push(item);\n      });\n\n      // 收集金属材质\n      const mRows = document.querySelectorAll('#tableMaterials tbody tr');\n      const materials = [];\n      mRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-m-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-m-name').value.trim(),\n          tier: parseInt(tr.querySelector('.cfg-m-tier').value) || 0,\n          dmg_scale: parseFloat(tr.querySelector('.cfg-m-dmg').value) || 1.0,\n          durability_scale: parseFloat(tr.querySelector('.cfg-m-dur').value) || 1.0,\n          rule: tr.querySelector('.cfg-m-rule').value.trim()\n        };\n        materials.push(item);\n      });\n\n      // 收集枪柄木料\n      const shRows = document.querySelectorAll('#tableShafts tbody tr');\n      const shaft_materials = [];\n      shRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-sh-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-sh-name').value.trim(),\n          hit_mod: parseInt(tr.querySelector('.cfg-sh-hit').value) || 0,\n          cost_mod: parseInt(tr.querySelector('.cfg-sh-cost').value) || 0,\n          durability_scale: parseFloat(tr.querySelector('.cfg-sh-dur').value) || 1.0\n        };\n        shaft_materials.push(item);\n      });\n\n      // 收集甲片淬炼\n      const uRows = document.querySelectorAll('#tableUpgrades tbody tr');\n      const armor_material_upgrades = [];\n      uRows.forEach(tr => {\n        const id = tr.querySelector('.cfg-u-id').value.trim();\n        if (!id) return;\n        const item = {\n          id,\n          name: tr.querySelector('.cfg-u-name').value.trim(),\n          reduce_mod: parseFloat(tr.querySelector('.cfg-u-reduce').value) || 1,\n          durability_mod: parseFloat(tr.querySelector('.cfg-u-dur').value) || 15,\n          repair_decay_mod: parseFloat(tr.querySelector('.cfg-u-decay').value) || -0.02\n        };\n        armor_material_upgrades.push(item);\n      });\n\n      // 收集霸气段位称号\n      const tRows = document.querySelectorAll('#tableTitles tbody tr');\n      const honor_titles = [];\n      tRows.forEach(tr => {\n        const title = tr.querySelector('.cfg-t-title').value.trim();\n        if (!title) return;\n        const minHonor = parseInt(tr.querySelector('.cfg-t-min').value) || 0;\n        const maxHonor = parseInt(tr.querySelector('.cfg-t-max').value) || 0;\n        honor_titles.push({ minHonor, maxHonor, title });\n      });\n      honor_titles.sort((a, b) => a.minHonor - b.minHonor);\n\n      cachedEquipmentData.weapons = weapons;\n      cachedEquipmentData.armors = armors;\n      cachedEquipmentData.shields = shields;\n      cachedEquipmentData.crafts = crafts;\n      cachedEquipmentData.materials = materials;\n      cachedEquipmentData.shaft_materials = shaft_materials;\n      cachedEquipmentData.armor_material_upgrades = armor_material_upgrades;\n      cachedEquipmentData.honor_titles = honor_titles;\n      return cachedEquipmentData;\n    }\n\n    async function saveEquipmentConfig() {\n      const data = collectConfigFromDOM();\n      if (!data) return;\n      try {\n        const res = await fetch('/api/debug/config/equipment', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify(data)\n        });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('✅ ' + json.message);\n          cachedEquipmentData = json.data;\n          renderConfigTables();\n          loadMeta(); // 刷新快捷作弊元数据\n        } else {\n          showToast('保存失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('保存配置网络异常: ' + e.message, true);\n      }\n    }\n\n    function formatConfigJson() {\n      try {\n        const obj = JSON.parse(document.getElementById('equipmentRawJson').value);\n        document.getElementById('equipmentRawJson').value = JSON.stringify(obj, null, 2);\n      } catch (e) { showToast('JSON 格式错误', true); }\n    }\n\n    async function saveEquipmentConfigFromRaw() {\n      try {\n        const data = JSON.parse(document.getElementById('equipmentRawJson').value);\n        const res = await fetch('/api/debug/config/equipment', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify(data)\n        });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('✅ ' + json.message);\n          cachedEquipmentData = json.data;\n          renderConfigTables();\n          loadMeta();\n        } else {\n          showToast('保存失败: ' + json.error, true);\n        }\n      } catch (e) { showToast('JSON 格式解析错误: ' + e.message, true); }\n    }\n\n    // ==========================================\n    // TAB 3: 数值版本快照与回滚\n    // ==========================================\n    async function loadSnapshots() {\n      try {\n        const res = await fetch('/api/debug/config/snapshots');\n        const json = await res.json();\n        if (json.ok) {\n          renderSnapshotsTable(json.snapshots || []);\n        } else {\n          showToast('读取快照失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('读取快照网络异常', true);\n      }\n    }\n\n    function renderSnapshotsTable(snapshots) {\n      const tbody = document.querySelector('#tableSnapshots tbody');\n      tbody.innerHTML = '';\n      if (snapshots.length === 0) {\n        tbody.innerHTML = '<tr><td colspan=\"7\" style=\"text-align:center; color:var(--text-muted); padding:20px;\">暂无历史数值备份快照，您可以在上方输入备注后创建一份快照。</td></tr>';\n        return;\n      }\n\n      snapshots.forEach(s => {\n        const tr = document.createElement('tr');\n        const dateStr = new Date(s.createdAt).toLocaleString('zh-CN');\n        const sizeKb = (s.sizeBytes / 1024).toFixed(1) + ' KB';\n        tr.innerHTML = `\n          <td><code style=\"color:var(--purple);\">${s.id}</code></td>\n          <td style=\"font-weight:600; color:var(--text);\">${s.note}</td>\n          <td style=\"color:var(--text-muted); font-size:11px;\">${dateStr}</td>\n          <td><span class=\"badge badge-cyan\">${s.weaponCount} 把</span></td>\n          <td><span class=\"badge badge-amber\">${s.armorCount} 件</span></td>\n          <td style=\"color:var(--text-muted);\">${sizeKb}</td>\n          <td>\n            <div style=\"display:flex; gap:6px;\">\n              <button class=\"btn btn-purple btn-sm\" onclick=\"rollbackToSnapshot('${s.id}')\">🔄 回滚此版本</button>\n              <button class=\"btn btn-danger btn-sm\" onclick=\"deleteSnapshotItem('${s.id}')\">🗑️</button>\n            </div>\n          </td>\n        `;\n        tbody.appendChild(tr);\n      });\n    }\n\n    async function createSnapshotBackup() {\n      const note = document.getElementById('snapNote').value.trim() || '手动数值备份';\n      try {\n        const res = await fetch('/api/debug/config/snapshot', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({ note })\n        });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('✅ ' + json.message);\n          document.getElementById('snapNote').value = '';\n          loadSnapshots();\n        } else {\n          showToast('创建快照失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('创建快照异常: ' + e.message, true);\n      }\n    }\n\n    async function rollbackToSnapshot(snapshotId) {\n      if (!confirm(`⚠️ 确定要将服务器装备数值配置一键回滚到快照【${snapshotId}】吗？\\n当前未备份的在线修改将被覆盖！`)) return;\n      try {\n        const res = await fetch('/api/debug/config/rollback', {\n          method: 'POST',\n          headers: { 'Content-Type': 'application/json' },\n          body: JSON.stringify({ snapshotId })\n        });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('✅ ' + json.message);\n          loadEquipmentConfig();\n        } else {\n          showToast('回滚失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('回滚异常: ' + e.message, true);\n      }\n    }\n\n    async function deleteSnapshotItem(snapshotId) {\n      if (!confirm(`确定要删除快照【${snapshotId}】吗？`)) return;\n      try {\n        const res = await fetch(`/api/debug/config/snapshot/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' });\n        const json = await res.json();\n        if (json.ok) {\n          showToast('快照已删除');\n          loadSnapshots();\n        } else {\n          showToast('删除失败: ' + json.error, true);\n        }\n      } catch (e) {\n        showToast('删除异常: ' + e.message, true);\n      }\n    }\n\n    // 初始化\n    loadMeta();\n    loadPlayers();\n  </script>\n</body>\n</html>\n";

  res.send(html);
});

export default router;
