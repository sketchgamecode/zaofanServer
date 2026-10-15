import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateEquipment, generateMagicShopItems } from './equipmentGenerator.js';
import { buildBotCandidate } from './arena.js';
import { getFallbackLoadout, simulateBattleV2 } from './combatSimulator.js';

describe('SERVER_MEMO and Phase A Equipment Constraints', () => {
  it('SERVER_MEMO.md exists in src/data and contains key guidelines', () => {
    const memoPath = path.resolve(__dirname, '../data/SERVER_MEMO.md');
    expect(fs.existsSync(memoPath)).toBe(true);

    const content = fs.readFileSync(memoPath, 'utf-8');
    expect(content).toContain('严禁兼容老存档');
    expect(content).toContain('JsonUtility');
    expect(content).toContain('方案 A');
    expect(content).toContain('combatProfile');
  });

  it('Phase A: generateEquipment only generates weapon and body slots by default', () => {
    for (let i = 0; i < 50; i++) {
      const item = generateEquipment({ playerLevel: 10 });
      expect(['weapon', 'body']).toContain(item.slot);
    }
  });

  it('Phase A: generateMagicShopItems only contains weapon and body slots', () => {
    const shop = generateMagicShopItems({ playerLevel: 15, count: 6, classId: 'CLASS_A' });
    expect(shop.length).toBe(6);
    shop.forEach((item) => {
      expect(['weapon', 'body']).toContain(item.slot);
    });
  });

  it('Phase A: buildBotCandidate has offHandItem explicitly set to null in loadout', () => {
    const mockState = {
      player: { level: 20 },
      arena: { honor: 1000 },
    } as any;
    const usedNames = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const bot = buildBotCandidate(mockState, 'seed-123', i, usedNames);
      expect(bot.loadout).toBeDefined();
      expect(bot.loadout?.offHand).toBeNull();
      expect(bot.loadout?.weapon).toBeDefined();
      expect(bot.loadout?.body).toBeDefined();
    }
  });

  it('Phase A: getFallbackLoadout has offHand set to null for all classes', () => {
    const classes = ['CLASS_A', 'CLASS_B', 'CLASS_C', 'CLASS_D', 'CLASS_E'] as const;
    classes.forEach((c) => {
      const loadout = getFallbackLoadout(c, 20);
      expect(loadout.offHand).toBeNull();
      expect(loadout.weapon).toBeDefined();
      expect(loadout.body).toBeDefined();
    });
  });

  it('Phase A: battles without shields never trigger shield bash (PUSH_DEBUFF / STATUS_PUSH_TRIGGERED)', () => {
    const weapon = {
      id: 'eq_test_w',
      name: '测试横刀',
      description: '刀',
      slot: 'weapon' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'dao_hengdao',
      material: 'chaogang',
    };
    const armor = {
      id: 'eq_test_a',
      name: '测试札甲',
      description: '甲',
      slot: 'body' as const,
      rarity: 1 as const,
      sellPrice: 0,
      bonusAttributes: {},
      itemId: 'zhajia',
      upgrade: null,
    };
    const loadout = { weapon, offHand: null, body: armor };

    for (let i = 0; i < 30; i++) {
      const result = simulateBattleV2({
        player: {
          id: 'p1',
          displayName: '玩家',
          title: '九品',
          level: 20,
          classId: 'CLASS_A',
          attributes: { strength: 30, agility: 20, intelligence: 10, constitution: 30, luck: 10 },
          hpMax: 100,
          armor: 15,
          weaponDamage: { min: 25, max: 25 },
          honor: 1000,
          rank: 1,
          avatarId: 'av1',
          equipmentSummary: { itemPowerTotal: 0 },
          loadout,
        },
        enemy: {
          id: 'e1',
          displayName: '李忠',
          title: '九品',
          level: 20,
          classId: 'CLASS_D',
          attributes: { strength: 25, agility: 35, intelligence: 10, constitution: 25, luck: 15 },
          hpMax: 100,
          armor: 15,
          weaponDamage: { min: 20, max: 20 },
          honor: 1000,
          rank: 2,
          avatarId: 'av2',
          equipmentSummary: { itemPowerTotal: 0 },
          loadout,
        },
        seed: `no-shield-battle-${i}`,
        context: 'ARENA',
      });

      const pushEvents = result.timelineEvents?.filter(
        (e) => e.eventType === 'STATUS_APPLY' && e.statusDetail?.statusType === 'PUSH_DEBUFF'
      );
      expect(pushEvents?.length ?? 0).toBe(0);

      const pushReasons = result.timelineEvents?.flatMap((e) => e.reasons || []).filter(
        (r) => r.code === 'STATUS_PUSH_TRIGGERED'
      );
      expect(pushReasons?.length ?? 0).toBe(0);
    }
  });
});
