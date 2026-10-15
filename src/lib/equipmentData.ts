import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameState, EquipmentItem, WeaponCombatProfile, WeaponTraitItem, WeaponRhythmProfile } from '../types/gameState.js';

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

export interface ClassConfigItem {
  id: 'CLASS_A' | 'CLASS_B' | 'CLASS_C' | 'CLASS_D' | 'CLASS_E';
  name: string;
  desc?: string;
  mainStat: 'strength' | 'agility' | 'intelligence' | 'constitution' | 'luck';
  mainStatName: string;
  hpMultiplier: number;
  blockChanceBp: number;
  dodgeChanceBp: number;
  allowedWeaponClasses: ('blade' | 'sword' | 'spear' | 'blunt' | 'bow' | 'fist')[];
  weaponFactor?: number;
  armorCap?: number;
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

export const classConfigs: ClassConfigItem[] = equipmentData.classes || [
  {
    id: 'CLASS_A',
    name: '猛将',
    desc: '猛力破阵型：精通大刀与长枪，体魄成长极高，拥有卓越的正面架招格挡能力。',
    mainStat: 'strength',
    mainStatName: '力量',
    hpMultiplier: 5,
    blockChanceBp: 2500,
    dodgeChanceBp: 0,
    allowedWeaponClasses: ['blade', 'spear'],
    weaponFactor: 2.0,
    armorCap: 50,
  },
  {
    id: 'CLASS_B',
    name: '游侠',
    desc: '灵动身法型：精通佩剑，拥有极高的被动闪避，身法飘逸难测。',
    mainStat: 'agility',
    mainStatName: '身法敏捷',
    hpMultiplier: 4,
    blockChanceBp: 0,
    dodgeChanceBp: 5000,
    allowedWeaponClasses: ['sword'],
    weaponFactor: 2.5,
    armorCap: 25,
  },
  {
    id: 'CLASS_C',
    name: '军策',
    desc: '谋略权谋型：配精钢文剑，身板最脆但智力极高，未来规划掌控计策与弱点破绽。',
    mainStat: 'intelligence',
    mainStatName: '智谋',
    hpMultiplier: 2,
    blockChanceBp: 0,
    dodgeChanceBp: 0,
    allowedWeaponClasses: ['sword'],
    weaponFactor: 4.5,
    armorCap: 10,
  },
  {
    id: 'CLASS_D',
    name: '义士',
    desc: '敏捷刺袭型：偏好轻快单手刀，身法敏锐，未来规划暗器刺击与追击连斩。',
    mainStat: 'agility',
    mainStatName: '身法敏捷',
    hpMultiplier: 4,
    blockChanceBp: 0,
    dodgeChanceBp: 0,
    allowedWeaponClasses: ['blade'],
    weaponFactor: 2.0,
    armorCap: 25,
  },
  {
    id: 'CLASS_E',
    name: '绿林好汉',
    desc: '重装强攻型：崇尚骨朵重锤与四棱铁锏，未破甲亦能凭借钝击震荡重创敌人。',
    mainStat: 'strength',
    mainStatName: '神力',
    hpMultiplier: 4,
    blockChanceBp: 0,
    dodgeChanceBp: 0,
    allowedWeaponClasses: ['blunt'],
    weaponFactor: 2.0,
    armorCap: 25,
  },
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

/** 根据霸气数值动态计算下一段位称号及所需门槛 */
export function getNextHonorTitleInfo(honor: number): { nextTitle: string; nextHonorThreshold: number } {
  const safeHonor = Math.max(0, Math.floor(honor || 0));
  const sorted = [...honorTitles].sort((a, b) => a.minHonor - b.minHonor);
  const matchedIndex = sorted.findIndex((t) => safeHonor >= t.minHonor && safeHonor <= t.maxHonor);
  if (matchedIndex !== -1 && matchedIndex < sorted.length - 1) {
    const nextTier = sorted[matchedIndex + 1];
    return {
      nextTitle: nextTier.title,
      nextHonorThreshold: nextTier.minHonor,
    };
  }
  if (sorted.length > 0) {
    const lastTier = sorted[sorted.length - 1];
    return {
      nextTitle: lastTier.title,
      nextHonorThreshold: lastTier.minHonor,
    };
  }
  return { nextTitle: '最高段位', nextHonorThreshold: 999999 };
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
  if (Array.isArray(data.classes)) {
    classConfigs.length = 0;
    classConfigs.push(...data.classes);
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

/** 武器类别汉字映射 */
const WEAPON_CLASS_NAMES: Record<string, string> = {
  blade: '刀',
  sword: '剑',
  spear: '枪',
  blunt: '钝器',
  bow: '弓',
  fist: '拳/徒手',
};

/** 战技文案默认模板。占位符 {pct} {scale} {n} {hit} {kind} {a} 由服务端按武器数值代入；可在 equipment_data.json 的 trait_texts 中按 code 覆盖。 */
export const TRAIT_TEXT_DEFAULTS: Record<string, { label: string; placeholders: string; name: string; description: string; conditionDescription: string }> = {
  COMBO: {
    label: '连击（武器字段 combo）', placeholders: '{pct}=触发概率%',
    name: '追击连斩',
    description: '攻击命中且对手存活未被格挡时，有 {pct}% 概率立即追加一次攻击；追加攻击独立判定命中，且不能再次触发连击。',
    conditionDescription: '攻击命中对手且未被格挡、对手未阵亡',
  },
  PARRY_COUNTER: {
    label: '招架反击（武器字段 parry）', placeholders: '{pct}=触发概率% {scale}=反击伤害系数',
    name: '招架反击',
    description: '防守方被攻击受到伤害后（若存活且未被震慑），有 {pct}% 概率发动即时反击（伤害系数 {scale}x）。注意：反击不免除受击伤害。',
    conditionDescription: '防守承受伤害后存活且自身未处于震慑状态',
  },
  REPEL: {
    label: '击退（武器字段 repel）', placeholders: '{pct}=触发概率%',
    name: '枪劲击退',
    description: '命中时有 {pct}% 概率令非长刀目标下一回合出手受挫落空。',
    conditionDescription: '攻击命中目标且对手无击退免疫',
  },
  STUN: {
    label: '眩晕/震慑（武器字段 stun）', placeholders: '{pct}=触发概率%',
    name: '重击震慑',
    description: '命中时有 {pct}% 概率使目标震慑跳过下一行动回合，并强制进行调息。',
    conditionDescription: '攻击命中目标',
  },
  BLUNT_SHOCK: {
    label: '钝击透甲（钝器自带）', placeholders: '无',
    name: '钝击透甲',
    description: '钝器无法穿透护甲时造成 8 点固定透甲震伤；被盾牌格挡时依然造成 5 点固定余震伤害。注意：钝器自带的破甲级加成已直接计入武器破甲值中。',
    conditionDescription: '未破甲或被盾牌格挡时常驻生效',
  },
  IGNORE_REDUCE: {
    label: '破甲压制（武器字段 ignore_reduce）', placeholders: '{n}=忽略的减伤点数',
    name: '破甲压制',
    description: '攻击穿透护甲计算时，强制忽略目标护甲 {n} 点减伤值。',
    conditionDescription: '完全贯穿护甲结算时',
  },
  VS_KIND_ADVANTAGE: {
    label: '克制某类兵器（武器字段 vs_kind）', placeholders: '{kind}=被克制兵器名 {hit}=命中加成%',
    name: '克制{kind}',
    description: '面对手持{kind}的目标时，攻击基础命中率提升 +{hit}%，且免疫长枪击退效果。',
    conditionDescription: '目标装备武器为 {kind}',
  },
  FIRST_STRIKE: {
    label: '远程先发（武器字段 first）', placeholders: '无',
    name: '远程先发',
    description: '出手就绪时具有行动优先权（仍受自身状态及双方优先级影响）。远程射击受纸甲等特定防具克制。',
    conditionDescription: '攻击准备就绪出手判定时',
  },
  LEGENDARY_SLAY_ARMOR: {
    label: '名器破重甲（武器字段 bonus_a / bonus_scale）', placeholders: '{a}=护甲等级门槛 {pct}=伤害提升%',
    name: '名刃破重甲',
    description: '面对护甲防护级 A >= {a} 的敌人时，攻击伤害基础值提升 {pct}%。',
    conditionDescription: '目标防护等级 A >= {a}',
  },
};

function fillTraitTemplate(tpl: string, vars: Record<string, string | number | undefined>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** 取战技文案：优先 equipment_data.json 的 trait_texts[code] 覆盖项，缺省用默认模板。 */
export function traitTexts(code: string, vars: Record<string, string | number | undefined>): { name: string; description: string; conditionDescription: string } {
  const d = TRAIT_TEXT_DEFAULTS[code];
  const o = ((equipmentData as any).trait_texts?.[code] ?? {}) as { name?: string; description?: string; conditionDescription?: string };
  const pick = (ov: string | undefined, def: string) => fillTraitTemplate(ov && ov.trim() ? ov.trim() : def, vars);
  return {
    name: pick(o.name, d.name),
    description: pick(o.description, d.description),
    conditionDescription: pick(o.conditionDescription, d.conditionDescription),
  };
}

const RARITY_NAMES: Record<number, string> = {
  0: '凡品',
  1: '良品',
  2: '精品',
  3: '绝品',
  4: '名器',
};

/** 构建武器战斗详情画像 (WeaponCombatProfile) */
export function buildWeaponCombatProfile(
  item: {
    itemId?: string;
    id?: string;
    material?: string;
    craft?: string | null;
    shaft?: string | null;
    arrow?: string | null;
    rarity?: number;
    weaponDamage?: { min: number; max: number };
  } | null | undefined
): WeaponCombatProfile {
  const itemId = item?.itemId || item?.id || 'tushou';
  const materialId = item?.material || 'chaogang';
  const craft = item?.craft;
  const shaft = item?.shaft;
  const arrow = item?.arrow;
  const rarity = item?.rarity ?? 0;

  const base = baseWeapons.find((w) => w.id === itemId);
  const finalW = getWeaponFinal(itemId, materialId, craft, shaft, arrow);
  if (item?.weaponDamage) {
    finalW.dmg = Math.round((item.weaponDamage.min + item.weaponDamage.max) / 2);
  }

  const mat = materials.find((m) => m.id === materialId) || {
    tier: 3,
    id: 'chaogang',
    name: '炒钢',
    dmg_scale: 1.0,
    durability_scale: 1.0,
  };
  const craftObj = crafts.find((c) => c.id === craft);
  const shaftObj = shaftMaterials.find((s) => s.id === shaft);
  const arrowObj = arrows.find((a) => a.id === arrow);

  const wClass = finalW.class;
  const className = WEAPON_CLASS_NAMES[wClass] || wClass;

  const grip = finalW.grip === 'twohand' ? 'twohand' : 'onehand';
  const gripName = grip === 'twohand' ? '双手持握' : '单手持握';

  const rhythm: WeaponRhythmProfile = {
    intervalRounds: finalW.interval,
    chargingRounds: Math.max(0, finalW.interval - 1),
    staminaCostPerAttack: finalW.cost,
    hasFirstStrike: !!finalW.first,
  };

  // 强类型特性解析（无 null 模糊，全部显式 boolean 标记）
  const traits: WeaponTraitItem[] = [];

  // 1. 连击 (blade 等)
  if (finalW.combo > 0) {
    const pct = Math.round(finalW.combo * 100);
    traits.push({
      code: 'COMBO',
      ...traitTexts('COMBO', { pct }),
      hasChancePercent: true,
      chancePercent: pct,
      hasDamageScale: true,
      damageScale: 1.0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 2. 招架反击 (sword 等)
  if (finalW.parry > 0) {
    const pct = Math.round(finalW.parry * 100);
    const scale = finalW.parryDmgScale ?? 1.0;
    traits.push({
      code: 'PARRY_COUNTER',
      ...traitTexts('PARRY_COUNTER', { pct, scale }),
      hasChancePercent: true,
      chancePercent: pct,
      hasDamageScale: true,
      damageScale: scale,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 3. 枪术击退 (spear 等)
  if (finalW.repel > 0) {
    const pct = Math.round(finalW.repel * 100);
    traits.push({
      code: 'REPEL',
      ...traitTexts('REPEL', { pct }),
      hasChancePercent: true,
      chancePercent: pct,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 4. 重击震慑 (blunt 等)
  if (finalW.stun > 0) {
    const pct = Math.round(finalW.stun * 100);
    traits.push({
      code: 'STUN',
      ...traitTexts('STUN', { pct }),
      hasChancePercent: true,
      chancePercent: pct,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: true,
      stunRounds: 1,
    });
  }

  // 5. 破甲穿透 (穿甲/钝器震伤特性)
  if (wClass === 'blunt') {
    traits.push({
      code: 'BLUNT_SHOCK',
      ...traitTexts('BLUNT_SHOCK', {}),
      hasChancePercent: false,
      chancePercent: 0,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: true,
      fixedDamage: 8,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 6. 锏忽略减伤
  if (finalW.ignoreReduce > 0) {
    traits.push({
      code: 'IGNORE_REDUCE',
      ...traitTexts('IGNORE_REDUCE', { n: finalW.ignoreReduce }),
      hasChancePercent: false,
      chancePercent: 0,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: true,
      ignoreArmorReduce: finalW.ignoreReduce,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 7. 克制长兵 (双手长刀)
  if (finalW.vsKind) {
    traits.push({
      code: 'VS_KIND_ADVANTAGE',
      ...traitTexts('VS_KIND_ADVANTAGE', { kind: WEAPON_CLASS_NAMES[finalW.vsKind!] || finalW.vsKind, hit: finalW.vsHit ?? 0 }),
      hasChancePercent: false,
      chancePercent: 0,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: true,
      hitBonus: finalW.vsHit ?? 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 8. 弓箭先攻与箭矢
  if (finalW.first) {
    traits.push({
      code: 'FIRST_STRIKE',
      ...traitTexts('FIRST_STRIKE', {}),
      hasChancePercent: false,
      chancePercent: 0,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  // 9. 名器专属加成
  if (finalW.bonusA !== undefined && finalW.bonusScale !== undefined) {
    traits.push({
      code: 'LEGENDARY_SLAY_ARMOR',
      ...traitTexts('LEGENDARY_SLAY_ARMOR', { a: finalW.bonusA, pct: Math.round(((finalW.bonusScale ?? 1) - 1) * 100) }),
      hasChancePercent: false,
      chancePercent: 0,
      hasDamageScale: true,
      damageScale: finalW.bonusScale,
      hasFixedDamage: false,
      fixedDamage: 0,
      hasIgnoreArmorReduce: false,
      ignoreArmorReduce: 0,
      hasHitBonus: false,
      hitBonus: 0,
      hasStunRounds: false,
      stunRounds: 0,
    });
  }

  return {
    profileVersion: 1,
    class: wClass,
    className,
    grip,
    gripName,
    materialTier: mat.tier,
    materialName: mat.name,
    rarity,
    rarityName: RARITY_NAMES[rarity] || '普通',
    craftName: craftObj?.name || '无',
    shaftName: shaftObj?.name || '无',
    arrowName: arrowObj?.name || '无',
    baseDamage: finalW.dmg,
    penetration: finalW.p,
    baseHitPercent: finalW.hit,
    dodgeSelfModifier: base?.id === 'tushou' ? 15 : 0,
    rhythm,
    traits,
  };
}

/** 动态为装备对象补全/同步最新的 iconId、汉字名称以及 combatProfile */
export function enrichEquipmentItem<
  T extends {
    slot?: string;
    itemId?: string;
    id?: string;
    iconId?: string;
    name?: string;
    craft?: string | null;
    combatProfile?: WeaponCombatProfile;
    subType?: 'weapon' | 'shield' | 'none';
  } | null | undefined
>(item: T): T {
  if (!item) return item;
  const latestIcon = resolveItemIconId(item);
  if (latestIcon) {
    item.iconId = latestIcon;
  }
  normalizeItemName(item as any);

  // 若为武器槽位或副手武器，注入/更新 combatProfile
  const isWeapon = item.slot === 'weapon' || (item.slot === 'offHand' && item.subType === 'weapon') || baseWeapons.some((w) => w.id === item.itemId);
  if (isWeapon) {
    item.combatProfile = buildWeaponCombatProfile(item as any);
  }

  return item;
}

/** 遍历并为整个 GameState 的装备栏、背包及黑市物品同步最新 iconId 与汉字名称与画像 */
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
