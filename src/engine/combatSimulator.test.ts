import { describe, expect, it } from 'vitest';
import type { CombatantSnapshot } from '../types/gameState.js';
import { simulateBattleV2 } from './combatSimulator.js';

function fighter(id: string, classId: CombatantSnapshot['classId'], overrides: Partial<CombatantSnapshot> = {}): CombatantSnapshot {
  return {
    id,
    displayName: id,
    level: 10,
    classId,
    attributes: { strength: 30, intelligence: 30, agility: 30, constitution: 60, luck: 20 },
    armor: 100,
    weaponDamage: { min: 8, max: 12 },
    ...overrides,
  };
}

describe('combatSimulator', () => {
  it('is deterministic for the same seed and snapshots', () => {
    const input = {
      player: fighter('p', 'CLASS_A'),
      enemy: fighter('e', 'CLASS_B'),
      seed: 'same-seed',
      context: 'MISSION' as const,
      firstAttacker: 'player' as const,
    };
    expect(simulateBattleV2(input)).toEqual(simulateBattleV2(input));
  });

  it('CLASS_C bypasses armor and cannot be blocked or dodged', () => {
    const result = simulateBattleV2({
      player: fighter('mage', 'CLASS_C'),
      enemy: fighter('defender', 'CLASS_A', { armor: 9999 }),
      seed: 'class-c',
      context: 'MISSION',
      firstAttacker: 'player',
    });
    const playerHits = result.actions.flatMap((a) => a.hits).filter((h) => h.attacker === 'player');
    expect(playerHits.length).toBeGreaterThan(0);
    expect(playerHits.every((h) => h.armorReductionBp === 0 && !h.wasBlocked && !h.wasDodged)).toBe(true);
  });

  it('CLASS_A block and CLASS_B dodge events can appear', () => {
    const blocked = simulateBattleV2({
      player: fighter('attacker', 'CLASS_A', { attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 300, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      enemy: fighter('blocker', 'CLASS_A', { attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 300, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      seed: 'blocks-show-up',
      context: 'MISSION',
      firstAttacker: 'player',
    });
    const dodged = simulateBattleV2({
      player: fighter('attacker', 'CLASS_A', { attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 300, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      enemy: fighter('dodger', 'CLASS_B', { attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 300, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      seed: 'dodges-show-up',
      context: 'MISSION',
      firstAttacker: 'player',
    });
    expect(blocked.actions.flatMap((a) => a.hits).some((h) => h.wasBlocked)).toBe(true);
    expect(dodged.actions.flatMap((a) => a.hits).some((h) => h.wasDodged)).toBe(true);
  });

  it('CLASS_D actions have two hits', () => {
    const result = simulateBattleV2({
      player: fighter('assassin', 'CLASS_D'),
      enemy: fighter('target', 'CLASS_A'),
      seed: 'dual-hit',
      context: 'MISSION',
      firstAttacker: 'player',
    });
    expect(result.actions.find((a) => a.attacker === 'player')?.hits).toHaveLength(2);
  });

  it('CLASS_E frenzy never exceeds 15 hits per action', () => {
    const result = simulateBattleV2({
      player: fighter('berserker', 'CLASS_E', { attributes: { strength: 5, intelligence: 5, agility: 5, constitution: 500, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      enemy: fighter('target', 'CLASS_A', { attributes: { strength: 5, intelligence: 5, agility: 5, constitution: 500, luck: 1 }, weaponDamage: { min: 1, max: 1 } }),
      seed: 'frenzy-cap',
      context: 'MISSION',
      firstAttacker: 'player',
    });
    const maxHits = Math.max(...result.actions.filter((a) => a.attacker === 'player').map((a) => a.hits.length));
    expect(maxHits).toBeLessThanOrEqual(15);
  });
});
