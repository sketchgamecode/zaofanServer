import type { Equipment, EquipmentSlot, ItemQuality } from './gameState';

const SLOTS: EquipmentSlot[] = ['head', 'chest', 'hands', 'feet', 'neck', 'belt', 'ring', 'trinket', 'mainHand', 'offHand'];

const NAMES: Record<EquipmentSlot, string[]> = {
  head: ['皮帽', '铁盔', '斗笠', '束发冠'],
  chest: ['布衣', '皮甲', '夜行衣', '锁子甲'],
  hands: ['粗布手套', '牛皮护腕', '精钢护手'],
  feet: ['草鞋', '布鞋', '皮靴', '铁履'],
  neck: ['狼牙项链', '平安扣', '玉坠'],
  belt: ['布带', '牛皮腰带', '玉带'],
  ring: ['铜戒指', '银扳指', '白玉环'],
  trinket: ['香囊', '铜镜', '护身符'],
  mainHand: ['铁剑', '长刀', '羽扇', '判官笔'],
  offHand: ['圆盾', '匕首', '短剑', '小盾'] // 混合，后面根据 subtype 决定
};

export function generateEquipment(playerLevel: number, missionType: 'A' | 'B' | 'C', forceDrop: boolean = false, forcedQuality?: ItemQuality): Equipment | null {
  const dropChances = { A: 0.20, B: 0.10, C: 0.02 };
  let chance = dropChances[missionType] || 0;
  
  if (forceDrop) chance = 1.0;

  if (Math.random() > chance) {
    return null;
  }

  return createItem(playerLevel, forcedQuality);
}

export function generateShopItem(playerLevel: number): Equipment {
  return createItem(playerLevel);
}

export function generateShopItems(playerLevel: number, count: number = 6): Equipment[] {
  const items: Equipment[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateShopItem(playerLevel));
  }
  return items;
}

function createItem(playerLevel: number, forcedQuality?: ItemQuality): Equipment {
  const slot = SLOTS[Math.floor(Math.random() * SLOTS.length)];

  let quality: ItemQuality = 'white';
  let multiplier = 1.0;
  let namePrefix = '破旧的 ';

  if (forcedQuality === 'blue') {
    quality = 'blue';
    multiplier = 1.5;
    namePrefix = '稀有的 ';
  } else if (forcedQuality === 'green') {
    quality = 'green';
    multiplier = 1.2;
    namePrefix = '精致的 ';
  } else if (!forcedQuality) {
    const roll = Math.random();
    if (roll > 0.95) {
      quality = 'blue';
      multiplier = 1.5;
      namePrefix = '稀有的 ';
    } else if (roll > 0.75) {
      quality = 'green';
      multiplier = 1.2;
      namePrefix = '精致的 ';
    }
  }

  let subType: 'weapon' | 'shield' | 'none' = 'none';
  let armor: number | undefined = undefined;
  let weaponDamage: { min: number, max: number } | undefined = undefined;

  let baseName = NAMES[slot][Math.floor(Math.random() * NAMES[slot].length)];

  if (slot === 'mainHand') {
    subType = 'weapon';
    const minDmg = Math.floor(playerLevel * 2 * multiplier);
    const maxDmg = Math.floor(playerLevel * 4 * multiplier);
    weaponDamage = { min: minDmg, max: maxDmg };
  } else if (slot === 'offHand') {
    if (Math.random() > 0.5) {
      subType = 'weapon';
      baseName = '短剑';
      const minDmg = Math.floor(playerLevel * 1.5 * multiplier);
      const maxDmg = Math.floor(playerLevel * 3 * multiplier);
      weaponDamage = { min: minDmg, max: maxDmg };
    } else {
      subType = 'shield';
      baseName = '圆盾';
      armor = Math.floor(playerLevel * 5 * multiplier);
    }
  } else if (['head', 'chest', 'hands', 'feet', 'belt'].includes(slot)) {
    // 防具类提供护甲
    armor = Math.floor(playerLevel * 2 * multiplier);
  }

  // 附加属性
  const bonusAttributes: Equipment['bonusAttributes'] = {};
  const randomBase = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  // 给1-2条主属性
  const possibleStats = ['strength', 'intelligence', 'agility', 'constitution', 'luck'] as const;
  const numStats = quality === 'blue' ? 3 : (quality === 'green' ? 2 : 1);
  
  for (let i = 0; i < numStats; i++) {
    const statKey = possibleStats[Math.floor(Math.random() * possibleStats.length)];
    // Base stat amount is roughly player level * multiplier
    const amt = Math.max(1, Math.floor(randomBase(3, 8) * playerLevel * multiplier / 2));
    bonusAttributes[statKey] = (bonusAttributes[statKey] || 0) + amt;
  }

  // Price Calculation
  const statSum = Object.values(bonusAttributes).reduce((a, b) => (a || 0) + (b || 0), 0) || 1;
  let price = Math.floor(statSum * 10);
  if (quality === 'green') price *= 5;
  if (quality === 'blue') price *= 20;

  return {
    id: `eq_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    name: namePrefix + baseName,
    description: `一件${quality === 'blue' ? '不可多得的' : (quality === 'green' ? '做工不错的' : '寻常的')}装备。`,
    slot,
    quality,
    subType,
    armor,
    weaponDamage,
    price,
    bonusAttributes
  };
}
