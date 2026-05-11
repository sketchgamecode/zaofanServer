/**
 * raceConfig.ts — 种族配置
 *
 * 定义 8 个种族的属性修正和默认显示名称。
 * ID 使用抽象代号（RACE_01 ~ RACE_08），遵循 id_naming_convention.md。
 */

import type { AttributeKey, RaceId } from '../types/gameState.js';

/** 种族属性修正（应用到基础属性上的偏移） */
export type RaceModifiers = Record<AttributeKey, number>;

/** 种族完整配置 */
export type RaceConfig = {
  displayName: string;
  sfArchetype: string;
  modifiers: RaceModifiers;
};

export const RACE_CONFIGS: Record<RaceId, RaceConfig> = {
  RACE_01: {
    displayName: '中原人士',
    sfArchetype: 'Human',
    modifiers: { strength: 0, agility: 0, intelligence: 0, constitution: 0, luck: 0 },
  },
  RACE_02: {
    displayName: '蓬莱仙客',
    sfArchetype: 'Elf',
    modifiers: { strength: -1, agility: 2, intelligence: 0, constitution: -1, luck: 0 },
  },
  RACE_03: {
    displayName: '漠北蛮族',
    sfArchetype: 'Dwarf',
    modifiers: { strength: 0, agility: -2, intelligence: -1, constitution: 2, luck: 1 },
  },
  RACE_04: {
    displayName: '苗岭童子',
    sfArchetype: 'Gnome',
    modifiers: { strength: -2, agility: 3, intelligence: -1, constitution: -1, luck: 1 },
  },
  RACE_05: {
    displayName: '契丹豪勇',
    sfArchetype: 'Orc',
    modifiers: { strength: 1, agility: 0, intelligence: -1, constitution: 0, luck: 0 },
  },
  RACE_06: {
    displayName: '西夏一品堂',
    sfArchetype: 'Dark Elf',
    modifiers: { strength: -2, agility: 2, intelligence: 1, constitution: -1, luck: 0 },
  },
  RACE_07: {
    displayName: '岭南流寇',
    sfArchetype: 'Goblin',
    modifiers: { strength: -2, agility: 2, intelligence: 0, constitution: -1, luck: 1 },
  },
  RACE_08: {
    displayName: '摩尼教徒',
    sfArchetype: 'Demon',
    modifiers: { strength: 3, agility: -1, intelligence: 0, constitution: 1, luck: -3 },
  },
};

const VALID_RACE_IDS = new Set<string>(Object.keys(RACE_CONFIGS));

export function isValidRaceId(value: unknown): value is RaceId {
  return typeof value === 'string' && VALID_RACE_IDS.has(value);
}
