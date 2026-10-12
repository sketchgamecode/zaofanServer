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
    expect(profile.rhythm.hasFirstStrike).toBe(false);

    // Traits (JsonUtility safety: no undefined/null numbers)
    const comboTrait = profile.traits.find((t) => t.code === 'COMBO');
    expect(comboTrait).toBeDefined();
    expect(comboTrait?.hasChancePercent).toBe(true);
    expect(comboTrait?.chancePercent).toBe(20);
    expect(comboTrait?.hasFixedDamage).toBe(false);
    expect(comboTrait?.fixedDamage).toBe(0);
    expect(comboTrait?.hasIgnoreArmorReduce).toBe(false);
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

  it('builds blunt shock trait without conflating armor pierce and ignore reduce', () => {
    const blunt = buildWeaponCombatProfile({
      itemId: 'chui_guduo',
      material: 'chaogang',
      rarity: 1,
    } as EquipmentItem);
    expect(blunt.penetration).toBe(5); // 3 + p_mod 2 = 5
    const shock = blunt.traits.find((t) => t.code === 'BLUNT_SHOCK');
    expect(shock).toBeDefined();
    expect(shock?.hasFixedDamage).toBe(true);
    expect(shock?.fixedDamage).toBe(8);
    expect(shock?.hasIgnoreArmorReduce).toBe(false);

    const siling = buildWeaponCombatProfile({
      itemId: 'jian_siling',
      material: 'chaogang',
      rarity: 1,
    } as EquipmentItem);
    const ignoreTrait = siling.traits.find((t) => t.code === 'IGNORE_REDUCE');
    expect(ignoreTrait).toBeDefined();
    expect(ignoreTrait?.hasIgnoreArmorReduce).toBe(true);
    expect(ignoreTrait?.ignoreArmorReduce).toBe(2);
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

  it('calculates CharacterCombatSummary and asserts consistency with combat snapshot on armor swap', () => {
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

    // 1. 穿戴明光铠 (mingguang: stamina 82, a 4, reduce 4, regen 3)
    const summaryMingguang = buildCharacterCombatSummary(baseMockState);
    expect(summaryMingguang.hpMax).toBe(82); // 与 battleSide.hp 一致
    expect(summaryMingguang.staminaMax).toBe(82);
    expect(summaryMingguang.staminaRegenIdle).toBe(3);
    expect(summaryMingguang.staminaRegenAttackRound).toBe(1); // floor(3/2) = 1
    expect(summaryMingguang.netStaminaMainAttack).toBe(1 - 6); // 1 - 6 = -5
    expect(summaryMingguang.armorLevel).toBe(4);
    expect(summaryMingguang.armorReduce).toBe(4);
    expect(summaryMingguang.activeSetTraits.some((t) => t.code === 'ARMOR_MIRROR_DEFLECT')).toBe(true);

    // 2. 切换为布衣 (buyi: stamina 100, a 0, reduce 0, regen 5)
    const stateBuyi: GameState = {
      ...baseMockState,
      equipment: {
        equipped: {
          ...baseMockState.equipment.equipped,
          body: {
            id: 'armor_buyi',
            name: '布衣麻衣',
            description: '',
            slot: 'body',
            rarity: 0,
            sellPrice: 10,
            bonusAttributes: {},
            itemId: 'buyi',
          },
        },
      },
    };
    const summaryBuyi = buildCharacterCombatSummary(stateBuyi);
    expect(summaryBuyi.hpMax).toBe(100);
    expect(summaryBuyi.staminaMax).toBe(100);
    expect(summaryBuyi.staminaRegenIdle).toBe(5);
    expect(summaryBuyi.staminaRegenAttackRound).toBe(2); // floor(5/2) = 2
    expect(summaryBuyi.netStaminaMainAttack).toBe(2 - 6); // 2 - 6 = -4
    expect(summaryBuyi.armorLevel).toBe(0);
    expect(summaryBuyi.armorReduce).toBe(0);
    expect(summaryBuyi.activeSetTraits.some((t) => t.code === 'ARMOR_MIRROR_DEFLECT')).toBe(false);

    // 3. 双持短兵测试
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
    // 双持出手耗体 = main(6) + off(6) = 12，回体 1 (明光铠)，净消耗 = 1 - 12 = -11
    expect(dualSummary.netStaminaDualAttack).toBe(1 - 6 - 6);
  });
});
