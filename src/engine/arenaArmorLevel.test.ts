import { describe, expect, it } from 'vitest';
import { createInitialGameState } from './gameStateFactory.js';
import { arenaGetInfo, arenaRefreshCandidates, buildBotCandidate } from './arena.js';
import { buildCharacterCombatSummary } from './characterCombat.js';
import { simulateBattleV2 } from './combatSimulator.js';
import { generateEquipment } from './equipmentGenerator.js';
import {
  equipmentData,
  saveEquipmentData,
  getArmorFinal,
  armors,
  enrichEquipmentItem,
} from '../lib/equipmentData.js';
import type { ActionContext } from './actionContext.js';
import type { GameState, EquipmentItem } from '../types/gameState.js';

function makeCtx(state: GameState, now = Date.now()): ActionContext {
  let dirty = false;
  return {
    playerId: '00000000-0000-0000-0000-000000000001',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

function activate(state: GameState): void {
  state.player.id = '00000000-0000-0000-0000-000000000001';
  state.player.status = 'ACTIVE';
  state.player.displayName = '测试玩家';
  state.player.level = 10;
  state.attributes.strength = 50;
  state.attributes.constitution = 80;
}

describe('Arena Candidate Armor Level (防护等级 A 字段与各入口一致性)', () => {
  it('ARENA_GET_INFO and ARENA_REFRESH_CANDIDATES return loadout.body with hasArmorLevel and armorLevel', () => {
    const state = createInitialGameState({ now: 1, playerId: '00000000-0000-0000-0000-000000000001' });
    activate(state);
    const ctx = makeCtx(state, 1000);

    const infoRes = arenaGetInfo(ctx, {});
    expect(infoRes.ok).toBe(true);
    const candidates = infoRes.data.arena.candidates;
    expect(candidates).toBeDefined();
    expect(candidates!.length).toBeGreaterThanOrEqual(1);

    for (const c of candidates!) {
      expect(c.loadout).toBeDefined();
      if (c.loadout?.body) {
        const body = c.loadout.body;
        expect(body.hasArmorLevel).toBe(true);
        expect(typeof body.armorLevel).toBe('number');
        expect(typeof body.armor).toBe('number');
        expect(body.itemId).toBeDefined();
        expect(body.name).toBeDefined();
      }
      if (c.equipment?.equipped?.body) {
        const body = c.equipment.equipped.body;
        expect(body.hasArmorLevel).toBe(true);
        expect(typeof body.armorLevel).toBe('number');
        expect(body.armorLevel).toBe(c.loadout?.body?.armorLevel);
      }
    }

    const refreshRes = arenaRefreshCandidates(ctx, {});
    expect(refreshRes.ok).toBe(true);
    for (const c of refreshRes.data.candidates) {
      if (c.loadout?.body) {
        expect(c.loadout.body.hasArmorLevel).toBe(true);
        expect(typeof c.loadout.body.armorLevel).toBe('number');
      }
    }
  });

  it('correctly handles burenjia where armorLevel != armor (步人甲: A4, 减伤5, 两者不混用)', () => {
    const burenjia = generateEquipment({
      playerLevel: 15,
      slot: 'body',
      classId: 'CLASS_A',
      forcedItemId: 'burenjia',
    });

    expect(burenjia.itemId).toBe('burenjia');
    expect(burenjia.hasArmorLevel).toBe(true);
    expect(burenjia.armorLevel).toBe(4); // 防护等级 A4
    expect(burenjia.armor).toBe(5); // 减伤 5
    expect(burenjia.armorLevel).not.toBe(burenjia.armor); // 验证两者不同，不能混用
  });

  it('correctly provides A0~A5 across all armor tiers, with valid A0 returning hasArmorLevel=true and armorLevel=0', () => {
    const armorTierMap: Record<number, string> = {
      0: 'buyi',
      1: 'pijia',
      2: 'zhijia',
      3: 'zhajia',
      4: 'burenjia',
      5: 'suozi',
    };

    for (const [tierStr, armorId] of Object.entries(armorTierMap)) {
      const tier = Number(tierStr);
      const generated = generateEquipment({
        playerLevel: 10,
        slot: 'body',
        classId: 'CLASS_A',
        forcedItemId: armorId,
        rarity: 0,
      });

      expect(generated.hasArmorLevel).toBe(true);
      expect(generated.armorLevel).toBe(tier);
      if (tier === 0) {
        // A0 布衣麻衣 (基础无升级)
        expect(generated.armorLevel).toBe(0);
        expect(generated.armor).toBe(0);
      }
    }

    // 验证进阶升级的 A0 防具：即使减伤提升，防护等级依然权威保持 A0
    const upgradedBuyi = generateEquipment({
      playerLevel: 10,
      slot: 'body',
      classId: 'CLASS_A',
      forcedItemId: 'buyi',
      rarity: 1, // jinggang 加固 (+1 减伤)
    });
    expect(upgradedBuyi.hasArmorLevel).toBe(true);
    expect(upgradedBuyi.armorLevel).toBe(0);
    expect(upgradedBuyi.armor).toBe(1);
  });

  it('maintains consistency across all entry points: combatSummary, candidate loadout, snapshot initialState, and equipment.equipped', () => {
    const state = createInitialGameState({ now: 1, playerId: '00000000-0000-0000-0000-000000000001' });
    activate(state);

    // 玩家装备步人甲
    const playerBurenjia = generateEquipment({
      playerLevel: 10,
      slot: 'body',
      classId: 'CLASS_A',
      forcedItemId: 'burenjia',
      rarity: 0,
    });
    state.equipment.equipped.body = playerBurenjia;

    // 1. 玩家 combatSummary.armorLevel
    const combatSummary = buildCharacterCombatSummary(state);
    expect(combatSummary.armorLevel).toBe(4);
    expect(combatSummary.armorReduce).toBe(5);

    // 2. 候选对手 loadout.body.armorLevel & equipment.equipped.body
    const botCandidate = buildBotCandidate(state, 'test_seed', 0, new Set());
    // 手动指定 bot 装备步人甲以进行精准对齐验证
    botCandidate.loadout!.body = generateEquipment({
      playerLevel: 10,
      slot: 'body',
      classId: 'CLASS_A',
      forcedItemId: 'burenjia',
      rarity: 0,
    });
    botCandidate.equipment = {
      equipped: {
        weapon: botCandidate.loadout!.weapon,
        offHand: null,
        body: botCandidate.loadout!.body,
      },
    };

    expect(botCandidate.loadout!.body.armorLevel).toBe(4);
    expect(botCandidate.loadout!.body.hasArmorLevel).toBe(true);
    expect(botCandidate.equipment.equipped.body?.armorLevel).toBe(4);
    expect(botCandidate.equipment.equipped.body?.hasArmorLevel).toBe(true);

    // 3. 战斗开局快照 initialState.*.loadoutSummary.body.a
    const battleResult = simulateBattleV2({
      player: {
        id: state.player.id!,
        displayName: state.player.displayName!,
        level: state.player.level,
        classId: state.player.classId,
        attributes: state.attributes,
        combatStats: { hp: 500, armor: 5, damageMin: 10, damageMax: 15, critChanceBp: 500 },
        equipmentSummary: { itemPowerTotal: 0 },
        loadout: {
          weapon: state.equipment.equipped.weapon,
          offHand: null,
          body: playerBurenjia,
        },
      },
      enemy: {
        id: botCandidate.playerId,
        displayName: botCandidate.displayName,
        level: botCandidate.level,
        classId: botCandidate.classId,
        attributes: botCandidate.attributes,
        combatPreview: botCandidate.combatPreview,
        loadout: botCandidate.loadout,
      } as any,
      seed: 'test_battle_seed',
      context: 'ARENA',
    });

    expect(battleResult.initialState).toBeDefined();
    expect(battleResult.initialState!.player.loadoutSummary.body?.a).toBe(4);
    expect(battleResult.initialState!.player.loadoutSummary.body?.reduce).toBe(5);
    expect(battleResult.initialState!.enemy.loadoutSummary.body?.a).toBe(4);
    expect(battleResult.initialState!.enemy.loadoutSummary.body?.reduce).toBe(5);

    // 验证四者完全一致
    expect(combatSummary.armorLevel).toBe(botCandidate.loadout!.body.armorLevel);
    expect(botCandidate.loadout!.body.armorLevel).toBe(battleResult.initialState!.player.loadoutSummary.body?.a);
    expect(battleResult.initialState!.player.loadoutSummary.body?.a).toBe(battleResult.initialState!.enemy.loadoutSummary.body?.a);
  });

  it('keeps body=null when unequipped (无甲时可保持 body=null)', () => {
    const emptyLoadoutItem: EquipmentItem | null = null;
    const enriched = enrichEquipmentItem(emptyLoadoutItem);
    expect(enriched).toBeNull();
  });

  it('supports server hot-reload configuration: dynamically changing armor A value immediately updates response without client config changes', () => {
    const fullOriginalData = JSON.parse(JSON.stringify(equipmentData));
    const originalArmors = JSON.parse(JSON.stringify(armors));

    const state = createInitialGameState({ now: 1, playerId: '00000000-0000-0000-0000-000000000001' });
    activate(state);
    const ctx = makeCtx(state, 1000);

    // 生成包含步人甲的候选人
    const candidate = buildBotCandidate(state, 'hot_reload_seed', 0, new Set());
    candidate.loadout!.body = generateEquipment({
      playerLevel: 10,
      slot: 'body',
      classId: 'CLASS_A',
      forcedItemId: 'burenjia',
    });
    state.arena.candidates = [candidate];

    try {
      // 检查当前步人甲防护等级为 4
      const initialInfo = arenaGetInfo(ctx, {});
      const bodyBefore = initialInfo.data.arena.candidates![0]!.loadout!.body!;
      expect(bodyBefore.armorLevel).toBe(4);

      // 服务端热更新配置：将 burenjia 的 a 改为 3
      const updatedArmors = originalArmors.map((a: any) => {
        if (a.id === 'burenjia') {
          return { ...a, a: 3 };
        }
        return a;
      });
      saveEquipmentData({
        ...fullOriginalData,
        armors: updatedArmors,
      });

      // 再次请求 ARENA_GET_INFO，新响应必须立即反映变化 (armorLevel -> 3)
      const afterHotReloadInfo = arenaGetInfo(ctx, {});
      const bodyAfter = afterHotReloadInfo.data.arena.candidates![0]!.loadout!.body!;
      expect(bodyAfter.hasArmorLevel).toBe(true);
      expect(bodyAfter.armorLevel).toBe(3);
      expect(bodyAfter.armor).toBe(5); // 减伤 5 保持不变
    } finally {
      // 还原原始配置
      saveEquipmentData(fullOriginalData);
      expect(getArmorFinal('burenjia', null).a).toBe(4);
    }
  });
});
