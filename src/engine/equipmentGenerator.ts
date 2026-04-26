import type { EquipmentItem, EquipmentSlot, ItemRarity } from '../types/gameState.js';
import type { SeededRandom } from '../lib/rng.js';

const SLOTS: EquipmentSlot[] = ['head', 'body', 'hands', 'feet', 'neck', 'belt', 'ring', 'trinket', 'weapon', 'offHand'];

const SLOT_NAMES: Record<EquipmentSlot, string[]> = {
  head: ['皮帽', '铁盔', '束发冠'],
  body: ['布衣', '皮甲', '锁子甲'],
  hands: ['粗布手套', '护腕'],
  feet: ['草鞋', '布鞋', '皮靴'],
  neck: ['平安扣', '玉坠'],
  belt: ['布带', '玉带'],
  ring: ['铜戒指', '白玉环'],
  trinket: ['香囊', '护身符'],
  weapon: ['铁剑', '长刀', '羽扇'],
  offHand: ['圆盾', '短剑'],
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
    pick: <T>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!,
  };
}

function pickRarity(rng: SeededRandom): ItemRarity {
  const roll = rng.next();
  if (roll > 0.98) return 4;
  if (roll > 0.92) return 3;
  if (roll > 0.75) return 2;
  if (roll > 0.45) return 1;
  return 0;
}

export function generateEquipment(
  input: { playerLevel: number; slot?: EquipmentSlot; rarity?: ItemRarity; rng?: SeededRandom },
): EquipmentItem {
  const rng = input.rng ?? defaultRng();
  const slot = input.slot ?? rng.pick(SLOTS);
  const rarity = input.rarity ?? pickRarity(rng);
  const baseName = rng.pick(SLOT_NAMES[slot]);
  const multiplier = 1 + rarity * 0.35;
  const armor = ['head', 'body', 'hands', 'feet', 'belt'].includes(slot)
    ? Math.floor(input.playerLevel * 2 * multiplier)
    : undefined;
  const weaponDamage = slot === 'weapon' || (slot === 'offHand' && rng.next() > 0.5)
    ? {
        min: Math.floor(input.playerLevel * 2 * multiplier),
        max: Math.floor(input.playerLevel * 4 * multiplier),
      }
    : undefined;

  return {
    id: `eq_${Math.floor(rng.next() * 1000000000)}`,
    name: baseName,
    description: 'Core rebuild placeholder equipment item.',
    slot,
    rarity,
    subType: weaponDamage ? 'weapon' : slot === 'offHand' ? 'shield' : 'none',
    armor,
    weaponDamage,
    price: Math.floor(input.playerLevel * 20 * (1 + rarity)),
    bonusAttributes: {
      strength: rng.int(0, input.playerLevel + rarity),
      intelligence: rng.int(0, input.playerLevel + rarity),
      agility: rng.int(0, input.playerLevel + rarity),
      constitution: rng.int(0, input.playerLevel + rarity),
      luck: rng.int(0, input.playerLevel + rarity),
    },
  };
}

export function generateShopItem(playerLevel: number): EquipmentItem {
  return generateEquipment({ playerLevel });
}

export function generateShopItems(playerLevel: number, count: number = 6): EquipmentItem[] {
  return Array.from({ length: count }, () => generateEquipment({ playerLevel }));
}
