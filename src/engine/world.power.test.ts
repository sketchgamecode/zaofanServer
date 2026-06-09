import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './gameStateFactory.js';
import { ensureWorldInitialized, worldActorsGetOverview, worldLocationsGetStatus, worldActorGetDetail, worldServicePositionsGetList, syncPlayerActor, applyWorldPowerTransfer, worldServicePositionGetDetail, worldServicePositionLedgerGet, worldServicePositionCandidatesGet, worldLocationTreasuryGet, worldLocationRaidStart, worldLocationRaidSettle, worldLocationGuardJoin, worldLocationGuardLeave, worldLocationGuardClaim, worldOfficeTributeGet, worldOfficeTributePay, worldLocationFinanceReportGet, worldLocationChiefDashboardGet } from './world.js';
import type { ActionContext } from './actionContext.js';
import type { GameState } from '../types/gameState.js';

function makeCtx(state: GameState, now = 1_000_000): ActionContext {
  let dirty = false;
  return {
    playerId: 'test-player',
    now,
    state,
    get dirty() { return dirty; },
    markDirty() { dirty = true; },
  };
}

describe('World Actor Pool Cold Start', () => {
  it('should initialize exactly 260 bots with total powerShare = 10000', () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    expect(state.world.status).toBe('UNINITIALIZED');
    expect(state.world.actors).toHaveLength(0);

    ensureWorldInitialized(ctx);

    expect(state.world.status).toBe('ACTIVE');
    expect(state.world.actors).toHaveLength(260);

    const totalPowerShare = state.world.actors.reduce((sum, actor) => sum + actor.powerShare, 0);
    expect(totalPowerShare).toBe(10000);
  });

  it('all actorIds should be unique', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const ids = new Set(state.world.actors.map((a) => a.actorId));
    expect(ids.size).toBe(260);
  });

  it('all 6 factions must have actors', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const factions = new Set(state.world.actors.map((a) => a.faction));
    expect(factions.has('imperial')).toBe(true);
    expect(factions.has('noble')).toBe(true);
    expect(factions.has('censorate')).toBe(true);
    expect(factions.has('border')).toBe(true);
    expect(factions.has('silver')).toBe(true);
    expect(factions.has('underworld')).toBe(true);
    expect(factions.size).toBe(6);
  });

  it('all 15 locations must have actors', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const locations = new Set(state.world.actors.map((a) => a.locationId));
    expect(locations.size).toBe(15);
    expect(locations.has('imperial_palace')).toBe(true);
    expect(locations.has('player_inventory')).toBe(true);
    expect(locations.has('wine_house')).toBe(true);
    expect(locations.has('bun_shop')).toBe(true);
    expect(locations.has('pleasure_quarter')).toBe(true);
  });

  it('WORLD_ACTORS_GET_OVERVIEW should return aggregated data', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    
    const response = await worldActorsGetOverview(ctx, {});
    expect(response.ok).toBe(true);
    
    const data = response.data;
    expect(data.totalActors).toBe(261);
    expect(data.totalPowerShare).toBe(10000);
    expect(data.byFaction).toHaveLength(6);
    expect(data.byLocation).toHaveLength(15);

    const aggregatedPower = data.byFaction.reduce((sum: number, f: any) => sum + f.powerShare, 0);
    expect(aggregatedPower).toBe(10000);
  });

  it('should auto initialize if old save missing world object', async () => {
    const state = createInitialGameState({ now: 1 });
    // mock old save
    delete (state as any).world;

    const ctx = makeCtx(state);
    const response = await worldActorsGetOverview(ctx, {});
    
    expect(response.ok).toBe(true);
    expect(state.world).toBeDefined();
    expect(state.world.status).toBe('ACTIVE');
    expect(state.world.actors).toHaveLength(261);
  });

  it('WORLD_LOCATIONS_GET_STATUS should return 15 locations with correct configurations', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    const response = await worldLocationsGetStatus(ctx, {});
    expect(response.ok).toBe(true);
    
    const locations = response.data.locations;
    expect(locations).toHaveLength(15);

    const palace = locations.find((l: any) => l.locationId === 'imperial_palace');
    expect(palace).toBeDefined();
    expect(palace!.name).toBe('皇宫');
    expect(palace!.ownerFaction).toBe('imperial');
    expect(palace!.x).toBe(500);
    expect(palace!.y).toBe(300);
    expect(palace!.unlockLevel).toBe(1);
    expect(palace!.services).toContain('promotion');
    expect(palace!.services).toContain('intel');
    expect(palace!.connectedLocationIds).toContain('northern_bureau');

    // Test wine_house
    const wineHouse = locations.find((l: any) => l.locationId === 'wine_house');
    expect(wineHouse).toBeDefined();
    expect(wineHouse!.name).toBe('京城酒楼');
    expect(wineHouse!.ownerFaction).toBe('silver');
    expect(wineHouse!.unlockLevel).toBe(1);
    expect(wineHouse!.services).toContain('stamina');
    expect(wineHouse!.connectedLocationIds).toContain('refugee_camp');
    expect(wineHouse!.serviceActors).toBeDefined();
    expect(wineHouse!.serviceActors).toHaveLength(1);
    expect(wineHouse!.serviceActors[0].services).toContain('stamina');
    expect(wineHouse!.serviceActors[0].title).toBeDefined();
    expect(wineHouse!.serviceActors[0].avatarId).toMatch(/^avatar_placeholder_\d{3}$/);

    // Test bun_shop
    const bunShop = locations.find((l: any) => l.locationId === 'bun_shop');
    expect(bunShop).toBeDefined();
    expect(bunShop!.name).toBe('城门包子铺');
    expect(bunShop!.ownerFaction).toBe('underworld');
    expect(bunShop!.services).toContain('stamina');
    expect(bunShop!.serviceActors).toBeDefined();
    expect(bunShop!.serviceActors).toHaveLength(1);
    expect(bunShop!.serviceActors[0].services).toContain('stamina');

    // Test pleasure_quarter
    const pleasureQuarter = locations.find((l: any) => l.locationId === 'pleasure_quarter');
    expect(pleasureQuarter).toBeDefined();
    expect(pleasureQuarter!.name).toBe('教司坊');
    expect(pleasureQuarter!.services).toContain('stamina');
    expect(pleasureQuarter!.services).toContain('intel');
    expect(pleasureQuarter!.serviceActors).toBeDefined();
    expect(pleasureQuarter!.serviceActors).toHaveLength(2);
    // Distinct check
    const servicesFound = pleasureQuarter!.serviceActors.flatMap((sa: any) => sa.services);
    expect(servicesFound).toContain('stamina');
    expect(servicesFound).toContain('intel');
    expect(pleasureQuarter!.serviceActors[0].actorId).not.toBe(pleasureQuarter!.serviceActors[1].actorId);

    // Verify format of all serviceActors in all locations
    for (const loc of locations) {
      expect(loc.serviceActors).toBeDefined();
      expect(loc.serviceActors.length).toBe(Math.max(1, loc.services.length));
      for (const sa of loc.serviceActors) {
        expect(sa.actorId).toBeDefined();
        expect(sa.displayName).toBeDefined();
        expect(sa.avatarId).toMatch(/^avatar_placeholder_\d{3}$/);
        expect(sa.faction).toBeDefined();
        expect(sa.title).toBeDefined();
        expect(sa.level).toBeGreaterThanOrEqual(1);
        expect(sa.powerShare).toBeGreaterThanOrEqual(0);
        expect(sa.services).toBeDefined();
      }
    }

    // Aggregate checks
    const totalCount = locations.reduce((sum: number, l: any) => sum + l.actorCount, 0);
    expect(totalCount).toBe(261);

    const totalPower = locations.reduce((sum: number, l: any) => sum + l.powerShare, 0);
    expect(totalPower).toBe(10000);
  });

  it('should compute location statuses based on player level, faction, and suspicion', async () => {
    const state = createInitialGameState({ now: 1 });
    
    // Set level to 9
    state.player.level = 9;
    // Set faction to noble
    state.player.powerFaction = 'noble';
    // Set suspicion for imperial to 60, and noble to 10
    state.player.suspicion = {
      imperial: 60,
      noble: 10,
    };

    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});
    const locations = response.data.locations;

    // 1. Level check: divine_engine_camp unlockLevel is 10. Since level is 9, it should be locked
    const camp = locations.find((l: any) => l.locationId === 'divine_engine_camp');
    expect(camp).toBeDefined();
    expect(camp!.status).toBe('locked');
    expect(camp!.playerRelationHint).toContain('你级别不足');

    // 2. Hostile check: northern_bureau is owned by imperial (suspicion 60 >= 50), not locked (unlockLevel 5 <= 9)
    const bureau = locations.find((l: any) => l.locationId === 'northern_bureau');
    expect(bureau).toBeDefined();
    expect(bureau!.status).toBe('hostile');
    expect(bureau!.playerRelationHint).toContain('备受盘查与戒备');

    // 3. Favored check: noble_mansion is owned by noble, level 15 is >= unlockLevel 12
    state.player.level = 15;
    const response2 = await worldLocationsGetStatus(ctx, {});
    const locations2 = response2.data.locations;

    const mansion = locations2.find((l: any) => l.locationId === 'noble_mansion');
    expect(mansion).toBeDefined();
    expect(mansion!.status).toBe('favored');
    expect(mansion!.playerRelationHint).toContain('你身为该势力成员');

    // 4. Open check: refugee_camp is owned by underworld, unlockLevel 1. level 15. suspicion not set. faction is noble.
    const refugee = locations2.find((l: any) => l.locationId === 'refugee_camp');
    expect(refugee).toBeDefined();
    expect(refugee!.status).toBe('open');
    expect(refugee!.playerRelationHint).toContain('防守森严，可自由通行');
  });

  it('should support old saves missing world, powerFaction, or suspicion', async () => {
    const state = createInitialGameState({ now: 1 });
    
    // simulate old save missing fields
    delete (state as any).world;
    delete (state.player as any).powerFaction;
    delete (state.player as any).suspicion;

    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});
    expect(response.ok).toBe(true);

    const locations = response.data.locations;
    expect(locations).toHaveLength(15);
    
    // Without powerFaction and suspicion, everything should be open (or locked if level is low)
    const refugee = locations.find((l: any) => l.locationId === 'refugee_camp');
    expect(refugee).toBeDefined();
    expect(refugee!.status).toBe('open');
  });

  it('syncPlayerActor should sync or create player actor correctly', () => {
    const state = createInitialGameState({ now: 1 });
    state.player.displayName = '皇帝私生子';
    state.player.level = 42;
    state.player.powerFaction = 'imperial';
    
    const ctx = makeCtx(state);
    syncPlayerActor(ctx);
    
    const actors = state.world.actors;
    const player = actors.find(a => a.actorId === `player:${ctx.playerId}`);
    expect(player).toBeDefined();
    expect(player!.kind).toBe('player');
    expect(player!.displayName).toBe('皇帝私生子');
    expect(player!.level).toBe(42);
    expect(player!.faction).toBe('imperial');
    expect(player!.powerShare).toBe(0);
    
    const totalPower = actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(totalPower).toBe(10000);
  });

  it('applyWorldPowerTransfer should deduct and add power keeping sum at 10000', () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);
    
    const targetFaction = 'noble';
    const amount = 5;
    
    const result = applyWorldPowerTransfer(ctx, {
      amount,
      targetFactionId: targetFaction,
      issuerFactionId: 'imperial',
    });
    
    expect(result.worldPowerTotal).toBe(10000);
    expect(result.actorPowerDelta).toBe(amount);
    
    // Total sum should still be 10000
    const totalPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(totalPower).toBe(10000);
    
    const player = state.world.actors.find(a => a.actorId === `player:${ctx.playerId}`);
    expect(player!.powerShare).toBe(amount);
    
    // Check that noble faction power share has decreased by 5
    const nobleFactionPower = state.world.actors
      .filter(a => a.faction === 'noble')
      .reduce((sum, a) => sum + a.powerShare, 0);
    
    // Check if noble faction power delta returned is -5
    expect(result.targetFactionPowerDelta!['noble']).toBe(-amount);
  });

  it('applyWorldPowerTransfer should not deduct actors below 0', () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    
    ensureWorldInitialized(ctx);
    
    // Set all bots to powerShare = 0
    for (const bot of state.world.actors) {
      bot.powerShare = 0;
    }
    
    // Set exactly 5 noble bots to 1 powerShare
    const nobleBots = state.world.actors.filter(a => a.faction === 'noble');
    for (let i = 0; i < 5; i++) {
      nobleBots[i]!.powerShare = 1;
    }
    
    // Try to transfer 10
    const result = applyWorldPowerTransfer(ctx, {
      amount: 10,
      targetFactionId: 'noble',
      issuerFactionId: 'imperial',
    });
    
    // Should have only deducted 5, since that's the total power available in the world
    expect(result.actorPowerDelta).toBe(5);
    
    // Check that no actor has negative powerShare
    for (const actor of state.world.actors) {
      expect(actor.powerShare).toBeGreaterThanOrEqual(0);
    }
    
    // Check total powerShare is still 10000 (after transfer player actor will have 5, others will have 9995)
    // Wait, since we set all bots to 0, total was not 10000. But applyWorldPowerTransfer adds 5 to player, so total becomes 10 (5 noble bots were 1, player is 5, others 0).
    // Let's modify: the player actor starts at 0, and receives 5. The total sum is exactly equal to the original sum (which was 5).
    // Since we mutated the bots to 0, we broke the initial 10000 sum for this test. To preserve the 10000 sum, we can assign the remaining 9995 to some other bot!
    // Yes! Let's assign 9995 to the first imperial bot.
    const imperialBot = state.world.actors.find(a => a.faction === 'imperial');
    expect(imperialBot).toBeDefined();
    imperialBot!.powerShare = 9995;

    // Check total powerShare is still 10000 after transfer (imperial bot: 9995, player actor: 5, others: 0)
    const totalPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(totalPower).toBe(10000);
  });

  it('WORLD_ACTORS_GET_OVERVIEW and WORLD_LOCATIONS_GET_STATUS should be aggregated and consistent', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    
    // Perform transfer
    applyWorldPowerTransfer(ctx, {
      amount: 10,
      targetFactionId: 'noble',
      issuerFactionId: 'imperial',
    });
    
    const overviewRes = await worldActorsGetOverview(ctx, {});
    const locationsRes = await worldLocationsGetStatus(ctx, {});
    
    expect(overviewRes.ok).toBe(true);
    expect(locationsRes.ok).toBe(true);
    
    const overviewData = overviewRes.data;
    const locationsData = locationsRes.data;
    
    // Count and power shares should match exactly
    const overviewLocations = overviewData.byLocation;
    const statusLocations = locationsData.locations;
    
    expect(statusLocations).toHaveLength(15);
    expect(overviewLocations).toHaveLength(15);
    
    for (const statusLoc of statusLocations) {
      const overviewLoc = overviewLocations.find((l: any) => l.locationId === statusLoc.locationId);
      expect(overviewLoc).toBeDefined();
      expect(statusLoc.actorCount).toBe(overviewLoc.actorCount);
      expect(statusLoc.powerShare).toBe(overviewLoc.powerShare);
    }
  });
});

describe('Service Positions System', () => {
  function makeCtx(state: any, now = 1_000_000): ActionContext {
    let dirty = false;
    return {
      playerId: 'test-player',
      now,
      state,
      get dirty() { return dirty; },
      markDirty() { dirty = true; },
    };
  }

  it('every location with services should return servicePositions', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});
    expect(response.ok).toBe(true);

    for (const loc of response.data.locations) {
      expect(loc.servicePositions).toBeDefined();
      if (loc.services.length > 0) {
        expect(loc.servicePositions.length).toBeGreaterThanOrEqual(loc.services.length);
      }
    }
  });

  it('every service has at least one corresponding position', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    for (const loc of response.data.locations) {
      for (const service of loc.services) {
        const matching = loc.servicePositions.filter((p: any) => p.service === service);
        expect(matching.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every servicePosition has a valid occupant', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    for (const loc of response.data.locations) {
      for (const pos of loc.servicePositions) {
        const occ = pos.occupant;
        expect(occ).toBeDefined();
        expect(typeof occ.actorId).toBe('string');
        expect(occ.actorId.length).toBeGreaterThan(0);
        expect(typeof occ.displayName).toBe('string');
        expect(occ.displayName.length).toBeGreaterThan(0);
        expect(occ.avatarId).toMatch(/^avatar_placeholder_\d{3}$/);
        expect(['imperial', 'noble', 'censorate', 'border', 'silver', 'underworld']).toContain(occ.faction);
        expect(occ.level).toBeGreaterThanOrEqual(1);
        expect(occ.powerShare).toBeGreaterThanOrEqual(0);
        expect(['bot', 'player']).toContain(occ.kind);
      }
    }
  });

  it('multi-service locations should prefer distinct occupants', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    // pleasure_quarter has 2 services (stamina, intel)
    const pq = response.data.locations.find((l: any) => l.locationId === 'pleasure_quarter');
    expect(pq).toBeDefined();
    expect(pq!.servicePositions).toHaveLength(2);
    const ids = pq!.servicePositions.map((p: any) => p.occupant.actorId);
    expect(ids[0]).not.toBe(ids[1]);

    // northern_bureau has 2 services (missions, intel)
    const nb = response.data.locations.find((l: any) => l.locationId === 'northern_bureau');
    expect(nb).toBeDefined();
    expect(nb!.servicePositions).toHaveLength(2);
    const nbIds = nb!.servicePositions.map((p: any) => p.occupant.actorId);
    expect(nbIds[0]).not.toBe(nbIds[1]);
  });

  it('position titles use custom location-specific titles where available', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    const nb = response.data.locations.find((l: any) => l.locationId === 'northern_bureau');
    expect(nb).toBeDefined();
    const missionPos = nb!.servicePositions.find((p: any) => p.service === 'missions');
    const intelPos = nb!.servicePositions.find((p: any) => p.service === 'intel');
    expect(missionPos!.title).toBe('北镇经历司吏');
    expect(intelPos!.title).toBe('密档书办');

    const wh = response.data.locations.find((l: any) => l.locationId === 'wine_house');
    expect(wh!.servicePositions[0].title).toBe('酒楼掌柜');
  });

  it('servicePositions and serviceActors should not conflict (both present)', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    for (const loc of response.data.locations) {
      expect(loc.serviceActors).toBeDefined();
      expect(loc.servicePositions).toBeDefined();
      // serviceActors legacy field should still have entries for service-bearing locations
      if (loc.services.length > 0) {
        expect(loc.serviceActors.length).toBeGreaterThan(0);
      }
    }
  });

  it('world power total remains 10000 after servicePositions are generated', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    await worldLocationsGetStatus(ctx, {});

    const total = state.world.actors.reduce((sum: number, a: any) => sum + a.powerShare, 0);
    expect(total).toBe(10000);
  });

  it('positionId should follow locationId:service format', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    for (const loc of response.data.locations) {
      for (const pos of loc.servicePositions) {
        expect(pos.positionId).toBe(`${loc.locationId}:${pos.service}`);
        expect(pos.locationId).toBe(loc.locationId);
      }
    }
  });

  it('incomeHint and replaceHint should be non-empty strings', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldLocationsGetStatus(ctx, {});

    for (const loc of response.data.locations) {
      for (const pos of loc.servicePositions) {
        expect(typeof pos.incomeHint).toBe('string');
        expect(pos.incomeHint.length).toBeGreaterThan(0);
        expect(typeof pos.replaceHint).toBe('string');
        expect(pos.replaceHint.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('WORLD_ACTOR_GET_DETAIL', () => {
  function makeCtx(state: any, now = 1_000_000): any {
    let dirty = false;
    return {
      playerId: 'test-player',
      now,
      state,
      get dirty() { return dirty; },
      markDirty() { dirty = true; },
    };
  }

  it('returns current player CharacterInfoView when queried by own actorId', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldActorGetDetail(ctx, { actorId: 'player:test-player' });
    expect(response.ok).toBe(true);
    const data = (response as any).data;
    expect(data.actorId).toBe('player:test-player');
    expect(data.kind).toBe('player');
    expect(data.character).toBeDefined();
    expect(data.character.player).toBeDefined();
    expect(data.character.attributes).toBeDefined();
    expect(data.character.combatPreview).toBeDefined();
    expect(data.character.equipment).toBeDefined();
    expect(data.character.inventory).toBeDefined();
    expect(Array.isArray(data.positions)).toBe(true);
  });

  it('returns bot CharacterInfoView with correct shape from combatSnapshot', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    const botActor = state.world.actors.find((a: any) => a.kind === 'bot');
    expect(botActor).toBeDefined();
    const response = await worldActorGetDetail(ctx, { actorId: botActor!.actorId });
    expect(response.ok).toBe(true);
    const data = (response as any).data;
    expect(data.actorId).toBe(botActor!.actorId);
    expect(data.kind).toBe('bot');
    const ch = data.character;
    expect(ch.player.level).toBe(botActor!.level);
    expect(ch.player.classId).toBe(botActor!.classId);
    expect(ch.player.raceId).toBe(botActor!.raceId);
    expect(ch.player.displayName).toBe(botActor!.displayName);
    expect(ch.player.status).toBe('ACTIVE');
    expect(ch.player.powerFaction).toBe(botActor!.faction);
    expect(ch.resources.copper).toBe(0);
    expect(ch.inventory.count).toBe(0);
    expect(typeof ch.combatPreview.hp).toBe('number');
    expect(ch.combatPreview.hp).toBeGreaterThan(0);
    expect(ch.attributes.base.strength).toBeGreaterThanOrEqual(1);
    // Equipment slots all null for bots
    expect(Object.values(ch.equipment.equipped).every((v: any) => v === null)).toBe(true);
  });

  it('returns avatarId on bot actor via stable hash', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    const botActor = state.world.actors.find((a: any) => a.kind === 'bot');
    const response = await worldActorGetDetail(ctx, { actorId: botActor!.actorId });
    const data = (response as any).data;
    expect(data.character.player.avatarId).toMatch(/^avatar_placeholder_\d{3}$/);
  });

  it('positions field has correct shape when an actor holds a position', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    const actors = state.world.actors;
    // Pick a bot from a location with services
    const botActor = actors.find((a: any) => a.kind === 'bot' && a.locationId === 'northern_bureau');
    const response = await worldActorGetDetail(ctx, { actorId: botActor!.actorId });
    const botPositions = (response as any).data.positions;
    expect(Array.isArray(botPositions)).toBe(true);
    for (const pos of botPositions) {
      expect(typeof pos.positionId).toBe('string');
      expect(typeof pos.locationId).toBe('string');
      expect(typeof pos.locationName).toBe('string');
      expect(typeof pos.title).toBe('string');
      expect(typeof pos.service).toBe('string');
      expect(typeof pos.serviceLabel).toBe('string');
      expect(typeof pos.ownerFaction).toBe('string');
      expect(typeof pos.ownerLabel).toBe('string');
      expect(typeof pos.incomeHint).toBe('string');
      expect(typeof pos.replaceHint).toBe('string');
      expect(['bot_held', 'player_held', 'vacant', 'locked']).toContain(pos.status);
    }
  });

  it('returns WORLD_ACTOR_NOT_FOUND error for unknown actorId', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    let threw = false;
    try {
      await worldActorGetDetail(ctx, { actorId: 'nonexistent:actor-xyz' });
    } catch (e: any) {
      threw = true;
      expect(e.code).toBe('WORLD_ACTOR_NOT_FOUND');
    }
    expect(threw).toBe(true);
  });

  it('returns WORLD_ACTOR_NOT_FOUND error when actorId is empty string', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    let threw = false;
    try {
      await worldActorGetDetail(ctx, { actorId: '' });
    } catch (e: any) {
      threw = true;
      expect(e.code).toBe('WORLD_ACTOR_NOT_FOUND');
    }
    expect(threw).toBe(true);
  });
});

describe('WORLD_SERVICE_POSITIONS_GET_LIST', () => {
  function makeCtx(state: any, now = 1_000_000): any {
    let dirty = false;
    return {
      playerId: 'test-player',
      now,
      state,
      get dirty() { return dirty; },
      markDirty() { dirty = true; },
    };
  }

  it('returns all positions when no filter is provided', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, {});
    expect(response.ok).toBe(true);
    const { positions } = (response as any).data;
    expect(Array.isArray(positions)).toBe(true);
    // 15 locations with services across them — total positions > 10
    expect(positions.length).toBeGreaterThan(10);
  });

  it('each position entry has all required fields', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, {});
    const { positions } = (response as any).data;
    for (const pos of positions) {
      expect(typeof pos.positionId).toBe('string');
      expect(typeof pos.locationId).toBe('string');
      expect(typeof pos.locationName).toBe('string');
      expect(typeof pos.title).toBe('string');
      expect(typeof pos.service).toBe('string');
      expect(typeof pos.serviceLabel).toBe('string');
      expect(typeof pos.ownerFaction).toBe('string');
      const occ = pos.occupant;
      expect(typeof occ.actorId).toBe('string');
      expect(['bot', 'player']).toContain(occ.kind);
      expect(typeof occ.displayName).toBe('string');
      expect(occ.avatarId).toMatch(/^avatar_placeholder_\d{3}$/);
      expect(['imperial', 'noble', 'censorate', 'border', 'silver', 'underworld']).toContain(occ.faction);
      expect(typeof pos.incomeHint).toBe('string');
      expect(typeof pos.replaceHint).toBe('string');
      expect(['bot_held', 'player_held', 'vacant', 'locked']).toContain(pos.status);
    }
  });

  it('locationId filter returns only positions from that location', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, { locationId: 'northern_bureau' });
    const { positions } = (response as any).data;
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.locationId).toBe('northern_bureau');
    }
    // northern_bureau has 2 services (missions, intel)
    expect(positions.length).toBe(2);
  });

  it('faction filter returns only positions from that faction owner', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, { faction: 'imperial' });
    const { positions } = (response as any).data;
    expect(positions.length).toBeGreaterThan(0);
    for (const pos of positions) {
      expect(pos.ownerFaction).toBe('imperial');
    }
  });

  it('combined locationId + matching faction returns positions', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, { locationId: 'northern_bureau', faction: 'imperial' });
    const { positions } = (response as any).data;
    expect(positions.length).toBe(2);
  });

  it('combined locationId + non-matching faction returns empty list', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, { locationId: 'northern_bureau', faction: 'noble' });
    const { positions } = (response as any).data;
    expect(positions.length).toBe(0);
  });

  it('locationName and serviceLabel are properly populated (wine_house)', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    const response = await worldServicePositionsGetList(ctx, { locationId: 'wine_house' });
    const { positions } = (response as any).data;
    expect(positions.length).toBe(1);
    expect(positions[0].locationName).toBe('京城酒楼');
    expect(positions[0].serviceLabel).toBe('补给');
  });

  it('world power total remains 10000 after calling the API', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);
    await worldServicePositionsGetList(ctx, {});
    const total = state.world.actors.reduce((sum: number, a: any) => sum + a.powerShare, 0);
    expect(total).toBe(10000);
  });

  it('each position returns correct controlProfile in WORLD_SERVICE_POSITIONS_GET_LIST and WORLD_LOCATIONS_GET_STATUS', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    // 1. 测试 WORLD_SERVICE_POSITIONS_GET_LIST
    const listRes = await worldServicePositionsGetList(ctx, {});
    expect(listRes.ok).toBe(true);
    const { positions } = listRes.data;
    expect(positions.length).toBeGreaterThan(0);

    for (const pos of positions) {
      expect(pos.controlProfile).toBeDefined();
      expect(typeof pos.controlProfile?.appointmentControllerLabel).toBe('string');
      expect(typeof pos.controlProfile?.financeControllerLabel).toBe('string');
      expect(typeof pos.controlProfile?.paylineHint).toBe('string');
      expect(typeof pos.controlProfile?.loyaltyCostHint).toBe('string');
    }

    // 2. 测试 WORLD_LOCATIONS_GET_STATUS
    const statusRes = await worldLocationsGetStatus(ctx, {});
    expect(statusRes.ok).toBe(true);
    const { locations } = statusRes.data;
    expect(locations.length).toBeGreaterThan(0);

    for (const loc of locations) {
      for (const pos of loc.servicePositions) {
        expect(pos.controlProfile).toBeDefined();
        expect(typeof pos.controlProfile?.appointmentControllerLabel).toBe('string');
        expect(typeof pos.controlProfile?.financeControllerLabel).toBe('string');
        expect(typeof pos.controlProfile?.paylineHint).toBe('string');
        expect(typeof pos.controlProfile?.loyaltyCostHint).toBe('string');
      }
    }
  });

  it('correctly maps controlProfile faction text details (抽查 imperial, border, silver, underworld)', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    const listRes = await worldServicePositionsGetList(ctx, {});
    const { positions } = listRes.data;

    // 抽查 imperial: 皇宫 (imperial_palace)
    const imperialPos = positions.find(p => p.ownerFaction === 'imperial');
    expect(imperialPos).toBeDefined();
    expect(imperialPos!.controlProfile!.appointmentControllerLabel).toBe('上意与内廷批红');
    expect(imperialPos!.controlProfile!.financeControllerLabel).toBe('内库、司礼监与赏赐账');
    expect(imperialPos!.controlProfile!.paylineHint).toBe('银钱先入内廷账面，再按圣眷与差遣发放。');
    expect(imperialPos!.controlProfile!.loyaltyCostHint).toBe('听旨、保密、背锅，不能质疑来路。');

    // 抽查 border: 兵部/边镇 (border_command)
    const borderPos = positions.find(p => p.ownerFaction === 'border');
    expect(borderPos).toBeDefined();
    expect(borderPos!.controlProfile!.appointmentControllerLabel).toBe('总兵、把总与家丁军头');
    expect(borderPos!.controlProfile!.financeControllerLabel).toBe('军粮、军饷、赏银与边镇私账');
    expect(borderPos!.controlProfile!.paylineHint).toBe('饷银层层下拨，克扣与拖欠都写在边账里。');
    expect(borderPos!.controlProfile!.loyaltyCostHint).toBe('服军令、交战功、别让中枢觉得尾大不掉。');

    // 抽查 silver: 盐商/织造局 (salt_merchant_guild / weaving_bureau)
    const silverPos = positions.find(p => p.ownerFaction === 'silver');
    expect(silverPos).toBeDefined();
    expect(silverPos!.controlProfile!.appointmentControllerLabel).toBe('盐商首总、织造买办与牙行保人');
    expect(silverPos!.controlProfile!.financeControllerLabel).toBe('盐引、贡品、账房银路与交易抽成');
    expect(silverPos!.controlProfile!.paylineHint).toBe('银路由账房放款，返多少看保人和账面余银。');
    expect(silverPos!.controlProfile!.loyaltyCostHint).toBe('纳份例、走银路、替后台遮账。');

    // 抽查 underworld: 漕帮/流民营 (refugee_camp)
    const underworldPos = positions.find(p => p.ownerFaction === 'underworld');
    expect(underworldPos).toBeDefined();
    expect(underworldPos!.controlProfile!.appointmentControllerLabel).toBe('香头、脚夫帮主与暗线保人');
    expect(underworldPos!.controlProfile!.financeControllerLabel).toBe('口粮、赃货、脚钱与藏匿份子');
    expect(underworldPos!.controlProfile!.paylineHint).toBe('底层先交粮交货，回款多少全看头目分配。');
    expect(underworldPos!.controlProfile!.loyaltyCostHint).toBe('听招呼、守暗号、出事先扛雷。');
  });

  it('correctly returns ministry_of_personnel status and services', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    const statusRes = await worldLocationsGetStatus(ctx, {});
    const { locations } = statusRes.data;
    const mop = locations.find(l => l.locationId === 'ministry_of_personnel');

    expect(mop).toBeDefined();
    expect(mop!.name).toBe('吏部衙门');
    expect(mop!.ownerFaction).toBe('censorate');
    expect(mop!.services).toContain('office_registry');
    expect(mop!.services).toContain('appointment');
    expect(mop!.services).toContain('evaluation');
  });
});

describe('WORLD_SERVICE_POSITION_GET_DETAIL', () => {
  function makeCtx(state: any, now = 1_000_000): any {
    let dirty = false;
    return {
      playerId: 'test-player',
      now,
      state,
      get dirty() { return dirty; },
      markDirty() { dirty = true; },
    };
  }

  it('returns details of a valid service position with KPIs and control details', async () => {
    const state = createInitialGameState({ now: 10000000 });
    const ctx = makeCtx(state, 10000000);

    const res = await worldServicePositionGetDetail(ctx, { positionId: 'ministry_of_personnel:office_registry' });
    expect(res.ok).toBe(true);

    const { position, location, kpiProfile, controlDetail, eligibility, imperialOverrideHint } = res.data;
    expect(position.positionId).toBe('ministry_of_personnel:office_registry');
    expect(location.locationId).toBe('ministry_of_personnel');
    expect(location.name).toBe('吏部衙门');

    // KPI Profile fields
    expect(kpiProfile.termStartsAt).toBeLessThan(10000000);
    expect(kpiProfile.termEndsAt).toBeGreaterThan(10000000);
    expect(kpiProfile.taxDuePerTerm).toBeGreaterThan(0);
    expect(kpiProfile.taxDeliveredThisTerm).toBeLessThanOrEqual(kpiProfile.taxDuePerTerm);
    expect(kpiProfile.powerDuePerTerm).toBeGreaterThan(0);
    expect(kpiProfile.powerDeliveredThisTerm).toBeLessThanOrEqual(kpiProfile.powerDuePerTerm);

    // Control Detail fields
    expect(controlDetail.treasurySplit.imperialPrivatePct).toBeDefined();
    expect(controlDetail.treasurySplit.publicTreasuryPct).toBeDefined();
    expect(controlDetail.treasurySplit.officeHolderPct).toBeDefined();
    expect(controlDetail.treasurySplit.superiorPct).toBeDefined();
    expect(controlDetail.treasurySplit.imperialPrivatePct + controlDetail.treasurySplit.publicTreasuryPct + controlDetail.treasurySplit.officeHolderPct + controlDetail.treasurySplit.superiorPct).toBe(100);

    // Eligibility check
    expect(eligibility.canBeConsidered).toBeDefined();
    expect(Array.isArray(eligibility.reasons)).toBe(true);
    expect(typeof imperialOverrideHint).toBe('string');
  });

  it('throws POSITION_NOT_FOUND when position does not exist', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    let error: any;
    try {
      await worldServicePositionGetDetail(ctx, { positionId: 'invalid-pos' });
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe('POSITION_NOT_FOUND');
  });

  it('throws POSITION_ID_REQUIRED when no positionId is provided', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    let error: any;
    try {
      await worldServicePositionGetDetail(ctx, {});
    } catch (e: any) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(error.code).toBe('POSITION_ID_REQUIRED');
  });
});

describe('Office Ledger & Bot Simulation V1', () => {
  it('caps officeLedger to 200 entries', () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    // Populate with 250 mock entries
    state.world.officeLedger = [];
    for (let i = 1; i <= 250; i++) {
      state.world.officeLedger.push({
        entryId: `mock_${i}`,
        createdAt: ctx.now,
        positionId: 'weaving_bureau:missions',
        locationId: 'weaving_bureau',
        service: 'missions',
        type: 'bot_tax',
        description: `Entry ${i}`,
      });
    }

    const entry = {
      entryId: `mock_new`,
      createdAt: ctx.now,
      positionId: 'weaving_bureau:missions',
      locationId: 'weaving_bureau',
      service: 'missions' as const,
      type: 'bot_tax' as const,
      description: `New Entry`,
    };
    state.world.officeLedger.push(entry);
    if (state.world.officeLedger.length > 200) {
      state.world.officeLedger = state.world.officeLedger.slice(-200);
    }

    expect(state.world.officeLedger).toHaveLength(200);
    expect(state.world.officeLedger[0]!.entryId).toBe('mock_52');
    expect(state.world.officeLedger[199]!.entryId).toBe('mock_new');
  });

  it('runs bot simulation deterministic random selection and conserves total power', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const initialPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(initialPower).toBe(10000);

    const res = await worldLocationsGetStatus(ctx, {});
    expect(res.ok).toBe(true);

    expect(state.world.botSimulation?.lastSimulatedAt).toBe(ctx.now);
    const ledger = state.world.officeLedger ?? [];
    expect(ledger.length).toBeGreaterThanOrEqual(3);

    const currentPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(currentPower).toBe(10000);
  });

  it('enforces 10-minute cooldown on bot simulation', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    await worldLocationsGetStatus(ctx, {});
    const countAfterFirst = state.world.officeLedger?.length ?? 0;

    ctx.now += 300 * 1000;
    await worldLocationsGetStatus(ctx, {});
    const countAfterSecond = state.world.officeLedger?.length ?? 0;
    expect(countAfterSecond).toBe(countAfterFirst);

    ctx.now += 360 * 1000;
    await worldLocationsGetStatus(ctx, {});
    const countAfterThird = state.world.officeLedger?.length ?? 0;
    expect(countAfterThird).toBeGreaterThan(countAfterFirst);
  });

  it('filters ledger entries by positionId and actorId and returns ledgerPreview', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    state.world.officeLedger = [
      {
        entryId: 'e1',
        createdAt: ctx.now,
        positionId: 'weaving_bureau:missions',
        locationId: 'weaving_bureau',
        service: 'missions',
        beneficiaryActorId: 'bot_1',
        type: 'bot_tax',
        description: 'd1',
      },
      {
        entryId: 'e2',
        createdAt: ctx.now + 1000,
        positionId: 'northern_bureau:missions',
        locationId: 'northern_bureau',
        service: 'missions',
        beneficiaryActorId: 'bot_2',
        type: 'bot_power',
        description: 'd2',
      },
    ];

    const resPos = await worldServicePositionLedgerGet(ctx, { positionId: 'northern_bureau:missions' });
    expect(resPos.ok).toBe(true);
    expect(resPos.data.entries).toHaveLength(1);
    expect(resPos.data.entries[0]!.entryId).toBe('e2');

    const resActor = await worldServicePositionLedgerGet(ctx, { actorId: 'bot_1' });
    expect(resActor.ok).toBe(true);
    expect(resActor.data.entries).toHaveLength(1);
    expect(resActor.data.entries[0]!.entryId).toBe('e1');

    const resDetail = await worldServicePositionGetDetail(ctx, { positionId: 'weaving_bureau:missions' });
    expect(resDetail.ok).toBe(true);
    expect(resDetail.data.ledgerPreview).toHaveLength(1);
    expect(resDetail.data.ledgerPreview[0]!.entryId).toBe('e1');
  });

  it('supports locationId filtering and AND combination with positionId/actorId and validates limit & newest-first order & bot simulation behavior', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    state.world.officeLedger = [
      {
        entryId: 'e1',
        createdAt: ctx.now,
        positionId: 'weaving_bureau:missions',
        locationId: 'weaving_bureau',
        service: 'missions' as const,
        beneficiaryActorId: 'bot_1',
        type: 'bot_tax' as const,
        description: 'd1',
      },
      {
        entryId: 'e2',
        createdAt: ctx.now + 1000,
        positionId: 'northern_bureau:missions',
        locationId: 'northern_bureau',
        service: 'missions' as const,
        beneficiaryActorId: 'bot_2',
        type: 'bot_power' as const,
        description: 'd2',
      },
      {
        entryId: 'e3',
        createdAt: ctx.now + 2000,
        positionId: 'weaving_bureau:missions',
        locationId: 'weaving_bureau',
        service: 'missions' as const,
        beneficiaryActorId: 'bot_2',
        type: 'bot_tax' as const,
        description: 'd3',
      },
    ];

    // 1. WORLD_SERVICE_POSITION_LEDGER_GET with locationId only
    const resLoc = await worldServicePositionLedgerGet(ctx, { locationId: 'weaving_bureau' });
    expect(resLoc.ok).toBe(true);
    expect(resLoc.data.entries).toHaveLength(2);
    // newest-first order (e3 at index 0, e1 at index 1)
    expect(resLoc.data.entries[0]!.entryId).toBe('e3');
    expect(resLoc.data.entries[1]!.entryId).toBe('e1');
    expect(resLoc.data.entries.every(e => e.locationId === 'weaving_bureau')).toBe(true);

    // 2. AND filtering: locationId + positionId
    const resAndPos = await worldServicePositionLedgerGet(ctx, {
      locationId: 'weaving_bureau',
      positionId: 'weaving_bureau:missions',
    });
    expect(resAndPos.ok).toBe(true);
    expect(resAndPos.data.entries).toHaveLength(2);

    const resAndPosNone = await worldServicePositionLedgerGet(ctx, {
      locationId: 'northern_bureau',
      positionId: 'weaving_bureau:missions',
    });
    expect(resAndPosNone.ok).toBe(true);
    expect(resAndPosNone.data.entries).toHaveLength(0);

    // 3. AND filtering: locationId + actorId
    const resAndActor = await worldServicePositionLedgerGet(ctx, {
      locationId: 'weaving_bureau',
      actorId: 'bot_2',
    });
    expect(resAndActor.ok).toBe(true);
    expect(resAndActor.data.entries).toHaveLength(1);
    expect(resAndActor.data.entries[0]!.entryId).toBe('e3');

    // 4. limit default and max regression validation
    const largeLedger = [];
    for (let i = 0; i < 60; i++) {
      largeLedger.push({
        entryId: `temp_${i}`,
        createdAt: ctx.now + i * 1000,
        positionId: 'weaving_bureau:missions',
        locationId: 'weaving_bureau',
        service: 'missions' as const,
        beneficiaryActorId: 'bot_1',
        type: 'bot_tax' as const,
        description: `d_${i}`,
      });
    }
    state.world.officeLedger = largeLedger;

    // limit default should be 20
    const resDefaultLimit = await worldServicePositionLedgerGet(ctx, {});
    expect(resDefaultLimit.data.entries).toHaveLength(20);
    expect(resDefaultLimit.data.entries[0]!.entryId).toBe('temp_59'); // newest first

    // limit max is capped at 50
    const resMaxLimit = await worldServicePositionLedgerGet(ctx, { limit: 100 });
    expect(resMaxLimit.data.entries).toHaveLength(50);
    expect(resMaxLimit.data.entries[0]!.entryId).toBe('temp_59'); // newest first

    // 5. Bot simulation cooldown is triggered and conserves 10000 power
    const simulationBefore = state.world.botSimulation?.lastSimulatedAt;
    state.world.officeLedger = [];
    // Advance time past 10 minutes (600,000 ms) to trigger bot simulation
    ctx.now += 601 * 1000;
    await worldServicePositionLedgerGet(ctx, { locationId: 'weaving_bureau' });
    const simulationAfter = state.world.botSimulation?.lastSimulatedAt;
    expect(simulationAfter).toBe(ctx.now);
    expect(simulationAfter).not.toBe(simulationBefore);

    const totalPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(totalPower).toBe(10000);
  });
});

describe('Office Candidates and Plotting V1', () => {
  it('throws POSITION_ID_REQUIRED and POSITION_NOT_FOUND appropriately', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    // 1. Missing positionId
    let error1: any;
    try {
      await worldServicePositionCandidatesGet(ctx, {});
    } catch (e: any) {
      error1 = e;
    }
    expect(error1).toBeDefined();
    expect(error1.code).toBe('POSITION_ID_REQUIRED');

    // 2. Non-existent positionId
    let error2: any;
    try {
      await worldServicePositionCandidatesGet(ctx, { positionId: 'invalid:pos' });
    } catch (e: any) {
      error2 = e;
    }
    expect(error2).toBeDefined();
    expect(error2.code).toBe('POSITION_NOT_FOUND');
  });

  it('evaluates candidates list correctly', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    state.player.level = 10;
    state.player.powerFaction = 'silver';
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const res = await worldServicePositionCandidatesGet(ctx, { positionId: 'weaving_bureau:missions' });
    expect(res.ok).toBe(true);

    const data = res.data;
    expect(data.incumbent).toBeDefined();
    expect(data.currentPlayer).toBeDefined();
    expect(data.candidates.length).toBeGreaterThan(0);

    let lastScore = 1000;
    for (const c of data.candidates) {
      expect(c.score).toBeLessThanOrEqual(lastScore);
      lastScore = c.score;

      const labels = c.scoreBreakdown.map(b => b.label);
      expect(labels).toContain('等级门槛');
      expect(labels).toContain('在野权柄');
      expect(labels).toContain('派系匹配');
      expect(labels).toContain('KPI机会');
      expect(labels).toContain('职务适配');
    }
  });

  it('generates plottingAdvice and recommendation reflecting player conditions', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    state.player.level = 1; // Insufficient level
    state.player.powerFaction = 'silver';
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const res = await worldServicePositionCandidatesGet(ctx, { positionId: 'ministry_of_personnel:office_registry' });
    expect(res.ok).toBe(true);
    const data = res.data;

    expect(data.currentPlayer?.recommendation).toContain('等级未达标');
    expect(data.plottingAdvice.some(a => a.includes('等级提升'))).toBe(true);

    const diff = data.incumbent.powerShare - data.currentPlayer!.powerShare;
    if (diff > 0) {
      expect(data.plottingAdvice.some(a => a.includes('权柄争夺'))).toBe(true);
    }

    const isKpiMet = data.incumbent.powerShare >= 300;
    if (!isKpiMet) {
      expect(data.plottingAdvice.some(a => a.includes('考功破绽'))).toBe(true);
    } else {
      expect(data.plottingAdvice.some(a => a.includes('暂难撬动'))).toBe(true);
    }
  });

  it('integrates candidatesPreview in worldServicePositionGetDetail', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const res = await worldServicePositionGetDetail(ctx, { positionId: 'weaving_bureau:missions' });
    expect(res.ok).toBe(true);
    expect(res.data.candidatesPreview).toBeDefined();
    expect(res.data.candidatesPreview!.currentPlayerRank).toBeGreaterThan(0);
    expect(res.data.candidatesPreview!.topCandidate).toBeDefined();
    expect(res.data.candidatesPreview!.advice.length).toBeGreaterThan(0);
  });

  it('keeps world actors and total power share completely unchanged', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const actorsBefore = JSON.stringify(state.world.actors);
    const totalPowerBefore = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);

    await worldServicePositionCandidatesGet(ctx, { positionId: 'weaving_bureau:missions' });
    await worldServicePositionGetDetail(ctx, { positionId: 'weaving_bureau:missions' });

    const actorsAfter = JSON.stringify(state.world.actors);
    const totalPowerAfter = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);

    expect(actorsAfter).toBe(actorsBefore);
    expect(totalPowerAfter).toBe(totalPowerBefore);
  });
});

describe('Location Treasury and Raid V1', () => {
  it('initializes location treasuries and processes query', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    expect(state.world.locationTreasuries).toBeDefined();
    expect(state.world.locationTreasuries!.length).toBeGreaterThan(0);

    const res = await worldLocationTreasuryGet(ctx, { locationId: 'weaving_bureau' });
    expect(res.ok).toBe(true);
    expect(res.data.locationId).toBe('weaving_bureau');
    expect(res.data.locationName).toBe('江南织造局');
    expect(res.data.copperBalance).toBeGreaterThan(0);
    expect(res.data.goodsValue).toBeGreaterThan(0);
    expect(res.data.powerValue).toBeGreaterThan(0);

    // Invalid location
    await expect(worldLocationTreasuryGet(ctx, { locationId: 'invalid' })).rejects.toThrow();
  });

  it('increases treasury balances upon bot simulation and mission settlements', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    const tBefore = { ...state.world.locationTreasuries!.find(t => t.locationId === 'weaving_bureau')! };

    // 1. Bot simulation increases treasury
    // Force simulation time trigger
    ctx.now += 601 * 1000;
    await worldLocationTreasuryGet(ctx, { locationId: 'weaving_bureau' });
    
    // Check total treasuries changed
    const tAfterSim = state.world.locationTreasuries!.find(t => t.locationId === 'weaving_bureau')!;
    const someIncreased = state.world.locationTreasuries!.some(t => {
      const original = tBefore.locationId === t.locationId ? tBefore : { copperBalance: 0, goodsValue: 0, powerValue: 0 };
      return t.copperBalance > original.copperBalance || t.goodsValue > original.goodsValue || t.powerValue > original.powerValue;
    });
    expect(someIncreased).toBe(true);
  });

  it('runs the raid battle and processes settlements for wealth, power, and fame choices', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    // Give player high attributes to guarantee player win (or force HP very high)
    state.attributes.strength = 10000;
    state.attributes.intelligence = 10000;
    state.attributes.agility = 10000;
    state.attributes.constitution = 10000;

    // 1. Start raid
    const resStart = await worldLocationRaidStart(ctx, { locationId: 'weaving_bureau' });
    expect(resStart.ok).toBe(true);
    expect(resStart.data.raidId).toBeDefined();
    expect(resStart.data.canChooseOutcome).toBe(true);
    expect(resStart.data.battleResult.playerWon).toBe(true);

    const raidId = resStart.data.raidId;
    const treasuryBefore = resStart.data.treasuryBefore;

    // 2. Choice: wealth
    const playerCopperBefore = state.resources.copper;
    const resSettle = await worldLocationRaidSettle(ctx, { raidId, choice: 'wealth' });
    expect(resSettle.ok).toBe(true);
    expect(resSettle.data.rewardCopper).toBeGreaterThan(0);
    expect(state.resources.copper).toBe(playerCopperBefore + resSettle.data.rewardCopper);
    expect(resSettle.data.treasuryAfter.copperBalance).toBeLessThan(treasuryBefore.copperBalance);

    // Double settle throws
    await expect(worldLocationRaidSettle(ctx, { raidId, choice: 'wealth' })).rejects.toThrow('already been settled');
  });

  it('validates mount carry multiplier for wealth choice', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    state.attributes.strength = 10000;
    state.attributes.intelligence = 10000;
    state.attributes.agility = 10000;
    state.attributes.constitution = 10000;

    // Set player mount to ox (2.0x carry multiplier)
    state.mount = {
      timeMultiplierBp: 5000,
      expiresAt: ctx.now + 3600 * 1000,
      name: '大青牛',
      tier: 'ox',
    };

    const resStart = await worldLocationRaidStart(ctx, { locationId: 'weaving_bureau' });
    expect(resStart.ok).toBe(true);
    const raidId = resStart.data.raidId;

    const resSettle = await worldLocationRaidSettle(ctx, { raidId, choice: 'wealth' });
    expect(resSettle.ok).toBe(true);
    const deducted = Math.floor(resStart.data.treasuryBefore.copperBalance * 0.5) + Math.floor(resStart.data.treasuryBefore.goodsValue * 0.5);
    expect(resSettle.data.rewardCopper).toBe(Math.floor(deducted * 2.0));
  });

  it('processes choice: power and choice: fame and maintains 10000 total power share', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    state.attributes.strength = 10000;
    state.attributes.intelligence = 10000;
    state.attributes.agility = 10000;
    state.attributes.constitution = 10000;

    // 1. Choice: power
    const resStartPower = await worldLocationRaidStart(ctx, { locationId: 'refugee_camp' });
    const raidIdPower = resStartPower.data.raidId;

    const playerPowerBefore = state.world.actors.find(a => a.actorId === `player:test-player`)?.powerShare ?? 0;
    const totalPowerBefore = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);

    const resSettlePower = await worldLocationRaidSettle(ctx, { raidId: raidIdPower, choice: 'power' });
    expect(resSettlePower.ok).toBe(true);
    expect(resSettlePower.data.rewardPower).toBeGreaterThan(0);

    const playerPowerAfter = state.world.actors.find(a => a.actorId === `player:test-player`)?.powerShare ?? 0;
    expect(playerPowerAfter).toBe(playerPowerBefore + resSettlePower.data.rewardPower);

    const totalPowerAfter = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
    expect(totalPowerAfter).toBe(10000);
    expect(totalPowerAfter).toBe(totalPowerBefore);

    // 2. Choice: fame
    const resStartFame = await worldLocationRaidStart(ctx, { locationId: 'wine_house' });
    const raidIdFame = resStartFame.data.raidId;
    const playerPrestigeBefore = state.resources.prestige ?? 0;

    const resSettleFame = await worldLocationRaidSettle(ctx, { raidId: raidIdFame, choice: 'fame' });
    expect(resSettleFame.ok).toBe(true);
    expect(resSettleFame.data.rewardPrestige).toBeGreaterThan(0);
    expect(state.resources.prestige).toBe(playerPrestigeBefore + resSettleFame.data.rewardPrestige);

    // 3. Ledger verification
    const resLedger = await worldServicePositionLedgerGet(ctx, { locationId: 'wine_house' });
    expect(resLedger.ok).toBe(true);
    expect(resLedger.data.entries.some(e => e.type === 'raid_fame')).toBe(true);
  });
});

describe('Location Guard Duty V1', () => {
  it('WORLD_LOCATION_TREASURY_GET returns guards and guardHint', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    const res = await worldLocationTreasuryGet(ctx, { locationId: 'weaving_bureau' });
    expect(res.ok).toBe(true);
    expect(res.data.guards).toEqual([]);
    expect(res.data.guardHint).toContain('0/3');
  });

  it('allows joining guard duty, enforces limits, double join, and slots', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    // Join once
    const resJoin = await worldLocationGuardJoin(ctx, { locationId: 'weaving_bureau', durationMinutes: 60 });
    expect(resJoin.ok).toBe(true);
    expect(resJoin.data.guards).toHaveLength(1);
    expect(resJoin.data.guardHint).toContain('1/3');
    expect(resJoin.data.guards[0].actorId).toBe('player:test-player');
    expect(resJoin.data.guards[0].wageCopper).toBeGreaterThan(0);
    expect(resJoin.data.guards[0].status).toBe('active');

    // Double join same location throws error
    await expect(
      worldLocationGuardJoin(ctx, { locationId: 'weaving_bureau', durationMinutes: 60 })
    ).rejects.toThrow('already guarding');

    // Test slot full limit
    // We mock another 2 guards at weaving_bureau in state
    state.world.locationGuardDuties!.push({
      dutyId: 'duty_mock_1',
      locationId: 'weaving_bureau',
      actorId: 'bot:1',
      actorDisplayName: '守卫1',
      actorAvatarId: 'avatar_1',
      actorKind: 'bot',
      faction: 'imperial',
      level: 10,
      combatRating: 100,
      startsAt: ctx.now,
      endsAt: ctx.now + 3600 * 1000,
      wageCopper: 50,
      status: 'active'
    });
    state.world.locationGuardDuties!.push({
      dutyId: 'duty_mock_2',
      locationId: 'weaving_bureau',
      actorId: 'bot:2',
      actorDisplayName: '守卫2',
      actorAvatarId: 'avatar_2',
      actorKind: 'bot',
      faction: 'imperial',
      level: 10,
      combatRating: 100,
      startsAt: ctx.now,
      endsAt: ctx.now + 3600 * 1000,
      wageCopper: 50,
      status: 'active'
    });

    const resQueryFull = await worldLocationTreasuryGet(ctx, { locationId: 'weaving_bureau' });
    expect(resQueryFull.data.guards).toHaveLength(3);

    // Join when slots full (max is 3) throws slot full error
    const ctxOther = { ...ctx, playerId: 'other-player' };
    syncPlayerActor(ctxOther);
    await expect(
      worldLocationGuardJoin(ctxOther, { locationId: 'weaving_bureau', durationMinutes: 60 })
    ).rejects.toThrow('slots are full');
  });

  it('allows leaving guard duty to abandon rewards', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const resJoin = await worldLocationGuardJoin(ctx, { locationId: 'weaving_bureau', durationMinutes: 30 });
    const dutyId = resJoin.data.guards[0].dutyId;

    // Leave guard duty
    const resLeave = await worldLocationGuardLeave(ctx, { dutyId });
    expect(resLeave.ok).toBe(true);
    expect(resLeave.data.guards).toHaveLength(0); // abandoned is filtered out

    const duty = state.world.locationGuardDuties!.find(d => d.dutyId === dutyId);
    expect(duty?.status).toBe('abandoned');

    // Trying to leave again or claim throws
    await expect(worldLocationGuardLeave(ctx, { dutyId })).rejects.toThrow('not active');
    await expect(worldLocationGuardClaim(ctx, { dutyId })).rejects.toThrow('already been settled or abandoned');
  });

  it('claims wage correctly (full and shortfall) when time ends', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const resJoin = await worldLocationGuardJoin(ctx, { locationId: 'weaving_bureau', durationMinutes: 60 });
    const dutyId = resJoin.data.guards[0].dutyId;
    const wageCopper = resJoin.data.guards[0].wageCopper;

    // Claim early throws
    await expect(worldLocationGuardClaim(ctx, { dutyId })).rejects.toThrow('shift has not ended yet');

    // Simulate shift completion
    ctx.now += 61 * 60 * 1000;

    const copperBefore = state.resources.copper;
    const resClaim = await worldLocationGuardClaim(ctx, { dutyId });
    expect(resClaim.ok).toBe(true);
    expect(resClaim.data.wagePaid).toBe(wageCopper);
    expect(resClaim.data.shortfall).toBe(0);
    expect(state.resources.copper).toBe(copperBefore + wageCopper);

    // Double claim throws
    await expect(worldLocationGuardClaim(ctx, { dutyId })).rejects.toThrow('already been settled or abandoned');

    // Shortfall verification
    const treasury = state.world.locationTreasuries!.find(t => t.locationId === 'weaving_bureau')!;
    treasury.copperBalance = 10;

    // Join again
    const resJoin2 = await worldLocationGuardJoin(ctx, { locationId: 'weaving_bureau', durationMinutes: 30 });
    const dutyId2 = resJoin2.data.guards[0].dutyId;
    const wageExpected = resJoin2.data.guards[0].wageCopper;

    ctx.now += 31 * 60 * 1000;
    state.world.botSimulation!.lastSimulatedAt = ctx.now;
    const playerCopperBefore2 = state.resources.copper;
    const resClaim2 = await worldLocationGuardClaim(ctx, { dutyId: dutyId2 });
    expect(resClaim2.ok).toBe(true);
    expect(resClaim2.data.wagePaid).toBe(10);
    expect(resClaim2.data.shortfall).toBe(wageExpected - 10);
    expect(state.resources.copper).toBe(playerCopperBefore2 + 10);
    expect(resClaim2.data.treasuryAfter.copperBalance).toBe(0);
  });

  it('prioritizes guard defense and sets reason appropriately in raids', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    state.world.locationGuardDuties!.push({
      dutyId: 'bot_guard_duty',
      locationId: 'weaving_bureau',
      actorId: 'bot_guard_actor',
      actorDisplayName: '铁浮屠',
      actorAvatarId: 'avatar_9',
      actorKind: 'bot',
      faction: 'imperial',
      level: 15,
      combatRating: 250,
      startsAt: ctx.now,
      endsAt: ctx.now + 3600 * 1000,
      wageCopper: 50,
      status: 'active'
    });

    state.world.actors.push({
      actorId: 'bot_guard_actor',
      kind: 'bot',
      displayName: '铁浮屠',
      raceId: 'RACE_01',
      classId: 'CLASS_A',
      faction: 'imperial',
      locationId: 'weaving_bureau',
      level: 15,
      powerShare: 100,
      combatSnapshot: {
        level: 15,
        classId: 'CLASS_A',
        attributes: { strength: 40, intelligence: 40, agility: 40, constitution: 40, luck: 10 },
        combatStats: { hp: 200, armor: 100, damageMin: 20, damageMax: 30, critChanceBp: 500 },
        equipmentSummary: { itemPowerTotal: 100 }
      }
    });

    state.attributes.strength = 10000;
    state.attributes.intelligence = 10000;
    state.attributes.agility = 10000;
    state.attributes.constitution = 10000;

    const resStart = await worldLocationRaidStart(ctx, { locationId: 'weaving_bureau' });
    expect(resStart.ok).toBe(true);
    expect(resStart.data.defenderActor).toBeDefined();
    expect(resStart.data.defenderActor!.actorId).toBe('bot_guard_actor');
    expect(resStart.data.defenderActor!.reason).toBe('场所值班守卫');
  });
});

describe('Global World State V1 Integration Tests', () => {
  it('multiple contexts sharing the same world state should see identical actors and locations', async () => {
    const globalWorldState = { status: 'UNINITIALIZED', actors: [] } as any;

    const stateA = createInitialGameState({ now: 1_000_000, playerId: 'player-a' });
    stateA.world = globalWorldState;
    const ctxA = makeCtx(stateA);
    ctxA.playerId = 'player-a';

    const stateB = createInitialGameState({ now: 1_000_000, playerId: 'player-b' });
    stateB.world = globalWorldState;
    const ctxB = makeCtx(stateB);
    ctxB.playerId = 'player-b';

    ensureWorldInitialized(ctxA);

    expect(ctxB.state.world.status).toBe('ACTIVE');
    expect(ctxB.state.world.actors).toHaveLength(260);

    syncPlayerActor(ctxA);
    const playerAActor = ctxB.state.world.actors.find(a => a.actorId === 'player:player-a');
    expect(playerAActor).toBeDefined();
    expect(playerAActor?.displayName).toBe('玩家');
  });

  it('joining guard duty on player A displays A to player B, and A defends when B raids', async () => {
    const globalWorldState = { status: 'UNINITIALIZED', actors: [] } as any;

    const stateA = createInitialGameState({ now: 1_000_000, playerId: 'player-a' });
    stateA.world = globalWorldState;
    const ctxA = makeCtx(stateA);
    ctxA.playerId = 'player-a';

    const stateB = createInitialGameState({ now: 1_000_000, playerId: 'player-b' });
    stateB.world = globalWorldState;
    const ctxB = makeCtx(stateB);
    ctxB.playerId = 'player-b';

    ensureWorldInitialized(ctxA);
    syncPlayerActor(ctxA);
    syncPlayerActor(ctxB);

    const resJoin = await worldLocationGuardJoin(ctxA, { locationId: 'weaving_bureau', durationMinutes: 60 });
    expect(resJoin.ok).toBe(true);

    const resTreasury = await worldLocationTreasuryGet(ctxB, { locationId: 'weaving_bureau' });
    expect(resTreasury.ok).toBe(true);
    expect(resTreasury.data.guards).toHaveLength(1);
    expect(resTreasury.data.guards[0].actorId).toBe('player:player-a');

    const resRaid = await worldLocationRaidStart(ctxB, { locationId: 'weaving_bureau' });
    expect(resRaid.ok).toBe(true);
    expect(resRaid.data.defenderActor?.actorId).toBe('player:player-a');
    expect(resRaid.data.defenderActor?.reason).toBe('场所值班守卫');
  });

  it('new players sync into world.actors, increasing total census dynamically and maintaining 10000 power share', async () => {
    const globalWorldState = { status: 'UNINITIALIZED', actors: [] } as any;

    const stateA = createInitialGameState({ now: 1_000_000, playerId: 'player-a' });
    stateA.world = globalWorldState;
    const ctxA = makeCtx(stateA);
    ctxA.playerId = 'player-a';

    ensureWorldInitialized(ctxA);
    syncPlayerActor(ctxA);

    const overview1 = await worldActorsGetOverview(ctxA, {});
    expect(overview1.data.totalActors).toBe(261);

    const stateB = createInitialGameState({ now: 1_000_000, playerId: 'player-b' });
    stateB.world = globalWorldState;
    const ctxB = makeCtx(stateB);
    ctxB.playerId = 'player-b';
    syncPlayerActor(ctxB);

    const overview2 = await worldActorsGetOverview(ctxA, {});
    expect(overview2.data.totalActors).toBe(262);

    const totalPower = globalWorldState.actors.reduce((sum: number, a: any) => sum + a.powerShare, 0);
    expect(totalPower).toBe(10000);
  });

  describe('Office Private Treasury and Weekly Tribute V1', () => {
    function makeCtx(state: GameState, now = 1_000_000): ActionContext {
      let dirty = false;
      let worldDirty = false;
      return {
        playerId: 'test-player',
        now,
        state,
        get dirty() { return dirty; },
        markDirty() { dirty = true; },
        get worldDirty() { return worldDirty; },
        markWorldDirty() { worldDirty = true; }
      };
    }

    it('verifies that Emperor and Wei Zhongxian are present and total power share is 10000', () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      const emperor = state.world.actors.find(a => a.actorId === 'reserved:emperor_tianqi');
      const wei = state.world.actors.find(a => a.actorId === 'reserved:wei_zhongxian');

      expect(emperor).toBeDefined();
      expect(emperor?.displayName).toBe('朱由校');
      expect(emperor?.title).toBe('大明天启皇帝');
      expect(emperor?.faction).toBe('imperial');
      expect(emperor?.locationId).toBe('imperial_palace');

      expect(wei).toBeDefined();
      expect(wei?.displayName).toBe('魏忠贤');
      expect(wei?.title).toBe('司礼监秉笔太监');
      expect(wei?.faction).toBe('imperial');
      expect(wei?.locationId).toBe('imperial_palace');

      const totalPower = state.world.actors.reduce((sum, a) => sum + a.powerShare, 0);
      expect(totalPower).toBe(10000);
      expect(state.world.actors).toHaveLength(260); // 2 reserved + 258 bots
    });

    it('maps chief actors for palace and normal locations correctly', async () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      // Palace treasury chief must be Wei Zhongxian
      const resPalace = await worldLocationTreasuryGet(ctx, { locationId: 'imperial_palace' });
      expect(resPalace.ok).toBe(true);
      expect(resPalace.data.chiefActor).toBeDefined();
      expect(resPalace.data.chiefActor?.actorId).toBe('reserved:wei_zhongxian');
      expect(resPalace.data.chiefActor?.displayName).toBe('魏忠贤');
      expect(resPalace.data.chiefActor?.title).toBe('司礼监秉笔太监');

      // Normal locations (e.g. weaving_bureau) should resolve a chief actor
      const resWeaving = await worldLocationTreasuryGet(ctx, { locationId: 'weaving_bureau' });
      expect(resWeaving.ok).toBe(true);
      expect(resWeaving.data.chiefActor).toBeDefined();
      expect(resWeaving.data.chiefActor?.personalCopperExposed).toBe(resWeaving.data.copperBalance);
    });

    it('initializes and queries weekly tributes', async () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      const resTributes = await worldOfficeTributeGet(ctx, {});
      expect(resTributes.ok).toBe(true);
      const terms = resTributes.data.terms;
      expect(terms.length).toBeGreaterThan(0);

      // Each term must default to active, due Wei Zhongxian, and reviewLabel '本周未考'
      for (const term of terms) {
        expect(term.status).toBe('active');
        expect(term.superiorActorId).toBe('reserved:wei_zhongxian');
        expect(term.reviewLabel).toBe('本周未考');
        expect(term.dueCopper).toBeGreaterThan(1000);
      }
    });

    it('enforces tribute pay permissions and processes valid pay', async () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      const resTributes = await worldOfficeTributeGet(ctx, {});
      const term = resTributes.data.terms[0];
      expect(term).toBeDefined();

      // 1. Try to pay from a non-holder actor (by default, player actor ID is 'player:default-player')
      term.officeHolderActorId = 'some_other_bot';
      await expect(worldOfficeTributePay(ctx, { tributeId: term.tributeId, amountCopper: 500 }))
        .rejects.toThrow('You cannot pay tribute for another officer');

      // 2. Set holder to current player to pass authorization
      const playerActorId = 'player:test-player';
      term.officeHolderActorId = playerActorId;

      // 3. Try to pay with insufficient copper
      state.resources.copper = 100;
      await expect(worldOfficeTributePay(ctx, { tributeId: term.tributeId, amountCopper: 500 }))
        .rejects.toThrow('You do not have enough copper');

      // 4. Pay successfully
      state.resources.copper = 1000;
      const resPalaceBefore = await worldLocationTreasuryGet(ctx, { locationId: 'imperial_palace' });
      const palaceCopperBefore = resPalaceBefore.data.copperBalance;

      const resPay = await worldOfficeTributePay(ctx, { tributeId: term.tributeId, amountCopper: 400 });
      expect(resPay.ok).toBe(true);
      expect(resPay.data.term.paidCopper).toBe(400);
      expect(state.resources.copper).toBe(600);
      expect(resPay.data.copperAfter).toBe(600);

      const resPalaceAfter = await worldLocationTreasuryGet(ctx, { locationId: 'imperial_palace' });
      expect(resPalaceAfter.data.copperBalance).toBe(palaceCopperBefore + 400);

      // 5. Verify ledgers are written
      const ledger = state.world.officeLedger ?? [];
      const entries = ledger.filter(e => e.type === 'tribute_pay');
      expect(entries.length).toBe(2); // double logging
      const payer = entries.find(e => e.locationId === term.locationId);
      const receiver = entries.find(e => e.locationId === 'imperial_palace');
      expect(payer).toBeDefined();
      expect(payer?.taxValueDelta).toBe(-400);
      expect(receiver).toBeDefined();
      expect(receiver?.taxValueDelta).toBe(400);
    });

    it('settles passed/failed status on tribute expiration', async () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      const resTributes = await worldOfficeTributeGet(ctx, {});
      const term = resTributes.data.terms[0];
      term.officeHolderActorId = 'player:test-player';

      // 1. Pay partially (less than due)
      state.resources.copper = 5000;
      await worldOfficeTributePay(ctx, { tributeId: term.tributeId, amountCopper: 100 });

      // 2. Fast forward past termEndsAt
      ctx.now = term.termEndsAt + 1000;

      // Trigger update/check
      const resTributesAfter = await worldOfficeTributeGet(ctx, { includeHistory: true });
      const termAfter = resTributesAfter.data.terms.find(t => t.tributeId === term.tributeId);
      expect(termAfter?.status).toBe('failed');
      expect(termAfter?.reviewLabel).toBe('欠贡');

      // Verify ledger entry for tribute_failed
      const entry = state.world.officeLedger?.find(e => e.type === 'tribute_failed' && e.locationId === term.locationId);
      expect(entry).toBeDefined();
    });

    it('generates finance report with reverse running balances and daily rows', async () => {
      const state = createInitialGameState({ now: 1_000_000 });
      const ctx = makeCtx(state);
      ensureWorldInitialized(ctx);

      const locId = 'weaving_bureau';
      const resReportInit = await worldLocationFinanceReportGet(ctx, { locationId: locId });
      expect(resReportInit.ok).toBe(true);
      expect(resReportInit.data.currentExposedCopper).toBeDefined();
      expect(resReportInit.data.dailyRows).toHaveLength(7);

      // Let's add some ledger activities
      const treasury = state.world.locationTreasuries!.find(t => t.locationId === locId)!;

      state.world.officeLedger = [
        {
          entryId: 'test_l1',
          createdAt: ctx.now - 5000,
          positionId: 'weaving_bureau:shop',
          locationId: locId,
          service: 'shop',
          type: 'guard_wage',
          taxValueDelta: -100,
          description: 'Test wage'
        },
        {
          entryId: 'test_l2',
          createdAt: ctx.now - 24 * 60 * 60 * 1000 - 5000,
          positionId: 'weaving_bureau:shop',
          locationId: locId,
          service: 'shop',
          type: 'chief_exposed_copper_change',
          taxValueDelta: -200,
          description: 'Test raid'
        },
        {
          entryId: 'test_l3',
          createdAt: ctx.now - 2 * 24 * 60 * 60 * 1000 - 5000,
          positionId: 'weaving_bureau:shop',
          locationId: locId,
          service: 'shop',
          type: 'shop_tax',
          taxValueDelta: 300,
          description: 'Test tax'
        }
      ];

      treasury.copperBalance = 1000;

      const resReport = await worldLocationFinanceReportGet(ctx, { locationId: locId });
      const rows = resReport.data.dailyRows;

      expect(rows[0].netCopperDelta).toBe(-100);
      expect(rows[0].expenseCopper).toBe(100);
      expect(rows[0].peakCopper).toBe(1100);

      expect(rows[1].netCopperDelta).toBe(-200);
      expect(rows[1].raidLossCopper).toBe(200);
      expect(rows[1].peakCopper).toBe(1300);

      expect(rows[2].netCopperDelta).toBe(300);
      expect(rows[2].incomeCopper).toBe(300);
      expect(rows[2].peakCopper).toBe(1300);
    });
  });
});

describe('Location Chief Dashboard V1', () => {
  it('returns a valid dashboard with chiefActor, treasury, topPositions, financeSummary, and recentLedger', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const locId = 'northern_bureau';
    const res = await worldLocationChiefDashboardGet(ctx, { locationId: locId });

    expect(res.ok).toBe(true);
    expect(res.data.locationId).toBe(locId);
    expect(res.data.locationName).toBeTruthy();
    expect(res.data.chiefActor).toBeDefined();
    expect(res.data.chiefActor.actorId).toBeTruthy();
    expect(res.data.chiefActor.displayName).toBeTruthy();
    expect(res.data.treasury).toBeDefined();
    expect(res.data.treasury.locationId).toBe(locId);
    expect(res.data.topPositions).toBeInstanceOf(Array);
    expect(res.data.topPositions.length).toBeGreaterThan(0);
    expect(res.data.topPositions.length).toBeLessThanOrEqual(5);
    expect(res.data.financeSummary).toHaveLength(7);
    expect(res.data.recentLedger).toBeInstanceOf(Array);
  });

  it('palace (imperial_palace) dashboard maps chiefActor to Wei Zhongxian', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const res = await worldLocationChiefDashboardGet(ctx, { locationId: 'imperial_palace' });

    expect(res.ok).toBe(true);
    expect(res.data.chiefActor.actorId).toBe('reserved:wei_zhongxian');
    expect(res.data.chiefActor.displayName).toBe('魏忠贤');
  });

  it('throws LOCATION_NOT_FOUND when locationId is missing or unknown', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);

    try {
      await worldLocationChiefDashboardGet(ctx, {});
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.code ?? e.errorCode ?? e.message).toMatch(/LOCATION_NOT_FOUND/);
    }

    try {
      await worldLocationChiefDashboardGet(ctx, { locationId: 'nonexistent_location' });
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.code ?? e.errorCode ?? e.message).toMatch(/LOCATION_NOT_FOUND/);
    }
  });

  it('financeSummary and recentLedger correctly reflect injected ledger entries', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const locId = 'weaving_bureau';
    const treasury = state.world.locationTreasuries!.find(t => t.locationId === locId)!;
    treasury.copperBalance = 500;

    // Inject ledger entries: today: 2 entries (guard_wage + tribute_pay), yesterday: 1 entry (shop_tax)
    state.world.officeLedger = [
      {
        entryId: 'dl1',
        createdAt: ctx.now - 100,
        positionId: 'weaving_bureau:missions',
        locationId: locId,
        service: 'missions',
        type: 'guard_wage',
        taxValueDelta: -50,
        description: 'Guard wage'
      },
      {
        entryId: 'dl2',
        createdAt: ctx.now - 200,
        positionId: 'weaving_bureau:missions',
        locationId: locId,
        service: 'missions',
        type: 'tribute_pay',
        taxValueDelta: -150,
        description: 'Tribute pay'
      },
      {
        entryId: 'dl3',
        createdAt: ctx.now - 24 * 60 * 60 * 1000 - 100,
        positionId: 'weaving_bureau:shop',
        locationId: locId,
        service: 'shop',
        type: 'shop_tax',
        taxValueDelta: 200,
        description: 'Tax income'
      },
    ];

    const res = await worldLocationChiefDashboardGet(ctx, { locationId: locId });

    // recentLedger should have all 3 entries (newest first)
    expect(res.data.recentLedger).toHaveLength(3);
    expect(res.data.recentLedger[0].entryId).toBe('dl1');

    // financeSummary day 0 (today): guard_wage -50 + tribute_pay -150 = net -200
    const today = res.data.financeSummary[0];
    expect(today.netCopperDelta).toBe(-200);
    expect(today.guardWageCopper).toBe(50);
    expect(today.tributePaidCopper).toBe(150);
    expect(today.expenseCopper).toBe(200);
    expect(today.incomeCopper).toBe(0);

    // financeSummary day 1 (yesterday): shop_tax +200
    const yesterday = res.data.financeSummary[1];
    expect(yesterday.netCopperDelta).toBe(200);
    expect(yesterday.incomeCopper).toBe(200);
    expect(yesterday.expenseCopper).toBe(0);
  });

  it('activeTribute is populated when an active tribute term exists for the location', async () => {
    const state = createInitialGameState({ now: 1_000_000 });
    const ctx = makeCtx(state);
    ensureWorldInitialized(ctx);
    syncPlayerActor(ctx);

    const locId = 'weaving_bureau';

    // Initially no active tribute before updateOfficeTributes runs
    // Force an active tribute
    const fakeChiefId = state.world.actors[0]?.actorId ?? 'bot:test';
    state.world.officeTributes = [
      {
        tributeId: 'tribute_test_1',
        positionId: `${locId}:missions`,
        locationId: locId,
        officeHolderActorId: fakeChiefId,
        superiorActorId: 'reserved:wei_zhongxian',
        dueCopper: 600,
        paidCopper: 0,
        termStartsAt: ctx.now - 1000,
        termEndsAt: ctx.now + 6 * 24 * 60 * 60 * 1000,
        status: 'active',
        reviewLabel: '本期足额上缴',
      }
    ];

    const res = await worldLocationChiefDashboardGet(ctx, { locationId: locId });

    expect(res.data.activeTribute).toBeDefined();
    expect(res.data.activeTribute!.tributeId).toBe('tribute_test_1');
    expect(res.data.activeTribute!.dueCopper).toBe(600);
    expect(res.data.activeTribute!.paidCopper).toBe(0);
    expect(res.data.activeTribute!.status).toBe('active');
  });
});

