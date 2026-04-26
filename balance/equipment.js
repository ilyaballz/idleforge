// Equipment slots and their stat multipliers against ore value.
export const SLOTS = {
  weapon: { key: 'weapon', label: 'Weapon', stat: 'damage', multiplier: 1.8 },
  ring:   { key: 'ring',   label: 'Ring',   stat: 'damage', multiplier: 0.8 },
  armor:  { key: 'armor',  label: 'Armor',  stat: 'hp',     multiplier: 8.5 },
  helmet: { key: 'helmet', label: 'Helmet', stat: 'hp',     multiplier: 4.0 },
};

export const SLOT_ORDER = ['weapon', 'ring', 'armor', 'helmet'];

// Weighted slot pick used when rolling a crafted/market item.
// Biased toward the slots that have the biggest combat impact.
export const SLOT_ROLL_WEIGHTS = {
  weapon: 30,
  armor:  30,
  helmet: 20,
  ring:   20,
};

export function pickSlotKey(rng = Math.random) {
  const total = Object.values(SLOT_ROLL_WEIGHTS).reduce((s, w) => s + w, 0);
  const r = rng() * total;
  let acc = 0;
  for (const [key, weight] of Object.entries(SLOT_ROLL_WEIGHTS)) {
    acc += weight;
    if (r <= acc) return key;
  }
  return SLOT_ORDER[0];
}

// Rarity table
export const RARITIES = [
  { key: 'Common',    multiplier: 1.0,   color: '#b0b4bb', sockets: () => (Math.random() < 0.20 ? 1 : 0) },
  { key: 'Uncommon',  multiplier: 2.5,   color: '#4fbf5f', sockets: () => 1 },
  { key: 'Rare',      multiplier: 6.0,   color: '#3a8ff0', sockets: () => (Math.random() < 0.5 ? 1 : 2) },
  { key: 'Epic',      multiplier: 18.0,  color: '#a24cd6', sockets: () => 2 },
  { key: 'Legendary', multiplier: 60.0,  color: '#f08a2a', sockets: () => (Math.random() < 0.5 ? 2 : 3) },
  { key: 'Mythical',  multiplier: 250.0, color: '#e04040', sockets: () => 3 },
];

export function getRarityByKey(key) {
  return RARITIES.find(r => r.key === key);
}

// Stat = floor(oreValue * slotMult * rarityMult)
export function rollItemStat(oreValue, slotKey, rarityKey) {
  const slot = SLOTS[slotKey];
  const rarity = getRarityByKey(rarityKey);
  return Math.floor(oreValue * slot.multiplier * rarity.multiplier);
}

// Base sell price for a freshly-rolled item.
export function baseSellPrice(oreValue, rarityKey) {
  const rarity = getRarityByKey(rarityKey);
  return Math.floor(oreValue * 15 * rarity.multiplier);
}

// Upgrade cost to go from level L to L+1 (0-indexed levels, max 10).
export const MAX_UPGRADE_LEVEL = 10;
export function upgradeCost(baseSellPrice, currentLevel) {
  return Math.floor(baseSellPrice * (currentLevel + 1));
}

// New stat value after an upgrade: +10% of current stat (min +1)
export function upgradedStat(currentStat) {
  return currentStat + Math.max(1, Math.floor(currentStat * 0.10));
}

// Final sell price including upgrades & socketed gems.
export function totalSellPrice(base, totalUpgradeCost, gemsSellValue = 0) {
  return base + Math.floor(totalUpgradeCost * 0.8) + gemsSellValue;
}
