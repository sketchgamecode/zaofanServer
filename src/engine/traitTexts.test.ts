import { describe, it, expect } from 'vitest';
import { buildWeaponCombatProfile, equipmentData, TRAIT_TEXT_DEFAULTS } from '../lib/equipmentData.js';

describe('Weapon trait text configuration', () => {
  it('uses default texts with numbers filled in from weapon data', () => {
    const profile = buildWeaponCombatProfile({ itemId: 'dao_hengdao', material: 'chaogang' });
    const combo = profile.traits.find((t) => t.code === 'COMBO');
    expect(combo).toBeDefined();
    expect(combo!.name).toBe(TRAIT_TEXT_DEFAULTS.COMBO.name);
    expect(combo!.description).toContain('20%');
    expect(combo!.description).not.toContain('{pct}');
  });

  it('applies trait_texts overrides (name/description/condition) and keeps placeholders working', () => {
    const data = equipmentData as any;
    const backup = data.trait_texts;
    try {
      data.trait_texts = {
        COMBO: { name: '二连斩', description: '命中后 {pct}% 再砍一刀', conditionDescription: '命中时' },
        VS_KIND_ADVANTAGE: { name: '破{kind}' },
      };
      const blade = buildWeaponCombatProfile({ itemId: 'dao_hengdao', material: 'chaogang' });
      const combo = blade.traits.find((t) => t.code === 'COMBO')!;
      expect(combo.name).toBe('二连斩');
      expect(combo.description).toBe('命中后 20% 再砍一刀');
      expect(combo.conditionDescription).toBe('命中时');

      const longBlade = buildWeaponCombatProfile({ itemId: 'dao_changdao', material: 'chaogang' });
      const vs = longBlade.traits.find((t) => t.code === 'VS_KIND_ADVANTAGE')!;
      expect(vs.name).toBe('破枪');
      // description not overridden -> default template still filled
      expect(vs.description).toContain('+15%');
    } finally {
      if (backup === undefined) delete data.trait_texts;
      else data.trait_texts = backup;
    }
  });

  it('does not show a trait when its weapon field is 0/absent', () => {
    const profile = buildWeaponCombatProfile({ itemId: 'jian_danshou', material: 'chaogang' });
    expect(profile.traits.some((t) => t.code === 'COMBO')).toBe(false);
    expect(profile.traits.some((t) => t.code === 'PARRY_COUNTER')).toBe(true);
  });
});
