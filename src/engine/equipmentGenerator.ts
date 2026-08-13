import type { EquipmentItem, EquipmentSlot, ItemRarity, PlayerClassId } from '../types/gameState.js';
import type { SeededRandom } from '../lib/rng.js';
import {
  baseWeapons,
  materials,
  shaftMaterials,
  armors,
  armorMaterialUpgrades,
  shields,
  arrows,
  getWeaponFinal,
  getArmorFinal,
  getShieldFinal,
} from '../lib/equipmentData.js';

// --- 常量与映射 ---

const QUALITY_MULTIPLIER: Record<ItemRarity, number> = {
  0: 1.00,  // 凡
  1: 1.20,  // 良
  2: 1.50,  // 精
  3: 2.00,  // 绝
  4: 3.00,  // 名 (名器)
};

const CLASS_WEAPON_CLASSES: Record<PlayerClassId, ('blade' | 'sword' | 'spear' | 'blunt' | 'bow' | 'fist')[]> = {
  CLASS_A: ['blade', 'spear'],      // 猛将
  CLASS_B: ['sword'],               // 游侠
  CLASS_C: ['sword'],               // 谋士 (配剑)
  CLASS_D: ['blade'],               // 杀手 (双持刀)
  CLASS_E: ['blunt'],               // 绿林好汉 (钝器)
};

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

export function pickShopRarity(rng: SeededRandom, playerLevel: number): ItemRarity {
  const roll = rng.next(); // [0, 1)
  if (playerLevel >= 45 && roll >= 0.98) return 3; // 绝 2%
  if (playerLevel >= 25 && roll >= 0.90) return 2; // 精 8%
  if (playerLevel >= 10 && roll >= 0.70) return 1; // 良 20%
  return 0; // 凡
}

export function calcItemPrice(playerLevel: number, rarity: ItemRarity): number {
  return Math.floor(Math.pow(playerLevel, 1.5) * QUALITY_MULTIPLIER[rarity] * 10);
}

export function calcSellPrice(playerLevel: number, rarity: ItemRarity): number {
  return Math.floor(calcItemPrice(playerLevel, rarity) * 0.25);
}

export type GenerateEquipmentInput = {
  playerLevel: number;
  slot?: EquipmentSlot;
  rarity?: ItemRarity;
  classId?: PlayerClassId;
  rng?: SeededRandom;
  forcedItemId?: string;
};

export function generateEquipment(input: GenerateEquipmentInput): EquipmentItem {
  const rng = input.rng ?? defaultRng();
  const level = input.playerLevel;
  
  let slot = input.slot ?? rng.pick(['weapon', 'offHand', 'body'] as EquipmentSlot[]);
  if (input.forcedItemId) {
    const isW = baseWeapons.some((w) => w.id === input.forcedItemId);
    const isA = armors.some((a) => a.id === input.forcedItemId);
    const isS = shields.some((s) => s.id === input.forcedItemId);
    if (isW) slot = 'weapon';
    else if (isA) slot = 'body';
    else if (isS) slot = 'offHand';
  }
  
  // 决定品质等级
  let rarity = input.rarity ?? pickShopRarity(rng, level);
  if (rarity === 4) {
    // 名器概率通过特殊活动产生，若此处偶遇则降级为 3，除非明确指定
    if (input.rarity === undefined) rarity = 3;
  }

  // 1. 初始化 Sancai 衍生字段
  let itemId = '';
  let material = 'chaogang';
  let craft: string | null = null;
  let shaft: string | null = null;
  let upgrade: string | null = null;
  let arrow: string | null = 'normal';

  let name = '';
  let desc = '';
  let subType: 'weapon' | 'shield' | 'none' = 'none';
  let armorVal: number | undefined;
  let weaponDamageVal: { min: number; max: number } | undefined;

  // 2. 名器特殊处理 (Rarity 4)
  if (rarity === 4) {
    const legendaryRules = (globalThis as any).equipmentData?.legendary_rules ?? {
      examples: [
        { "id": "dao_sutiedao", "name": "宿铁刀", "class": "blade", "trait": "斩甲" },
        { "id": "dao_longque", "name": "大夏龙雀", "class": "blade", "trait": "龙雀" },
        { "id": "spear_qinglong", "name": "青龙偃月", "class": "spear", "trait": "威压" },
        { "id": "blunt_yuchi", "name": "尉迟钢鞭", "class": "blunt", "trait": "双鞭" },
        { "id": "bow_zhentian", "name": "震天弓", "class": "bow", "trait": "贯日" }
      ]
    };
    const example = rng.pick(legendaryRules.examples);
    
    // 如果是名弓，槽位强制为 weapon
    const actualSlot = (example.class === 'bow' || example.class === 'spear') ? 'weapon' : slot;

    if (actualSlot === 'weapon') {
      itemId = example.id ?? 'dao_hengdao';
      material = 'bintie';
      craft = 'guangang';
      name = example.name;
      desc = `【名器】${example.name}。专属词条：${example.trait}。`;
      subType = 'weapon';
      
      const finalW = getWeaponFinal(itemId, material, craft, null, null);
      weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };
    } else if (actualSlot === 'body') {
      itemId = 'suozi';
      material = 'bintie';
      upgrade = 'bintie';
      name = '镔铁锁子甲';
      desc = `【名器】罕见的西域镔铁锁子甲，极其轻韧。`;
      subType = 'none';
      
      const finalA = getArmorFinal(itemId, upgrade);
      armorVal = finalA.reduce;
    } else {
      itemId = 'tengpai';
      name = '百炼铁缘藤牌';
      desc = `【名器】镶铁边的古法藤牌，格挡卸力无暇。`;
      subType = 'shield';
      armorVal = 0;
    }
  } else {
    // 3. 普通/精良/绝等物品生成 (Rarity 0 - 3)
    // 根据 slot 选择基础配置
    if (slot === 'weapon') {
      // 武器：考虑职业倾向
      const base = (input.forcedItemId && baseWeapons.find((w) => w.id === input.forcedItemId)) || (() => {
        let allowedClasses = input.classId ? CLASS_WEAPON_CLASSES[input.classId] : ['blade', 'sword', 'spear', 'blunt', 'bow'];
        if (!allowedClasses || allowedClasses.length === 0) allowedClasses = ['blade', 'sword'];
        const chosenClass = rng.pick(allowedClasses);
        const candidates = baseWeapons.filter((w) => w.class === chosenClass && w.id !== 'tushou');
        return candidates.length > 0 ? rng.pick(candidates) : baseWeapons[0]!;
      })();

      itemId = base.id;
      subType = 'weapon';

      // 材质决定
      if (rarity === 0) {
        material = rng.pick(['qingtong', 'shengtie', 'shutie']);
      } else if (rarity === 1) {
        material = 'chaogang';
      } else if (rarity === 2) {
        material = 'jinggang';
        craft = rng.pick(['guangang', 'baogang', 'jiagang']);
      } else {
        material = 'bintie';
        craft = 'guangang';
      }

      // 长枪需要枪杆
      if (base.class === 'spear') {
        shaft = rarity === 0 ? 'zamu' : (rarity === 1 ? 'zaomu' : (rarity === 2 ? 'baila' : 'jizhu'));
      }
      // 弓需要箭矢
      if (base.class === 'bow') {
        arrow = rarity === 0 ? 'normal' : (rarity === 1 ? 'normal' : (rarity === 2 ? 'pierce' : 'heavy'));
      }

      const finalW = getWeaponFinal(itemId, material, craft, shaft, arrow);
      weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };

      // 组装名称
      const matName = materials.find((m) => m.id === material)?.name ?? '';
      const craftName = craft ? craft : '';
      const shaftName = shaft ? shaftMaterials.find((s) => s.id === shaft)?.name.slice(0, 3) ?? '' : '';
      name = `${craftName}${shaftName}${matName}${base.name}`;
      desc = `一件${name}。基础命中率: ${finalW.hit}%，攻击耗体: ${finalW.cost}。`;
    } else if (slot === 'body') {
      // 甲胄
      const base = (input.forcedItemId && armors.find((a) => a.id === input.forcedItemId)) || (() => {
        const candidates = armors.filter((a) => a.id !== 'buyi');
        return rng.pick(candidates);
      })();

      itemId = base.id;
      subType = 'none';

      // 甲材质升级
      if (rarity === 0) {
        upgrade = null;
      } else if (rarity === 1) {
        upgrade = 'jinggang';
      } else if (rarity === 2) {
        upgrade = 'bailian';
      } else {
        upgrade = 'bintie';
      }

      const finalA = getArmorFinal(itemId, upgrade);
      armorVal = finalA.reduce;

      const upName = upgrade ? armorMaterialUpgrades.find((u) => u.id === upgrade)?.name ?? '' : '';
      name = `${upName}${base.name}`;
      desc = `防具：${name}。防护级: A${finalA.a}，护甲减伤: ${finalA.reduce}，体力上限修正: ${finalA.stamina}。`;
    } else {
      // 副手 (offHand)：盾牌 或 允许双持的副手武器
      const forcedShield = input.forcedItemId ? shields.find((s) => s.id === input.forcedItemId) : null;
      const forcedWeapon = input.forcedItemId ? baseWeapons.find((w) => w.id === input.forcedItemId) : null;
      const isShield = forcedShield ? true : (forcedWeapon ? false : rng.next() < 0.7);

      if (isShield) {
        const base = forcedShield || rng.pick(shields);
        itemId = base.id;
        subType = 'shield';
        armorVal = 0;
        
        const matPrefix = rarity === 0 ? '藤编' : (rarity === 1 ? '白铜' : (rarity === 2 ? '铁叶' : '百炼铁装'));
        name = `${matPrefix}${base.name}`;
        const finalS = getShieldFinal(itemId);
        desc = `副手防具：${name}。格挡率加成: +${Math.round(finalS.blockMod * 100)}%，格挡体力修正: ${finalS.blockCostMod}。`;
      } else {
        // 双持武器：找允许双持的武器（如铁鞭/单刀）
        const base = forcedWeapon || (() => {
          const candidates = baseWeapons.filter((w) => w.dual_allowed || w.class === 'blade');
          return candidates.length > 0 ? rng.pick(candidates) : baseWeapons[0]!;
        })();
        
        itemId = base.id;
        subType = 'weapon';

        if (rarity === 0) {
          material = rng.pick(['qingtong', 'shengtie', 'shutie']);
        } else if (rarity === 1) {
          material = 'chaogang';
        } else if (rarity === 2) {
          material = 'jinggang';
          craft = 'jiagang';
        } else {
          material = 'bintie';
          craft = 'guangang';
        }

        const finalW = getWeaponFinal(itemId, material, craft, null, null);
        weaponDamageVal = { min: finalW.dmg, max: finalW.dmg };

        const matName = materials.find((m) => m.id === material)?.name ?? '';
        name = `${matName}${base.name}·副手`;
        desc = `双持副手武器：${name}。副手伤害折算 80%，格挡率强制为 0%。`;
      }
    }
  }

  // 计算买卖价格
  const price = calcItemPrice(level, rarity);
  const sellPrice = calcSellPrice(level, rarity);

  // 随机唯一 ID
  const id = `eq_${slot}_${Date.now().toString(36)}_${Math.floor(rng.next() * 0xffff).toString(16)}`;

  return {
    id,
    name,
    description: desc,
    slot,
    rarity,
    iconId: `item_${slot}_${String(rng.int(1, 5)).padStart(2, '0')}`,
    subType,
    armor: armorVal,
    weaponDamage: weaponDamageVal,
    price,
    sellPrice,
    bonusAttributes: {},
    itemId,
    material,
    craft,
    shaft,
    upgrade,
    arrow,
  };
}

export type ShopBatchInput = {
  playerLevel: number;
  classId: PlayerClassId;
  count?: number;
  rng?: SeededRandom;
};

export function generateWeaponShopItems(input: ShopBatchInput): EquipmentItem[] {
  const { playerLevel, classId, rng } = input;
  const count = input.count ?? 6;

  const items: EquipmentItem[] = [];

  // 第 1 件：必定是本职业主手武器
  items.push(generateEquipment({
    playerLevel,
    classId,
    slot: 'weapon',
    rng,
  }));

  // 其余从武器和甲衣中生成
  for (let i = 1; i < count; i++) {
    const slot = (rng ?? defaultRng()).pick(['weapon', 'body'] as EquipmentSlot[]);
    items.push(generateEquipment({ playerLevel, classId, slot, rng }));
  }

  return items;
}

export function generateMagicShopItems(input: ShopBatchInput): EquipmentItem[] {
  const { playerLevel, classId, rng } = input;
  const count = input.count ?? 6;

  const items: EquipmentItem[] = [];

  // 生成副手盾牌/双持武器 以及 甲防衣物
  for (let i = 0; i < count; i++) {
    const slot = (rng ?? defaultRng()).pick(['offHand', 'body'] as EquipmentSlot[]);
    items.push(generateEquipment({ playerLevel, classId, slot, rng }));
  }

  return items;
}

export function generateBlackMarketItems(input: ShopBatchInput): EquipmentItem[] {
  return [
    ...generateWeaponShopItems(input),
    ...generateMagicShopItems(input),
  ];
}

/** @deprecated 请使用 generateEquipment() */
export function generateShopItem(playerLevel: number): EquipmentItem {
  return generateEquipment({ playerLevel });
}

/** @deprecated 请使用 generateBlackMarketItems() */
export function generateShopItems(playerLevel: number, count: number = 6): EquipmentItem[] {
  return Array.from({ length: count }, () => generateEquipment({ playerLevel }));
}
