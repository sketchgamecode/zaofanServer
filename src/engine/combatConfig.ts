import type { PlayerClassId } from '../types/gameState.js';

export const CLASS_CONFIG: Record<PlayerClassId, {
  name: string;
  mainStat: 'strength' | 'agility' | 'intelligence';
  hpMultiplier: number;
  armorCap: number;
  weaponFactor: number;
  blockChanceBp: number;
  dodgeChanceBp: number;
  bypassArmor: boolean;
  dualWield: boolean;
  frenzyChanceBp: number;
  armorHalved: boolean;
}> = {
  CLASS_A: {
    name: '猛将', mainStat: 'strength', hpMultiplier: 5, armorCap: 50,
    weaponFactor: 2.0, blockChanceBp: 2500, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
  },
  CLASS_B: {
    name: '游侠', mainStat: 'agility', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.5, blockChanceBp: 0, dodgeChanceBp: 5000,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
  },
  CLASS_C: {
    name: '谋士', mainStat: 'intelligence', hpMultiplier: 2, armorCap: 10,
    weaponFactor: 4.5, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: true, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
  },
  CLASS_D: {
    name: '杀手', mainStat: 'agility', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.0, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: true, frenzyChanceBp: 0, armorHalved: false,
  },
  CLASS_E: {
    name: '绿林好汉', mainStat: 'strength', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.0, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 5000, armorHalved: true,
  },
};
