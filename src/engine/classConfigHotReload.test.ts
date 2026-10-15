import { describe, it, expect } from 'vitest';
import { classConfigs, equipmentData, saveEquipmentData } from '../lib/equipmentData.js';
import { CLASS_CONFIG } from './combatConfig.js';
import { CLASS_WEAPON_CLASSES } from './equipmentGenerator.js';
import { MathCore } from './mathCore.js';

describe('Class Config Hot Reload and Attributes Verification', () => {
  it('loads 5 default classes with their respective properties', () => {
    expect(classConfigs.length).toBe(5);

    const a = classConfigs.find((c) => c.id === 'CLASS_A');
    expect(a).toBeDefined();
    expect(a?.name).toBe('猛将');
    expect(a?.mainStat).toBe('strength');
    expect(a?.mainStatName).toBe('力量');
    expect(a?.hpMultiplier).toBe(5);
    expect(a?.blockChanceBp).toBe(2500);
    expect(a?.allowedWeaponClasses).toContain('spear');
  });

  it('CLASS_CONFIG dynamic proxy reflects class configuration correctly', () => {
    expect(CLASS_CONFIG.CLASS_A.name).toBe('猛将');
    expect(CLASS_CONFIG.CLASS_B.name).toBe('游侠');
    expect(CLASS_CONFIG.CLASS_B.dodgeChanceBp).toBe(5000);
    expect(CLASS_CONFIG.CLASS_C.hpMultiplier).toBe(2);

    expect(CLASS_WEAPON_CLASSES.CLASS_A).toContain('blade');
    expect(CLASS_WEAPON_CLASSES.CLASS_A).toContain('spear');
    expect(CLASS_WEAPON_CLASSES.CLASS_E).toContain('blunt');
  });

  it('MathCore.getMaxHP scales dynamically with class hpMultiplier', () => {
    // constitution = 20, level = 10 (multiplier = level + 1 = 11)
    // CLASS_A (hpMultiplier = 5): 20 * 5 * 11 = 1100
    // CLASS_C (hpMultiplier = 2): 20 * 2 * 11 = 440
    const hpA = MathCore.getMaxHP(20, 10, 'CLASS_A');
    const hpC = MathCore.getMaxHP(20, 10, 'CLASS_C');

    expect(hpA).toBe(1100);
    expect(hpC).toBe(440);
    expect(hpA / hpC).toBe(2.5);
  });

  it('hot-reloads configuration when saved and immediately updates runtime logic', () => {
    const fullOriginalData = JSON.parse(JSON.stringify(equipmentData));
    const originalClasses = JSON.parse(JSON.stringify(classConfigs));

    try {
      // 临时将 CLASS_A 名称改为“大宋神将”，血量系数改为 6，武器加入 bow
      const updatedClasses = originalClasses.map((c: any) => {
        if (c.id === 'CLASS_A') {
          return {
            ...c,
            name: '大宋神将',
            mainStatName: '九牛二虎之力',
            hpMultiplier: 6,
            allowedWeaponClasses: ['blade', 'spear', 'bow'],
          };
        }
        return c;
      });

      const updatedEquipmentData = {
        ...fullOriginalData,
        classes: updatedClasses,
      };

      saveEquipmentData(updatedEquipmentData);

      // 验证动态热重载生效
      expect(CLASS_CONFIG.CLASS_A.name).toBe('大宋神将');
      expect(CLASS_CONFIG.CLASS_A.mainStatName).toBe('九牛二虎之力');
      expect(CLASS_CONFIG.CLASS_A.hpMultiplier).toBe(6);
      expect(CLASS_WEAPON_CLASSES.CLASS_A).toContain('bow');

      const newHpA = MathCore.getMaxHP(20, 10, 'CLASS_A');
      expect(newHpA).toBe(20 * 6 * 11); // 1320
    } finally {
      // 恢复原配置
      saveEquipmentData(fullOriginalData);
      expect(CLASS_CONFIG.CLASS_A.name).toBe('猛将');
      expect(CLASS_CONFIG.CLASS_A.hpMultiplier).toBe(5);
    }
  });

  it('debug router provides GET /config/classes and POST /config/classes endpoints', async () => {
    process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

    const { default: debugRouter } = await import('../routes/debug.js');
    expect(debugRouter).toBeDefined();

    const routes = (debugRouter as any).stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
      }));

    const getClassesRoute = routes.find((r: any) => r.path === '/config/classes' && r.methods.includes('get'));
    const postClassesRoute = routes.find((r: any) => r.path === '/config/classes' && r.methods.includes('post'));

    expect(getClassesRoute).toBeDefined();
    expect(postClassesRoute).toBeDefined();
  });
});
