import type { PlayerClassId } from '../types/gameState.js';
import { classConfigs, type ClassConfigItem } from '../lib/equipmentData.js';

export interface ClassRuntimeConfig {
  name: string;
  desc?: string;
  mainStat: 'strength' | 'agility' | 'intelligence' | 'constitution' | 'luck';
  mainStatName: string;
  hpMultiplier: number;
  armorCap: number;
  weaponFactor: number;
  blockChanceBp: number;
  dodgeChanceBp: number;
  bypassArmor: boolean;
  dualWield: boolean;
  frenzyChanceBp: number;
  armorHalved: boolean;
  allowedWeaponClasses: ('blade' | 'sword' | 'spear' | 'blunt' | 'bow' | 'fist')[];
}

const DEFAULT_CONFIGS: Record<PlayerClassId, ClassRuntimeConfig> = {
  CLASS_A: {
    name: '猛将', mainStat: 'strength', mainStatName: '力量', hpMultiplier: 5, armorCap: 50,
    weaponFactor: 2.0, blockChanceBp: 2500, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
    allowedWeaponClasses: ['blade', 'spear'],
  },
  CLASS_B: {
    name: '游侠', mainStat: 'agility', mainStatName: '身法敏捷', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.5, blockChanceBp: 0, dodgeChanceBp: 5000,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
    allowedWeaponClasses: ['sword'],
  },
  CLASS_C: {
    name: '军策', mainStat: 'intelligence', mainStatName: '智谋', hpMultiplier: 2, armorCap: 10,
    weaponFactor: 4.5, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: true, dualWield: false, frenzyChanceBp: 0, armorHalved: false,
    allowedWeaponClasses: ['sword'],
  },
  CLASS_D: {
    name: '义士', mainStat: 'agility', mainStatName: '身法敏捷', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.0, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: true, frenzyChanceBp: 0, armorHalved: false,
    allowedWeaponClasses: ['blade'],
  },
  CLASS_E: {
    name: '绿林好汉', mainStat: 'strength', mainStatName: '神力', hpMultiplier: 4, armorCap: 25,
    weaponFactor: 2.0, blockChanceBp: 0, dodgeChanceBp: 0,
    bypassArmor: false, dualWield: false, frenzyChanceBp: 5000, armorHalved: true,
    allowedWeaponClasses: ['blunt'],
  },
};

/**
 * 动态代理 CLASS_CONFIG：
 * 实时优先读取 equipmentData.classes 的在线配置，若未配置则回退到静态默认值。
 * 支持热重载与在线无缝切换。
 */
export const CLASS_CONFIG: Record<PlayerClassId, ClassRuntimeConfig> = new Proxy({} as any, {
  get(_target, prop: string): ClassRuntimeConfig {
    const matched = classConfigs.find((c) => c.id === prop);
    const def = DEFAULT_CONFIGS[prop as PlayerClassId] ?? DEFAULT_CONFIGS.CLASS_A;
    if (matched) {
      return {
        ...def,
        ...matched,
        mainStat: (matched.mainStat || def.mainStat) as any,
        mainStatName: matched.mainStatName || def.mainStatName,
        name: matched.name || def.name,
        desc: matched.desc || def.desc,
        hpMultiplier: matched.hpMultiplier ?? def.hpMultiplier,
        blockChanceBp: matched.blockChanceBp ?? def.blockChanceBp,
        dodgeChanceBp: matched.dodgeChanceBp ?? def.dodgeChanceBp,
        allowedWeaponClasses: matched.allowedWeaponClasses?.length ? matched.allowedWeaponClasses : def.allowedWeaponClasses,
        weaponFactor: matched.weaponFactor ?? def.weaponFactor,
        armorCap: matched.armorCap ?? def.armorCap,
      };
    }
    return def;
  },
  ownKeys() {
    return ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E'];
  },
  getOwnPropertyDescriptor(_target, prop) {
    return {
      configurable: true,
      enumerable: true,
      value: (CLASS_CONFIG as any)[prop],
    };
  },
});
