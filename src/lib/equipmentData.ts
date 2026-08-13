import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.resolve(__dirname, '../data/equipment_data.json');
const rawJson = fs.readFileSync(jsonPath, 'utf-8');

export const equipmentData = JSON.parse(rawJson);

// ---------- TS 类型定义 ----------

export interface BaseWeapon {
  id: string;
  name: string;
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

// 最终战斗衍生实体类型
export interface WeaponFinal {
  id: string;
  name: string;
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
  blockMod: number;
  blockCostMod: number;
  dodgeMod: number;
}

// ---------- 强类型 Getter 数组 ----------

export const baseWeapons: BaseWeapon[] = equipmentData.weapons;
export const materials: Material[] = equipmentData.materials;
export const shaftMaterials: ShaftMaterial[] = equipmentData.shaft_materials;
export const armors: Armor[] = equipmentData.armors;
export const armorMaterialUpgrades: ArmorMaterialUpgrade[] = equipmentData.armor_material_upgrades;
export const shields: Shield[] = equipmentData.shields;
export const arrows: Arrow[] = equipmentData.arrows;

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
  };
}
