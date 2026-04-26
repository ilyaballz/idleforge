// Mobs: HP, damage per hit, attack speed (per sec), xp/gold reward, aggro radius
// Glass-cannon tuning: low HP + high damage = short, tense fights.
export const MOBS = [
  { tier: 0, name: 'Stone Golem',  hp: 30,   damage: 8,   attackSpeed: 1.0, reward: 60,   aggroRadius: 120, color: '#7a8490', size: 22 },
  { tier: 1, name: 'Copper Snake', hp: 90,   damage: 14,  attackSpeed: 2.0, reward: 250,  aggroRadius: 120, color: '#c77b47', size: 20 },
  { tier: 2, name: 'Iron Knight',  hp: 260,  damage: 60,  attackSpeed: 1.2, reward: 900,  aggroRadius: 120, color: '#5a6470', size: 26 },
  { tier: 3, name: 'Werewolf',     hp: 900,  damage: 100, attackSpeed: 3.0, reward: 3000, aggroRadius: 120, color: '#8a5a3a', size: 28 },
];

// Both gold and XP use the same `reward` value.
export const mobMoveSpeed = 70; // px/sec // TODO: уточнить

// Bosses: hand-placed elite mobs with guaranteed first-kill rewards.
// Keyed for the player's "first kill" tracker so the egg drops only once.
export const BOSSES = {
  king_snake: {
    key: 'king_snake',
    name: 'King of Snakes',
    tier: 1,                  // shares Copper-band scaling for derived bonuses
    hp: 800,
    damage: 25,
    attackSpeed: 2.0,
    reward: 1800,             // gold + xp
    aggroRadius: 180,
    color: '#3f8a4e',
    crownColor: '#f2c14e',
    size: 38,
    moveSpeed: 60,            // slightly slower than regular mobs — heavy presence
  },
  iron_warlord: {
    key: 'iron_warlord',
    name: 'Iron Warlord',
    tier: 2,                  // Iron-band — gates the descent to Silver Depths
    hp: 1800,
    damage: 70,
    attackSpeed: 1.0,
    reward: 4500,
    aggroRadius: 180,
    color: '#4a5460',         // darker iron than the Knight base
    crownColor: '#f2c14e',
    size: 44,
    moveSpeed: 45,            // heavy armor — slowest of the bosses
  },
  alpha_werewolf: {
    key: 'alpha_werewolf',
    name: 'Alpha Werewolf',
    tier: 3,                  // Silver-band — endgame gate of the prototype
    hp: 5500,
    damage: 110,
    attackSpeed: 2.5,
    reward: 12000,
    aggroRadius: 200,         // wider — alpha senses prey from further out
    color: '#5a3a2a',         // darker pelt than the regular Werewolf
    crownColor: '#f2c14e',
    size: 46,
    moveSpeed: 80,            // faster than its pack — predator alpha
  },
};
