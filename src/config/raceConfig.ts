/**
 * raceConfig.ts — 出身配置（大明体制内升迁设定）
 *
 * 定义 8 个出身的属性修正、默认权力归属与显示名称。
 * ID 使用抽象代号（RACE_01 ~ RACE_08），遵循 id_naming_convention.md。
 * 注意：枚举 ID 永不更改，保持存档兼容性。
 */

import type { AttributeKey, PowerFactionId, RaceId } from '../types/gameState.js';

/** 出身属性修正（应用到基础属性上的偏移） */
export type RaceModifiers = Record<AttributeKey, number>;

/** 出身完整配置 */
export type RaceConfig = {
  displayName: string;
  sfArchetype: string;
  modifiers: RaceModifiers;
  /** 该出身新角色创建时的默认权力归属 */
  defaultFaction: PowerFactionId;
};

export const RACE_CONFIGS: Record<RaceId, RaceConfig> = {
  RACE_01: {
    displayName: '军户',
    sfArchetype: 'Human',
    modifiers: { strength: 0, agility: 0, intelligence: 0, constitution: 0, luck: 0 },
    defaultFaction: 'border',
  },
  RACE_02: {
    displayName: '边塞老兵',
    sfArchetype: 'Elf',
    modifiers: { strength: -1, agility: 2, intelligence: 0, constitution: -1, luck: 0 },
    defaultFaction: 'border',
  },
  RACE_03: {
    displayName: '市井商贾',
    sfArchetype: 'Dwarf',
    modifiers: { strength: 0, agility: -2, intelligence: -1, constitution: 2, luck: 1 },
    defaultFaction: 'silver',
  },
  RACE_04: {
    displayName: '江南牙行',
    sfArchetype: 'Gnome',
    modifiers: { strength: -2, agility: 3, intelligence: -1, constitution: -1, luck: 1 },
    defaultFaction: 'silver',
  },
  RACE_05: {
    displayName: '清流世家',
    sfArchetype: 'Orc',
    modifiers: { strength: 1, agility: 0, intelligence: -1, constitution: 0, luck: 0 },
    defaultFaction: 'censorate',
  },
  RACE_06: {
    displayName: '国子监生',
    sfArchetype: 'Dark Elf',
    modifiers: { strength: -2, agility: 2, intelligence: 1, constitution: -1, luck: 0 },
    defaultFaction: 'censorate',
  },
  RACE_07: {
    displayName: '流民',
    sfArchetype: 'Goblin',
    modifiers: { strength: -2, agility: 2, intelligence: 0, constitution: -1, luck: 1 },
    defaultFaction: 'underworld',
  },
  RACE_08: {
    displayName: '秘社信众',
    sfArchetype: 'Demon',
    modifiers: { strength: 3, agility: -1, intelligence: 0, constitution: 1, luck: -3 },
    defaultFaction: 'underworld',
  },
};

const VALID_RACE_IDS = new Set<string>(Object.keys(RACE_CONFIGS));

export function isValidRaceId(value: unknown): value is RaceId {
  return typeof value === 'string' && VALID_RACE_IDS.has(value);
}
