import { RARITIES } from './equipment.js';

// Base chances at forge level 1.
export const FORGE_BASE_CHANCES = {
  Common:    0.690,
  Uncommon:  0.200,
  Rare:      0.080,
  Epic:      0.025,
  Legendary: 0.0045,
  Mythical:  0.0005,
};

// Rarity unlocks by forge level.
export const FORGE_UNLOCKS = [
  { level: 1,  unlocks: ['Common', 'Uncommon'] },
  { level: 2,  unlocks: ['Rare'] },
  { level: 4,  unlocks: ['Epic'] },
  { level: 7,  unlocks: ['Legendary'] },
  { level: 10, unlocks: ['Mythical'] },
];

// Which rarities are available at a given forge level.
export function availableRarities(forgeLevel) {
  const allowed = new Set();
  for (const gate of FORGE_UNLOCKS) {
    if (forgeLevel >= gate.level) gate.unlocks.forEach(r => allowed.add(r));
  }
  return RARITIES.filter(r => allowed.has(r.key));
}

// Best-of-N attempts based on ore spent (10-100 ore => 1-10 attempts).
export function forgeAttempts(ore) {
  return Math.floor(Math.min(ore, 100) / 10);
}

// Calculate rarity chances for a given forge level. Returns a dict {rarityKey: chance}.
export function forgeChances(forgeLevel) {
  const bonus = (forgeLevel - 1) * 0.01;
  const allowedKeys = availableRarities(forgeLevel).map(r => r.key);

  const adjusted = {};
  for (const key of allowedKeys) {
    const base = FORGE_BASE_CHANCES[key] ?? 0;
    adjusted[key] = base * (1 + bonus);
  }
  // Common is the remainder so chances sum to 1.
  const nonCommonSum = Object.entries(adjusted)
    .filter(([k]) => k !== 'Common')
    .reduce((s, [, v]) => s + v, 0);

  // Cap: if non-common sum > 0.99, scale down to 0.99
  if (nonCommonSum > 0.99) {
    const scale = 0.99 / nonCommonSum;
    for (const key of Object.keys(adjusted)) {
      if (key !== 'Common') adjusted[key] *= scale;
    }
  }

  const newNonCommon = Object.entries(adjusted)
    .filter(([k]) => k !== 'Common')
    .reduce((s, [, v]) => s + v, 0);
  if (allowedKeys.includes('Common')) {
    adjusted.Common = Math.max(0, 1 - newNonCommon);
  }
  return adjusted;
}

// Roll a single attempt according to chances dict. Returns rarity key.
export function rollRarity(chances, rng = Math.random) {
  const r = rng();
  let acc = 0;
  const entries = Object.entries(chances);
  for (const [key, chance] of entries) {
    acc += chance;
    if (r <= acc) return key;
  }
  return entries[0][0];
}

// Pick the best (highest multiplier) rarity from N attempts.
export function bestOfN(chances, attempts, rng = Math.random) {
  let best = null;
  let bestMult = -1;
  for (let i = 0; i < attempts; i++) {
    const key = rollRarity(chances, rng);
    const mult = RARITIES.find(r => r.key === key).multiplier;
    if (mult > bestMult) { bestMult = mult; best = key; }
  }
  return best;
}

// Forge XP per craft: amountUsed * (1 + rarityMultiplier/5), rounded UP.
// Rewards the forge more for rare outcomes.
export function forgeXP(amountUsed, rarityKey) {
  const rarity = RARITIES.find(r => r.key === rarityKey);
  return Math.ceil(amountUsed * (1 + rarity.multiplier / 5));
}

// Player XP per craft: max(10, floor(oreValue * attempts)).
// Player is rewarded for "work done", not for luck of the roll.
export function playerCraftXP(oreValue, attempts) {
  return Math.max(10, Math.floor(oreValue * attempts));
}

// Forge XP required to reach next level. Each level needs 30% more xp.
const FORGE_BASE_XP = 50; // TODO: уточнить базовое значение из GDD
export function xpForForgeLevel(level) {
  return Math.floor(FORGE_BASE_XP * Math.pow(1.3, level - 1));
}
