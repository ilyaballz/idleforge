// Starting player stats
export const PLAYER = {
  hp: 100,
  damage: 5,
  attackSpeed: 1.0,      // attacks per second
  hpRegen: 1,            // HP per second
  critChance: 0.05,
  critMultiplier: 2.0,
  attackRadius: 60,      // pixels — detect/attack mobs within this
  mineRadius: 45,        // pixels — mine rocks within this (shorter than attackRadius)
  moveSpeed: 120,        // pixels per second // TODO: уточнить
  size: 24,              // pixels // TODO: уточнить
};

// XP curve for character level-ups
export const xpForLevel = (level) => Math.floor(100 * Math.pow(1.5, level));
