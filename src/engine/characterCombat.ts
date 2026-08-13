import type {
  CombatPreviewView,
  EquipmentItem,
  EquipmentState,
  GameState,
  PlayerCombatSnapshot,
  CombatLoadout,
} from '../types/gameState.js';
import { buildPlayerBattleSide, getTotalAttributes } from './mathCore.js';

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
    weapon: state.equipment.equipped.weapon,
    offHand: state.equipment.equipped.offHand,
    body: state.equipment.equipped.body,
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
