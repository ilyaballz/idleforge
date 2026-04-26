// Gems: 3 types × 5 tiers.
// Each type has a "weapon-side" and "armor-side" effect. The slot categories:
//   weapon / ring  → use weaponStat
//   armor  / helmet → use armorStat

export const GEM_TYPES = {
  ruby: {
    key: 'ruby',
    name: 'Ruby',
    color: '#e04040',
    weaponStat: 'combat_dmg',       // +% damage
    armorStat:  'max_hp_pct',       // +% max HP
    weaponValues: [0.02, 0.04, 0.06, 0.08, 0.10],
    armorValues:  [0.02, 0.04, 0.06, 0.08, 0.10],
  },
  sapphire: {
    key: 'sapphire',
    name: 'Sapphire',
    color: '#3a8ff0',
    weaponStat: 'crit_chance',      // +% crit chance
    armorStat:  'damage_reduction', // +% flat damage reduction on incoming hits
    weaponValues: [0.01, 0.02, 0.03, 0.04, 0.05],
    armorValues:  [0.01, 0.02, 0.03, 0.04, 0.05],
  },
  emerald: {
    key: 'emerald',
    name: 'Emerald',
    color: '#3fb56a',
    weaponStat: 'atk_speed_pct',    // +% attack speed
    armorStat:  'hp_regen_pct_max', // +% of max HP per second
    weaponValues: [0.01, 0.02, 0.03, 0.04, 0.05],
    armorValues:  [0.002, 0.004, 0.006, 0.008, 0.010],
  },
};

// Tier names (index 0..4).
export const GEM_TIERS = ['Chipped', 'Flawed', 'Normal', 'Flawless', 'Perfect'];

// Sell value scales by tier.
export const GEM_TIER_SELL = [10, 30, 90, 250, 700];

// Combo bonus when two gems of the same type are socketed in the same item.
export const GEM_SAME_TYPE_COMBO = 0.20;  // +20% multiplicative on combined bonus

// Hard caps on derived stats (per-stat, to keep the game sane).
export const GEM_CAPS = {
  damage_reduction: 0.75,
};

// Slots split into two categories for which side of the gem applies.
export function gemSideForSlot(slotKey) {
  return (slotKey === 'weapon' || slotKey === 'ring') ? 'weapon' : 'armor';
}

// Create a gem object (stored in player inventory or in item.gems).
export function makeGem(typeKey, tier) {
  const t = GEM_TYPES[typeKey];
  if (!t) return null;
  return {
    type: typeKey,
    tier,
    name: `${GEM_TIERS[tier]} ${t.name}`,
    color: t.color,
    sellValue: GEM_TIER_SELL[tier],
  };
}

// Drop chances:
//   - 1% per rock fully mined
//   - 5% per mob killed
// (Eggs drop independently from mobs — see balance/pets.js.)
export const GEM_DROP_CHANCE_ROCK = 0.01;
export const GEM_DROP_CHANCE_MOB  = 0.05;

// Tier roll weights (fixed across all sources):
//   Chipped 60% / Flawed 25% / Regular 10% / Flawless 4% / Perfect 1%
export const GEM_TIER_WEIGHTS = [60, 25, 10, 4, 1];

// Max tier available scales with the player's current zone:
//   maxTier = floor(zoneIndex / 2) + 1, capped at the highest tier (5 → index 4).
// surface=0, mine1=1, mine2=2, mine3=3 → caps: 1, 1, 2, 2 (Chipped..Flawed/Regular).
const ZONE_INDEX = { surface: 0, mine1: 1, mine2: 2, mine3: 3 };
export function maxGemTierForZone(zoneKey) {
  const idx = ZONE_INDEX[zoneKey] ?? 0;
  const tierOneIndexed = Math.floor(idx / 2) + 1;       // 1..5
  const cap = Math.min(GEM_TIERS.length, tierOneIndexed); // clamp to GEM_TIERS length
  return cap - 1;                                         // return as 0-indexed
}

// Roll a tier from the fixed weights, capped to `maxTierIdx` inclusive.
function rollGemTier(maxTierIdx, rng = Math.random) {
  const weights = GEM_TIER_WEIGHTS.slice(0, maxTierIdx + 1);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

// Roll a random gem (type uniform across 3, tier from weights, gated by zone).
export function rollGemAt(zoneKey, rng = Math.random) {
  const maxTierIdx = maxGemTierForZone(zoneKey);
  const typeKeys = Object.keys(GEM_TYPES);
  const typeKey = typeKeys[Math.floor(rng() * typeKeys.length)];
  const tier = rollGemTier(maxTierIdx, rng);
  return makeGem(typeKey, tier);
}

// Drop roll for a slain mob. Returns a gem or null.
export function rollGemDropFromMob(zoneKey, rng = Math.random) {
  if (rng() >= GEM_DROP_CHANCE_MOB) return null;
  return rollGemAt(zoneKey, rng);
}

// Drop roll for a fully-mined rock. Returns a gem or null.
export function rollGemDropFromRock(zoneKey, rng = Math.random) {
  if (rng() >= GEM_DROP_CHANCE_ROCK) return null;
  return rollGemAt(zoneKey, rng);
}

// Apply socketed gems from a single equipped item into accumulator buckets.
// Accumulates into `bonuses` object keyed by the gem's stat key.
// Also applies the same-type combo multiplier when a single item has 2+ gems of one type.
export function applyItemGemBonuses(item, slotKey, bonuses) {
  if (!item || !item.gems || !item.gems.length) return;
  const side = gemSideForSlot(slotKey);

  // Tally per-type bonus from THIS item only (for the combo multiplier).
  const perTypeThisItem = {};
  for (const g of item.gems) {
    const def = GEM_TYPES[g.type];
    if (!def) continue;
    const stat = side === 'weapon' ? def.weaponStat : def.armorStat;
    const values = side === 'weapon' ? def.weaponValues : def.armorValues;
    const value = values[g.tier] ?? 0;
    perTypeThisItem[g.type] = perTypeThisItem[g.type] || { count: 0, sum: 0, stat };
    perTypeThisItem[g.type].count++;
    perTypeThisItem[g.type].sum += value;
  }

  // Combo: if 2+ of the same type in the same item, multiply THIS ITEM's sum by 1+combo.
  for (const { count, sum, stat } of Object.values(perTypeThisItem)) {
    const multiplier = count >= 2 ? (1 + GEM_SAME_TYPE_COMBO) : 1;
    bonuses[stat] = (bonuses[stat] || 0) + sum * multiplier;
  }
}
