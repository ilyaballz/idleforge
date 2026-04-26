// Ore tiers: HP, defense, value (gold/craft material value)
export const ORES = [
  { tier: 0, name: 'Stone',   hp: 100,    def: 0,    value: 2,   color: '#9aa3ad' },
  { tier: 1, name: 'Copper',  hp: 350,    def: 10,   value: 5,   color: '#c77b47' },
  { tier: 2, name: 'Iron',    hp: 1200,   def: 40,   value: 18,  color: '#6d7680' },
  { tier: 3, name: 'Silver',  hp: 4500,   def: 200,  value: 65,  color: '#d9dce0' },
  { tier: 4, name: 'Gold',    hp: 18000,  def: 800,  value: 240, color: '#e6c34a' },
  { tier: 5, name: 'Emerald', hp: 75000,  def: 3000, value: 850, color: '#3fb56a' },
];

// Rock size variations
export const ROCK_VARIATIONS = [
  { key: 'Small', hpMult: 0.6, dropMin: 1, dropMax: 1, spawnChance: 0.40, size: 22 },
  { key: 'Stone', hpMult: 1.0, dropMin: 1, dropMax: 3, spawnChance: 0.45, size: 30 },
  { key: 'Large', hpMult: 2.0, dropMin: 2, dropMax: 5, spawnChance: 0.15, size: 42 },
];

// Damage from pickaxe to rock
export function rockDamage(pickaxeDamage, oreDef) {
  return Math.max(1, pickaxeDamage - oreDef);
}

// Pick a rock variation based on spawn weights
export function pickRockVariation(rng = Math.random) {
  const r = rng();
  let acc = 0;
  for (const v of ROCK_VARIATIONS) {
    acc += v.spawnChance;
    if (r <= acc) return v;
  }
  return ROCK_VARIATIONS[ROCK_VARIATIONS.length - 1];
}

// Depth-biased variation — at depthFrac=0 (top of zone) Small dominates,
// at depthFrac=1 (bottom near portal) Large dominates. Stone stays the
// stable middle ground. Pairs with the mob density gradient: deeper zones
// give bigger reward but face denser packs.
export function pickRockVariationByDepth(depthFrac, rng = Math.random) {
  const d = Math.max(0, Math.min(1, depthFrac));
  // Multipliers on the base spawnChance — Small fades out, Large ramps up.
  const smallW = ROCK_VARIATIONS[0].spawnChance * (1.6 - d * 1.4);
  const stoneW = ROCK_VARIATIONS[1].spawnChance;
  const largeW = ROCK_VARIATIONS[2].spawnChance * (0.4 + d * 3.2);
  const weights = [smallW, stoneW, largeW];
  const total = weights[0] + weights[1] + weights[2];
  const r = rng() * total;
  let acc = 0;
  for (let i = 0; i < ROCK_VARIATIONS.length; i++) {
    acc += weights[i];
    if (r <= acc) return ROCK_VARIATIONS[i];
  }
  return ROCK_VARIATIONS[ROCK_VARIATIONS.length - 1];
}
