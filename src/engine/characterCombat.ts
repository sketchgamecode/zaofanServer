import type {
  CombatPreviewView,
  EquipmentItem,
  EquipmentState,
  GameState,
  PlayerCombatSnapshot,
  CombatLoadout,
  CharacterCombatSummary,
  ActiveSetTraitItem,
} from '../types/gameState.js';
import { buildPlayerBattleSide, getTotalAttributes } from './mathCore.js';
import {
  enrichEquipmentItem,
  getWeaponFinal,
  getArmorFinal,
  getShieldFinal,
  shields,
  buildWeaponCombatProfile,
  type WeaponFinal,
  type ShieldFinal,
} from '../lib/equipmentData.js';

function getWeaponAverageDamage(item: EquipmentItem | null, level: number): number {
  if (!item?.weaponDamage) {
    return level * 3;
  }
  return (item.weaponDamage.min + item.weaponDamage.max) / 2;
}

function getEquipmentSummary(equipped: EquipmentState['equipped'], level: number) {
  const weapon = equipped.weapon;
  const offHand = equipped.offHand;
  const itemPowerTotal = Object.values(equipped).reduce((sum, item) => {
    if (!item) return sum;
    const statPower = Object.values(item.bonusAttributes || {}).reduce((acc, value) => acc + (value ?? 0), 0);
    const weaponPower = item.weaponDamage ? item.weaponDamage.min + item.weaponDamage.max : 0;
    return sum + (item.armor ?? 0) + statPower + weaponPower;
  }, 0);

  return {
    weaponId: weapon?.id,
    offHandId: offHand?.id,
    itemPowerTotal,
    weaponAverageDamage: getWeaponAverageDamage(weapon, level),
  };
}

export function buildPlayerCombatSnapshot(state: GameState): PlayerCombatSnapshot {
  const attrs = getTotalAttributes(state);
  const battleSide = buildPlayerBattleSide(state);
  const equipmentSummary = getEquipmentSummary(state.equipment.equipped, state.player.level);

  const loadout: CombatLoadout = {
    weapon: enrichEquipmentItem(state.equipment.equipped.weapon),
    offHand: enrichEquipmentItem(state.equipment.equipped.offHand),
    body: enrichEquipmentItem(state.equipment.equipped.body),
    arrow: state.equipment.equipped.weapon?.arrow ?? 'normal',
  };

  return {
    playerId: state.player.id,
    displayName: state.player.displayName,
    avatarId: state.player.avatarId,
    level: state.player.level,
    classId: state.player.classId,
    attributes: {
      strength: attrs.strength,
      intelligence: attrs.intelligence,
      agility: attrs.agility,
      constitution: attrs.constitution,
      luck: attrs.luck,
    },
    combatStats: {
      hp: battleSide.hp,
      armor: battleSide.armor,
      damageMin: battleSide.damageMin,
      damageMax: battleSide.damageMax,
      critChanceBp: battleSide.critChanceBp,
      dodgeChanceBp: battleSide.dodgeChanceBp,
      blockChanceBp: battleSide.blockChanceBp,
    },
    equipmentSummary: {
      weaponId: equipmentSummary.weaponId,
      offHandId: equipmentSummary.offHandId,
      itemPowerTotal: equipmentSummary.itemPowerTotal,
    },
    loadout,
  };
}

export function buildCombatPreview(state: GameState): CombatPreviewView {
  const snapshot = buildPlayerCombatSnapshot(state);
  const stats = snapshot.combatStats;
  const itemPowerTotal = snapshot.equipmentSummary.itemPowerTotal;
  const combatRating = Math.floor(
    stats.hp * 1.5
      + stats.armor * 10
      + stats.damageMin * 8
      + (stats.blockChanceBp ?? 0) * 0.05
      + (stats.dodgeChanceBp ?? 0) * 0.05
      + itemPowerTotal * 0.2
  );

  return {
    hp: stats.hp,
    armor: stats.armor,
    damageMin: stats.damageMin,
    damageMax: stats.damageMax,
    critChanceBp: stats.critChanceBp,
    dodgeChanceBp: stats.dodgeChanceBp,
    blockChanceBp: stats.blockChanceBp,
    itemPowerTotal,
    combatRating,
  };
}

export function buildCharacterCombatSummary(state: GameState): CharacterCombatSummary {
  const equipped = state.equipment?.equipped ?? { weapon: null, offHand: null, body: null };
  const weaponItem = equipped.weapon;
  const offHandItem = equipped.offHand;
  const armorItem = equipped.body;

  // 1. 武器计算 (与 combatSimulator.normalizeFighter 完全一致)
  const weaponFinal = weaponItem
    ? getWeaponFinal(weaponItem.itemId || weaponItem.id, weaponItem.material || 'chaogang', weaponItem.craft, weaponItem.shaft, weaponItem.arrow)
    : getWeaponFinal('tushou', 'chaogang', null, null, null);
  if (weaponItem && weaponItem.weaponDamage) {
    weaponFinal.dmg = Math.round((weaponItem.weaponDamage.min + weaponItem.weaponDamage.max) / 2);
  }

  // 2. 防具计算
  const armorFinal = armorItem
    ? getArmorFinal(armorItem.itemId || armorItem.id, armorItem.upgrade)
    : getArmorFinal('buyi', null);
  if (armorItem && armorItem.armor !== undefined) {
    armorFinal.reduce = armorItem.armor;
  }

  // 3. 副手计算 (盾牌 vs 副手武器)
  let shieldFinal: ShieldFinal | null = null;
  let offhandWeapon: WeaponFinal | null = null;
  let isDualWielding = false;

  if (offHandItem) {
    const isShield = shields.some((s) => s.id === offHandItem.itemId);
    if (isShield) {
      shieldFinal = getShieldFinal(offHandItem.itemId!);
    } else {
      offhandWeapon = getWeaponFinal(offHandItem.itemId!, offHandItem.material!, offHandItem.craft, null, null);
      if (offHandItem.weaponDamage) {
        offhandWeapon.dmg = Math.round((offHandItem.weaponDamage.min + offHandItem.weaponDamage.max) / 2);
      }
      isDualWielding = true;
    }
  }

  // 4. 格挡率与闪避率
  let blockRatePercent = 15;
  let blockReason = '基础徒手/单手格挡率 (15%)';
  if (isDualWielding) {
    blockRatePercent = 0;
    blockReason = '双持短兵关闭格挡 (0%)';
  } else if (shieldFinal) {
    blockRatePercent = Math.round((0.15 + shieldFinal.blockMod) * 100);
    blockReason = `持盾加成 (基础15% + 盾牌${Math.round(shieldFinal.blockMod * 100)}% = ${blockRatePercent}%)`;
  }

  const dodgeRatePercent = armorFinal.dodge + (shieldFinal ? shieldFinal.dodgeMod : 0) + (weaponItem ? 0 : 15);

  // 5. 装备特效汇聚 (activeSetTraits)
  const activeSetTraits: ActiveSetTraitItem[] = [];

  // 主手词条
  if (weaponItem) {
    const wp = buildWeaponCombatProfile(weaponItem);
    for (const t of wp.traits) {
      activeSetTraits.push({
        sourceSlot: 'weapon',
        sourceItemId: weaponItem.itemId || weaponItem.id,
        sourceInstanceId: weaponItem.id,
        sourceName: weaponItem.name,
        code: t.code,
        name: t.name,
        description: t.description,
        hasChancePercent: t.hasChancePercent,
        chancePercent: t.chancePercent,
        hasDamageScale: t.hasDamageScale,
        damageScale: t.damageScale,
        hasFixedDamage: t.hasFixedDamage,
        fixedDamage: t.fixedDamage,
      });
    }
  }

  // 副手武器词条
  if (offHandItem && offhandWeapon) {
    const offp = buildWeaponCombatProfile(offHandItem);
    for (const t of offp.traits) {
      activeSetTraits.push({
        sourceSlot: 'offHand',
        sourceItemId: offHandItem.itemId || offHandItem.id,
        sourceInstanceId: offHandItem.id,
        sourceName: offHandItem.name,
        code: `OFFHAND_${t.code}`,
        name: `副手·${t.name}`,
        description: `【副手】${t.description}`,
        hasChancePercent: t.hasChancePercent,
        chancePercent: t.chancePercent,
        hasDamageScale: t.hasDamageScale,
        damageScale: t.damageScale,
        hasFixedDamage: t.hasFixedDamage,
        fixedDamage: t.fixedDamage,
      });
    }
  }

  // 盾牌词条 (例如藤牌/旁牌的推撞特性)
  if (offHandItem && shieldFinal) {
    activeSetTraits.push({
      sourceSlot: 'offHand',
      sourceItemId: offHandItem.itemId || offHandItem.id,
      sourceInstanceId: offHandItem.id,
      sourceName: offHandItem.name,
      code: 'SHIELD_BASH_PUSH',
      name: '盾击推撞',
      description: '格挡成功后有 30% 概率使对手推撞失衡，其下一次攻击受到 20 个百分点的命中减益，生效后解除。',
      hasChancePercent: true,
      chancePercent: 30,
      hasDamageScale: false,
      damageScale: 0,
      hasFixedDamage: false,
      fixedDamage: 0,
    });
  }

  // 防具词条 (明光铠/纸甲/藤甲等)
  if (armorItem && armorFinal.trait) {
    const traitKey = armorFinal.trait;
    if (traitKey.startsWith('mirror')) {
      activeSetTraits.push({
        sourceSlot: 'body',
        sourceItemId: armorItem.itemId || armorItem.id,
        sourceInstanceId: armorItem.id,
        sourceName: armorItem.name,
        code: 'ARMOR_MIRROR_DEFLECT',
        name: '护心镜弹开',
        description: '遭受枪/弓等刺击命中时，有 25% 概率将攻击弹开，完全免受该次伤害。',
        hasChancePercent: true,
        chancePercent: 25,
        hasDamageScale: false,
        damageScale: 0,
        hasFixedDamage: false,
        fixedDamage: 0,
      });
    } else if (traitKey.startsWith('arrow_reduce')) {
      activeSetTraits.push({
        sourceSlot: 'body',
        sourceItemId: armorItem.itemId || armorItem.id,
        sourceInstanceId: armorItem.id,
        sourceName: armorItem.name,
        code: 'ARMOR_ARROW_REDUCE',
        name: '密织御矢',
        description: '遭受弓箭射击时，护甲减伤额外提升 +3 点。',
        hasChancePercent: false,
        chancePercent: 0,
        hasDamageScale: false,
        damageScale: 0,
        hasFixedDamage: true,
        fixedDamage: 3,
      });
    } else if (traitKey === 'light_iron') {
      activeSetTraits.push({
        sourceSlot: 'body',
        sourceItemId: armorItem.itemId || armorItem.id,
        sourceInstanceId: armorItem.id,
        sourceName: armorItem.name,
        code: 'ARMOR_LIGHT_IRON',
        name: '轻巧铁甲',
        description: '比同阶重铁甲更轻便，提供更高的体力上限与机动性。',
        hasChancePercent: false,
        chancePercent: 0,
        hasDamageScale: false,
        damageScale: 0,
        hasFixedDamage: false,
        fixedDamage: 0,
      });
    }
  }

  // 6. 生命与体力收支 (与战斗快照 buildPlayerBattleSide / normalizeFighter 保持完全一致)
  const battleSide = buildPlayerBattleSide(state);
  const hpMax = battleSide.hp;
  const attackRoundRegen = Math.floor(armorFinal.regen / 2);
  const netStaminaMainAttack = attackRoundRegen - weaponFinal.cost;
  const netStaminaDualAttack = isDualWielding && offhandWeapon
    ? attackRoundRegen - weaponFinal.cost - offhandWeapon.cost
    : netStaminaMainAttack;

  return {
    summaryVersion: 1,
    hpMax,
    staminaMax: armorFinal.stamina,
    staminaRegenIdle: armorFinal.regen,
    staminaRegenAttackRound: attackRoundRegen,
    armorLevel: armorFinal.a,
    armorReduce: armorFinal.reduce,
    dodgeRatePercent,
    blockRatePercent,
    blockReason,
    isDualWielding,
    mainWeaponDamage: weaponFinal.dmg,
    mainWeaponPenetration: weaponFinal.p,
    mainWeaponHitRatePercent: weaponFinal.hit,
    mainWeaponInterval: weaponFinal.interval,
    mainWeaponStaminaCost: weaponFinal.cost,
    netStaminaMainAttack,
    hasOffhandWeapon: !!offhandWeapon,
    offhandWeaponDamage: offhandWeapon ? Math.floor(offhandWeapon.dmg * 0.8) : 0,
    offhandWeaponPenetration: offhandWeapon ? offhandWeapon.p : 0,
    offhandWeaponHitRatePercent: offhandWeapon ? offhandWeapon.hit : 0,
    offhandWeaponStaminaCost: offhandWeapon ? offhandWeapon.cost : 0,
    netStaminaDualAttack,
    hasShield: !!shieldFinal,
    shieldBlockRatePercent: shieldFinal ? Math.round(shieldFinal.blockMod * 100) : 0,
    shieldBlockCostMod: shieldFinal ? shieldFinal.blockCostMod : 0,
    activeSetTraits,
    rules: {
      exposedTriggerAtOrBelow: 0,
      staminaAfterExposedReset: 40,
      attackRoundRegenRule: 'floor(regen / 2)',
      offhandDamageScalePercent: 80,
    },
  };
}
