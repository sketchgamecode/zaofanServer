import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { generateEquipment, generateMagicShopItems } from './equipmentGenerator.js';
import { buildBotCandidate } from './arena.js';

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
});
