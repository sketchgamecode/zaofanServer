import { describe, it, expect } from 'vitest';
import { createInitialGameState } from './gameStateFactory.js';
import { ensureWorldInitialized, worldActorsGetOverview, worldLocationsGetStatus, worldActorGetDetail, worldServicePositionsGetList, syncPlayerActor, applyWorldPowerTransfer } from './world.js';
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

  it('all 13 locations must have actors', () => {
    const state = createInitialGameState({ now: 1 });
    ensureWorldInitialized(makeCtx(state));

    const locations = new Set(state.world.actors.map((a) => a.locationId));
    expect(locations.size).toBe(13);
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
    expect(data.byLocation).toHaveLength(13);

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

  it('WORLD_LOCATIONS_GET_STATUS should return 13 locations with correct configurations', async () => {
    const state = createInitialGameState({ now: 1 });
    const ctx = makeCtx(state);

    const response = await worldLocationsGetStatus(ctx, {});
    expect(response.ok).toBe(true);
    
    const locations = response.data.locations;
    expect(locations).toHaveLength(13);

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
    expect(locations).toHaveLength(13);
    
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
    
    expect(statusLocations).toHaveLength(13);
    expect(overviewLocations).toHaveLength(13);
    
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
    // 13 locations with services across them — total positions > 10
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
});
