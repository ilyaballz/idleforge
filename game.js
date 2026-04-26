// ============================================================
// IDLE MINE - Core game logic
// All balance numbers live in balance/. This file wires mechanics.
// ============================================================

import { PLAYER, xpForLevel } from './balance/player.js';
import { ORES, ROCK_VARIATIONS, rockDamage, pickRockVariation, pickRockVariationByDepth } from './balance/ores.js';
import { PICKAXES } from './balance/pickaxes.js';
import { MOBS, mobMoveSpeed, BOSSES } from './balance/mobs.js';
import {
  SLOTS, SLOT_ORDER, RARITIES, getRarityByKey, pickSlotKey,
  rollItemStat, baseSellPrice, upgradeCost, upgradedStat,
  totalSellPrice, MAX_UPGRADE_LEVEL,
} from './balance/equipment.js';
import {
  forgeAttempts, forgeChances, bestOfN,
  forgeXP, playerCraftXP, xpForForgeLevel, availableRarities,
} from './balance/forge.js';
import { rollPerkOffer, formatPerk } from './balance/perks.js';
import {
  rollGemDropFromMob, rollGemDropFromRock, applyItemGemBonuses, rollGemAt,
  GEM_CAPS, GEM_TYPES, GEM_TIERS,
} from './balance/gems.js';
import {
  rollCrystalDrop, marketPrice, MARKET_SLOT_COUNT, MARKET_RARITY_WEIGHTS,
  MARKET_REFRESH_COST, MARKET_ROTATION_MS,
  gemMarketPrice, eggMarketPrice,
} from './balance/crystals.js';
import {
  PET_TYPES, PET_XP_SHARE, PET_MAX_LEVEL,
  WOLF_STACK_WINDOW_S, BLOCK_CHANCE_CAP,
  rollEggDrop, rollEgg, makePet, awardPetXp,
  petPrimaryValue, petSecondaryParams, eggSacrificeXP,
} from './balance/pets.js';

// ------------- World config (prototype) -------------
// Zones define the play-space; player moves between them through portals.
// Each zone has three difficulty layers:
//   1. Ambient rocks — free, scattered, base ore tier (no guards)
//   2. Outposts — procedurally placed, 1 guard + 1-2 rocks of the zone's
//      "upgrade" ore tier. Good quick-fight risk/reward.
//   3. Nests — hand-placed rich deposits: a pack of guards + a pile of
//      upgrade-tier rocks. Requires taking on a group.
//
// Zone fields of interest:
//   outposts — { count, mobTier, oreTier, rocksPer: [min,max] }
//   nests    — [{ x, y, radius, mobTier, count, oreTier, rockCount? }]
export const ZONES = {
  surface: {
    key: 'surface',
    name: 'Surface Quarry',
    width: 600,
    height: 900,
    maxRocks: 30,
    maxMobs: 10,
    rockRespawnMs: 40000,   // slow trickle — mine out the zone, then move deeper
    mobRespawnMs: 7000,
    oreTierWeights: [
      { tier: 0, weight: 100 }, // ambient is all Stone
    ],
    mobTiers: [0],             // Stone Golem only
    outposts: {
      // Surface stays solo: 1 guard/outpost — tutorial floor.
      // Guards defend Large Stone rocks — risk/reward is "more base ore per rock", not a new tier.
      count: 3, mobTier: 0, guards: 1, oreTier: 0, rocksPer: [1, 2], rockVariation: 'Large',
    },
    nests: [
      // Only source of Copper on Surface — ~2 crafts worth of Large Copper rocks,
      // gated by a pack of 4 Golems.
      { x: 120, y: 640, radius: 75, mobTier: 0, count: 4, oreTier: 1, rockCount: 4 },
    ],
    forgeBuilding: {
      x: 360, y: 120,
      size: 56, interactRadius: 70,
    },
    shopBuilding: {
      x: 220, y: 120,
      size: 54, interactRadius: 68,
    },
    portal: {
      x: 300, y: 820,
      size: 60, interactRadius: 70,
      toZone: 'mine1',
      requiresPickaxe: 1,
      label: 'COPPER MINE',
    },
    exitPortal: null,
    playerSpawn: { x: 300, y: 220 },
  },
  mine1: {
    key: 'mine1',
    name: 'Copper Mine',
    width: 600,
    height: 1600,
    maxRocks: 35,
    maxMobs: 18,                 // 4 outposts×2 guards + 2 nests×3 + boss
    rockRespawnMs: 25000,
    mobRespawnMs: 5000,
    oreTierWeights: [
      { tier: 1, weight: 100 }, // Copper — primary ore of this shaft
    ],
    mobTiers: [1],             // Copper Snake (main danger of this zone)
    outposts: {
      // Pack-spawn from Mine 1 onward: 2 guards/outpost share aggro.
      count: 4, mobTier: 1, guards: 2, oreTier: 1, rocksPer: [1, 2], rockVariation: 'Large',
    },
    nests: [
      // Only source of Iron in this zone — a couple crafts each, gated by a pack of snakes
      { x: 150, y: 550,  radius: 80, mobTier: 1, count: 3, oreTier: 2, rockCount: 3 },
      { x: 450, y: 1100, radius: 80, mobTier: 1, count: 3, oreTier: 2, rockCount: 3 },
    ],
    // Boss — sits before the portal, gating the descent. First kill drops a guaranteed egg.
    boss: { key: 'king_snake', x: 300, y: 1350 },
    forgeBuilding: {
      x: 300, y: 100,       // center top
      size: 50, interactRadius: 70,
    },
    shopBuilding: {
      x: 500, y: 100,       // right of forge
      size: 48, interactRadius: 68,
    },
    portal: {
      x: 300, y: 1520,
      size: 60, interactRadius: 70,
      toZone: 'mine2',
      requiresPickaxe: 2,
      label: 'IRON DEPTHS',
    },
    exitPortal: {
      x: 100, y: 100,       // left of forge
      size: 56, interactRadius: 70,
      toZone: 'surface',
      requiresPickaxe: 0,
      label: 'EXIT TO SURFACE',
    },
    playerSpawn: { x: 300, y: 240 },
  },
  mine2: {
    key: 'mine2',
    name: 'Iron Depths',
    width: 600,
    height: 2800,
    maxRocks: 45,
    maxMobs: 22,                 // 5 outposts×2 guards + 3 nests×3
    rockRespawnMs: 18000,
    mobRespawnMs: 4500,
    oreTierWeights: [
      { tier: 2, weight: 100 }, // Iron — primary ore
    ],
    mobTiers: [2],             // Iron Knight
    outposts: {
      count: 5, mobTier: 2, guards: 2, oreTier: 2, rocksPer: [1, 2], rockVariation: 'Large',
    },
    nests: [
      { x: 150, y: 650,  radius: 85, mobTier: 2, count: 3, oreTier: 3, rockCount: 3 },
      { x: 450, y: 1400, radius: 85, mobTier: 2, count: 3, oreTier: 3, rockCount: 3 },
      { x: 200, y: 2150, radius: 85, mobTier: 2, count: 3, oreTier: 3, rockCount: 3 },
    ],
    // Iron Warlord guards the descent to Silver Depths.
    boss: { key: 'iron_warlord', x: 300, y: 2530 },
    forgeBuilding: {
      x: 300, y: 100,
      size: 50, interactRadius: 70,
    },
    shopBuilding: {
      x: 500, y: 100,
      size: 48, interactRadius: 68,
    },
    portal: {
      x: 300, y: 2720,
      size: 60, interactRadius: 70,
      toZone: 'mine3',
      requiresPickaxe: 3,
      label: 'SILVER DEPTHS',
    },
    exitPortal: {
      x: 100, y: 100,
      size: 56, interactRadius: 70,
      toZone: 'mine1',
      requiresPickaxe: 0,
      label: 'BACK TO COPPER MINE',
    },
    playerSpawn: { x: 300, y: 240 },
  },
  mine3: {
    key: 'mine3',
    name: 'Silver Depths',
    width: 600,
    height: 3800,
    maxRocks: 48,
    maxMobs: 28,                 // 5 outposts×3 guards + 3 nests×3
    rockRespawnMs: 14000,
    mobRespawnMs: 4200,
    oreTierWeights: [
      { tier: 3, weight: 100 }, // Silver — primary ore
    ],
    mobTiers: [3],             // Werewolf
    outposts: {
      count: 5, mobTier: 3, guards: 3, oreTier: 3, rocksPer: [1, 2], rockVariation: 'Large',
    },
    nests: [
      { x: 150, y: 850,  radius: 95, mobTier: 3, count: 3, oreTier: 4, rockCount: 3 },
      { x: 450, y: 1700, radius: 95, mobTier: 3, count: 3, oreTier: 4, rockCount: 3 },
      { x: 200, y: 2650, radius: 95, mobTier: 3, count: 3, oreTier: 4, rockCount: 3 },
    ],
    // Alpha Werewolf — endgame trophy of the prototype, sits before the locked portal.
    boss: { key: 'alpha_werewolf', x: 300, y: 3530 },
    forgeBuilding: {
      x: 300, y: 100,
      size: 50, interactRadius: 70,
    },
    shopBuilding: {
      x: 500, y: 100,
      size: 48, interactRadius: 68,
    },
    portal: {
      x: 300, y: 3720,
      size: 60, interactRadius: 70,
      toZone: 'mine3',
      requiresPickaxe: 999,   // unreachable — future Emerald zone
      label: 'DEEPER (LOCKED)',
    },
    exitPortal: {
      x: 100, y: 100,
      size: 56, interactRadius: 70,
      toZone: 'mine2',
      requiresPickaxe: 0,
      label: 'BACK TO IRON DEPTHS',
    },
    playerSpawn: { x: 300, y: 240 },
  },
};

// Current world state is derived from the active zone.
// WORLD is kept as a live reference that ui.js reads — we mutate its fields
// when the zone changes.
export const WORLD = {
  width: ZONES.surface.width,
  height: ZONES.surface.height,
  viewW: 390,
  viewH: 844,
  maxRocks: ZONES.surface.maxRocks,
  maxMobs: ZONES.surface.maxMobs,
  rockRespawnMs: ZONES.surface.rockRespawnMs,
  mobRespawnMs: ZONES.surface.mobRespawnMs,
  baseOreTier: 0,
  forgeBuilding: ZONES.surface.forgeBuilding,
  shopBuilding: ZONES.surface.shopBuilding,
  portal: ZONES.surface.portal,
  exitPortal: null,
  zoneKey: 'surface',
};

function applyZone(state, zoneKey) {
  const z = ZONES[zoneKey];
  WORLD.width = z.width;
  WORLD.height = z.height;
  WORLD.maxRocks = z.maxRocks;
  WORLD.maxMobs = z.maxMobs;
  WORLD.rockRespawnMs = z.rockRespawnMs;
  WORLD.mobRespawnMs = z.mobRespawnMs;
  WORLD.forgeBuilding = z.forgeBuilding;
  WORLD.shopBuilding = z.shopBuilding || null;
  WORLD.portal = z.portal;
  WORLD.exitPortal = z.exitPortal || null;
  WORLD.zoneKey = z.key;
  state.currentZone = z.key;
  state.rocks = [];
  state.mobs = [];
  state.rockSpawnTimer = 0;
  state.mobSpawnTimer = 0;
  state.player.x = z.playerSpawn.x;
  state.player.y = z.playerSpawn.y;
  state.player.target = null;
  state.player.priorityMobId = null;
  state.player.priorityMobTimer = 0;
}

export function travelToZone(state, zoneKey) {
  const z = ZONES[zoneKey];
  if (!z) return { ok: false, reason: 'Unknown zone' };
  applyZone(state, zoneKey);
  seedNests(state);
  seedOutposts(state);
  seedBoss(state);
  // Seed the zone full — it's a finite deposit, respawn is a slow trickle
  fillAmbientRocks(state, WORLD.maxRocks);
  state.log.unshift(`🗺 Entered ${z.name}`);
  trimLog(state);
  return { ok: true };
}

// Seed the zone's boss if it has one. Boss respawns each visit, but first-kill
// reward (guaranteed egg) only triggers once (tracked in player.bossesKilled).
function seedBoss(state) {
  const zone = ZONES[state.currentZone];
  if (!zone.boss) return;
  spawnBossAt(state, zone.boss.x, zone.boss.y, zone.boss.key);
}

function spawnBossAt(state, x, y, bossKey) {
  const tpl = BOSSES[bossKey];
  if (!tpl) return;
  state.mobs.push({
    id: uid(), kind: 'mob',
    x, y,
    tpl,
    hp: tpl.hp, maxHp: tpl.hp,
    damage: tpl.damage, attackSpeed: tpl.attackSpeed,
    reward: tpl.reward, aggroRadius: tpl.aggroRadius,
    homeX: x, homeY: y,
    attackTimer: 0,
    color: tpl.color, size: tpl.size,
    hitFlash: 0,
    isGuardian: true,
    isBoss: true,
    bossKey,                // for first-kill tracking
    moveSpeed: tpl.moveSpeed || mobMoveSpeed,
    groupId: null,
    alertedTimer: 0,
  });
}

// Seed designed "nests" — guarded ore veins.
function seedNests(state) {
  const zone = ZONES[state.currentZone];
  if (!zone.nests || !zone.nests.length) return;
  for (const [nestIdx, nest] of zone.nests.entries()) {
    // Each nest forms a chain-aggro group: damage to any guardian alerts the rest.
    const groupId = `nest_${state.currentZone}_${nestIdx}`;
    // Guardian mobs around the nest
    for (let i = 0; i < nest.count; i++) {
      if (state.mobs.length >= WORLD.maxMobs) break;
      const angle = (Math.PI * 2 * i) / nest.count + Math.random() * 0.4;
      const r = nest.radius * (0.6 + Math.random() * 0.3);
      const x = clamp(nest.x + Math.cos(angle) * r, 30, WORLD.width - 30);
      const y = clamp(nest.y + Math.sin(angle) * r, 30, WORLD.height - 30);
      spawnMobAt(state, x, y, nest.mobTier, groupId);
    }
    // Treasure rocks around the nest centre on an evenly-spaced ring.
    // Nests always contain Large rocks (bigger drops) unless the zone overrides —
    // this gates the next-tier ore behind a group fight and gives enough drops
    // to craft with. Small fallback kicks in if a big rock won't fit the ring.
    const rockCount = nest.rockCount ?? (2 + Math.floor(Math.random() * 2));
    const nestVariation = nest.rockVariation
      ? ROCK_VARIATIONS.find(v => v.key === nest.rockVariation)
      : ROCK_VARIATIONS.find(v => v.key === 'Large');
    for (let i = 0; i < rockCount; i++) {
      if (state.rocks.length >= WORLD.maxRocks) break;
      let variation = nestVariation || pickRockVariation();
      const baseAngle = (Math.PI * 2 * i) / rockCount;
      let x, y, placed = false;
      for (let attempt = 0; attempt < 15; attempt++) {
        const angle = baseAngle + (Math.random() - 0.5) * 0.6;
        const r = nest.radius * (0.5 + Math.random() * 0.35);
        x = clamp(nest.x + Math.cos(angle) * r, 30, WORLD.width - 30);
        y = clamp(nest.y + Math.sin(angle) * r, 30, WORLD.height - 30);
        if (!rockOverlaps(state, x, y, variation.size)) {
          placed = true;
          break;
        }
      }
      if (!placed) {
        // Nest is too cramped for the rolled variation — drop to the smallest.
        variation = ROCK_VARIATIONS[0];
      }
      spawnRockAt(state, x, y, nest.oreTier, variation);
    }
  }
}

// Seed small outposts — one guard + 1-2 treasure rocks. Procedurally placed,
// kept away from nests and other outposts so the layout reads as distinct encounters.
// On tall shaft zones, outposts are distributed into vertical bands so the
// player encounters them as they descend — not all clumped near spawn.
function seedOutposts(state) {
  const zone = ZONES[state.currentZone];
  const spec = zone.outposts;
  if (!spec || !spec.count) return;

  const placed = [];
  const minOutpostSpacing = 150;
  const nestClearance = 80;

  // Pre-resolve the outpost rock variation if the zone fixes one (e.g. 'Large').
  const fixedVariation = spec.rockVariation
    ? ROCK_VARIATIONS.find(v => v.key === spec.rockVariation)
    : null;

  // Vertical band boundaries — keep outposts out of the top buildings area and
  // the bottom portal area. Anchors are skewed toward the deeper end so the
  // mob density rises as the player descends (forge area stays calm).
  const topBuffer = 260;
  const bottomBuffer = 140;
  const usableH = Math.max(100, WORLD.height - topBuffer - bottomBuffer);
  const bandTol = (usableH / spec.count) * 0.6;
  const guardCount = spec.guards ?? 1;

  for (let i = 0; i < spec.count; i++) {
    if (state.mobs.length >= WORLD.maxMobs) break;

    // Density-gradient: t^0.75 leans anchors toward the deeper end while still
    // letting at least one outpost land near the top of the zone.
    const t = spec.count > 1 ? (i + 0.5) / spec.count : 0.5;
    const bandCenterY = topBuffer + usableH * Math.pow(t, 0.75);

    let pos = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = safeSpawnPoint(state, 140);
      // Prefer a candidate inside this outpost's vertical band.
      if (Math.abs(candidate.y - bandCenterY) > bandTol) continue;
      const tooCloseToOutpost = placed.some(p => dist(candidate, p) < minOutpostSpacing);
      const tooCloseToNest = (zone.nests || []).some(n => dist(candidate, n) < n.radius + nestClearance);
      if (!tooCloseToOutpost && !tooCloseToNest) { pos = candidate; break; }
    }
    if (!pos) pos = safeSpawnPoint(state, 140);
    placed.push(pos);

    // Pack of guards — they share a chain-aggro group, ringed around the anchor
    // so the player visually reads them as a unit.
    const groupId = `outpost_${state.currentZone}_${i}`;
    const ringR = guardCount > 1 ? 24 : 0;
    for (let g = 0; g < guardCount; g++) {
      if (state.mobs.length >= WORLD.maxMobs) break;
      const angle = (Math.PI * 2 * g) / Math.max(1, guardCount) + Math.random() * 0.3;
      const gx = clamp(pos.x + Math.cos(angle) * ringR, 30, WORLD.width - 30);
      const gy = clamp(pos.y + Math.sin(angle) * ringR, 30, WORLD.height - 30);
      spawnMobAt(state, gx, gy, spec.mobTier, groupId);
    }

    const [rMin, rMax] = spec.rocksPer || [1, 2];
    const rockCount = randInt(rMin, rMax);
    for (let j = 0; j < rockCount; j++) {
      if (state.rocks.length >= WORLD.maxRocks) break;
      let variation = fixedVariation || pickRockVariation();
      let rockX = pos.x, rockY = pos.y, ok = false;
      for (let attempt = 0; attempt < 15; attempt++) {
        const angle = (Math.PI * 2 * j) / Math.max(1, rockCount) + (Math.random() - 0.5) * 0.8;
        const r = 38 + Math.random() * 22;
        rockX = clamp(pos.x + Math.cos(angle) * r, 30, WORLD.width - 30);
        rockY = clamp(pos.y + Math.sin(angle) * r, 30, WORLD.height - 30);
        if (!rockOverlaps(state, rockX, rockY, variation.size)) { ok = true; break; }
      }
      if (!ok) variation = ROCK_VARIATIONS[0];
      spawnRockAt(state, rockX, rockY, spec.oreTier, variation);
    }
  }
}

// ------------- Utils -------------
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
const dist = (a, b) => Math.sqrt(dist2(a, b));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let _id = 1;
const uid = () => _id++;

// Does a rock of given size placed at (x,y) overlap any existing rock?
// pad keeps a small visible gap between neighbours.
function rockOverlaps(state, x, y, size, pad = 4) {
  for (const r of state.rocks) {
    const dx = x - r.x, dy = y - r.y;
    const minD = size + r.size + pad;
    if (dx * dx + dy * dy < minD * minD) return true;
  }
  return false;
}

function pushFloat(state, x, y, text, color = '#fff') {
  state.floatingTexts.push({
    x, y, text, color,
    life: 0, maxLife: 0.9,
    vy: -28,
  });
}

// ------------- Game state -------------
function makeStarterWeapon() {
  const ore = ORES[0]; // Stone
  const rarity = getRarityByKey('Common');
  const stat = rollItemStat(ore.value, 'weapon', 'Common');
  return {
    id: uid(),
    slot: 'weapon',
    rarity: 'Common',
    rarityColor: rarity.color,
    stat,
    baseStat: stat,
    upgradeLevel: 0,
    totalUpgradeCost: 0,
    baseSellPrice: baseSellPrice(ore.value, 'Common'),
    sockets: 0,
    gems: [],
    oreName: ore.name,
  };
}

export function createState() {
  return {
    t: 0,                // elapsed seconds
    camera: { x: 0, y: 0 },
    currentZone: 'surface',
    player: {
      x: ZONES.surface.playerSpawn.x,
      y: ZONES.surface.playerSpawn.y,
      hp: PLAYER.hp,
      maxHp: PLAYER.hp,
      level: 1,
      xp: 0,
      gold: 0,
      crystals: 0,                // hard currency — drops from rocks
      ore: 20,                    // total ore (sum of oreByTier), kept for backward-compat
      oreByTier: [20, 0, 0, 0, 0, 0],  // index matches ORES[tier]
      selectedOreTier: 0,        // which ore to use in the forge
      moveX: 0, moveY: 0,        // joystick input (-1..1)
      attackTimer: 0,
      mineTimer: 0,
      target: null,              // { type: 'rock'|'mob', id } — computed each frame
      // Retaliation: if a mob hits us, prioritize it over nearby rocks for a short window.
      priorityMobId: null,
      priorityMobTimer: 0,       // seconds remaining
      // Perks: accumulators of bonus values
      perks: {
        combat_dmg: 0, crit_chance: 0, crit_mult: 0,
        atk_speed_pct: 0, max_hp_pct: 0, hp_regen_pct: 0,
        dodge_pct: 0, lifesteal_pct: 0,
        mining_dmg: 0, gold_bonus: 0, xp_bonus: 0,
      },
      pickaxeTier: 0,
      equipped: { weapon: makeStarterWeapon(), ring: null, armor: null, helmet: null },
      inventory: [],             // items not equipped
      gemInventory: [],          // {key, name, color, sellValue, bonus} copies, one per drop
      // Pets — at most one active companion. `pets` is the bench (incl. unhatched eggs).
      activePet: null,           // { type, rarity, level, xp, ... }
      pets: [],                  // [{ ...pet }] — inactive pets
      eggs: [],                  // [{ kind:'egg', type, rarity, name, color }]
      // Wolf stack tracker — atk-speed bonus per recent crit, decays after WOLF_STACK_WINDOW_S.
      petWolfStacks: 0,          // current stack count
      petWolfStackTimer: 0,      // seconds since last crit
      // Smoothed pet follower position (rendered, not gameplay).
      petPos: { x: ZONES.surface.playerSpawn.x - 24, y: ZONES.surface.playerSpawn.y },
      // First-kill flags per boss key — guarantees an egg only once per save.
      bossesKilled: {},
    },
    rocks: [],
    mobs: [],
    rockSpawnTimer: 0,
    mobSpawnTimer: 0,
    forge: { level: 1, xp: 0 },
    pendingLevelUps: 0,
    currentPerkOffer: null,
    lastCraftedItem: null,     // set after successful craft, UI shows compare popup
    log: [],
    paused: false,
    floatingTexts: [],       // {x,y,text,color,life,maxLife,vy}
    nearForge: false,        // is player near the forge building?
    nearShop: false,         // is player near the shop building?
    nearPortal: false,       // is player near the main portal?
    nearExitPortal: false,   // is player near the exit portal (mines only)?
    market: null,            // { items: [...], nextRotationAt: timestamp } — rolled on first shop open
  };
}

// ------------- Derived player stats -------------
export function getPlayerStats(p) {
  const pick = PICKAXES[p.pickaxeTier];

  // Accumulate gem bonuses from every equipped item.
  const gemBonus = {};
  for (const slotKey of ['weapon', 'ring', 'armor', 'helmet']) {
    applyItemGemBonuses(p.equipped[slotKey], slotKey, gemBonus);
  }

  // Pet contribution — only the active pet matters.
  const pet = p.activePet;
  const petPrimary = pet ? petPrimaryValue(pet) : 0;
  const petParams  = pet ? petSecondaryParams(pet) : null;
  // Wolf: primary = +crit dmg %, secondary = stacking +atk speed % per crit (live).
  const wolfCritDmg = pet?.type === 'wolf' ? petPrimary : 0;
  const wolfStackAtkSpd = pet?.type === 'wolf' && petParams
    ? Math.min(p.petWolfStacks * petParams.perStack, petParams.maxStack)
    : 0;
  // Bat: primary = +lifesteal % (added to perk lifesteal). Double-hit handled in attackMob.
  const batLifesteal = pet?.type === 'bat' ? petPrimary : 0;
  // Fairy: primary = +hp_regen_pct_max (added to gem channel). Hi-HP dmg bonus computed live.
  const fairyRegen = pet?.type === 'fairy' ? petPrimary : 0;
  // Golem: primary = block chance, secondary = counter dmg multiplier (used in updateMob).
  const golemBlock = pet?.type === 'golem' ? Math.min(BLOCK_CHANCE_CAP, petPrimary) : 0;

  // maxHp depends only on equipment + perks/gems — compute first so Fairy hi-HP check can use it.
  const eqHp = (p.equipped.armor?.stat || 0) + (p.equipped.helmet?.stat || 0);
  const maxHp = (PLAYER.hp + eqHp) * (1 + p.perks.max_hp_pct + (gemBonus.max_hp_pct || 0));
  const hpRatio = maxHp > 0 ? p.hp / maxHp : 1;
  const fairyHiHpBonus = (pet?.type === 'fairy' && petParams && hpRatio > 0.80)
    ? petParams.hiHpDmg : 0;

  const bonusDamage = p.perks.combat_dmg + (gemBonus.combat_dmg || 0) + fairyHiHpBonus;
  const eqDamage = (p.equipped.weapon?.stat || 0) + (p.equipped.ring?.stat || 0);
  const totalDamage = (PLAYER.damage + eqDamage) * (1 + bonusDamage);
  // Armor/helmet HP grants flat regen: 1 HP/sec per 100 bonus HP from equipment.
  const eqRegen = Math.floor(eqHp / 100);
  // Emerald-armor gems and Fairy add regen as % of maxHp per sec.
  const gemRegen = maxHp * ((gemBonus.hp_regen_pct_max || 0) + fairyRegen);
  const dr = Math.min(
    GEM_CAPS.damage_reduction,
    gemBonus.damage_reduction || 0,
  );

  return {
    damage: totalDamage,
    attackSpeed: PLAYER.attackSpeed
      * (1 + p.perks.atk_speed_pct + (gemBonus.atk_speed_pct || 0) + wolfStackAtkSpd),
    critChance: clamp(PLAYER.critChance + p.perks.crit_chance + (gemBonus.crit_chance || 0), 0, 1),
    critMultiplier: PLAYER.critMultiplier + p.perks.crit_mult + wolfCritDmg,
    maxHp,
    hpRegen: (PLAYER.hpRegen + eqRegen) * (1 + p.perks.hp_regen_pct) + gemRegen,
    damageReduction: dr,
    attackRadius: PLAYER.attackRadius,
    mineRadius: PLAYER.mineRadius,
    pickaxeDamage: pick.damage * (1 + p.perks.mining_dmg),
    pickaxeSpeed: pick.speed * (1 + p.perks.atk_speed_pct + (gemBonus.atk_speed_pct || 0) + wolfStackAtkSpd),
    dodge: clamp(p.perks.dodge_pct, 0, 0.75),
    lifesteal: p.perks.lifesteal_pct + batLifesteal,
    goldBonus: p.perks.gold_bonus,
    xpBonus: p.perks.xp_bonus,
    blockChance: golemBlock,
    blockCounterMult: (pet?.type === 'golem' && petParams) ? petParams.counterMult : 0,
    batDoubleHit: (pet?.type === 'bat' && petParams) ? petParams.doubleHit : 0,
    power: 0, // filled below
  };
}

// Combat-only power: geometric mean of DPS and effective HP.
// Keeps player and mobs on the same scale for balance tuning — a group
// whose summed power matches the player's should be a meaningful threat.
export function computePower(p) {
  const s = getPlayerStats(p);
  const dps = s.damage * s.attackSpeed * (1 + s.critChance * (s.critMultiplier - 1));
  const ehp = s.maxHp / ((1 - s.dodge) * (1 - s.damageReduction));
  return Math.round(Math.sqrt(dps * ehp));
}

export function computeMobPower(mob) {
  const dps = mob.damage * mob.attackSpeed;
  const ehp = mob.maxHp;
  return Math.round(Math.sqrt(dps * ehp));
}

// ------------- Spawning -------------
function safeSpawnPoint(state, minDistFromPlayer = 80, opts = {}) {
  const { avoidNear = null, rockSize = 0 } = opts;
  const fb = WORLD.forgeBuilding;
  const sb = WORLD.shopBuilding;
  const portal = WORLD.portal;
  const exitPortal = WORLD.exitPortal;
  for (let i = 0; i < 30; i++) {
    const x = rand(30, WORLD.width - 30);
    const y = rand(30, WORLD.height - 30);
    if (dist({ x, y }, state.player) < minDistFromPlayer) continue;
    if (fb && dist({ x, y }, fb) < fb.size + 40) continue;
    if (sb && dist({ x, y }, sb) < sb.size + 40) continue;
    if (portal && dist({ x, y }, portal) < portal.size + 40) continue;
    if (exitPortal && dist({ x, y }, exitPortal) < exitPortal.size + 40) continue;
    if (avoidNear && dist({ x, y }, avoidNear) < 40) continue;
    if (rockSize > 0 && rockOverlaps(state, x, y, rockSize)) continue;
    return { x, y };
  }
  return { x: rand(30, WORLD.width - 30), y: rand(30, WORLD.height - 30) };
}

function pickOreTierForRock(state) {
  const zone = ZONES[state.currentZone];
  const weights = zone.oreTierWeights || [{ tier: 0, weight: 1 }];
  const total = weights.reduce((s, w) => s + w.weight, 0);
  const r = Math.random() * total;
  let acc = 0;
  for (const w of weights) {
    acc += w.weight;
    if (r <= acc) return w.tier;
  }
  return weights[weights.length - 1].tier;
}

function mobTierForCurrentZone(state) {
  const zone = ZONES[state.currentZone];
  const allowed = zone.mobTiers || [0];
  // Pick uniformly at random from the allowed mob tiers.
  return allowed[randInt(0, allowed.length - 1)];
}

// Push a rock into state — small helper to avoid duplicating the boilerplate
// across deposit / single / nest spawners.
function pushRock(state, x, y, ore, variation) {
  const hp = Math.floor(ore.hp * variation.hpMult);
  state.rocks.push({
    id: uid(), kind: 'rock',
    x, y,
    ore, variation,
    hp, maxHp: hp,
    size: variation.size,
    hitFlash: 0,
  });
}

// Pick the "lead" rock of a deposit: never Small. Deeper deposits are more
// likely led by a Large boulder; shallow deposits lead with Stone.
function pickLeadVariation(depthFrac) {
  const d = Math.max(0, Math.min(1, depthFrac));
  const largeChance = 0.30 + 0.50 * d;     // top 30% / bottom 80%
  return Math.random() < largeChance ? ROCK_VARIATIONS[2] : ROCK_VARIATIONS[1];
}

// Spawn a "deposit" — one lead rock with 2-4 smaller satellites tucked around
// it. Reads as a natural ore vein instead of random scatter.
function spawnRockDeposit(state, anchor) {
  if (state.rocks.length >= WORLD.maxRocks) return 0;

  const depthFrac = WORLD.height > 0 ? anchor.y / WORLD.height : 0.5;
  let leadV = pickLeadVariation(depthFrac);
  // If even the lead doesn't fit, drop to Stone, then Small. If still won't
  // fit, abandon the deposit — caller will move on to the next anchor.
  if (rockOverlaps(state, anchor.x, anchor.y, leadV.size)) leadV = ROCK_VARIATIONS[1];
  if (rockOverlaps(state, anchor.x, anchor.y, leadV.size)) leadV = ROCK_VARIATIONS[0];
  if (rockOverlaps(state, anchor.x, anchor.y, leadV.size)) return 0;

  const ore = ORES[pickOreTierForRock(state)];
  pushRock(state, anchor.x, anchor.y, ore, leadV);
  let placed = 1;

  // Satellites — Small dominates, occasional Stone. Same ore tier as the lead
  // so a deposit is a single visual "vein".
  const satCount = randInt(2, 4);
  for (let i = 0; i < satCount; i++) {
    if (state.rocks.length >= WORLD.maxRocks) break;
    const isSmall = Math.random() < 0.65;
    let satV = isSmall ? ROCK_VARIATIONS[0] : ROCK_VARIATIONS[1];
    let placedSat = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = (Math.PI * 2 * i) / satCount + (Math.random() - 0.5) * 0.7;
      const gap = leadV.size * 0.5 + satV.size * 0.5 + 6 + Math.random() * 12;
      const sx = clamp(anchor.x + Math.cos(angle) * gap, 30, WORLD.width - 30);
      const sy = clamp(anchor.y + Math.sin(angle) * gap, 30, WORLD.height - 30);
      if (dist({ x: sx, y: sy }, state.player) < 60) continue;
      if (rockOverlaps(state, sx, sy, satV.size)) continue;
      pushRock(state, sx, sy, ore, satV);
      placed++;
      placedSat = true;
      break;
    }
    // Tight spot — try once more with a guaranteed-Small satellite.
    if (!placedSat && satV !== ROCK_VARIATIONS[0]) {
      satV = ROCK_VARIATIONS[0];
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const gap = leadV.size * 0.5 + satV.size * 0.5 + 4 + Math.random() * 10;
        const sx = clamp(anchor.x + Math.cos(angle) * gap, 30, WORLD.width - 30);
        const sy = clamp(anchor.y + Math.sin(angle) * gap, 30, WORLD.height - 30);
        if (dist({ x: sx, y: sy }, state.player) < 60) continue;
        if (rockOverlaps(state, sx, sy, satV.size)) continue;
        pushRock(state, sx, sy, ore, satV);
        placed++;
        break;
      }
    }
  }
  return placed;
}

// Spawn a single rock — used for respawns. Variation is depth-biased so a
// fresh respawn fits the local ore-density feel.
export function spawnRock(state, anchor = null) {
  if (state.rocks.length >= WORLD.maxRocks) return;
  const maxRockSize = ROCK_VARIATIONS[ROCK_VARIATIONS.length - 1].size;
  let pos;
  if (anchor) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = rand(30, 70);
      const x = clamp(anchor.x + Math.cos(angle) * r, 30, WORLD.width - 30);
      const y = clamp(anchor.y + Math.sin(angle) * r, 30, WORLD.height - 30);
      if (dist({ x, y }, state.player) < 60) continue;
      if (rockOverlaps(state, x, y, maxRockSize)) continue;
      pos = { x, y };
      break;
    }
    if (!pos) pos = safeSpawnPoint(state, 60, { rockSize: ROCK_VARIATIONS[0].size });
  } else {
    pos = safeSpawnPoint(state, 60, { rockSize: maxRockSize });
  }

  const depthFrac = WORLD.height > 0 ? pos.y / WORLD.height : 0.5;
  let variation = pickRockVariationByDepth(depthFrac);
  if (rockOverlaps(state, pos.x, pos.y, variation.size)) variation = ROCK_VARIATIONS[0];

  const ore = ORES[pickOreTierForRock(state)];
  pushRock(state, pos.x, pos.y, ore, variation);
}

// Fill a zone with ambient rocks at zone-load — deposits first, top up with
// singles to hit the exact target if the last deposit overshoots a slot.
function fillAmbientRocks(state, targetCount) {
  let safety = 80;
  while (state.rocks.length < targetCount && safety-- > 0) {
    const remaining = targetCount - state.rocks.length;
    if (remaining >= 3) {
      const anchor = safeSpawnPoint(state, 80);
      const placed = spawnRockDeposit(state, anchor);
      if (placed === 0) spawnRock(state); // anchor too cramped — bail with a single
    } else {
      spawnRock(state);
    }
  }
}

// Spawn a rock at a specific position with a specific ore tier (used by nests).
// `variation` is optional — when given, use it directly (caller already picked one
// to do a size-aware overlap check).
function spawnRockAt(state, x, y, oreTier, variation = null) {
  if (state.rocks.length >= WORLD.maxRocks) return;
  const v = variation || pickRockVariation();
  const ore = ORES[oreTier] || ORES[0];
  const hp = Math.floor(ore.hp * v.hpMult);
  state.rocks.push({
    id: uid(), kind: 'rock',
    x, y,
    ore, variation: v,
    hp, maxHp: hp,
    size: v.size,
    hitFlash: 0,
  });
}

// Spawn a mob at a specific position with a specific tier (used by nests).
// groupId binds pack/nest mates so chain-aggro alerts the whole group when
// any member takes damage (see alertGroup).
function spawnMobAt(state, x, y, tier, groupId = null) {
  if (state.mobs.length >= WORLD.maxMobs) return;
  const tpl = MOBS[tier] || MOBS[0];
  state.mobs.push({
    id: uid(), kind: 'mob',
    x, y,
    tpl,
    hp: tpl.hp, maxHp: tpl.hp,
    damage: tpl.damage, attackSpeed: tpl.attackSpeed,
    reward: tpl.reward, aggroRadius: tpl.aggroRadius,
    homeX: x, homeY: y,
    attackTimer: 0,
    color: tpl.color, size: tpl.size,
    hitFlash: 0,
    isGuardian: true,        // stays near its spawn (used by updateMob)
    groupId,                 // chain-aggro pack id (null = solo mob)
    alertedTimer: 0,         // sec remaining of forced aggro from chain
  });
}

export function spawnMob(state) {
  if (state.mobs.length >= WORLD.maxMobs) return;
  const tpl = MOBS[mobTierForCurrentZone(state)];
  const { x, y } = safeSpawnPoint(state, 140);
  state.mobs.push({
    id: uid(), kind: 'mob',
    x, y,
    tpl,
    hp: tpl.hp, maxHp: tpl.hp,
    damage: tpl.damage, attackSpeed: tpl.attackSpeed,
    reward: tpl.reward, aggroRadius: tpl.aggroRadius,
    homeX: x, homeY: y,
    attackTimer: 0,
    color: tpl.color, size: tpl.size,
    hitFlash: 0,
  });
}

// ------------- Targeting -------------
// Cell-by-cell: each frame pick a target from entities within range.
// Priority:
//   1. "Retaliation" mob (one that recently hit us) — within attackRadius
//   2. Nearest mob within attackRadius
//   3. Nearest rock within mineRadius (measured from entity edge)

function nearestMobInRadius(state, radius) {
  const r2 = radius * radius;
  let best = null, bd = Infinity;
  for (const m of state.mobs) {
    const d = dist2(m, state.player);
    if (d <= r2 && d < bd) { bd = d; best = m; }
  }
  return best;
}

function nearestRockInReach(state, reach) {
  const p = state.player;
  let best = null, bd = Infinity;
  for (const r of state.rocks) {
    // Distance from player edge to rock edge.
    const d = dist(r, p) - (p.size / 2 + r.size);
    if (d <= reach && d < bd) { bd = d; best = r; }
  }
  return best;
}

function findTarget(state) {
  const p = state.player;
  const stats = getPlayerStats(p);

  // 1. Retaliation window: if a mob recently hit us and is still within reach, prioritize it.
  if (p.priorityMobId && p.priorityMobTimer > 0) {
    const mob = state.mobs.find(m => m.id === p.priorityMobId);
    if (mob && dist(p, mob) <= stats.attackRadius) {
      return { type: 'mob', ref: mob };
    }
    // Either dead or out of range — forget.
    if (!mob) {
      p.priorityMobId = null;
      p.priorityMobTimer = 0;
    }
  }

  // 2. Nearest mob within attack radius
  const mob = nearestMobInRadius(state, stats.attackRadius);
  if (mob) return { type: 'mob', ref: mob };

  // 3. Nearest rock within mine reach
  const rock = nearestRockInReach(state, stats.mineRadius);
  if (rock) return { type: 'rock', ref: rock };

  return null;
}

// ------------- Combat & Mining -------------
function rollCrit(stats) {
  return Math.random() < stats.critChance ? stats.critMultiplier : 1;
}

// Chain-aggro: damaging any group member alerts the rest. Alerted mobs
// override the aggroRadius check and chase the player for ALERT_DURATION sec.
const ALERT_DURATION = 6.0;
function alertGroup(state, mob) {
  if (!mob.groupId) return;
  for (const m of state.mobs) {
    if (m === mob) continue;
    if (m.groupId === mob.groupId && m.hp > 0) {
      m.alertedTimer = ALERT_DURATION;
    }
  }
}

function attackMob(state, mob, dt) {
  const p = state.player;
  const stats = getPlayerStats(p);
  p.attackTimer += dt;
  const period = 1 / stats.attackSpeed;
  while (p.attackTimer >= period) {
    p.attackTimer -= period;
    // Bat: chance to swing twice in one tick.
    const hits = (stats.batDoubleHit && Math.random() < stats.batDoubleHit) ? 2 : 1;
    for (let h = 0; h < hits; h++) {
      const critMult = rollCrit(stats);
      const dmg = stats.damage * critMult;
      mob.hp -= dmg;
      mob.hitFlash = 0.15;  // seconds
      alertGroup(state, mob);
      const isCrit = critMult > 1;
      pushFloat(state, mob.x, mob.y - mob.size / 2,
        (isCrit ? '✦' : '') + Math.floor(dmg),
        isCrit ? '#ffd54a' : '#ffffff');
      if (stats.lifesteal > 0) {
        p.hp = Math.min(stats.maxHp, p.hp + dmg * stats.lifesteal);
      }
      // Wolf: refresh atk-speed stack on crit (capped inside getPlayerStats).
      if (isCrit && p.activePet?.type === 'wolf') {
        const params = petSecondaryParams(p.activePet);
        const maxStacks = params ? Math.ceil(params.maxStack / params.perStack) : 0;
        if (p.petWolfStacks < maxStacks) p.petWolfStacks++;
        p.petWolfStackTimer = 0;
      }
      if (mob.hp <= 0) {
        onMobKilled(state, mob);
        return;
      }
    }
  }
}

function mineRock(state, rock, dt) {
  const p = state.player;
  const stats = getPlayerStats(p);
  p.mineTimer += dt;
  const period = 1 / stats.pickaxeSpeed;
  while (p.mineTimer >= period) {
    p.mineTimer -= period;
    const dmg = rockDamage(stats.pickaxeDamage, rock.ore.def);
    rock.hp -= dmg;
    rock.hitFlash = 0.12;
    if (rock.hp <= 0) {
      onRockBroken(state, rock);
      return;
    }
  }
}

function onRockBroken(state, rock) {
  const p = state.player;
  const dropCount = randInt(rock.variation.dropMin, rock.variation.dropMax);
  p.oreByTier[rock.ore.tier] += dropCount;
  p.ore += dropCount;  // total
  pushFloat(state, rock.x, rock.y - rock.size, `+${dropCount} ${rock.ore.name}`, rock.ore.color);
  state.log.unshift(`⛏ +${dropCount} ${rock.ore.name}`);

  // Crystal drop
  const crystals = rollCrystalDrop(rock.ore.tier);
  if (crystals > 0) {
    p.crystals += crystals;
    pushFloat(state, rock.x - 12, rock.y - rock.size + 14, `+${crystals} 💎`, '#a674ff');
    state.log.unshift(`💎 +${crystals} crystal${crystals !== 1 ? 's' : ''}`);
  }

  // Gem drop from rock (1%, tier capped by zone)
  const gem = rollGemDropFromRock(state.currentZone);
  if (gem) {
    p.gemInventory.push({ ...gem });
    pushFloat(state, rock.x + 12, rock.y - rock.size + 4, `◆ ${gem.name}`, gem.color);
    state.log.unshift(`◆ Found ${gem.name}`);
  }

  trimLog(state);
  state.rocks = state.rocks.filter(r => r.id !== rock.id);
  if (p.target?.type === 'rock' && p.target.id === rock.id) p.target = null;
}

function onMobKilled(state, mob) {
  const p = state.player;
  const stats = getPlayerStats(p);
  const gold = Math.floor(mob.reward * (1 + stats.goldBonus));
  const xp = Math.floor(mob.reward * (1 + stats.xpBonus));
  p.gold += gold;
  p.xp += xp;
  pushFloat(state, mob.x, mob.y - 8, `+${gold}g +${xp}xp`, '#f2c14e');
  state.log.unshift(`☠ Killed ${mob.tpl.name} (+${gold}g +${xp}xp)`);
  trimLog(state);

  // Gem drop (5% per kill, tier capped by zone)
  const gem = rollGemDropFromMob(state.currentZone);
  if (gem) {
    p.gemInventory.push({ ...gem });
    pushFloat(state, mob.x, mob.y - 22, `💎 ${gem.name}`, gem.color);
    state.log.unshift(`💎 Dropped ${gem.name}`);
    trimLog(state);
  }

  // Egg drop — rare, scales with mob tier.
  const egg = rollEggDrop(mob.tpl.tier);
  if (egg) {
    p.eggs.push(egg);
    pushFloat(state, mob.x, mob.y - 36, `🥚 ${egg.rarity} ${PET_TYPES[egg.type].name}`, egg.color);
    state.log.unshift(`🥚 Dropped ${egg.rarity} ${PET_TYPES[egg.type].name} Egg`);
    trimLog(state);
  }

  // Boss: guaranteed egg on first kill (independent of egg-drop roll above).
  if (mob.isBoss && mob.bossKey && !p.bossesKilled[mob.bossKey]) {
    p.bossesKilled[mob.bossKey] = true;
    const bossEgg = rollEgg();
    p.eggs.push(bossEgg);
    pushFloat(state, mob.x, mob.y - 56,
      `👑 BOSS DROP: ${bossEgg.rarity} ${PET_TYPES[bossEgg.type].name}`, bossEgg.color);
    state.log.unshift(`👑 Defeated ${mob.tpl.name}! +${bossEgg.rarity} ${PET_TYPES[bossEgg.type].name} Egg`);
    trimLog(state);
  } else if (mob.isBoss) {
    state.log.unshift(`👑 Defeated ${mob.tpl.name} again`);
    trimLog(state);
  }

  // Active pet earns 10% of mob XP.
  if (p.activePet && p.activePet.level < PET_MAX_LEVEL) {
    const petXp = Math.floor(xp * PET_XP_SHARE);
    if (petXp > 0) {
      const lvls = awardPetXp(p.activePet, petXp);
      if (lvls > 0) {
        state.log.unshift(`🐾 ${p.activePet.name} reached L${p.activePet.level}`);
        trimLog(state);
      }
    }
  }

  state.mobs = state.mobs.filter(m => m.id !== mob.id);
  if (p.target?.type === 'mob' && p.target.id === mob.id) p.target = null;
  if (p.priorityMobId === mob.id) {
    p.priorityMobId = null;
    p.priorityMobTimer = 0;
  }
  checkLevelUp(state);
}

function checkLevelUp(state) {
  const p = state.player;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    state.pendingLevelUps++;
    state.log.unshift(`⬆ LEVEL UP! Now level ${p.level}`);
    trimLog(state);
  }
  if (state.pendingLevelUps > 0 && !state.currentPerkOffer) {
    state.currentPerkOffer = rollPerkOffer(3);
    state.paused = true;
  }
}

function trimLog(state) { if (state.log.length > 50) state.log.length = 50; }

// ------------- Mob AI -------------
function updateMob(state, mob, dt) {
  const p = state.player;
  const d = dist(mob, p);
  const speed = mob.moveSpeed || mobMoveSpeed;
  if (mob.alertedTimer > 0) mob.alertedTimer = Math.max(0, mob.alertedTimer - dt);
  // Alerted = forced aggro (chain-aggro from a damaged group-mate) ignores radius.
  const isAggroed = mob.alertedTimer > 0 || d <= mob.aggroRadius;
  if (isAggroed) {
    // Move toward player
    const stats = getPlayerStats(p);
    const touchDist = mob.size + p.size * 0.5;
    if (d > touchDist) {
      const dx = (p.x - mob.x) / d;
      const dy = (p.y - mob.y) / d;
      mob.x += dx * speed * dt;
      mob.y += dy * speed * dt;
    } else {
      // Attack the player
      mob.attackTimer += dt;
      const period = 1 / mob.attackSpeed;
      while (mob.attackTimer >= period) {
        mob.attackTimer -= period;
        // Dodge
        if (Math.random() < stats.dodge) {
          state.log.unshift(`💨 Dodged ${mob.tpl.name}`);
          trimLog(state);
          continue;
        }
        // Golem: block negates the hit and counterattacks for a % of player damage.
        if (stats.blockChance > 0 && Math.random() < stats.blockChance) {
          const counter = stats.damage * stats.blockCounterMult;
          mob.hp -= counter;
          mob.hitFlash = 0.15;
          alertGroup(state, mob);
          pushFloat(state, mob.x, mob.y - mob.size / 2,
            `🛡 ${Math.floor(counter)}`, '#c9a86a');
          if (mob.hp <= 0) {
            onMobKilled(state, mob);
            return;
          }
          continue;
        }
        const mitigated = mob.damage * (1 - (stats.damageReduction || 0));
        p.hp = Math.max(0, p.hp - mitigated);
        // Retaliation: lock onto the first attacker and stay on them even if
        // other mobs are hitting. Without this, a group would make the player
        // flip targets every frame. We still refresh the timer when the same
        // mob keeps hitting, and let findTarget clear priority when the mob
        // dies or leaves attack range.
        if (p.priorityMobId == null || p.priorityMobId === mob.id) {
          p.priorityMobId = mob.id;
          p.priorityMobTimer = 3.0;
        }
        if (p.hp <= 0) onPlayerDeath(state);
      }
    }
  } else {
    // Return home slowly
    const homeD = Math.hypot(mob.homeX - mob.x, mob.homeY - mob.y);
    if (homeD > 2) {
      mob.x += (mob.homeX - mob.x) / homeD * speed * 0.5 * dt;
      mob.y += (mob.homeY - mob.y) / homeD * speed * 0.5 * dt;
    }
    mob.attackTimer = 0;
  }
}

function onPlayerDeath(state) {
  const p = state.player;
  const stats = getPlayerStats(p);
  p.hp = stats.maxHp;
  // Penalty: drop half ore (total). TODO: уточнить
  const lost = Math.floor(p.ore * 0.5);
  p.ore -= lost;
  const zone = ZONES[state.currentZone];
  p.x = zone.playerSpawn.x;
  p.y = zone.playerSpawn.y;
  state.log.unshift(`💀 You died. Lost ${lost} ore.`);
  trimLog(state);
}

// ------------- Main tick -------------
export function tick(state, dt) {
  if (state.paused) return;
  state.t += dt;
  const p = state.player;
  p.size = PLAYER.size;

  // Movement from joystick
  const mag = Math.hypot(p.moveX, p.moveY);
  if (mag > 0.05) {
    const nx = p.moveX / (mag || 1);
    const ny = p.moveY / (mag || 1);
    p.x = clamp(p.x + nx * PLAYER.moveSpeed * dt, 16, WORLD.width - 16);
    p.y = clamp(p.y + ny * PLAYER.moveSpeed * dt, 16, WORLD.height - 16);
  }

  // Regen
  const stats = getPlayerStats(p);
  p.hp = Math.min(stats.maxHp, p.hp + stats.hpRegen * dt);

  // Spawning — single rocks
  state.rockSpawnTimer += dt * 1000;
  if (state.rockSpawnTimer >= WORLD.rockRespawnMs) {
    state.rockSpawnTimer = 0;
    spawnRock(state);
  }
  // Mobs do NOT ambient-respawn: outposts and nests define the encounter
  // layout, and random wanderers would dilute the designed pacing. Clearing
  // the zone leaves it clean — re-enter the portal to reset.

  // Update mobs (they can aggro player)
  for (const m of state.mobs) updateMob(state, m, dt);

  // Decide target
  // findTarget already guarantees the target is within range, so act immediately.
  const target = findTarget(state);
  p.target = target ? { type: target.type, id: target.ref.id } : null;

  if (target) {
    if (target.type === 'rock') mineRock(state, target.ref, dt);
    else attackMob(state, target.ref, dt);
  } else {
    // No target → reset attack/mine timers so we don't over-charge next encounter.
    p.attackTimer = 0;
    p.mineTimer = 0;
  }

  // Tick hitFlash down on all rocks and mobs.
  for (const r of state.rocks) if (r.hitFlash > 0) r.hitFlash = Math.max(0, r.hitFlash - dt);
  for (const m of state.mobs)  if (m.hitFlash > 0) m.hitFlash = Math.max(0, m.hitFlash - dt);

  // Tick retaliation window
  if (p.priorityMobTimer > 0) {
    p.priorityMobTimer = Math.max(0, p.priorityMobTimer - dt);
    if (p.priorityMobTimer === 0) p.priorityMobId = null;
  }

  // Tick Wolf crit-stack decay: clear all stacks once the no-crit window elapses.
  if (p.petWolfStacks > 0) {
    p.petWolfStackTimer += dt;
    if (p.petWolfStackTimer >= WOLF_STACK_WINDOW_S) {
      p.petWolfStacks = 0;
      p.petWolfStackTimer = 0;
    }
  }

  // Pet follower: smoothly trail behind the player. Render-only state.
  if (p.activePet) {
    if (!p.petPos) p.petPos = { x: p.x - 24, y: p.y };
    const trail = 28;
    const targetX = p.x - trail, targetY = p.y - 4;
    const k = Math.min(1, dt * 4);  // exponential follow
    p.petPos.x += (targetX - p.petPos.x) * k;
    p.petPos.y += (targetY - p.petPos.y) * k;
  }

  // Floating text update
  for (const f of state.floatingTexts) {
    f.life += dt;
    f.y += f.vy * dt;
    f.vy += 18 * dt;
  }
  state.floatingTexts = state.floatingTexts.filter(f => f.life < f.maxLife);

  // Camera follow (clamp differs if zone is smaller than viewport)
  const maxCamX = Math.max(0, WORLD.width  - WORLD.viewW);
  const maxCamY = Math.max(0, WORLD.height - WORLD.viewH);
  state.camera.x = clamp(p.x - WORLD.viewW / 2, 0, maxCamX);
  state.camera.y = clamp(p.y - WORLD.viewH / 2, 0, maxCamY);

  // Forge proximity
  const fb = WORLD.forgeBuilding;
  state.nearForge = !!fb && dist(p, fb) <= fb.interactRadius;

  // Shop proximity
  const sb = WORLD.shopBuilding;
  state.nearShop = !!sb && dist(p, sb) <= sb.interactRadius;

  // Portal proximity
  const portal = WORLD.portal;
  state.nearPortal = !!portal && dist(p, portal) <= portal.interactRadius;
  const exitPortal = WORLD.exitPortal;
  state.nearExitPortal = !!exitPortal && dist(p, exitPortal) <= exitPortal.interactRadius;
}

// ------------- Forge interface -------------
export function craftItem(state, oreSpent) {
  const p = state.player;
  if (!state.nearForge) return { ok: false, reason: 'Get closer to the forge' };
  if (oreSpent < 10) return { ok: false, reason: 'Minimum 10 ore' };
  if (oreSpent > 100) oreSpent = 100;
  const tier = p.selectedOreTier;
  if (p.oreByTier[tier] < oreSpent) return { ok: false, reason: `Not enough ${ORES[tier].name}` };
  p.oreByTier[tier] -= oreSpent;
  p.ore -= oreSpent;
  const attempts = forgeAttempts(oreSpent);
  const chances = forgeChances(state.forge.level);
  const rarityKey = bestOfN(chances, attempts);
  const slotKey = pickSlotKey();
  const ore = ORES[tier];
  const stat = rollItemStat(ore.value, slotKey, rarityKey);
  const base = baseSellPrice(ore.value, rarityKey);
  const rarity = getRarityByKey(rarityKey);
  const sockets = rarity.sockets();
  const item = {
    id: uid(),
    slot: slotKey,
    rarity: rarityKey,
    rarityColor: rarity.color,
    stat,
    baseStat: stat,
    upgradeLevel: 0,
    totalUpgradeCost: 0,
    baseSellPrice: base,
    sockets,
    gems: [],
    oreName: ore.name,
  };
  p.inventory.push(item);

  // Forge XP
  const xpGain = forgeXP(oreSpent, rarityKey);
  state.forge.xp += xpGain;
  while (state.forge.xp >= xpForForgeLevel(state.forge.level)) {
    state.forge.xp -= xpForForgeLevel(state.forge.level);
    state.forge.level++;
    state.log.unshift(`🔨 Forge level up! L${state.forge.level}`);
    trimLog(state);
  }

  // Player XP — rewards "work done", not rarity
  const pStats = getPlayerStats(p);
  const pxp = Math.floor(playerCraftXP(ore.value, attempts) * (1 + pStats.xpBonus));
  p.xp += pxp;

  state.log.unshift(`✨ Crafted ${rarityKey} ${SLOTS[slotKey].label} (+${pxp}xp)`);
  trimLog(state);
  checkLevelUp(state);

  // Trigger craft-result popup
  state.lastCraftedItem = item;

  return { ok: true, item };
}

// Clear the craft-result popup state (called when user closes or chooses action)
export function dismissCraftResult(state) {
  state.lastCraftedItem = null;
}

export function selectOreTier(state, tier) {
  if (tier < 0 || tier >= ORES.length) return;
  state.player.selectedOreTier = tier;
}

export function equipItem(state, itemId) {
  const p = state.player;
  const idx = p.inventory.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  const item = p.inventory[idx];
  const current = p.equipped[item.slot];
  p.equipped[item.slot] = item;
  p.inventory.splice(idx, 1);
  if (current) p.inventory.push(current);
  state.log.unshift(`🎯 Equipped ${item.rarity} ${SLOTS[item.slot].label}`);
  trimLog(state);
}

export function sellItem(state, itemId, fromEquipped) {
  const p = state.player;
  let item;
  if (fromEquipped) {
    for (const k of SLOT_ORDER) if (p.equipped[k]?.id === itemId) {
      item = p.equipped[k]; p.equipped[k] = null; break;
    }
  } else {
    const idx = p.inventory.findIndex(i => i.id === itemId);
    if (idx >= 0) { item = p.inventory[idx]; p.inventory.splice(idx, 1); }
  }
  if (!item) return;
  const gemsVal = item.gems.reduce((s, g) => s + (g.sellValue || 0), 0);
  const price = totalSellPrice(item.baseSellPrice, item.totalUpgradeCost, gemsVal);
  p.gold += price;
  state.log.unshift(`💰 Sold ${item.rarity} ${SLOTS[item.slot].label} (+${price}g)`);
  trimLog(state);
}

// Find an item in inventory or equipped slots.
function findItemById(p, itemId) {
  const inv = p.inventory.find(i => i.id === itemId);
  if (inv) return inv;
  for (const k of SLOT_ORDER) {
    if (p.equipped[k]?.id === itemId) return p.equipped[k];
  }
  return null;
}

export function socketGem(state, itemId, gemInvIndex) {
  const p = state.player;
  const item = findItemById(p, itemId);
  if (!item) return { ok: false, reason: 'Item not found' };
  if (!item.sockets) return { ok: false, reason: 'No sockets' };
  if ((item.gems?.length || 0) >= item.sockets) return { ok: false, reason: 'All sockets full' };
  const gem = p.gemInventory[gemInvIndex];
  if (!gem) return { ok: false, reason: 'Gem not found' };
  p.gemInventory.splice(gemInvIndex, 1);
  item.gems = item.gems || [];
  item.gems.push(gem);
  state.log.unshift(`◆ Socketed ${gem.name} into ${SLOTS[item.slot].label}`);
  trimLog(state);
  return { ok: true };
}

export function unsocketGem(state, itemId, gemIndex) {
  const p = state.player;
  const item = findItemById(p, itemId);
  if (!item || !item.gems || !item.gems[gemIndex]) {
    return { ok: false, reason: 'Gem not found' };
  }
  const gem = item.gems[gemIndex];
  item.gems.splice(gemIndex, 1);
  p.gemInventory.push(gem);
  state.log.unshift(`◆ Removed ${gem.name} from ${SLOTS[item.slot].label}`);
  trimLog(state);
  return { ok: true };
}

export function sellGem(state, gemInvIndex) {
  const p = state.player;
  const gem = p.gemInventory[gemInvIndex];
  if (!gem) return { ok: false, reason: 'Gem not found' };
  p.gemInventory.splice(gemInvIndex, 1);
  p.gold += gem.sellValue || 0;
  state.log.unshift(`💰 Sold ${gem.name} (+${gem.sellValue}g)`);
  trimLog(state);
  return { ok: true };
}

export function upgradeItem(state, itemId) {
  const p = state.player;
  const all = [...p.inventory, ...SLOT_ORDER.map(k => p.equipped[k]).filter(Boolean)];
  const item = all.find(i => i.id === itemId);
  if (!item) return;
  if (item.upgradeLevel >= MAX_UPGRADE_LEVEL) return;
  const cost = upgradeCost(item.baseSellPrice, item.upgradeLevel);
  if (p.gold < cost) return;
  p.gold -= cost;
  item.upgradeLevel++;
  item.totalUpgradeCost += cost;
  item.stat = upgradedStat(item.stat);
  state.log.unshift(`⬆ Upgraded ${SLOTS[item.slot].label} L${item.upgradeLevel}`);
  trimLog(state);
}

export function buyPickaxe(state, tier) {
  const p = state.player;
  if (tier <= p.pickaxeTier) return { ok: false, reason: 'Already owned' };
  const pickaxe = PICKAXES[tier];
  if (!pickaxe) return { ok: false, reason: 'Invalid tier' };
  if (p.gold < pickaxe.price) return { ok: false, reason: 'Not enough gold' };
  p.gold -= pickaxe.price;
  p.pickaxeTier = tier;
  state.log.unshift(`⛏ Bought ${pickaxe.name}`);
  trimLog(state);
  return { ok: true };
}

// ------------- Market (shop's random-gear tab) -------------
function rollMarketRarity(rng = Math.random) {
  const weights = MARKET_RARITY_WEIGHTS;
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const r = rng() * total;
  let acc = 0;
  for (const [key, w] of Object.entries(weights)) {
    acc += w;
    if (r <= acc) return key;
  }
  return 'Common';
}

function rollMarketItem(state) {
  const p = state.player;
  // Item ore tier scales with player progress (their best-owned pickaxe or level).
  // We bias to the player's pickaxe tier so offerings feel relevant.
  const tierCap = Math.min(ORES.length - 1,
    Math.max(0, p.pickaxeTier, Math.floor(p.level / 3)));
  const oreTier = randInt(0, tierCap);
  const ore = ORES[oreTier];
  const rarityKey = rollMarketRarity();
  const slotKey = pickSlotKey();
  const rarity = getRarityByKey(rarityKey);
  const stat = rollItemStat(ore.value, slotKey, rarityKey);
  const price = marketPrice(rarityKey, oreTier);
  return {
    id: uid(),
    slot: slotKey,
    rarity: rarityKey,
    rarityColor: rarity.color,
    stat,
    baseStat: stat,
    upgradeLevel: 0,
    totalUpgradeCost: 0,
    baseSellPrice: baseSellPrice(ore.value, rarityKey),
    sockets: rarity.sockets(),
    gems: [],
    oreName: ore.name,
    price,             // crystals
  };
}

// Roll one extra "gem of the day" — uses the same zone-gated roll as drops,
// but the price is set from the gem's tier (see gemMarketPrice).
function rollMarketGem(state) {
  const gem = rollGemAt(state.currentZone);
  return {
    id: uid(),
    kind: 'gem',
    gem,
    price: gemMarketPrice(gem.tier),
  };
}

// Roll one extra "egg of the day" — fresh roll from rollEgg, priced by rarity.
function rollMarketEgg() {
  const egg = rollEgg();
  return {
    id: uid(),
    kind: 'egg',
    egg,
    price: eggMarketPrice(egg.rarity),
  };
}

export function ensureMarket(state, force = false) {
  const now = Date.now();
  if (!state.market || force || now >= state.market.nextRotationAt) {
    const items = [];
    for (let i = 0; i < MARKET_SLOT_COUNT; i++) items.push(rollMarketItem(state));
    state.market = {
      items,
      gem: rollMarketGem(state),
      egg: rollMarketEgg(),
      nextRotationAt: now + MARKET_ROTATION_MS,
    };
  }
  return state.market;
}

export function refreshMarket(state) {
  const p = state.player;
  if (p.crystals < MARKET_REFRESH_COST) {
    return { ok: false, reason: 'Not enough crystals' };
  }
  p.crystals -= MARKET_REFRESH_COST;
  ensureMarket(state, true);
  state.log.unshift(`🔄 Market refreshed (-${MARKET_REFRESH_COST} 💎)`);
  trimLog(state);
  return { ok: true };
}

export function buyMarketItem(state, itemId) {
  const p = state.player;
  if (!state.market) return { ok: false, reason: 'Market not open' };
  const idx = state.market.items.findIndex(i => i && i.id === itemId);
  if (idx < 0) return { ok: false, reason: 'Item no longer available' };
  const item = state.market.items[idx];
  if (p.crystals < item.price) return { ok: false, reason: 'Not enough crystals' };
  p.crystals -= item.price;
  // Add to inventory (same shape as crafted items)
  const { price, ...itemForInventory } = item;
  p.inventory.push(itemForInventory);
  // Mark slot as sold out (null — so other slots remain)
  state.market.items[idx] = null;
  state.log.unshift(`🛒 Bought ${item.rarity} ${SLOTS[item.slot].label} (-${item.price} 💎)`);
  trimLog(state);
  return { ok: true };
}

export function buyMarketGem(state) {
  const p = state.player;
  if (!state.market?.gem) return { ok: false, reason: 'No gem available' };
  const offer = state.market.gem;
  if (p.crystals < offer.price) return { ok: false, reason: 'Not enough crystals' };
  p.crystals -= offer.price;
  p.gemInventory.push({ ...offer.gem });
  state.market.gem = null;
  state.log.unshift(`🛒 Bought ${offer.gem.name} (-${offer.price} 💎)`);
  trimLog(state);
  return { ok: true };
}

export function buyMarketEgg(state) {
  const p = state.player;
  if (!state.market?.egg) return { ok: false, reason: 'No egg available' };
  const offer = state.market.egg;
  if (p.crystals < offer.price) return { ok: false, reason: 'Not enough crystals' };
  p.crystals -= offer.price;
  p.eggs.push({ ...offer.egg });
  state.market.egg = null;
  state.log.unshift(`🛒 Bought ${offer.egg.name} (-${offer.price} 💎)`);
  trimLog(state);
  return { ok: true };
}


export function choosePerk(state, index) {
  if (!state.currentPerkOffer) return;
  const offer = state.currentPerkOffer[index];
  const p = state.player;
  p.perks[offer.type] = (p.perks[offer.type] || 0) + offer.value;
  state.log.unshift(`✨ Perk: ${offer.rarity} ${offer.name} (${formatPerk(offer)})`);
  trimLog(state);
  state.currentPerkOffer = null;
  state.pendingLevelUps--;
  if (state.pendingLevelUps > 0) {
    state.currentPerkOffer = rollPerkOffer(3);
  } else {
    state.paused = false;
  }
}

// ------------- Pet actions -------------

// Hatch an egg from inventory into a level-1 pet on the bench.
// If no active pet is set, the new pet auto-activates.
export function hatchEgg(state, eggIndex) {
  const p = state.player;
  const egg = p.eggs[eggIndex];
  if (!egg) return { ok: false, reason: 'Egg not found' };
  p.eggs.splice(eggIndex, 1);
  const pet = makePet(egg.type, egg.rarity);
  if (!p.activePet) {
    p.activePet = pet;
    p.petWolfStacks = 0;
    p.petWolfStackTimer = 0;
    p.petPos = { x: p.x - 24, y: p.y };
  } else {
    p.pets.push(pet);
  }
  state.log.unshift(`🐣 Hatched ${pet.name}`);
  trimLog(state);
  return { ok: true, pet };
}

// Sacrifice an egg: feed it to the active pet for XP.
export function sacrificeEgg(state, eggIndex) {
  const p = state.player;
  if (!p.activePet) return { ok: false, reason: 'No active pet' };
  if (p.activePet.level >= PET_MAX_LEVEL) return { ok: false, reason: 'Pet is max level' };
  const egg = p.eggs[eggIndex];
  if (!egg) return { ok: false, reason: 'Egg not found' };
  const xp = eggSacrificeXP(egg.rarity);
  p.eggs.splice(eggIndex, 1);
  const lvls = awardPetXp(p.activePet, xp);
  state.log.unshift(`🍖 Fed ${egg.rarity} egg to ${p.activePet.name} (+${xp} pet XP${lvls ? `, L${p.activePet.level}` : ''})`);
  trimLog(state);
  return { ok: true };
}

// Activate a pet from the bench. Current active pet swaps to bench.
export function setActivePet(state, petIndex) {
  const p = state.player;
  const pet = p.pets[petIndex];
  if (!pet) return { ok: false, reason: 'Pet not found' };
  p.pets.splice(petIndex, 1);
  if (p.activePet) p.pets.push(p.activePet);
  p.activePet = pet;
  p.petWolfStacks = 0;
  p.petWolfStackTimer = 0;
  p.petPos = { x: p.x - 24, y: p.y };
  state.log.unshift(`🐾 ${pet.name} is now active`);
  trimLog(state);
  return { ok: true };
}

// Stash the active pet — no companion until another is activated.
export function dismissActivePet(state) {
  const p = state.player;
  if (!p.activePet) return { ok: false };
  p.pets.push(p.activePet);
  p.activePet = null;
  p.petWolfStacks = 0;
  return { ok: true };
}

// ------------- Init world -------------
export function initWorld(state) {
  seedNests(state);
  seedOutposts(state);
  fillAmbientRocks(state, WORLD.maxRocks);
}
