// Pet system: hatch from eggs (mob drop), one active pet, levels 1-10.
// Each pet type has a primary scaling stat + a secondary mechanic.
// Egg rarity drives the magnitude — same multipliers as perks (Common ×1 → Mythical ×12).

import { PERK_RARITY_WEIGHTS, rollPerkRarity } from './perks.js';

export const PET_MAX_LEVEL = 10;

// XP curve: pet level k requires 100 × 1.5^k to reach k+1.
export function petXpForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level));
}

// Active pet earns 10% of mob XP from kills.
export const PET_XP_SHARE = 0.10;

// Sacrifice: feeding an egg to the active pet grants this base XP × rarity multiplier.
export const PET_SACRIFICE_BASE_XP = 80;

// Rarity multipliers — reused from perks so eggs scale identically to perk rarity.
export const EGG_RARITY_MULT = {
  Common:    1.0,
  Uncommon:  1.5,
  Rare:      2.5,
  Epic:      4.0,
  Legendary: 7.0,
  Mythical:  12.0,
};

// Egg drop chance per mob kill — fixed 3%, independent of mob tier.
export const EGG_DROP_CHANCE = 0.03;

export function eggDropChance(_mobTier) {
  return EGG_DROP_CHANCE;
}

// Pet definitions. Per-rarity table holds primary stat at L1/L10 plus the
// secondary mechanic's parameters. The primary stat is interpolated linearly
// across levels (L1 → L10).
export const PET_TYPES = {
  wolf: {
    key: 'wolf',
    name: 'Wolf',
    color: '#9aa3ad',
    accent: '#3a8ff0',                // sapphire-themed (matches "Brutality + crit" build)
    primaryStat: 'crit_dmg_pct',
    primaryLabel: 'Crit Damage',
    secondaryLabel: 'Crit stacks Atk Speed',
    rarities: {
      Common:    { l1: 0.02, l10: 0.20, perStack: 0.005,  maxStack: 0.05  },
      Uncommon:  { l1: 0.03, l10: 0.30, perStack: 0.0075, maxStack: 0.075 },
      Rare:      { l1: 0.05, l10: 0.50, perStack: 0.0125, maxStack: 0.125 },
      Epic:      { l1: 0.08, l10: 0.80, perStack: 0.02,   maxStack: 0.20  },
      Legendary: { l1: 0.14, l10: 1.40, perStack: 0.035,  maxStack: 0.35  },
      Mythical:  { l1: 0.24, l10: 2.40, perStack: 0.06,   maxStack: 0.60  },
    },
  },
  bat: {
    key: 'bat',
    name: 'Bat',
    color: '#7a4ec2',
    accent: '#e04040',                // ruby-themed (high damage / vampirism)
    primaryStat: 'lifesteal_pct',
    primaryLabel: 'Lifesteal',
    secondaryLabel: 'Double Hit Chance',
    rarities: {
      Common:    { l1: 0.004, l10: 0.04, doubleHit: 0.01  },
      Uncommon:  { l1: 0.006, l10: 0.06, doubleHit: 0.015 },
      Rare:      { l1: 0.010, l10: 0.10, doubleHit: 0.025 },
      Epic:      { l1: 0.016, l10: 0.16, doubleHit: 0.04  },
      Legendary: { l1: 0.028, l10: 0.28, doubleHit: 0.07  },
      Mythical:  { l1: 0.048, l10: 0.48, doubleHit: 0.12  },
    },
  },
  fairy: {
    key: 'fairy',
    name: 'Fairy',
    color: '#ffe066',
    accent: '#3fb56a',                // emerald-themed (regen)
    primaryStat: 'hp_regen_pct_max',  // % of max HP per second
    primaryLabel: 'HP Regen',
    secondaryLabel: 'Damage when HP > 80%',
    rarities: {
      Common:    { l1: 0.001,  l10: 0.01,  hiHpDmg: 0.03 },
      Uncommon:  { l1: 0.0015, l10: 0.015, hiHpDmg: 0.045 },
      Rare:      { l1: 0.0025, l10: 0.025, hiHpDmg: 0.075 },
      Epic:      { l1: 0.004,  l10: 0.04,  hiHpDmg: 0.12  },
      Legendary: { l1: 0.007,  l10: 0.07,  hiHpDmg: 0.21  },
      Mythical:  { l1: 0.012,  l10: 0.12,  hiHpDmg: 0.36  },
    },
  },
  golem: {
    key: 'golem',
    name: 'Golem',
    color: '#8a7a5a',
    accent: '#c77b47',
    primaryStat: 'block_chance',      // chance to negate incoming hit + counterattack
    primaryLabel: 'Block Chance',
    secondaryLabel: 'Counter Damage (× player dmg)',
    rarities: {
      Common:    { l1: 0.004, l10: 0.04, counterMult: 0.25 },
      Uncommon:  { l1: 0.006, l10: 0.06, counterMult: 0.375 },
      Rare:      { l1: 0.010, l10: 0.10, counterMult: 0.625 },
      Epic:      { l1: 0.016, l10: 0.16, counterMult: 1.0   },
      Legendary: { l1: 0.028, l10: 0.28, counterMult: 1.75  },
      Mythical:  { l1: 0.048, l10: 0.48, counterMult: 3.0   },
    },
  },
};

// Window for Wolf's atk-speed stacks: stacks decay completely after this much
// idle time without a crit. Keeps the bonus situational instead of permanent.
export const WOLF_STACK_WINDOW_S = 5;

// Block proc chance is hard-capped so even maxed Mythical Golem can't fully nullify hits.
export const BLOCK_CHANCE_CAP = 0.60;

// ---------- Eggs & pets ----------
export function makeEgg(typeKey, rarity) {
  const t = PET_TYPES[typeKey];
  if (!t) return null;
  return {
    kind: 'egg',
    type: typeKey,
    rarity,
    name: `${rarity} ${t.name} Egg`,
    color: t.color,
    accent: t.accent,
  };
}

export function makePet(typeKey, rarity) {
  const t = PET_TYPES[typeKey];
  if (!t) return null;
  return {
    type: typeKey,
    rarity,
    level: 1,
    xp: 0,
    name: `${rarity} ${t.name}`,
    color: t.color,
    accent: t.accent,
  };
}

// Roll an egg drop from a slain mob. Returns an egg or null.
export function rollEggDrop(_mobTier, rng = Math.random) {
  if (rng() >= EGG_DROP_CHANCE) return null;
  return rollEgg(rng);
}

// Always returns an egg — used by guaranteed boss drops too.
export function rollEgg(rng = Math.random) {
  const types = Object.keys(PET_TYPES);
  const typeKey = types[Math.floor(rng() * types.length)];
  const rarity = rollPerkRarity(rng);  // share perk rarity weights
  return makeEgg(typeKey, rarity);
}

// XP awarded by sacrificing an egg to the active pet.
export function eggSacrificeXP(eggRarity) {
  return Math.floor(PET_SACRIFICE_BASE_XP * (EGG_RARITY_MULT[eggRarity] || 1));
}

// Apply XP gain to a pet, leveling up as needed. Returns levels gained.
export function awardPetXp(pet, xp) {
  if (!pet || pet.level >= PET_MAX_LEVEL) return 0;
  pet.xp += xp;
  let gained = 0;
  while (pet.level < PET_MAX_LEVEL && pet.xp >= petXpForLevel(pet.level)) {
    pet.xp -= petXpForLevel(pet.level);
    pet.level++;
    gained++;
  }
  if (pet.level >= PET_MAX_LEVEL) pet.xp = 0;
  return gained;
}

// Compute a pet's primary stat at its current level — linear from L1 to L10.
export function petPrimaryValue(pet) {
  if (!pet) return 0;
  const def = PET_TYPES[pet.type];
  const tier = def.rarities[pet.rarity];
  const t = (pet.level - 1) / (PET_MAX_LEVEL - 1);   // 0 at L1, 1 at L10
  return tier.l1 + (tier.l10 - tier.l1) * t;
}

// Secondary mechanic params — return raw rarity object for the caller to use the
// field it needs (perStack/maxStack/doubleHit/hiHpDmg/counterMult).
export function petSecondaryParams(pet) {
  if (!pet) return null;
  const def = PET_TYPES[pet.type];
  return def.rarities[pet.rarity];
}
