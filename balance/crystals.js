// Hard currency — "Crystals". Rare drop from rocks.
// TODO: уточнить (not in GDD yet)

// Drop chance per rock broken, scales up with ore tier.
export const CRYSTAL_DROP_CHANCE = {
  0: 0.02,  // Stone
  1: 0.04,  // Copper
  2: 0.07,  // Iron
  3: 0.10,  // Silver
  4: 0.14,  // Gold
  5: 0.18,  // Emerald
};

// Drop amount: most drops are 1, occasional 2-3
export function rollCrystalDrop(oreTier, rng = Math.random) {
  const chance = CRYSTAL_DROP_CHANCE[oreTier] ?? 0;
  if (rng() >= chance) return 0;
  const roll = rng();
  if (roll < 0.10) return 3;
  if (roll < 0.30) return 2;
  return 1;
}

// Crystal price for market items. Scales by rarity (base) and by ore tier —
// a Gold Common is far more useful than a Stone Common, so the price reflects
// that. Formula: marketPrice = base(rarity) × tierMult(oreTier), rounded.
//
// Current drop rate has a player accumulating ~3-5 crystals per Surface clear,
// so Stone Common at 1 is snackable, Stone Rare at ~18 requires commitment.
export const CRYSTAL_PRICE_BASE = {
  Common:    1,
  Uncommon:  4,
  Rare:      18,
  Epic:      80,
  Legendary: 320,
};

export const CRYSTAL_TIER_MULT = [
  1.0,   // Stone
  1.5,   // Copper
  2.5,   // Iron
  4.0,   // Silver
  7.0,   // Gold
  12.0,  // Emerald
];

export function marketPrice(rarityKey, oreTier) {
  const base = CRYSTAL_PRICE_BASE[rarityKey] ?? 10;
  const mult = CRYSTAL_TIER_MULT[oreTier] ?? 1;
  return Math.max(1, Math.round(base * mult));
}

// Rotation: how many items displayed at once, and their rarity distribution.
export const MARKET_SLOT_COUNT = 4;

// Weights for rolling rarity of a market listing. Epics/Legendaries stay forge-only.
export const MARKET_RARITY_WEIGHTS = {
  Common:   60,
  Uncommon: 30,
  Rare:     10,
};

// Refresh the market manually — costs crystals.
export const MARKET_REFRESH_COST = 2;

// Auto-rotation period (ms). // TODO: уточнить
export const MARKET_ROTATION_MS = 3 * 60 * 1000;

// Gem listing price: scales with gem tier (Chipped → Perfect = 1..5).
// Drops are common, so the shop is mainly a top-up — keeps Chipped as a snack
// and Perfect as a real commitment.
export function gemMarketPrice(tier) {
  return [12, 30, 90, 220, 500][tier] ?? 12;
}

// Egg listing price: matches the perk-rarity multiplier ladder, scaled into
// crystals so a Common egg is impulse-buy and Mythical is endgame goal.
export const EGG_PRICE_BY_RARITY = {
  Common:    18,
  Uncommon:  40,
  Rare:      120,
  Epic:      400,
  Legendary: 1200,
  Mythical:  4500,
};
export function eggMarketPrice(rarity) {
  return EGG_PRICE_BY_RARITY[rarity] ?? 18;
}
