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

// Rarity table.
// Sockets are NOT rolled at craft time — they unlock through item upgrades
// (see SOCKET_UNLOCK_LEVELS). `sockets()` is kept on the row for legacy callers
// and always returns 0 so a freshly-rolled item starts socketless.
export const RARITIES = [
  { key: 'Common',    multiplier: 1.0,   color: '#b0b4bb', sockets: () => 0 },
  { key: 'Uncommon',  multiplier: 2.5,   color: '#4fbf5f', sockets: () => 0 },
  { key: 'Rare',      multiplier: 6.0,   color: '#3a8ff0', sockets: () => 0 },
  { key: 'Epic',      multiplier: 18.0,  color: '#a24cd6', sockets: () => 0 },
  { key: 'Legendary', multiplier: 60.0,  color: '#f08a2a', sockets: () => 0 },
  { key: 'Mythical',  multiplier: 250.0, color: '#e04040', sockets: () => 0 },
];

export function getRarityByKey(key) {
  return RARITIES.find(r => r.key === key);
}

// Socket-unlock schedule per rarity. Each entry is the upgrade level at which
// a new socket opens up. Higher rarities open sockets earlier; Common gets a
// single socket at L3 so dragging a Common to max only pays off if its base
// stat is exceptional.
export const SOCKET_UNLOCK_LEVELS = {
  Common:    [3],
  Uncommon:  [3, 5],
  Rare:      [2, 4],
  Epic:      [2, 4, 5],
  Legendary: [1, 3, 5],
  Mythical:  [1, 2, 3],
};

export function socketsAtLevel(rarityKey, upgradeLevel) {
  const levels = SOCKET_UNLOCK_LEVELS[rarityKey] || [];
  let count = 0;
  for (const lv of levels) if (upgradeLevel >= lv) count++;
  return count;
}

// Returns the next upgrade level that grants a new socket, or null if none.
export function nextSocketLevel(rarityKey, upgradeLevel) {
  const levels = SOCKET_UNLOCK_LEVELS[rarityKey] || [];
  for (const lv of levels) if (lv > upgradeLevel) return lv;
  return null;
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

// Upgrade cost to go from level L to L+1 (0-indexed levels, max 5).
// Fewer, chunkier levels — each step is +20% stat so the click feels meaningful
// and the player can plan around socket-unlock thresholds.
export const MAX_UPGRADE_LEVEL = 5;
export function upgradeCost(baseSellPrice, currentLevel) {
  return Math.floor(baseSellPrice * (currentLevel + 1));
}

// New stat value after an upgrade: +20% of current stat (min +1)
export function upgradedStat(currentStat) {
  return currentStat + Math.max(1, Math.floor(currentStat * 0.20));
}

// Final sell price including upgrades & socketed gems.
export function totalSellPrice(base, totalUpgradeCost, gemsSellValue = 0) {
  return base + Math.floor(totalUpgradeCost * 0.8) + gemsSellValue;
}
