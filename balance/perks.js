// Perk rarity multipliers
export const PERK_RARITY_MULT = {
  Common:    1.0,
  Uncommon:  1.5,
  Rare:      2.5,
  Epic:      4.0,
  Legendary: 7.0,
  Mythical:  12.0,
};

// Perk rarity drop weights on level-up. // TODO: уточнить (not specified in GDD)
export const PERK_RARITY_WEIGHTS = {
  Common:    60,
  Uncommon:  25,
  Rare:      10,
  Epic:      4,
  Legendary: 0.9,
  Mythical:  0.1,
};

// Base Common values for each perk type.
export const PERKS = [
  { type: 'combat_dmg',    name: 'Strength',  base: 0.025, format: 'pct', desc: '+{v}% damage' },
  { type: 'crit_chance',   name: 'Precision', base: 0.015, format: 'pct', desc: '+{v}% crit chance' },
  { type: 'crit_mult',     name: 'Brutality', base: 0.050, format: 'pct', desc: '+{v}% crit damage' },
  { type: 'atk_speed_pct', name: 'Haste',     base: 0.015, format: 'pct', desc: '+{v}% attack speed' },
  { type: 'max_hp_pct',    name: 'Vitality',  base: 0.025, format: 'pct', desc: '+{v}% max HP' },
  { type: 'hp_regen_pct',  name: 'Recovery',  base: 0.002, format: 'pct', desc: '+{v}% HP regen' },
  { type: 'dodge_pct',     name: 'Evasion',   base: 0.010, format: 'pct', desc: '+{v}% dodge' },
  { type: 'lifesteal_pct', name: 'Vampirism', base: 0.005, format: 'pct', desc: '+{v}% lifesteal' },
  { type: 'mining_dmg',    name: 'Mining',    base: 0.040, format: 'pct', desc: '+{v}% mining dmg' },
  { type: 'gold_bonus',    name: 'Greed',     base: 0.050, format: 'pct', desc: '+{v}% gold gain' },
  { type: 'xp_bonus',      name: 'Wisdom',    base: 0.050, format: 'pct', desc: '+{v}% XP gain' },
];

// Roll a perk rarity based on weights.
export function rollPerkRarity(rng = Math.random) {
  const total = Object.values(PERK_RARITY_WEIGHTS).reduce((s, v) => s + v, 0);
  const r = rng() * total;
  let acc = 0;
  for (const [key, w] of Object.entries(PERK_RARITY_WEIGHTS)) {
    acc += w;
    if (r <= acc) return key;
  }
  return 'Common';
}

// Roll a set of unique perk offers at level-up.
export function rollPerkOffer(count = 3, rng = Math.random) {
  const shuffled = [...PERKS].sort(() => rng() - 0.5);
  const picks = shuffled.slice(0, count);
  return picks.map(p => {
    const rarity = rollPerkRarity(rng);
    const mult = PERK_RARITY_MULT[rarity];
    return {
      ...p,
      rarity,
      value: p.base * mult,
    };
  });
}

// Format the displayable value of a perk offer.
export function formatPerk(offer) {
  const pct = (offer.value * 100).toFixed(1);
  return offer.desc.replace('{v}', pct);
}
