import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameState } from '../types/gameState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePaths() {
  const localPath = path.resolve(__dirname, '../data/equipment_data.json');
  if (fs.existsSync(localPath)) {
    return {
      jsonPath: localPath,
      snapshotsDir: path.resolve(__dirname, '../data/snapshots'),
    };
  }
  const srcPath = path.resolve(__dirname, '../../src/data/equipment_data.json');
  if (fs.existsSync(srcPath)) {
    return {
      jsonPath: srcPath,
      snapshotsDir: path.resolve(__dirname, '../../src/data/snapshots'),
    };
  }
  return {
    jsonPath: localPath,
    snapshotsDir: path.resolve(__dirname, '../data/snapshots'),
  };
}

const { jsonPath, snapshotsDir } = resolvePaths();
const rawJson = fs.readFileSync(jsonPath, 'utf-8');

export const equipmentData = JSON.parse(rawJson);

// ---------- TS 类型定义 ----------

export interface BaseWeapon {
  id: string;
  name: string;
  iconId?: string;
  class: 'blade' | 'sword' | 'spear' | 'blunt' | 'bow' | 'fist';
  dmg: number;
  interval: number;
  cost: number;
  hit: number;
  p_mod?: number;
  p_fixed?: number;
  combo?: number;
  parry?: number;
  parry_dmg_scale?: number;
  repel?: number;
  stun?: number;
  pierce?: boolean;
  first?: boolean;
  grip?: 'twohand';
  vs_kind?: string;
  vs_hit?: number;
  repel_immune_vs?: string;
  ignore_reduce?: number;
  dual_allowed?: boolean;
  bonus_a?: number;
  bonus_scale?: number;
}

export interface Material {
  tier: number;
  id: string;
  name: string;
  dmg_scale: number;
  dmg_scale_blunt?: number;
  durability_scale: number;
  rule?: string;
}

export interface ShaftMaterial {
  id: string;
  name: string;
  hit_mod: number;
  cost_mod: number;
  durability_scale: number;
}

export interface Armor {
  id: string;
  name: string;
  iconId?: string;
  a: number;
  reduce: number;
  stamina: number;
  dodge: number;
  regen: number;
  durability: number;
  repair_decay: number;
  trait?: string;
}

export interface ArmorMaterialUpgrade {
  id: string;
  name: string;
  reduce_mod: number;
  durability_mod: number;
  repair_decay_mod: number;
}

export interface Shield {
  id: string;
  name: string;
  iconId?: string;
  block_mod: number;
  block_cost_mod: number;
  dodge_mod: number;
}

export interface Arrow {
  id: string;
  name: string;
  p_mod: number;
  dmg_scale: number;
  hit_mod: number;
}

export interface Craft {
  id: string;
  name: string;
  desc?: string;
}

export interface HonorTitleTier {
  minHonor: number;
  maxHonor: number;
  title: string;
}

// 最终战斗衍生实体类型
export interface WeaponFinal {
  id: string;
  name: string;
  iconId?: string;
  class: 'blade' | 'sword' | 'spear' | 'blunt' | 'bow' | 'fist';
  dmg: number;
  interval: number;
  cost: number;
  hit: number;
  p: number;
  pierce: boolean;
  first: boolean;
  stun: number;
  repel: number;
  combo: number;
  parry: number;
  parryDmgScale?: number;
  ignoreReduce: number;
  vsKind?: string;
  vsHit?: number;
  repelImmuneVs?: string;
  grip?: 'twohand';
  bonusA?: number;
  bonusScale?: number;
}

export interface ArmorFinal {
  id: string;
  name: string;
  iconId?: string;
  a: number;
  reduce: number;
  stamina: number;
  dodge: number;
  regen: number;
  durability: number;
  repairDecay: number;
  trait?: string;
}

export interface ShieldFinal {
  id: string;
  name: string;
  iconId?: string;
  blockMod: number;
  blockCostMod: number;
  dodgeMod: number;
}

// ---------- 强类型 Getter 数组 ----------

export const baseWeapons: BaseWeapon[] = equipmentData.weapons || [];
export const materials: Material[] = equipmentData.materials || [];
export const crafts: Craft[] = equipmentData.crafts || [
  { id: 'guangang', name: '灌钢', desc: '灌钢工艺 (破甲+1, 伤害+5%)' },
  { id: 'baogang',  name: '包钢', desc: '包钢工艺 (破甲+1, 伤害+5%)' },
  { id: 'jiagang',  name: '夹钢', desc: '夹钢工艺 (破甲+1, 伤害+5%)' },
  { id: 'cuiri',    name: '淬日', desc: '淬日工艺 (暴击伤害提升)' },
  { id: 'bailian',  name: '百炼', desc: '百炼工艺 (基础数值提升)' },
];
export const shaftMaterials: ShaftMaterial[] = equipmentData.shaft_materials || [];
export const armors: Armor[] = equipmentData.armors || [];
export const armorMaterialUpgrades: ArmorMaterialUpgrade[] = equipmentData.armor_material_upgrades || [];
export const shields: Shield[] = equipmentData.shields || [];
export const arrows: Arrow[] = equipmentData.arrows || [];
export const honorTitles: HonorTitleTier[] = equipmentData.honor_titles || [
  { minHonor: 0, maxHonor: 499, title: '日龙包' },
  { minHonor: 500, maxHonor: 899, title: '路人' },
  { minHonor: 900, maxHonor: 1199, title: '操哥' },
  { minHonor: 1200, maxHonor: 1499, title: '猛人' },
  { minHonor: 1500, maxHonor: 1799, title: '狠人' },
  { minHonor: 1800, maxHonor: 2099, title: '好汉' },
  { minHonor: 2100, maxHonor: 2399, title: '英雄' },
  { minHonor: 2400, maxHonor: 2799, title: '大英雄' },
  { minHonor: 2800, maxHonor: 999999, title: '盖世英雄' },
];

/** 根据霸气数值动态计算段位称号 */
export function getHonorTitle(honor: number): string {
  const safeHonor = Math.max(0, Math.floor(honor || 0));
  const matched = honorTitles.find((t) => safeHonor >= t.minHonor && safeHonor <= t.maxHonor);
  if (matched) return matched.title;
  // 兜底逻辑：若超出最大区间则返回最高档，否则返回第一档
  if (honorTitles.length > 0) {
    if (safeHonor >= honorTitles[honorTitles.length - 1].minHonor) {
      return honorTitles[honorTitles.length - 1].title;
    }
    return honorTitles[0].title;
  }
  return '路人';
}

// ---------- 热重载与持久化 ----------

export function reloadEquipmentData(newData?: any): void {
  const data = newData || JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  for (const k of Object.keys(equipmentData)) {
    delete (equipmentData as any)[k];
  }
  Object.assign(equipmentData, data);

  if (Array.isArray(data.weapons)) {
    baseWeapons.length = 0;
    baseWeapons.push(...data.weapons);
  }
  if (Array.isArray(data.materials)) {
    materials.length = 0;
    materials.push(...data.materials);
  }
  if (Array.isArray(data.crafts)) {
    crafts.length = 0;
    crafts.push(...data.crafts);
  }
  if (Array.isArray(data.shaft_materials)) {
    shaftMaterials.length = 0;
    shaftMaterials.push(...data.shaft_materials);
  }
  if (Array.isArray(data.armors)) {
    armors.length = 0;
    armors.push(...data.armors);
  }
  if (Array.isArray(data.armor_material_upgrades)) {
    armorMaterialUpgrades.length = 0;
    armorMaterialUpgrades.push(...data.armor_material_upgrades);
  }
  if (Array.isArray(data.shields)) {
    shields.length = 0;
    shields.push(...data.shields);
  }
  if (Array.isArray(data.arrows)) {
    arrows.length = 0;
    arrows.push(...data.arrows);
  }
  if (Array.isArray(data.honor_titles)) {
    honorTitles.length = 0;
    honorTitles.push(...data.honor_titles);
  }
}

export function saveEquipmentData(newData: any): void {
  fs.writeFileSync(jsonPath, JSON.stringify(newData, null, 2), 'utf-8');
  reloadEquipmentData(newData);
}

// ---------- 快照版本管理 ----------

export type EquipmentSnapshotMeta = {
  id: string;
  filename: string;
  note: string;
  createdAt: number;
  weaponCount: number;
  armorCount: number;
  sizeBytes: number;
};

export function ensureSnapshotsDir(): void {
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }
}

export function listSnapshots(): EquipmentSnapshotMeta[] {
  ensureSnapshotsDir();
  const files = fs.readdirSync(snapshotsDir).filter((f) => f.endsWith('.json'));
  const snapshots: EquipmentSnapshotMeta[] = [];

  for (const f of files) {
    try {
      const fullPath = path.join(snapshotsDir, f);
      const stat = fs.statSync(fullPath);
      const raw = fs.readFileSync(fullPath, 'utf-8');
      const json = JSON.parse(raw);
      snapshots.push({
        id: f.replace('.json', ''),
        filename: f,
        note: json._snapshotNote || '无备注',
        createdAt: json._snapshotCreatedAt || stat.mtimeMs,
        weaponCount: json.weapons?.length ?? 0,
        armorCount: json.armors?.length ?? 0,
        sizeBytes: stat.size,
      });
    } catch (e) {
      console.warn(`Failed to read snapshot file: ${f}`, e);
    }
  }

  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

export function createSnapshot(note: string): EquipmentSnapshotMeta {
  ensureSnapshotsDir();
  const now = Date.now();
  const dateStr = new Date(now).toISOString().replace(/[:.]/g, '-');
  const safeNote = (note || 'backup').trim().replace(/[^a-zA-Z0-9_\u4e00-\u9fa5-]/g, '_').slice(0, 30);
  const id = `snap_${dateStr}_${safeNote}`;
  const filename = `${id}.json`;
  const fullPath = path.join(snapshotsDir, filename);

  const currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  currentData._snapshotNote = note;
  currentData._snapshotCreatedAt = now;

  fs.writeFileSync(fullPath, JSON.stringify(currentData, null, 2), 'utf-8');
  const stat = fs.statSync(fullPath);

  return {
    id,
    filename,
    note,
    createdAt: now,
    weaponCount: currentData.weapons?.length ?? 0,
    armorCount: currentData.armors?.length ?? 0,
    sizeBytes: stat.size,
  };
}

export function rollbackSnapshot(snapshotId: string): void {
  ensureSnapshotsDir();
  const filename = snapshotId.endsWith('.json') ? snapshotId : `${snapshotId}.json`;
  const fullPath = path.join(snapshotsDir, filename);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  const raw = fs.readFileSync(fullPath, 'utf-8');
  const json = JSON.parse(raw);
  delete json._snapshotNote;
  delete json._snapshotCreatedAt;

  saveEquipmentData(json);
}

export function deleteSnapshot(snapshotId: string): void {
  ensureSnapshotsDir();
  const filename = snapshotId.endsWith('.json') ? snapshotId : `${snapshotId}.json`;
  const fullPath = path.join(snapshotsDir, filename);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

// ---------- 属性派生计算器 ----------

export function getWeaponFinal(
  itemId: string,
  materialId: string,
  craft: string | null | undefined,
  shaftId: string | null | undefined,
  arrowId: string | null | undefined,
): WeaponFinal {
  const base = baseWeapons.find((w) => w.id === itemId);
  if (!base) {
    // 兼容遗留测试 mock 数据的默认刀
    return {
      id: itemId,
      name: '制式兵刃',
      class: 'blade',
      dmg: 12,
      interval: 1,
      cost: 6,
      hit: 75,
      p: 3,
      pierce: false,
      first: false,
      stun: 0,
      repel: 0,
      combo: 0,
      parry: 0,
      ignoreReduce: 0,
    };
  }

  const mat = materials.find((m) => m.id === materialId) || ({ tier: 3, id: 'chaogang', dmg_scale: 1.0, durability_scale: 1.0 } as Material);
  const composite = equipmentData.composite_craft;

  // 1. 伤害 dmg
  let dmgScale = mat.dmg_scale;
  if (base.class === 'blunt' && mat.dmg_scale_blunt !== undefined) {
    dmgScale = mat.dmg_scale_blunt;
  }
  let dmg = base.dmg * dmgScale;
  if (craft) {
    dmg = dmg * composite.dmg_scale;
  }
  if (base.class === 'bow' && arrowId) {
    const arr = arrows.find((a) => a.id === arrowId);
    if (arr) {
      dmg = dmg * arr.dmg_scale;
    }
  }
  dmg = Math.round(dmg);

  // 2. 破甲级 p
  let p = 0;
  if (base.p_fixed !== undefined) {
    p = base.p_fixed;
  } else {
    const pMod = base.p_mod ?? 0;
    const craftMod = craft ? composite.p_mod : 0;
    const arrowMod = (base.class === 'bow' && arrowId === 'pierce') ? 1 : 0;
    p = Math.min(equipmentData.global_rules.p_cap, mat.tier + pMod + craftMod + arrowMod);
  }

  // 3. 命中率 hit
  let hit = base.hit;
  if (shaftId) {
    const shaft = shaftMaterials.find((s) => s.id === shaftId);
    if (shaft) hit += shaft.hit_mod;
  }
  if (base.class === 'bow' && arrowId) {
    const arr = arrows.find((a) => a.id === arrowId);
    if (arr) hit += arr.hit_mod;
  }

  // 4. 体力消耗 cost
  let cost = base.cost;
  if (shaftId) {
    const shaft = shaftMaterials.find((s) => s.id === shaftId);
    if (shaft) cost += shaft.cost_mod;
  }

  // 5. 名器修正属性（从 JSON legendary_rules.examples 适配，或者配置在 weapon 本身）
  // 在 JSON 中，"legendary_rules.examples" 列出了名器的专属词条规则。
  // 我们直接在装备上注入专属名器属性，如 "bonus_a": 4, "bonus_scale": 1.2
  // 这里为了向下兼容及方便直接从 weapon 数据里拉取，如果 weapon 里有对应字段则带上：
  const weaponWithLegendary = base as any;
  const bonusA = weaponWithLegendary.bonus_a;
  const bonusScale = weaponWithLegendary.bonus_scale;

  return {
    id: base.id,
    name: base.name,
    class: base.class,
    dmg,
    interval: base.interval,
    cost,
    hit,
    p,
    pierce: !!base.pierce,
    first: !!base.first,
    stun: base.stun ?? 0,
    repel: base.repel ?? 0,
    combo: base.combo ?? 0,
    parry: base.parry ?? 0,
    parryDmgScale: base.parry_dmg_scale,
    ignoreReduce: base.ignore_reduce ?? 0,
    vsKind: base.vs_kind,
    vsHit: base.vs_hit,
    repelImmuneVs: base.repel_immune_vs,
    grip: base.grip,
    bonusA,
    bonusScale,
    iconId: base.iconId,
  };
}

export function getArmorFinal(armorId: string, upgradeId: string | null | undefined): ArmorFinal {
  const base = armors.find((a) => a.id === armorId);
  if (!base) {
    // 兼容遗留测试 mock 数据的默认甲
    return {
      id: armorId,
      name: '制式铁甲',
      a: 3,
      reduce: 3,
      stamina: 88,
      dodge: 7,
      regen: 4,
      durability: 70,
      repairDecay: 0.12,
    };
  }

  let reduce = base.reduce;
  let durability = base.durability;
  let repairDecay = base.repair_decay;

  if (upgradeId) {
    const up = armorMaterialUpgrades.find((u) => u.id === upgradeId);
    if (up) {
      reduce += up.reduce_mod;
      durability += up.durability_mod;
      // 减幅，向下有 floor 限制（最低 4% / 0.04）
      repairDecay = Math.max(0.04, repairDecay + up.repair_decay_mod);
    }
  }

  return {
    id: base.id,
    name: base.name,
    a: base.a,
    reduce,
    stamina: base.stamina,
    dodge: base.dodge,
    regen: base.regen,
    durability,
    repairDecay,
    trait: base.trait,
    iconId: base.iconId,
  };
}

export function getShieldFinal(shieldId: string): ShieldFinal {
  const base = shields.find((s) => s.id === shieldId);
  if (!base) {
    throw new Error(`Shield not found: ${shieldId}`);
  }
  return {
    id: base.id,
    name: base.name,
    blockMod: base.block_mod,
    blockCostMod: base.block_cost_mod,
    dodgeMod: base.dodge_mod,
    iconId: base.iconId,
  };
}

/** 根据 itemId / id 查找当前配置中对应的最新 iconId */
export function resolveItemIconId(
  item: { slot?: string; itemId?: string; id?: string; iconId?: string } | null | undefined
): string | undefined {
  if (!item) return undefined;
  const key = item.itemId || item.id;
  if (key) {
    const weapon = baseWeapons.find((w) => w.id === key);
    if (weapon?.iconId) return weapon.iconId;
    const armor = armors.find((a) => a.id === key);
    if (armor?.iconId) return armor.iconId;
    const shield = shields.find((s) => s.id === key);
    if (shield?.iconId) return shield.iconId;
  }
  return item.iconId;
}

/** 生成/拼装装备的完整汉字名称（工艺前缀 + 材质前缀 + 基础装备名） */
export function composeItemName(params: {
  slot: string;
  itemId?: string;
  customName?: string;
  material?: string | null;
  craft?: string | null;
  shaft?: string | null;
  upgrade?: string | null;
  arrow?: string | null;
}): string {
  if (params.customName) return params.customName;
  const { slot, itemId, material, craft, shaft, upgrade } = params;

  if (slot === 'weapon') {
    const base = baseWeapons.find((w) => w.id === itemId);
    const matName = material ? (materials.find((m) => m.id === material)?.name ?? '') : '';
    const craftName = craft ? (crafts.find((c) => c.id === craft)?.name ?? craft) : '';
    const shaftName = shaft ? (shaftMaterials.find((s) => s.id === shaft)?.name.slice(0, 3) ?? '') : '';
    return `${craftName}${shaftName}${matName}${base?.name || '兵刃'}`;
  } else if (slot === 'body') {
    const base = armors.find((a) => a.id === itemId);
    const upName = upgrade ? (armorMaterialUpgrades.find((u) => u.id === upgrade)?.name ?? '') : '';
    return `${upName}${base?.name || '甲胄'}`;
  } else {
    const isShield = shields.some((s) => s.id === itemId);
    if (isShield) {
      const base = shields.find((s) => s.id === itemId);
      return `精装${base?.name || '盾牌'}`;
    } else {
      const base = baseWeapons.find((w) => w.id === itemId);
      const matName = material ? (materials.find((m) => m.id === material)?.name ?? '') : '';
      const craftName = craft ? (crafts.find((c) => c.id === craft)?.name ?? craft) : '';
      return `${craftName}${matName}${base?.name || '短兵'}·副手`;
    }
  }
}

/** 纠正老存档中误将工艺拼音作为前缀的装备名称 */
export function normalizeItemName(item: { name?: string; craft?: string | null }): void {
  if (!item.name || !item.craft) return;
  const craftObj = crafts.find((c) => c.id === item.craft);
  if (craftObj && item.name.startsWith(item.craft)) {
    item.name = craftObj.name + item.name.slice(item.craft.length);
  }
}

/** 动态为装备对象补全/同步最新的 iconId 及纠正汉字名称 */
export function enrichEquipmentItem<
  T extends { slot?: string; itemId?: string; id?: string; iconId?: string; name?: string; craft?: string | null } | null | undefined
>(item: T): T {
  if (!item) return item;
  const latestIcon = resolveItemIconId(item);
  if (latestIcon) {
    item.iconId = latestIcon;
  }
  normalizeItemName(item);
  return item;
}

/** 遍历并为整个 GameState 的装备栏、背包及黑市物品同步最新 iconId 与汉字名称 */
export function normalizeGameStateEquipment(state: GameState): GameState {
  if (state.equipment?.equipped) {
    if (state.equipment.equipped.weapon) enrichEquipmentItem(state.equipment.equipped.weapon);
    if (state.equipment.equipped.offHand) enrichEquipmentItem(state.equipment.equipped.offHand);
    if (state.equipment.equipped.body) enrichEquipmentItem(state.equipment.equipped.body);
  }
  if (state.inventory?.items) {
    state.inventory.items.forEach((item) => enrichEquipmentItem(item));
  }
  if (state.blackMarket?.items) {
    state.blackMarket.items.forEach((item) => enrichEquipmentItem(item));
  }
  return state;
}
