/**
 * EquipmentGenerator — 装备属性生成器
 *
 * 严格遵循 BlackMarket_System_Spec_V1.md § 3 的数值公式：
 *
 *   BaseAttr  = playerLevel × SlotFactor × QualityMultiplier × (0.85 + rand[0,0.3))
 *   MinDmg    = floor(playerLevel × WEAPON_SLOT_FACTOR × 0.7 × QualityMultiplier)
 *   MaxDmg    = floor(playerLevel × WEAPON_SLOT_FACTOR × 1.3 × QualityMultiplier)
 *   Price     = floor(playerLevel^1.5 × QualityMultiplier × 10)
 *
 * 品质出现概率 (商店)：Normal 90% / Excellent 8% / Epic 2% (50级解锁)
 */

import type { EquipmentItem, EquipmentSlot, ItemRarity, PlayerClassId } from '../types/gameState.js';
import type { SeededRandom } from '../lib/rng.js';

// ---------------------------------------------------------------------------
// 常量表
// ---------------------------------------------------------------------------

/** 按 Spec § 3.3 定义的槽位系数 */
const SLOT_FACTOR: Record<EquipmentSlot, number> = {
  weapon:  1.2,
  body:    1.0,
  offHand: 0.8,
  head:    0.5,
  hands:   0.5,
  feet:    0.5,
  neck:    0.5,
  belt:    0.5,
  ring:    0.5,
  trinket: 0.5,
};

/** 按 Spec § 3.2 定义的品质属性倍率。rarity 0-4 对应索引 */
const QUALITY_MULTIPLIER: Record<ItemRarity, number> = {
  0: 1.00,  // 普通 Normal
  1: 1.15,  // 优秀 Excellent
  2: 1.35,  // 史诗 Epic
  3: 1.55,  // 传说 Legendary
  4: 2.00,  // 神器 Artifact
};

/**
 * 兵器铺 (weapon shop) 槽位：会由职业武器保障逻辑介入。
 * 奇珍阁 (magic shop) 槽位：纯随机。
 */
const WEAPON_SHOP_SLOTS: EquipmentSlot[] = ['weapon', 'head', 'body', 'hands', 'feet', 'offHand'];
const MAGIC_SHOP_SLOTS:  EquipmentSlot[] = ['neck', 'belt', 'ring', 'trinket', 'offHand'];

/** 每职业的主属性键 (用于属性权重倾斜) */
const CLASS_MAIN_STAT: Record<PlayerClassId, keyof Pick<
  { strength: number; intelligence: number; agility: number; constitution: number; luck: number },
  'strength' | 'intelligence' | 'agility'
>> = {
  CLASS_A: 'strength',      // 猛将
  CLASS_B: 'intelligence',  // 谋士
  CLASS_C: 'agility',       // 游侠
  CLASS_D: 'agility',       // 刺客
};

/** 各职业允许使用的武器槽类型（决定兵器铺保障的"本职业武器"名称池） */
const CLASS_WEAPON_NAMES: Record<PlayerClassId, string[]> = {
  CLASS_A: ['朴刀', '长枪', '陌刀', '斩马刀', '铁锏'],
  CLASS_B: ['羽扇', '玉如意', '符箓筒', '画卷', '龙泉剑'],
  CLASS_C: ['角弓', '铁胎弓', '雕翎箭袋', '短弩', '猎刀'],
  CLASS_D: ['匕首', '飞刀', '乌金钩', '袖箭', '副刃'],
};

/** 各槽位的通用名称池 */
const SLOT_NAMES: Record<EquipmentSlot, string[]> = {
  head:    ['皮帽', '铁盔', '束发冠', '笠帽', '铜盔'],
  body:    ['布衣', '皮甲', '锁子甲', '鱼鳞铠', '步人甲'],
  hands:   ['粗布手套', '皮护腕', '铁手套', '革手套'],
  feet:    ['草鞋', '布鞋', '皮靴', '铁鞋'],
  neck:    ['平安扣', '玉坠', '驱邪符', '铜铃'],
  belt:    ['布带', '玉带', '牛皮腰带', '铁腰扣'],
  ring:    ['铜戒指', '白玉环', '金扳指'],
  trinket: ['香囊', '护身符', '铜镜片', '兽牙吊坠'],
  weapon:  ['铁剑', '长刀', '短棍', '铁鞭'],
  offHand: ['圆盾', '藤盾', '皮盾', '铁盾'],
};

// ---------------------------------------------------------------------------
// 内部工具
// ---------------------------------------------------------------------------

/** 生成默认的非确定性 RNG（用于非测试场景） */
function defaultRng(): SeededRandom {
  return {
    next: () => Math.random(),
    int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    chanceBp: (bp) => {
      if (bp <= 0) return false;
      if (bp >= 10000) return true;
      return Math.floor(Math.random() * 10000) + 1 <= bp;
    },
    pick: <T>(items: readonly T[]) => {
      if (items.length === 0) throw new Error('Cannot pick from empty array');
      return items[Math.floor(Math.random() * items.length)]!;
    },
  };
}

/**
 * 按照 Spec § 3.2 的商店概率生成品质。
 * - Normal  90%
 * - Excellent 8%
 * - Epic     2% (需要 playerLevel >= 50)
 * - Legendary / Artifact 仅限特定产出，商店不生成。
 */
export function pickShopRarity(rng: SeededRandom, playerLevel: number): ItemRarity {
  const roll = rng.next(); // [0, 1)
  if (playerLevel >= 50 && roll >= 0.98) return 2; // Epic 2%
  if (roll >= 0.90) return 1;                        // Excellent 8%
  return 0;                                           // Normal 90%
}

/**
 * 计算装备购买价格。
 * Price = floor(playerLevel^1.5 × QualityMultiplier × 10)
 */
export function calcItemPrice(playerLevel: number, rarity: ItemRarity): number {
  return Math.floor(Math.pow(playerLevel, 1.5) * QUALITY_MULTIPLIER[rarity] * 10);
}

/**
 * 计算装备出售价格（购买价的 25%）。
 */
export function calcSellPrice(playerLevel: number, rarity: ItemRarity): number {
  return Math.floor(calcItemPrice(playerLevel, rarity) * 0.25);
}

// ---------------------------------------------------------------------------
// 核心生成函数
// ---------------------------------------------------------------------------

export type GenerateEquipmentInput = {
  playerLevel: number;
  slot?: EquipmentSlot;
  rarity?: ItemRarity;
  /** 传入以启用本职业属性权重倾斜。生成武器名称时同样依赖此值。 */
  classId?: PlayerClassId;
  rng?: SeededRandom;
};

/**
 * 生成单件装备，严格遵循 Spec § 3 的全套公式。
 */
export function generateEquipment(input: GenerateEquipmentInput): EquipmentItem {
  const rng      = input.rng ?? defaultRng();
  const level    = input.playerLevel;
  const slot     = input.slot ?? rng.pick([...WEAPON_SHOP_SLOTS, ...MAGIC_SHOP_SLOTS] as EquipmentSlot[]);
  const rarity   = input.rarity ?? pickShopRarity(rng, level);

  const slotFactor    = SLOT_FACTOR[slot];
  const qualityMult   = QUALITY_MULTIPLIER[rarity];

  // BaseAttr = playerLevel × SlotFactor × QualityMultiplier × (0.85 + rand[0, 0.30))
  const floatFactor   = 0.85 + rng.next() * 0.30;
  const baseAttr      = level * slotFactor * qualityMult * floatFactor;

  // 装备名称
  const name = pickItemName(rng, slot, input.classId, rarity);

  // 武器伤害（仅 weapon 槽，以及部分 offHand 武器型副手）
  const isWeaponDmgSlot = slot === 'weapon';
  const isOffHandWeapon = slot === 'offHand' && rarity >= 2; // 高品质副手才有伤害
  const weaponDamage = (isWeaponDmgSlot || isOffHandWeapon)
    ? {
        min: Math.floor(level * SLOT_FACTOR['weapon'] * 0.7 * qualityMult),
        max: Math.floor(level * SLOT_FACTOR['weapon'] * 1.3 * qualityMult),
      }
    : undefined;

  // 护甲（物理防护槽位）
  const armorSlots: EquipmentSlot[] = ['head', 'body', 'hands', 'feet', 'belt'];
  const armor = armorSlots.includes(slot)
    ? Math.floor(baseAttr)
    : undefined;

  // 属性加成
  const bonusAttributes = distributeBonusAttributes(rng, baseAttr, slot, input.classId);

  // 价格
  const price = calcItemPrice(level, rarity);

  // 唯一 ID
  const id = `eq_${slot}_${Date.now().toString(36)}_${Math.floor(rng.next() * 0xffff).toString(16)}`;

  return {
    id,
    name,
    description: buildDescription(name, rarity),
    slot,
    rarity,
    subType: isWeaponDmgSlot ? 'weapon' : (slot === 'offHand' ? 'shield' : 'none'),
    armor,
    weaponDamage,
    price,
    bonusAttributes,
  };
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 分配属性加成到五维属性。
 * - 主属性（职业相关）获得 60% 的 baseAttr 值。
 * - 其余四维各获得随机的余量分配。
 */
function distributeBonusAttributes(
  rng: SeededRandom,
  baseAttr: number,
  slot: EquipmentSlot,
  classId?: PlayerClassId,
): Partial<{ strength: number; intelligence: number; agility: number; constitution: number; luck: number }> {
  // 首饰/光环类槽位不提供大量属性，以免数值失控
  const isAccessory = ['neck', 'ring', 'trinket'].includes(slot);
  const effectiveBase = isAccessory ? baseAttr * 0.5 : baseAttr;

  const mainStatKey = classId ? CLASS_MAIN_STAT[classId] : undefined;

  const attrs: Record<string, number> = {
    strength: 0,
    intelligence: 0,
    agility: 0,
    constitution: 0,
    luck: 0,
  };

  if (mainStatKey) {
    // 主属性获得 60% 分配
    attrs[mainStatKey] = Math.floor(effectiveBase * 0.60);
    const remainder = effectiveBase * 0.40;
    // 剩余随机分配到其他属性（每个属性获得 0~25% 的余量）
    const otherKeys = Object.keys(attrs).filter(k => k !== mainStatKey);
    let remainBudget = remainder;
    for (let i = 0; i < otherKeys.length - 1; i++) {
      const share = Math.floor(rng.next() * (remainBudget * 0.5));
      attrs[otherKeys[i]!] = share;
      remainBudget -= share;
    }
    attrs[otherKeys[otherKeys.length - 1]!] = Math.floor(Math.max(0, remainBudget));
  } else {
    // 无职业偏向：均匀随机分配
    let remainBudget = effectiveBase;
    const keys = Object.keys(attrs);
    for (let i = 0; i < keys.length - 1; i++) {
      const share = Math.floor(rng.next() * (remainBudget * 0.4));
      attrs[keys[i]!] = share;
      remainBudget -= share;
    }
    attrs[keys[keys.length - 1]!] = Math.floor(Math.max(0, remainBudget));
  }

  // 过滤掉值为 0 的属性（Partial）
  const result: Partial<typeof attrs> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v > 0) result[k as keyof typeof result] = v;
  }
  return result;
}

/**
 * 选取物品名称。weapon 槽在有 classId 时优先使用本职业名称池。
 */
function pickItemName(
  rng: SeededRandom,
  slot: EquipmentSlot,
  classId?: PlayerClassId,
  rarity?: ItemRarity,
): string {
  if (slot === 'weapon' && classId) {
    const classNames = CLASS_WEAPON_NAMES[classId];
    return rng.pick(classNames);
  }
  return rng.pick(SLOT_NAMES[slot]);
}

/**
 * 生成简短描述文案（Placeholder；正式文案由装备数据库或文案 Agent 提供）。
 * 此处仅按品质给出基础档次文案，满足 EquipmentItem.description 非空要求。
 */
function buildDescription(name: string, rarity: ItemRarity): string {
  const descs: Record<ItemRarity, string> = {
    0: `一件寻常的${name}，在当铺里论斤卖。`,
    1: `品相不错的${name}，前任主人死得比较体面。`,
    2: `来路不明的${name}，据说与某起大案有所关联。`,
    3: `传世的${name}，每一道划痕背后都是一段不能细说的往事。`,
    4: `神兵${name}，天下能用它的人屈指可数，你算哪根葱？`,
  };
  return descs[rarity];
}

// ---------------------------------------------------------------------------
// 商店批量生成入口
// ---------------------------------------------------------------------------

export type ShopBatchInput = {
  playerLevel: number;
  classId: PlayerClassId;
  count?: number;
  rng?: SeededRandom;
};

/**
 * 生成一批兵器铺商品（weapon shop items）。
 * 规则：确保至少 1 件 weapon 槽位商品（本职业武器）。
 *
 * @param input.count 默认 6，对应 Spec § 4.2 的 6 个货架位。
 */
export function generateWeaponShopItems(input: ShopBatchInput): EquipmentItem[] {
  const { playerLevel, classId, rng } = input;
  const count = input.count ?? 6;

  const items: EquipmentItem[] = [];

  // 第 1 件：保证本职业武器
  items.push(generateEquipment({
    playerLevel,
    classId,
    slot: 'weapon',
    rng,
  }));

  // 其余从兵器铺槽位池随机
  for (let i = 1; i < count; i++) {
    const slot = (rng ?? defaultRng()).pick(WEAPON_SHOP_SLOTS);
    items.push(generateEquipment({ playerLevel, classId, slot, rng }));
  }

  return items;
}

/**
 * 生成一批奇珍阁商品（magic shop items）。
 * 全部从首饰/配件槽位随机。
 */
export function generateMagicShopItems(input: ShopBatchInput): EquipmentItem[] {
  const { playerLevel, classId, rng } = input;
  const count = input.count ?? 6;

  return Array.from({ length: count }, () => {
    const slot = (rng ?? defaultRng()).pick(MAGIC_SHOP_SLOTS);
    return generateEquipment({ playerLevel, classId, slot, rng });
  });
}

/**
 * 生成完整的黑市商品列表（兵器铺 6 + 奇珍阁 6 = 12 件）。
 * 存储在 BlackMarketState.items 单一数组中；前端按 slot 类型过滤展示。
 */
export function generateBlackMarketItems(input: ShopBatchInput): EquipmentItem[] {
  return [
    ...generateWeaponShopItems(input),
    ...generateMagicShopItems(input),
  ];
}

// ---------------------------------------------------------------------------
// 向后兼容旧接口（供尚未迁移的调用方使用，后续可移除）
// ---------------------------------------------------------------------------

/** @deprecated 请使用 generateEquipment() */
export function generateShopItem(playerLevel: number): EquipmentItem {
  return generateEquipment({ playerLevel });
}

/** @deprecated 请使用 generateBlackMarketItems() */
export function generateShopItems(playerLevel: number, count: number = 6): EquipmentItem[] {
  return Array.from({ length: count }, () => generateEquipment({ playerLevel }));
}
