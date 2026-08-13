import { describe, expect, it } from 'vitest';
import type { CombatantSnapshot, CombatantSnapshotLoadout } from '../types/gameState.js';
import { simulateBattleV2 } from './combatSimulator.js';

function fighter(
  id: string,
  classId: CombatantSnapshot['classId'],
  loadout: CombatantSnapshotLoadout
): CombatantSnapshot {
  return {
    id,
    displayName: id,
    level: 10,
    classId,
    attributes: { strength: 10, intelligence: 10, agility: 10, constitution: 10, luck: 10 },
    armor: 1,
    weaponDamage: { min: 5, max: 10 },
    loadout,
  };
}

describe('combatSimulator Sancai V1', () => {
  it('is deterministic for the same seed and snapshots', () => {
    const w = {
      id: 'eq_w',
      name: '横刀',
      description: '横刀',
      slot: 'weapon' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'dao_hengdao',
      material: 'chaogang',
    };
    const b = {
      id: 'eq_b',
      name: '皮甲',
      description: '皮甲',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'pijia',
      upgrade: null,
    };
    
    const loadout: CombatantSnapshotLoadout = {
      weapon: w,
      offHand: null,
      body: b,
    };

    const input = {
      player: fighter('player', 'CLASS_A', loadout),
      enemy: fighter('enemy', 'CLASS_E', loadout),
      seed: 'sancai-deterministic-seed',
      context: 'MISSION' as const,
    };

    const res1 = simulateBattleV2(input);
    const res2 = simulateBattleV2(input);

    expect(res1.winner).toBe(res2.winner);
    expect(res1.totalRounds).toBe(res2.totalRounds);
    expect(res1.actions).toEqual(res2.actions);
  });

  it('triggers blunt shock damage when blocked or not penetrating', () => {
    const chui = {
      id: 'eq_chui',
      name: '骨朵锤',
      description: '锤',
      slot: 'weapon' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'chui_guduo',
      material: 'chaogang',
    };
    const zhajia = {
      id: 'eq_zhajia',
      name: '铁札甲',
      description: '札甲',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'zhajia',
      upgrade: null,
    };

    const loadoutA: CombatantSnapshotLoadout = { weapon: chui, offHand: null, body: zhajia };
    const loadoutB: CombatantSnapshotLoadout = { weapon: chui, offHand: null, body: zhajia };

    let hasBluntShock = false;
    for (let i = 0; i < 50; i++) {
      const result = simulateBattleV2({
        player: fighter('hammer', 'CLASS_E', loadoutA),
        enemy: fighter('shield_wall', 'CLASS_A', loadoutB),
        seed: `blunt-test-${i}`,
        context: 'MISSION',
      });
      const hits = result.actions.flatMap((a) => a.hits);
      const hasBlockedShock = hits.some((h) => h.sancaiOutcome === 'blocked' && h.damage === 5);
      const hasShockNoPen = hits.some((h) => h.sancaiOutcome === 'shock' && h.damage === 8);
      if (hasBlockedShock || hasShockNoPen) {
        hasBluntShock = true;
        break;
      }
    }

    expect(hasBluntShock).toBe(true);
  });

  it('bypasses / deflects stab arrow when mirror armor is equipped', () => {
    // 花枪 (spear, pierce: true) vs 明光铠 (mirror_0.25)
    const spear = {
      id: 'eq_spear',
      name: '花枪',
      description: '枪',
      slot: 'weapon' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'qiang_huaqiang',
      material: 'chaogang',
    };
    const mingguang = {
      id: 'eq_mingguang',
      name: '明光铠',
      description: '明光铠',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'mingguang',
      upgrade: null,
    };

    const loadoutPlayer: CombatantSnapshotLoadout = { weapon: spear, offHand: null, body: mingguang };
    const loadoutEnemy: CombatantSnapshotLoadout = { weapon: spear, offHand: null, body: mingguang };

    let hasMirrorDeflect = false;
    for (let i = 0; i < 50; i++) {
      const result = simulateBattleV2({
        player: fighter('spearman', 'CLASS_B', loadoutPlayer),
        enemy: fighter('knight', 'CLASS_A', loadoutEnemy),
        seed: `mirror-test-${i}`,
        context: 'MISSION',
      });
      const hits = result.actions.flatMap((a) => a.hits);
      if (hits.some((h) => h.sancaiOutcome === 'mirror')) {
        hasMirrorDeflect = true;
        break;
      }
    }

    expect(hasMirrorDeflect).toBe(true);
  });
});
