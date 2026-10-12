import { describe, it, expect } from 'vitest';
import {
  buildWeaponCombatProfile,
  getWeaponFinal,
} from '../lib/equipmentData.js';
import { buildCharacterCombatSummary } from './characterCombat.js';
import { generateEquipment } from './equipmentGenerator.js';
import type { GameState, EquipmentItem } from '../types/gameState.js';

describe('Phase 1 Weapon Combat Profile & Character Combat Summary', () => {
  it('builds WeaponCombatProfile with accurate tier, rhythm, and explicit boolean flags for blade', () => {
    const hengdaoItem: Partial<EquipmentItem> = {
      id: 'eq_weapon_hengdao_1',
      slot: 'weapon',
      itemId: 'dao_hengdao',
      material: 'chaogang', // Tier 3
      craft: null,
      shaft: null,
      arrow: null,
      rarity: 1,
    };

    const profile = buildWeaponCombatProfile(hengdaoItem as EquipmentItem);
    expect(profile.profileVersion).toBe(1);
    expect(profile.class).toBe('blade');
    expect(profile.className).toBe('刀');
    expect(profile.materialTier).toBe(3);
    expect(profile.materialName).toBe('炒钢');
    expect(profile.baseDamage).toBe(12);
    expect(profile.penetration).toBe(3);
    expect(profile.baseHitPercent).toBe(75);

    // Rhythm
    expect(profile.rhythm.intervalRounds).toBe(1);
    expect(profile.rhythm.chargingRounds).toBe(0);
    expect(profile.rhythm.staminaCostPerAttack).toBe(6);
    expect(profile.rhythm.attackRoundRegen).toBe(2);
    expect(profile.rhythm.netStaminaOnAttack).toBe(-4);

    // Traits (JsonUtility safety: no undefined/null numbers)
    const comboTrait = profile.traits.find((t) => t.code === 'COMBO');
    expect(comboTrait).toBeDefined();
    expect(comboTrait?.hasChancePercent).toBe(true);
    expect(comboTrait?.chancePercent).toBe(20);
    expect(comboTrait?.hasFixedDamage).toBe(false);
    expect(comboTrait?.fixedDamage).toBe(0);
  });

  it('reflects material tier differences for T1 vs T2 vs T3 weapons accurately', () => {
    // T1: 生铁 (dmg_scale 0.9, tier 1)
    const t1 = buildWeaponCombatProfile({
      itemId: 'dao_hengdao',
      material: 'shengtie',
      rarity: 0,
    } as EquipmentItem);
    expect(t1.materialTier).toBe(1);
    expect(t1.penetration).toBe(1); // 1 + p_mod 0 = 1
    expect(t1.baseDamage).toBe(11); // 12 * 0.9 = 10.8 -> 11

    // T2: 熟铁 (dmg_scale 0.95, tier 2)
    const t2 = buildWeaponCombatProfile({
      itemId: 'dao_hengdao',
      material: 'shutie',
      rarity: 0,
    } as EquipmentItem);
    expect(t2.materialTier).toBe(2);
    expect(t2.penetration).toBe(2); // 2 + p_mod 0 = 2
    expect(t2.baseDamage).toBe(11); // 12 * 0.95 = 11.4 -> 11

    // T3: 炒钢 (dmg_scale 1.0, tier 3)
    const t3 = buildWeaponCombatProfile({
      itemId: 'dao_hengdao',
      material: 'chaogang',
      rarity: 1,
    } as EquipmentItem);
    expect(t3.materialTier).toBe(3);
    expect(t3.penetration).toBe(3); // 3 + p_mod 0 = 3
    expect(t3.baseDamage).toBe(12);

    // T4 + Craft (精钢 tier 4, guangang craft +5% dmg, +1 p)
    const t4 = buildWeaponCombatProfile({
      itemId: 'dao_hengdao',
      material: 'jinggang',
      craft: 'guangang',
      rarity: 2,
    } as EquipmentItem);
    expect(t4.materialTier).toBe(4);
    expect(t4.penetration).toBe(5); // 4 + 1 = 5
    expect(t4.baseDamage).toBe(15); // 12 * 1.2 * 1.05 = 15.12 -> 15
  });

  it('builds slow weapon (双手长刀) and bow profiles correctly', () => {
    const changdao = buildWeaponCombatProfile({
      itemId: 'dao_changdao',
      material: 'chaogang',
      rarity: 1,
    } as EquipmentItem);
    expect(changdao.grip).toBe('twohand');
    expect(changdao.rhythm.intervalRounds).toBe(2);
    expect(changdao.rhythm.chargingRounds).toBe(1);
    expect(changdao.traits.some((t) => t.code === 'VS_KIND_ADVANTAGE')).toBe(true);

    const bow = buildWeaponCombatProfile({
      itemId: 'gong_mugong',
      material: 'chaogang',
      arrow: 'pierce',
      rarity: 2,
    } as EquipmentItem);
    expect(bow.rhythm.hasFirstStrike).toBe(true);
    expect(bow.rhythm.intervalRounds).toBe(3);
    expect(bow.rhythm.chargingRounds).toBe(2);
    expect(bow.traits.some((t) => t.code === 'FIRST_STRIKE')).toBe(true);
  });

  it('generates items with attached combatProfile via generateEquipment', () => {
    const item = generateEquipment({
      playerLevel: 25,
      slot: 'weapon',
      rarity: 2,
    });
    expect(item.combatProfile).toBeDefined();
    expect(item.combatProfile?.profileVersion).toBe(1);
    expect(typeof item.combatProfile?.baseDamage).toBe('number');
  });

  it('calculates CharacterCombatSummary for dual-wield, sword & shield, and armor traits', () => {
    const baseMockState: GameState = {
      meta: { schemaVersion: 1, createdAt: 0, updatedAt: 0, lastDailyResetDate: '', stateRevision: 1 },
      player: { level: 20, exp: 0, classId: 'CLASS_A', raceId: 'RACE_01', status: 'ACTIVE' },
      resources: { copper: 0, tokens: 0, hourglasses: 0, prestige: 0 },
      attributes: {
        strength: 20, intelligence: 20, agility: 20, constitution: 20, luck: 20,
        bought: { strength: 0, intelligence: 0, agility: 0, constitution: 0, luck: 0 },
      },
      inventory: { items: [] },
      equipment: {
        equipped: {
          weapon: {
            id: 'wpn_main',
            name: '炒钢单手剑',
            description: '',
            slot: 'weapon',
            rarity: 1,
            sellPrice: 100,
            bonusAttributes: {},
            itemId: 'jian_danshou',
            material: 'chaogang',
          },
          offHand: {
            id: 'shield_off',
            name: '藤牌',
            description: '',
            slot: 'offHand',
            subType: 'shield',
            rarity: 1,
            sellPrice: 100,
            bonusAttributes: {},
            itemId: 'tengpai',
          },
          body: {
            id: 'armor_mingguang',
            name: '明光铠',
            description: '',
            slot: 'body',
            rarity: 2,
            sellPrice: 200,
            bonusAttributes: {},
            itemId: 'mingguang',
          },
        },
      },
      tavern: {} as any,
      mount: {} as any,
      blackMarket: {} as any,
      arena: {} as any,
      dungeon: {} as any,
      world: {} as any,
    };

    // 1. 剑盾组合测试
    const shieldSummary = buildCharacterCombatSummary(baseMockState);
    expect(shieldSummary.summaryVersion).toBe(1);
    expect(shieldSummary.isDualWielding).toBe(false);
    expect(shieldSummary.hasShield).toBe(true);
    expect(shieldSummary.blockRatePercent).toBe(40); // 15 + 25 = 40%
    expect(shieldSummary.armorLevel).toBe(4);
    expect(shieldSummary.armorReduce).toBe(4);
    expect(shieldSummary.rules.exposedTriggerAtOrBelow).toBe(0);
    expect(shieldSummary.rules.staminaAfterExposedReset).toBe(40);

    // Active traits contains parry (from sword), shield bash push (from shield), and mirror deflect (from mingguang armor)
    expect(shieldSummary.activeSetTraits.some((t) => t.code === 'PARRY_COUNTER')).toBe(true);
    expect(shieldSummary.activeSetTraits.some((t) => t.code === 'SHIELD_BASH_PUSH')).toBe(true);
    expect(shieldSummary.activeSetTraits.some((t) => t.code === 'ARMOR_MIRROR_DEFLECT')).toBe(true);

    // 2. 双持组合测试 (换下盾牌，换上副手柳叶刀)
    const dualWieldState: GameState = {
      ...baseMockState,
      equipment: {
        equipped: {
          ...baseMockState.equipment.equipped,
          weapon: {
            id: 'wpn_main_dao',
            name: '横刀',
            description: '',
            slot: 'weapon',
            rarity: 1,
            sellPrice: 100,
            bonusAttributes: {},
            itemId: 'dao_hengdao',
            material: 'chaogang',
          },
          offHand: {
            id: 'wpn_off_dao',
            name: '柳叶刀·副手',
            description: '',
            slot: 'offHand',
            subType: 'weapon',
            rarity: 1,
            sellPrice: 100,
            bonusAttributes: {},
            itemId: 'dao_liuye',
            material: 'chaogang',
          },
        },
      },
    };

    const dualSummary = buildCharacterCombatSummary(dualWieldState);
    expect(dualSummary.isDualWielding).toBe(true);
    expect(dualSummary.hasOffhandWeapon).toBe(true);
    expect(dualSummary.hasShield).toBe(false);
    expect(dualSummary.blockRatePercent).toBe(0); // 双持强制关闭格挡
    expect(dualSummary.blockReason).toContain('双持短兵关闭格挡');
    expect(dualSummary.offhandWeaponDamage).toBe(Math.floor(12 * 0.8)); // 80% damage
  });
});
