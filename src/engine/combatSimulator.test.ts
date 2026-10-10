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

  it('generates consistent and valid Timeline V3 events with resource continuity', () => {
    const chui = {
      id: 'eq_chui_v3',
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
      id: 'eq_zhajia_v3',
      name: '铁札甲',
      description: '札甲',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'zhajia',
      upgrade: null,
    };

    const loadout: CombatantSnapshotLoadout = { weapon: chui, offHand: null, body: zhajia };
    const result = simulateBattleV2({
      player: fighter('player_v3', 'CLASS_E', loadout),
      enemy: fighter('enemy_v3', 'CLASS_A', loadout),
      seed: 'timeline-v3-verification-seed',
      context: 'ARENA',
    });

    expect(result.timelineSchemaVersion).toBe(1);
    expect(result.initialState).toBeDefined();
    expect(result.timelineEvents).toBeDefined();
    expect(result.timelineEvents!.length).toBeGreaterThan(0);

    const events = result.timelineEvents!;
    const init = result.initialState!;

    // 验证初始状态
    expect(init.player.hp).toBe(result.player.hpMax);
    expect(init.enemy.hp).toBe(result.enemy.hpMax);

    // 验证事件严格连续性
    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      expect(evt.sequence).toBe(i + 1);
      expect(evt.eventId).toBe(`evt_${i + 1}`);
      expect(evt.actionId).toBeDefined();
      expect(evt.eventType).toBeDefined();

      if (evt.eventType === 'ATTACK') {
        expect(evt.actionKind).toBeDefined();
      }
      if (evt.eventType === 'ATTACK_RESULT') {
        expect(evt.outcome).toBeDefined();
      }

      if (i === 0) {
        expect(evt.stateBefore.player.hp).toBe(init.player.hp);
        expect(evt.stateBefore.player.stamina).toBe(init.player.stamina);
        expect(evt.stateBefore.enemy.hp).toBe(init.enemy.hp);
        expect(evt.stateBefore.enemy.stamina).toBe(init.enemy.stamina);
      } else {
        const prev = events[i - 1];
        expect(evt.stateBefore.player.hp).toBe(prev.stateAfter.player.hp);
        expect(evt.stateBefore.player.stamina).toBe(prev.stateAfter.player.stamina);
        expect(evt.stateBefore.enemy.hp).toBe(prev.stateAfter.enemy.hp);
        expect(evt.stateBefore.enemy.stamina).toBe(prev.stateAfter.enemy.stamina);
      }
    }

    // 验证终局状态与结算完全一致
    const lastEvent = events[events.length - 1];
    expect(lastEvent.stateAfter.player.hp).toBe(result.player.hpEnd);
    expect(lastEvent.stateAfter.enemy.hp).toBe(result.enemy.hpEnd);
  });

  it('passes 30 offline battles with zero stamina gaps and stable statusIds', () => {
    const chui = {
      id: 'eq_chui_30',
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
      id: 'eq_zhajia_30',
      name: '铁札甲',
      description: '札甲',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'zhajia',
      upgrade: null,
    };
    const loadout: CombatantSnapshotLoadout = { weapon: chui, offHand: null, body: zhajia };

    for (let b = 0; b < 30; b++) {
      const result = simulateBattleV2({
        player: fighter(`p_${b}`, 'CLASS_E', loadout),
        enemy: fighter(`e_${b}`, 'CLASS_A', loadout),
        seed: `blunt_${b}`,
        context: 'ARENA',
      });

      const events = result.timelineEvents!;
      const init = result.initialState!;

      // 1. 严格检查事件间资源无缝连续（包括破绽前后、耗体回体）
      for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        const prevRes = i === 0
          ? { player: { hp: init.player.hp, stamina: init.player.stamina }, enemy: { hp: init.enemy.hp, stamina: init.enemy.stamina } }
          : events[i - 1].stateAfter;

        expect(evt.stateBefore.player.hp).toBe(prevRes.player.hp);
        expect(evt.stateBefore.player.stamina).toBe(prevRes.player.stamina);
        expect(evt.stateBefore.enemy.hp).toBe(prevRes.enemy.hp);
        expect(evt.stateBefore.enemy.stamina).toBe(prevRes.enemy.stamina);
      }

      // 2. 检查所有状态生命周期：TRIGGER 和 REMOVE 必须与对应的 APPLY 保持完全一致的 statusId
      const applyStatusIds = new Map<string, string>(); // statusId -> applyEventId
      for (const evt of events) {
        if (!evt.statusDetail) continue;
        const { statusId, operation, sourceEventId } = evt.statusDetail;
        if (operation === 'APPLY') {
          applyStatusIds.set(statusId, evt.eventId);
        } else if (operation === 'TRIGGER' || operation === 'REMOVE') {
          expect(applyStatusIds.has(statusId)).toBe(true);
          expect(sourceEventId).toBe(applyStatusIds.get(statusId));
        }
      }
    }
  });
});

