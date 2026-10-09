import { describe, it, expect } from 'vitest';
import {
  baseWeapons,
  resolveItemIconId,
  enrichEquipmentItem,
  getWeaponFinal,
  normalizeGameStateEquipment,
} from '../lib/equipmentData.js';
import type { GameState, EquipmentItem } from '../types/gameState.js';

describe('Equipment IconId Dynamic Sync and Hot-reload', () => {
  it('resolves iconId from baseWeapons configuration', () => {
    const liuyeWeapon = baseWeapons.find((w) => w.id === 'dao_liuye');
    expect(liuyeWeapon?.iconId).toBe('weapon_4');

    const resolved = resolveItemIconId({ itemId: 'dao_liuye', slot: 'weapon' });
    expect(resolved).toBe('weapon_4');

    const finalW = getWeaponFinal('dao_liuye', 'bintie', null, null, null);
    expect(finalW.iconId).toBe('weapon_4');
  });

  it('normalizes legacy save items with missing or stale iconId', () => {
    const mockItem: EquipmentItem = {
      id: 'debug_weapon_old_1',
      name: '柳叶刀',
      description: '攻击力: 12',
      slot: 'weapon',
      rarity: 2,
      sellPrice: 300,
      bonusAttributes: {},
      itemId: 'dao_liuye',
      // iconId was undefined or stale in old save
    };

    enrichEquipmentItem(mockItem);
    expect(mockItem.iconId).toBe('weapon_4');

    const mockState: Partial<GameState> = {
      equipment: {
        equipped: {
          weapon: {
            id: 'legacy_wpn_1',
            name: '柳叶双刀',
            description: '',
            slot: 'weapon',
            rarity: 3,
            sellPrice: 400,
            bonusAttributes: {},
            itemId: 'dao_liuye',
          },
          offHand: null,
          body: null,
        },
      },
      inventory: {
        items: [
          {
            id: 'legacy_wpn_inv_1',
            name: '雁翎刀',
            description: '',
            slot: 'weapon',
            rarity: 1,
            sellPrice: 200,
            bonusAttributes: {},
            itemId: 'dao_yanling',
            iconId: 'stale_old_icon',
          },
        ],
        capacity: 60,
      },
    };

    normalizeGameStateEquipment(mockState as GameState);
    expect(mockState.equipment?.equipped.weapon?.iconId).toBe('weapon_4');
    expect(mockState.inventory?.items[0].iconId).toBe('weapon_yanlingdao_1');
  });
});
