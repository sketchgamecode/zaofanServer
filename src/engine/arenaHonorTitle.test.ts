import { describe, it, expect } from 'vitest';
import { getHonorTitle } from '../lib/equipmentData.js';
import { buildBotCandidate } from './arena.js';

describe('Honor Titles System', () => {
  it('correctly maps honor thresholds according to the standard table', () => {
    // 0–499: 日龙包
    expect(getHonorTitle(0)).toBe('日龙包');
    expect(getHonorTitle(100)).toBe('日龙包');
    expect(getHonorTitle(499)).toBe('日龙包');

    // Negative values should floor to 0
    expect(getHonorTitle(-50)).toBe('日龙包');

    // 500–899: 路人
    expect(getHonorTitle(500)).toBe('路人');
    expect(getHonorTitle(899)).toBe('路人');

    // 900–1199: 操哥 (默认1000霸气处于此区间)
    expect(getHonorTitle(900)).toBe('操哥');
    expect(getHonorTitle(1000)).toBe('操哥');
    expect(getHonorTitle(1199)).toBe('操哥');

    // 1200–1499: 猛人
    expect(getHonorTitle(1200)).toBe('猛人');
    expect(getHonorTitle(1499)).toBe('猛人');

    // 1500–1799: 狠人
    expect(getHonorTitle(1500)).toBe('狠人');
    expect(getHonorTitle(1799)).toBe('狠人');

    // 1800–2099: 好汉
    expect(getHonorTitle(1800)).toBe('好汉');
    expect(getHonorTitle(2099)).toBe('好汉');

    // 2100–2399: 英雄
    expect(getHonorTitle(2100)).toBe('英雄');
    expect(getHonorTitle(2399)).toBe('英雄');

    // 2400–2799: 大英雄
    expect(getHonorTitle(2400)).toBe('大英雄');
    expect(getHonorTitle(2799)).toBe('大英雄');

    // ≥2800: 盖世英雄
    expect(getHonorTitle(2800)).toBe('盖世英雄');
    expect(getHonorTitle(5000)).toBe('盖世英雄');
  });

  it('buildBotCandidate derives title purely from its honor', () => {
    const mockState = {
      player: { level: 10, classId: 'CLASS_A' },
      arena: { honor: 1000, rank: 100 },
      equipment: { equipped: { weapon: null, offHand: null, body: null } }
    } as any;

    const bot = buildBotCandidate(mockState, 'seed_123', 0, new Set());
    expect(bot.honor).toBeGreaterThanOrEqual(0);
    expect(bot.title).toBeDefined();
    expect(bot.title).toBe(getHonorTitle(bot.honor ?? 0));
  });
});
