// ============================================================
// UI — rendering + DOM updates + input
// ============================================================

import {
  WORLD, getPlayerStats, computePower,
  craftItem, equipItem, sellItem, upgradeItem, buyPickaxe, choosePerk,
  selectOreTier, dismissCraftResult, travelToZone,
  ensureMarket, refreshMarket, buyMarketItem, buyMarketGem, buyMarketEgg,
  socketGem, unsocketGem, sellGem,
  hatchEgg, sacrificeEgg, setActivePet, dismissActivePet,
} from './game.js';
import { PICKAXES } from './balance/pickaxes.js';
import { ORES } from './balance/ores.js';
import {
  SLOT_ORDER, SLOTS, getRarityByKey, RARITIES, MAX_UPGRADE_LEVEL,
  upgradeCost, totalSellPrice,
} from './balance/equipment.js';
import { xpForLevel } from './balance/player.js';
import {
  forgeAttempts, xpForForgeLevel, availableRarities, forgeChances,
} from './balance/forge.js';
import { formatPerk } from './balance/perks.js';
import {
  GEM_TYPES, GEM_TIERS, gemSideForSlot,
} from './balance/gems.js';
import {
  PET_TYPES, PET_MAX_LEVEL,
  petXpForLevel, petPrimaryValue, petSecondaryParams, eggSacrificeXP,
} from './balance/pets.js';

const $ = (id) => document.getElementById(id);

// ---------- SVG icons (24x24 viewBox, fill=currentColor) ----------
// Simple silhouettes in the style of game-icons.net — paste into HTML, color via CSS.
const ICONS = {
  sword: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,1.5 13.8,4.5 13.8,14 10.2,14 10.2,4.5"/><rect x="6.5" y="14" width="11" height="1.8"/><rect x="11.1" y="15.8" width="1.8" height="5"/><circle cx="12" cy="21.6" r="1.4"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2 L20 5 V11.5 C20 17 16.2 20.2 12 22 C7.8 20.2 4 17 4 11.5 V5 Z"/></svg>`,
  helmet: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 13 C4 7 7 3.5 12 3.5 C17 3.5 20 7 20 13 V18.5 H4 Z"/><rect x="6.5" y="13.5" width="11" height="2.2" fill="#0e1014" opacity="0.55"/></svg>`,
  ring: `<svg viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M12 8.5 C16.4 8.5 19 12 19 15.5 C19 19 16.4 22 12 22 C7.6 22 5 19 5 15.5 C5 12 7.6 8.5 12 8.5 Z M12 11.5 C14.5 11.5 16 13.2 16 15.5 C16 17.8 14.5 19 12 19 C9.5 19 8 17.8 8 15.5 C8 13.2 9.5 11.5 12 11.5 Z"/><polygon points="9.5,3 14.5,3 12,8.2"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.3 C4 14.5 2.5 10 2.5 7 C2.5 4.5 4.5 2.8 7 2.8 C9.3 2.8 11 4.4 12 6.3 C13 4.4 14.7 2.8 17 2.8 C19.5 2.8 21.5 4.5 21.5 7 C21.5 10 20 14.5 12 21.3 Z"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="9.5" y="3" width="5" height="18" rx="1"/><rect x="3" y="9.5" width="18" height="5" rx="1"/></svg>`,
  bullseye: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2"/></svg>`,
  pickaxe: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 7 C7 3.5 12 3.5 16 5 L21 10 C17 8.5 13 8.5 9 10 Z"/><rect x="10.6" y="9" width="2.2" height="13" transform="rotate(20 12 15)"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 14.85,8.9 22.2,9.3 16.5,14 18.6,21.2 12,17.3 5.4,21.2 7.5,14 1.8,9.3 9.15,8.9"/></svg>`,
  gem: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="7,3 17,3 22,9 12,22 2,9"/><polyline fill="none" stroke="#0e1014" stroke-opacity="0.3" stroke-width="1" points="2,9 7,3 12,9 17,3 22,9"/><line x1="12" y1="9" x2="12" y2="22" stroke="#0e1014" stroke-opacity="0.3" stroke-width="1"/></svg>`,
  chestplate: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.5 5.5 L9.5 4 L14.5 4 L18.5 5.5 L17 10.5 L15 11.5 L15 19.5 L9 19.5 L9 11.5 L7 10.5 Z"/></svg>`,
};

function iconHtml(key, extraClass = '') {
  const svg = ICONS[key];
  if (!svg) return '';
  return `<span class="ic-svg ${extraClass}">${svg}</span>`;
}

// ---------- Mob silhouette paths (game-icons.net, CC BY 3.0) ----------
// viewBox is 512x512 for all. Path2D is lazily cached on first use.
// Attribution: Rock Golem — Delapouite; Snake, Battle Gear, Werewolf — Lorc.
const MOB_ICON_PATHS = {
  0: 'm227.7 25-57.9 57.96L183.4 151h145.2l13.6-68.04-32.8-32.84L282.5 64l16.3-24.53L284.3 25h-56.6zM195 88.44 240 111l-4 17h-41V88.44zm122 0V128h-41l-4-17 32-16.05 13-6.51zM154 109.1l-22 11 10.6 17.1-24.1-10.4L73 149.6v16l91.8-13.1-10.8-43.4zm204 0-10.8 43.4 91.8 13.1v-16l-81-40.5zm-152.4 60.1-63.3 4.7-6.6 1-9.2 62.3 50.2 25.1 44.5-14.8 5.6 17-51.5 17.2-44.4-22.2 20.4 84.5 95.7 13.6V196.8l-41.4-27.6zm100.8 0L265 196.8v160.8l95.7-13.6 20.4-84.5-23.8 11.9-19.6 38.6-18.8-34.2-33.7-11.3 5.6-17 44.5 14.8 50.2-25.1-9.2-62.3-6.6-1-63.3-4.7zm-189.6 8.4-61.32 8.7-30.04 40.1 3.64 25.5 25.38 10.4L33.09 280l6.47 45.3L103 312.7v-57.4l13.8-77.7zm278.4 0 13.8 77.6v57.4l52 10.4 13.7-13.7 11.9-82.9-30.1-40.1-28-4-4.2 17.9-9.9-19.9-19.2-2.7zM104.1 330.8 42.78 343l28 126 47.42-11.8-14.1-126.4zm303.8 0-14.1 126.4 22.6 5.6 7.9-25.8 17.8 28.1L469.2 343l-61.3-12.2zm-256 31.4L138.1 487h80.3l37.6-75.1 37.6 75.1h30.8l11.6-23 11.5 23h26.4l-13.8-124.8L256 377.1l-41.9-6-6.1 34.4-15.3-37.5-40.8-5.8z',
  1: 'M301.563 20.22c-8.64-.033-17.075.304-25.22.968-200.737 0-184.708 197.468 0 226 184.71 28.53 137.485 190.906 9.907 190.906-84.162 0-140.85-19.887-181.03-64.156-42.064-46.34-12.496-99.594 44.28-51.938 57.026 47.867 100.32 83.576 171.813 28-89.54 29.698-124.626-42.73-188.313-81.875-60.388-37.117-138.036 38.746-86 121.25 43.402 68.815 152.713 107.78 243.344 107.78 220.645 0 259.324-271.296 63.094-301.936-69.28-10.818-119.376-23.398-143.688-61.907-17.817-28.226 32.672-85.843 97.656-59.688 9.406 15.75 13.877 35.578 15.375 65.47l83.5 39.53 3.22-5.438.063.125c8.535-4.49 14.952-14.657 20.906-26.03-10.923 4.674-23.103 4.475-34.69 1.468a84.447 84.447 0 0 1-8.092-6c-23.392-19.585-28.737-45.978-11.938-58.97 12.435-9.615 33.52-9.19 53.125-.374 8.603 18.074 9.702 35.265 11.188 52.5 10.24-14.024 15.704-29.453 18.562-45.656l10.72-18.063C421.43 35.528 357.307 20.423 301.56 20.22zm42.812 22.06c13.64.758 28.504 1.625 41.72 9.407l-9.47 16.126c-8.187-4.822-19.96-6.137-33.28-6.876l1.03-18.656z',
  2: 'M262.406 17.188c-27.22 8.822-54.017 28.012-72.375 55.53 17.544 47.898 17.544 57.26 0 105.157 19.92 15.463 40.304 24.76 60.782 27.47-2.063-25.563-3.63-51.13 1.125-76.69-13.625-1.483-23.374-5.995-37-13.874V82.563c35.866 19.096 61.84 18.777 98.813 0v32.22c-13.364 6.497-21.886 11.16-35.25 13.218 3.614 25.568 3.48 51.15 1.375 76.72 18.644-3.265 37.236-12.113 55.5-26.845-14.353-47.897-14.355-57.26 0-105.156-16.982-28.008-47.453-46.633-72.97-55.532zm-129.594 8.218c-25.906 110.414-27.35 215.33-27.4 330.922-18.84-1.537-37.582-5.12-56.027-11.12v28.554h69.066c8.715 35.025 6.472 70.052-1.036 105.078h28.13c-7.195-35.026-8.237-70.053-.872-105.078h68.904v-28.555c-18.49 4.942-37.256 8.552-56.097 10.46.082-114.94 2.496-223.068-24.667-330.26zm89.47 202.375c0 117.27 25.517 233.342 120.155 257.97C446.62 464.716 462.72 345.374 462.72 227.78H222.28z',
  3: 'M340.573 495.942h-79.318c-17.24-19.952-46.972-25.794 25.136-118.418 12.088-15.528-46.796-47.858-56.975-35.75-28.683 46.058-50.585 105.183-120.653 71.499-6.986 26.338 4.46 54.395 10.054 82.67h-94.4c16.02-47.83 23.117-100.957 70.94-127.915l40.776 20.109c-1.342-16.2-2.167-32.398 1.676-48.597-120.404-30.952-104.494-70.512-112.833-80.714l23.46 7.54c-15.39-46.284 5.568-77.477 18.434-92.724 4.425 9.79 12.396 44.278 20.108 65.913 4.531-5.565 4.27-12.491 17.316-14.244-3.269 44.218 4.552 80.447 46.362 80.715 14.779-23.381 32.411-39.627 51.39-52.507-4.278-20.515-1.554-60.232-20.11-60.885-25.41-.894-37.227 2.808-54.74-2.793-16.173-22.335-14.987-47.59-12.74-67.847-54.678-27.557-48.39-81.972-13.772-88.792-4.022 22.54-9.233 40.639 15.9 49.392.914-42.185 2.97-89.372 65.844-54.272-20.147 7.362-41.442 16.125-36.077 39.484 46.607-22.884 55.874 4.5 63.086 21.858-17.15-.46-38.262-19.805-52.078 6.336-8.267 15.643 3.313 43.175 13.965 59.21 30.528-25.635 55.627-59.8 103.337-48.038-23.147-24.95-24.066-49.9-25.695-74.85 15.918 4.581 33.276 14.078 57.534 37.425h150.816L432.74 119.46l-15.584-20.272-24.075 24.74-21.785-26.252-29.046 33.514 13.406 16.2 15.082-18.993 20.108 21.785 25.136-21.226 12.848 12.289-11.73 28.487c-32.382 2.288-63.976-11.185-98.31 30.164 9.407 21.581 26.252 34.796 52.506 37.424 61.734-77.259 87.839-40.664 97.308-19.008-18.712-7.396-41.145-5.18-48.99 20.963 94.104-13.285 65.17 46.659 58.734 63.227-9.057-20.891-7.92-50.593-41.698-38.37 21.891 49.98.846 55.718-11.73 64.795-2.965-27.495-3.925-70.39-31.28-62.56-48.574 13.901-81.41 34.295-99.428-35.191-12.245 12.959-20.846 28.52-18.433 51.948 64.634 19.134 94.215 50.374 100.082 103.907 1.383 12.625-48.923 20.805-72.712 15.07-8.508 46.645 12.735 72.095 37.425 93.841z',
};
const _mobPathCache = {};
function getMobPath(tier) {
  if (!_mobPathCache[tier]) _mobPathCache[tier] = new Path2D(MOB_ICON_PATHS[tier] || MOB_ICON_PATHS[0]);
  return _mobPathCache[tier];
}

// Map slot key → icon key for tiles and chips.
const SLOT_ICON_KEY = {
  weapon: 'sword',
  ring:   'ring',
  armor:  'chestplate',
  helmet: 'helmet',
};

// Persist player facing direction across frames (so they don't snap to right when idle)
let _playerFacing = 1;

// ---------- Canvas ----------
let canvas, ctx;

export function initCanvas(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = WORLD.viewW * dpr;
  canvas.height = WORLD.viewH * dpr;
  canvas.style.width = WORLD.viewW + 'px';
  canvas.style.height = WORLD.viewH + 'px';
  ctx.scale(dpr, dpr);
}

export function render(state) {
  const p = state.player;
  const cam = state.camera;

  ctx.fillStyle = '#1a1d24';
  ctx.fillRect(0, 0, WORLD.viewW, WORLD.viewH);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawGrid(cam);

  ctx.strokeStyle = 'rgba(242, 193, 78, 0.15)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD.width, WORLD.height);

  drawForge(state);
  drawShop(state);
  drawPortal(state);

  const stats = getPlayerStats(p);
  // Attack radius (outer, faint red-ish)
  ctx.strokeStyle = 'rgba(230, 80, 80, 0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, stats.attackRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Mine radius (inner, faint yellow)
  ctx.strokeStyle = 'rgba(255, 210, 90, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(p.x, p.y, stats.mineRadius, 0, Math.PI * 2);
  ctx.stroke();

  const targetId = p.target?.id;
  const targetIsRock = p.target?.type === 'rock';
  const targetIsMob  = p.target?.type === 'mob';
  for (const r of state.rocks) drawRock(r, targetIsRock && r.id === targetId);
  for (const m of state.mobs)  drawMob(m, p, targetIsMob && m.id === targetId);

  drawPet(state);
  drawPlayer(p);
  drawPlayerLabel(p, stats);

  for (const f of state.floatingTexts) {
    const alpha = 1 - (f.life / f.maxLife);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Screen-space HUD
  drawForgePrompt(state);
  drawShopPrompt(state);
  drawPortalPrompt(state);
}

function drawGrid(cam) {
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  const step = 30;
  const x0 = Math.floor(cam.x / step) * step;
  const y0 = Math.floor(cam.y / step) * step;
  for (let x = x0; x < cam.x + WORLD.viewW + step; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.height); ctx.stroke();
  }
  for (let y = y0; y < cam.y + WORLD.viewH + step; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.width, y); ctx.stroke();
  }
}

function drawForge(state) {
  const fb = WORLD.forgeBuilding;
  if (!fb) return;

  // Interact ring
  if (state.nearForge) {
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(fb.x, fb.y, fb.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = 'rgba(242, 193, 78, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(fb.x, fb.y, fb.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const s = fb.size;

  // Stone pedestal (under both anvil and fire)
  ctx.fillStyle = '#6e757d';
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fb.x - s * 0.7, fb.y + s * 0.5);
  ctx.lineTo(fb.x - s * 0.55, fb.y + s * 0.15);
  ctx.lineTo(fb.x + s * 0.55, fb.y + s * 0.15);
  ctx.lineTo(fb.x + s * 0.7, fb.y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Pedestal cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fb.x - s * 0.2, fb.y + s * 0.2);
  ctx.lineTo(fb.x - s * 0.1, fb.y + s * 0.4);
  ctx.moveTo(fb.x + s * 0.3, fb.y + s * 0.2);
  ctx.lineTo(fb.x + s * 0.25, fb.y + s * 0.45);
  ctx.stroke();

  // ----- Forge fire (small brazier to the right) -----
  // Pot base
  ctx.fillStyle = '#2a2326';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(fb.x + s * 0.25, fb.y + s * 0.15);
  ctx.lineTo(fb.x + s * 0.55, fb.y + s * 0.15);
  ctx.lineTo(fb.x + s * 0.45, fb.y - s * 0.05);
  ctx.lineTo(fb.x + s * 0.35, fb.y - s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fire (animated pulse)
  const pulse = 0.7 + 0.3 * Math.sin(state.t * 6);
  const flameH = s * 0.3 * pulse;
  // Outer red-orange
  ctx.fillStyle = '#e04040';
  ctx.beginPath();
  ctx.moveTo(fb.x + s * 0.3, fb.y - s * 0.05);
  ctx.quadraticCurveTo(fb.x + s * 0.4, fb.y - s * 0.05 - flameH * 1.3, fb.x + s * 0.5, fb.y - s * 0.05);
  ctx.closePath();
  ctx.fill();
  // Inner yellow
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.moveTo(fb.x + s * 0.35, fb.y - s * 0.05);
  ctx.quadraticCurveTo(fb.x + s * 0.4, fb.y - s * 0.05 - flameH * 0.9, fb.x + s * 0.45, fb.y - s * 0.05);
  ctx.closePath();
  ctx.fill();
  // Glow under the fire
  ctx.save();
  ctx.globalAlpha = 0.35 * pulse;
  const grad = ctx.createRadialGradient(fb.x + s * 0.4, fb.y, 2, fb.x + s * 0.4, fb.y, s * 0.8);
  grad.addColorStop(0, '#ffaa40');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(fb.x + s * 0.4, fb.y, s * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ----- Anvil (main silhouette, on the left of pedestal) -----
  const ax = fb.x - s * 0.15; // center of the anvil
  const ay = fb.y - s * 0.1;
  ctx.fillStyle = '#3a3e45';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Top working surface (flat with horn protruding left)
  ctx.moveTo(ax - s * 0.35, ay - s * 0.05); // left tip of horn
  ctx.lineTo(ax - s * 0.15, ay - s * 0.15); // horn base top
  ctx.lineTo(ax + s * 0.3, ay - s * 0.15);  // right top
  ctx.lineTo(ax + s * 0.3, ay);             // right side down
  ctx.lineTo(ax + s * 0.15, ay + s * 0.02); // narrowing
  ctx.lineTo(ax + s * 0.12, ay + s * 0.1);  // waist
  ctx.lineTo(ax + s * 0.22, ay + s * 0.22); // foot right
  ctx.lineTo(ax - s * 0.22, ay + s * 0.22); // foot left
  ctx.lineTo(ax - s * 0.12, ay + s * 0.1);
  ctx.lineTo(ax - s * 0.15, ay + s * 0.02);
  ctx.lineTo(ax - s * 0.15, ay);            // back to horn base
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Anvil highlight (top edge)
  ctx.strokeStyle = '#6e757d';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(ax - s * 0.33, ay - s * 0.06);
  ctx.lineTo(ax - s * 0.15, ay - s * 0.13);
  ctx.lineTo(ax + s * 0.28, ay - s * 0.13);
  ctx.stroke();
  // Small hot metal piece on the anvil (the "ingot being forged")
  const glowPulse = 0.6 + 0.4 * Math.sin(state.t * 8);
  ctx.fillStyle = `rgba(255, 120, 40, ${glowPulse})`;
  ctx.fillRect(ax + s * 0.02, ay - s * 0.18, s * 0.18, 3);
}

function drawShop(state) {
  const sb = WORLD.shopBuilding;
  if (!sb) return;

  // Interact ring
  if (state.nearShop) {
    ctx.strokeStyle = 'rgba(166, 116, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, sb.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = 'rgba(166, 116, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sb.x, sb.y, sb.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const s = sb.size;
  // Wooden counter base
  ctx.fillStyle = '#6d5032';
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sb.x - s * 0.7, sb.y + s * 0.5);
  ctx.lineTo(sb.x - s * 0.7, sb.y + s * 0.1);
  ctx.lineTo(sb.x + s * 0.7, sb.y + s * 0.1);
  ctx.lineTo(sb.x + s * 0.7, sb.y + s * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Counter wood planks (horizontal lines)
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sb.x - s * 0.7, sb.y + s * 0.25);
  ctx.lineTo(sb.x + s * 0.7, sb.y + s * 0.25);
  ctx.moveTo(sb.x - s * 0.7, sb.y + s * 0.38);
  ctx.lineTo(sb.x + s * 0.7, sb.y + s * 0.38);
  ctx.stroke();

  // Striped awning/canopy on top — alternating purple/cream stripes
  const awningY = sb.y - s * 0.35;
  const awningH = s * 0.28;
  const stripes = 6;
  const stripeW = (s * 1.6) / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#7a4ebd' : '#e8d8b4';
    ctx.beginPath();
    ctx.moveTo(sb.x - s * 0.8 + i * stripeW, awningY);
    ctx.lineTo(sb.x - s * 0.8 + (i + 1) * stripeW, awningY);
    ctx.lineTo(sb.x - s * 0.8 + (i + 1) * stripeW - stripeW * 0.15, awningY + awningH);
    ctx.lineTo(sb.x - s * 0.8 + i * stripeW - stripeW * 0.15, awningY + awningH);
    ctx.closePath();
    ctx.fill();
  }
  // Awning outline
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sb.x - s * 0.8, awningY);
  ctx.lineTo(sb.x + s * 0.8, awningY);
  ctx.lineTo(sb.x + s * 0.8 - stripeW * 0.15, awningY + awningH);
  ctx.lineTo(sb.x - s * 0.8 - stripeW * 0.15, awningY + awningH);
  ctx.closePath();
  ctx.stroke();

  // Awning support posts
  ctx.strokeStyle = '#4a3622';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sb.x - s * 0.7, sb.y + s * 0.1);
  ctx.lineTo(sb.x - s * 0.72, awningY + awningH);
  ctx.moveTo(sb.x + s * 0.7, sb.y + s * 0.1);
  ctx.lineTo(sb.x + s * 0.68, awningY + awningH);
  ctx.stroke();

  // Crystal sign above — glowing diamond
  const signPulse = 0.6 + 0.4 * Math.sin(state.t * 3);
  const cx = sb.x;
  const cy = awningY - s * 0.28;
  // Glow behind
  ctx.save();
  ctx.globalAlpha = 0.4 * signPulse;
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.5);
  grad.addColorStop(0, '#a674ff');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Diamond crystal
  ctx.fillStyle = '#a674ff';
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.08, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.08, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.15, cy - s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Crystal highlight
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.02, cy - s * 0.15);
  ctx.lineTo(cx + s * 0.06, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.03, cy + s * 0.05);
  ctx.closePath();
  ctx.fill();

  // Items on the counter — 3 tiny gem-like chips
  const chipY = sb.y + s * 0.18;
  const chipColors = ['#e04040', '#3a8ff0', '#3fb56a'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = chipColors[i];
    const chipX = sb.x - s * 0.4 + i * s * 0.4;
    ctx.beginPath();
    ctx.arc(chipX, chipY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPortal(state) {
  drawPortalAt(state, WORLD.portal,     state.nearPortal);
  drawPortalAt(state, WORLD.exitPortal, state.nearExitPortal);
}

function drawPortalAt(state, portal, near) {
  if (!portal) return;
  const p = state.player;
  const meetsReq = p.pickaxeTier >= (portal.requiresPickaxe || 0);

  // Outer interact ring
  if (near) {
    ctx.strokeStyle = meetsReq ? 'rgba(110, 180, 255, 0.7)' : 'rgba(230, 80, 80, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, portal.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = meetsReq ? 'rgba(110, 180, 255, 0.2)' : 'rgba(230, 80, 80, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(portal.x, portal.y, portal.interactRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const s = portal.size;
  // Base platform
  ctx.fillStyle = '#1a1822';
  ctx.fillRect(portal.x - s / 2 - 4, portal.y - s / 2 - 4, s + 8, s + 8);
  ctx.strokeStyle = '#0a0c0f';
  ctx.lineWidth = 2;
  ctx.strokeRect(portal.x - s / 2 - 4, portal.y - s / 2 - 4, s + 8, s + 8);

  // Arch body
  ctx.fillStyle = meetsReq ? '#2a3a52' : '#3a2a2a';
  ctx.beginPath();
  ctx.moveTo(portal.x - s / 2, portal.y + s / 2);
  ctx.lineTo(portal.x - s / 2, portal.y - s / 4);
  ctx.quadraticCurveTo(portal.x, portal.y - s / 2 - 4, portal.x + s / 2, portal.y - s / 4);
  ctx.lineTo(portal.x + s / 2, portal.y + s / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.stroke();

  // Inner void (pulsing if meetsReq)
  const pulse = meetsReq ? (0.6 + 0.4 * Math.sin(state.t * 4)) : 0.3;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = meetsReq ? '#6eb4ff' : '#4a2a2a';
  ctx.beginPath();
  ctx.moveTo(portal.x - s / 2 + 6, portal.y + s / 2 - 2);
  ctx.lineTo(portal.x - s / 2 + 6, portal.y - s / 6);
  ctx.quadraticCurveTo(portal.x, portal.y - s / 2, portal.x + s / 2 - 6, portal.y - s / 6);
  ctx.lineTo(portal.x + s / 2 - 6, portal.y + s / 2 - 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.fillStyle = meetsReq ? 'rgba(110, 180, 255, 0.9)' : 'rgba(230, 80, 80, 0.8)';
  ctx.textAlign = 'center';
  ctx.fillText(portal.label, portal.x, portal.y - s / 2 - 10);
}

// Helper: irregular rock path (7-sided polygon with slight jitter so each rock has character).
// Uses r.id for stable shape so rocks don't wiggle between frames.
function rockPath(r) {
  const s = r.size;
  ctx.beginPath();
  const verts = 7;
  // Stable pseudo-random based on id (no wiggle between frames)
  const rng = (i) => {
    const seed = (r.id * 9301 + i * 49297) % 233280;
    return (seed / 233280) * 0.3 - 0.15; // -15%..+15%
  };
  for (let i = 0; i < verts; i++) {
    const angle = (Math.PI * 2 * i / verts) - Math.PI / 2;
    const jitter = 1 + rng(i);
    const px = r.x + Math.cos(angle) * s * jitter;
    const py = r.y + Math.sin(angle) * s * jitter * 0.9; // slightly squashed
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// Hex color utilities: lighten/darken for shading.
function shade(hex, amt) {
  // amt: -1..1 — negative=darken, positive=lighten
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const adj = (c) => {
    if (amt >= 0) return Math.round(c + (255 - c) * amt);
    return Math.round(c * (1 + amt));
  };
  const toHex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return '#' + toHex(adj(r)) + toHex(adj(g)) + toHex(adj(b));
}

function drawRock(r, isTarget) {
  const s = r.size;
  const isStone = r.ore.tier === 0;
  // Base color is ALWAYS the ore color — copper rocks are brown, iron rocks
  // are grey-steel, silver is pale, etc. Shading is derived from the base.
  const baseColor = r.ore.color;
  const baseDark  = shade(baseColor, -0.35);
  const baseLight = shade(baseColor, +0.35);

  // Drop shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(r.x, r.y + s * 0.85, s * 0.9, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Target halo — stroked under the fill so only the outer ring shows through.
  if (isTarget) {
    rockPath(r);
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Main body
  rockPath(r);
  ctx.fillStyle = baseColor;
  ctx.fill();

  // Highlight (top-left) — brighter ellipse inside clipped rock shape
  ctx.save();
  rockPath(r);
  ctx.clip();
  ctx.fillStyle = baseLight;
  ctx.beginPath();
  ctx.ellipse(r.x - s * 0.25, r.y - s * 0.35, s * 0.7, s * 0.45, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Shadow (bottom-right)
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(r.x + s * 0.25, r.y + s * 0.4, s * 0.65, s * 0.4, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Texture: small darker flecks for stone-like feel
  ctx.fillStyle = baseDark;
  for (let i = 0; i < 3; i++) {
    const seed = (r.id * 131 + i * 997) % 1000;
    const vx = r.x + ((seed % 100) / 100 - 0.5) * s * 1.2;
    const vy = r.y + (((seed / 7) % 100) / 100 - 0.5) * s * 1.2;
    ctx.beginPath();
    ctx.arc(vx, vy, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // For non-stone rocks: bright "nugget" specks embedded in the rock face,
  // so you can still tell "yes this has visible ore in it" even though the
  // whole body is tinted to match.
  if (!isStone) {
    // Bright shiny spots (pure light version of the ore)
    ctx.fillStyle = shade(baseColor, +0.55);
    for (let i = 0; i < 3; i++) {
      const seed = (r.id * 263 + i * 571) % 1000;
      const vx = r.x + ((seed % 100) / 100 - 0.5) * s * 1.1;
      const vy = r.y + (((seed / 7) % 100) / 100 - 0.5) * s * 1.1;
      const vr = s * 0.12 + (seed % 4) * 0.02;
      ctx.beginPath();
      ctx.arc(vx, vy, vr, 0, Math.PI * 2);
      ctx.fill();
    }
    // White specular dot on each shiny spot
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 3; i++) {
      const seed = (r.id * 263 + i * 571) % 1000;
      const vx = r.x + ((seed % 100) / 100 - 0.5) * s * 1.1 - 1.5;
      const vy = r.y + (((seed / 7) % 100) / 100 - 0.5) * s * 1.1 - 1.5;
      ctx.beginPath();
      ctx.arc(vx, vy, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Outline on top
  rockPath(r);
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Hit flash (white overlay)
  if (r.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, r.hitFlash / 0.12);
    rockPath(r);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  // HP bar
  if (r.hp < r.maxHp) {
    const barW = s * 1.6;
    const pct = r.hp / r.maxHp;
    ctx.fillStyle = '#000';
    ctx.fillRect(r.x - barW / 2, r.y - s - 8, barW, 4);
    ctx.fillStyle = '#f0c040';
    ctx.fillRect(r.x - barW / 2, r.y - s - 8, barW * pct, 4);
  }
}

function drawMob(m, player, isTarget) {
  const d = Math.hypot(m.x - player.x, m.y - player.y);
  if (d < m.aggroRadius * 1.2) {
    ctx.strokeStyle = 'rgba(230,80,80,0.10)';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.aggroRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(m.x, m.y + m.size * 0.55, m.size * 0.55, m.size * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  const path = getMobPath(m.tpl.tier);
  // viewBox is 512; render at ~2.4x m.size so icon matches old mob footprint.
  const renderSize = m.size * 2.4;
  const scale = renderSize / 512;

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(scale, scale);
  ctx.translate(-256, -256);
  ctx.lineJoin = 'round';

  // Target halo: stroked first so fill covers the inner half, leaving a clean red rim.
  if (isTarget) {
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 64;
    ctx.stroke(path);
  }

  // Dark outline for silhouette contrast (also stroked under the fill).
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 18;
  ctx.stroke(path);

  // Body fill — tinted with the mob's tier color.
  ctx.fillStyle = m.tpl.color;
  ctx.fill(path);

  ctx.restore();

  // Hit flash — additive white over the actual silhouette, not a bounding
  // circle. We re-apply the mob's transform and fill the Path2D with 'lighter'
  // composite so the coloured body pixels brighten toward white on hit.
  if (m.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, m.hitFlash / 0.15);
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(m.x, m.y);
    ctx.scale(scale, scale);
    ctx.translate(-256, -256);
    ctx.fillStyle = '#fff';
    ctx.fill(path);
    ctx.restore();
  }

  // HP bar — bosses get a beefier, named bar with a gold accent.
  if (m.isBoss) {
    drawBossLabel(m);
  } else if (m.hp < m.maxHp) {
    const barW = m.size + 14;
    const pct = m.hp / m.maxHp;
    ctx.fillStyle = '#000';
    ctx.fillRect(m.x - barW / 2, m.y - m.size - 2, barW, 4);
    ctx.fillStyle = '#e04040';
    ctx.fillRect(m.x - barW / 2, m.y - m.size - 2, barW * pct, 4);
  }

  // Chain-aggro alert — yellow "!" floats above the mob while it's been
  // pulled in by a damaged group-mate. Bobs vertically and pulses opacity.
  if (m.alertedTimer > 0) {
    const ax = m.x;
    const ay = m.y - m.size - 12;
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 6) * 2;
    const pulse = 0.65 + 0.35 * Math.sin(t * 8);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#1a1d24';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('!', ax, ay + bob);
    ctx.fillText('!', ax, ay + bob);
    ctx.restore();
  }

  // Boss crown — gold tri-spike above the silhouette, drawn last so it sits on top.
  if (m.isBoss) {
    const cx = m.x;
    const cy = m.y - m.size * 0.85;
    const cw = m.size * 0.7;
    ctx.fillStyle = m.tpl.crownColor || '#f2c14e';
    ctx.strokeStyle = '#1a1d24';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Crown base
    ctx.moveTo(cx - cw / 2, cy);
    ctx.lineTo(cx + cw / 2, cy);
    ctx.lineTo(cx + cw / 2, cy - 3);
    // Three spikes
    ctx.lineTo(cx + cw * 0.32, cy - 3);
    ctx.lineTo(cx + cw * 0.16, cy - 9);
    ctx.lineTo(cx, cy - 4);
    ctx.lineTo(cx - cw * 0.16, cy - 9);
    ctx.lineTo(cx - cw * 0.32, cy - 3);
    ctx.lineTo(cx - cw / 2, cy - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Gem dots on the band
    ctx.fillStyle = '#e04040';
    ctx.fillRect(cx - 1, cy - 2, 2, 1.5);
    ctx.fillStyle = '#3a8ff0';
    ctx.fillRect(cx - cw * 0.30, cy - 2, 2, 1.5);
    ctx.fillRect(cx + cw * 0.22, cy - 2, 2, 1.5);
  }
}

// Wide HP bar + name plate for bosses. Sits well above the crown.
function drawBossLabel(m) {
  const barW = Math.max(80, m.size + 40);
  const barH = 6;
  const x = m.x - barW / 2;
  const y = m.y - m.size - 22;
  const pct = Math.max(0, m.hp / m.maxHp);

  // Name
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(m.tpl.name, m.x + 1, y - 4);
  ctx.fillStyle = '#f2c14e';
  ctx.fillText(m.tpl.name, m.x, y - 5);

  // Bar
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#3a1010';
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = '#e04040';
  ctx.fillRect(x, y, barW * pct, barH);
  // Gold trim
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, barH + 1);
}

function drawPlayer(p) {
  const s = p.size;

  // Facing direction: follow active movement, remember last one on idle.
  if (Math.abs(p.moveX) > 0.05) {
    _playerFacing = p.moveX >= 0 ? 1 : -1;
  }
  const facing = _playerFacing;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 0.55, s * 0.55, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body (torso) — brown overalls
  ctx.fillStyle = '#6d5032';
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + s * 0.25, s * 0.42, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head — skin tone circle
  ctx.fillStyle = '#f2c89a';
  ctx.beginPath();
  ctx.arc(p.x, p.y - s * 0.05, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Helmet (yellow hard-hat with brim)
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  // Dome
  ctx.arc(p.x, p.y - s * 0.15, s * 0.32, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Brim
  ctx.fillRect(p.x - s * 0.4, p.y - s * 0.15, s * 0.8, 2.5);
  ctx.strokeRect(p.x - s * 0.4, p.y - s * 0.15, s * 0.8, 2.5);
  // Helmet lamp (small circle on front)
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(p.x + facing * s * 0.12, p.y - s * 0.28, 2, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (tiny dots under helmet)
  ctx.fillStyle = '#1a1d24';
  ctx.fillRect(p.x - 4, p.y - s * 0.05, 2, 2);
  ctx.fillRect(p.x + 2, p.y - s * 0.05, 2, 2);

  // Pickaxe — drawn on facing side
  ctx.save();
  ctx.translate(p.x + facing * s * 0.4, p.y + s * 0.1);
  ctx.rotate(facing * -0.35);
  // Handle
  ctx.strokeStyle = '#6d5032';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.25);
  ctx.lineTo(0, s * 0.4);
  ctx.stroke();
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.25);
  ctx.lineTo(0, s * 0.4);
  ctx.stroke();
  // Head of pickaxe (dark metal pointed shape)
  ctx.fillStyle = '#6d7680';
  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, -s * 0.3);
  ctx.lineTo(s * 0.28, -s * 0.3);
  ctx.lineTo(s * 0.2, -s * 0.2);
  ctx.lineTo(-s * 0.2, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Pointed ends
  ctx.fillStyle = '#b4bac3';
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, -s * 0.3);
  ctx.lineTo(-s * 0.4, -s * 0.22);
  ctx.lineTo(-s * 0.2, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(s * 0.28, -s * 0.3);
  ctx.lineTo(s * 0.4, -s * 0.22);
  ctx.lineTo(s * 0.2, -s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Tiny canvas-primitive companion next to the player.
// Each species has a distinct silhouette so it's recognizable at thumb-size.
function drawPet(state) {
  const p = state.player;
  const pet = p.activePet;
  if (!pet || !p.petPos) return;
  const px = p.petPos.x, py = p.petPos.y;
  const t = state.t;

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(px, py + 8, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1a1d24';
  ctx.lineWidth = 1;

  if (pet.type === 'wolf') {
    // Crouched wolf — body ellipse, ears, tail.
    ctx.fillStyle = pet.color;
    ctx.beginPath();
    ctx.ellipse(px, py + 1, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.arc(px + 6, py - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ears (triangles)
    ctx.beginPath();
    ctx.moveTo(px + 4, py - 5);
    ctx.lineTo(px + 5.5, py - 8);
    ctx.lineTo(px + 6.5, py - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 7, py - 5);
    ctx.lineTo(px + 8.5, py - 8);
    ctx.lineTo(px + 9, py - 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Tail (animated wag)
    ctx.beginPath();
    ctx.moveTo(px - 7, py);
    ctx.lineTo(px - 11 + Math.sin(t * 6) * 1.5, py - 3);
    ctx.lineWidth = 2;
    ctx.strokeStyle = pet.color;
    ctx.stroke();
    // Eye
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(px + 7, py - 2, 1.4, 1.4);
  } else if (pet.type === 'bat') {
    // Bat — small body with flapping wings (animation).
    const wing = Math.sin(t * 14) * 4;
    ctx.fillStyle = pet.color;
    // Wings
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - 8, py - 3 + wing);
    ctx.lineTo(px - 5, py + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 8, py - 3 + wing);
    ctx.lineTo(px + 5, py + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Body
    ctx.beginPath();
    ctx.ellipse(px, py, 3, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ears
    ctx.beginPath();
    ctx.moveTo(px - 1.5, py - 3);
    ctx.lineTo(px - 2.5, py - 6);
    ctx.lineTo(px - 0.5, py - 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + 1.5, py - 3);
    ctx.lineTo(px + 2.5, py - 6);
    ctx.lineTo(px + 0.5, py - 3.5);
    ctx.closePath();
    ctx.fill();
    // Glowing eyes
    ctx.fillStyle = pet.accent;
    ctx.fillRect(px - 1.4, py - 1, 1, 1);
    ctx.fillRect(px + 0.4, py - 1, 1, 1);
  } else if (pet.type === 'fairy') {
    // Glowing orb + flapping translucent wings + bobbing.
    const bob = Math.sin(t * 3) * 2;
    const wing = Math.sin(t * 14) * 3;
    ctx.save();
    ctx.translate(px, py + bob);
    // Glow halo
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
    grad.addColorStop(0, pet.color);
    grad.addColorStop(1, 'rgba(255,224,102,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    // Wings (translucent)
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-5, -1, 5, 3 + wing * 0.3, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(5, -1, 5, 3 + wing * 0.3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = pet.color;
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1d24';
    ctx.stroke();
    ctx.restore();
  } else if (pet.type === 'golem') {
    // Stocky stone golem — square body, blocky arms.
    ctx.fillStyle = pet.color;
    ctx.strokeStyle = '#1a1d24';
    ctx.fillRect(px - 6, py - 3, 12, 9);
    ctx.strokeRect(px - 6, py - 3, 12, 9);
    // Head
    ctx.fillRect(px - 4, py - 8, 8, 6);
    ctx.strokeRect(px - 4, py - 8, 8, 6);
    // Glowing eyes (orange)
    ctx.fillStyle = pet.accent;
    ctx.fillRect(px - 2.5, py - 6, 1.5, 1.5);
    ctx.fillRect(px + 1, py - 6, 1.5, 1.5);
    // Arms
    ctx.fillStyle = pet.color;
    ctx.fillRect(px - 9, py - 1, 3, 6);
    ctx.strokeRect(px - 9, py - 1, 3, 6);
    ctx.fillRect(px + 6, py - 1, 3, 6);
    ctx.strokeRect(px + 6, py - 1, 3, 6);
  }

  // Level pip — tiny rarity-tinted dot above pet.
  const rarityColor = getRarityByKey(pet.rarity)?.color || '#ffffff';
  ctx.fillStyle = rarityColor;
  ctx.beginPath();
  ctx.arc(px, py - 12, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayerLabel(p, stats) {
  const barW = 54;
  const hpY = p.y - p.size / 2 - 20;
  ctx.font = 'bold 10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000';
  ctx.fillText(`⚔ ${Math.floor(stats.damage)}`, p.x + 1, hpY - 5 + 1);
  ctx.fillStyle = '#f2c14e';
  ctx.fillText(`⚔ ${Math.floor(stats.damage)}`, p.x, hpY - 5);

  const pct = p.hp / stats.maxHp;
  ctx.fillStyle = '#000';
  ctx.fillRect(p.x - barW / 2 - 1, hpY - 1, barW + 2, 6);
  ctx.fillStyle = '#2a0a0a';
  ctx.fillRect(p.x - barW / 2, hpY, barW, 4);
  ctx.fillStyle = '#e04040';
  ctx.fillRect(p.x - barW / 2, hpY, barW * pct, 4);

  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${Math.ceil(p.hp)}/${Math.floor(stats.maxHp)}`, p.x, hpY + 14);
}

// Bottom CTA button. Stores its hitbox in state so the canvas click handler
// can route a tap on the prompt straight to the action without having to hit
// the tiny building sprite.
function drawProximityPrompt(state, slot, label, color) {
  const t = performance.now() / 1000;
  const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 4));
  const w = 240, h = 44;
  const x = (WORLD.viewW - w) / 2;
  const y = WORLD.viewH - 140;
  const r = 10;

  // Outer glow — pulses opacity for the "press me" feel.
  ctx.save();
  ctx.globalAlpha = pulse * 0.55;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  roundRect(x - 2, y - 2, w + 4, h + 4, r + 2);
  ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = 'rgba(12,14,20,0.92)';
  roundRect(x, y, w, h, r);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  roundRect(x, y, w, h, r);
  ctx.stroke();

  // Label
  ctx.font = 'bold 16px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(label, WORLD.viewW / 2, y + h / 2 + 1);

  // Stash the screen-space rect for click routing.
  state._promptHitbox = state._promptHitbox || {};
  state._promptHitbox[slot] = { x, y, w, h };
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawForgePrompt(state) {
  if (state._promptHitbox) state._promptHitbox.forge = null;
  if (!state.nearForge) return;
  drawProximityPrompt(state, 'forge', '◆ TAP TO CRAFT ◆', '#f2c14e');
}

function drawShopPrompt(state) {
  if (state._promptHitbox) state._promptHitbox.shop = null;
  if (!state.nearShop) return;
  drawProximityPrompt(state, 'shop', '◆ TAP TO SHOP ◆', '#a674ff');
}

function drawPortalPrompt(state) {
  // Prefer the main portal prompt (deeper) when both are near, which realistically won't happen.
  const portal = state.nearPortal
    ? WORLD.portal
    : (state.nearExitPortal ? WORLD.exitPortal : null);
  if (!portal) return;
  const p = state.player;
  const meetsReq = p.pickaxeTier >= (portal.requiresPickaxe || 0);
  let msg;
  if (meetsReq) {
    msg = `◆ TAP TO ENTER ${portal.label} ◆`;
  } else {
    const need = PICKAXES[portal.requiresPickaxe];
    msg = need ? `✗ REQUIRES ${need.name.toUpperCase()} ✗` : '✗ LOCKED ✗';
  }
  ctx.font = 'bold 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const w = ctx.measureText(msg).width + 20;
  const x = WORLD.viewW / 2 - w / 2;
  const y = WORLD.viewH - 150;
  ctx.fillStyle = 'rgba(10,12,15,0.85)';
  ctx.fillRect(x, y, w, 22);
  ctx.strokeStyle = meetsReq ? '#6eb4ff' : '#e04040';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, 22);
  ctx.fillStyle = meetsReq ? '#6eb4ff' : '#e04040';
  ctx.fillText(msg, WORLD.viewW / 2, y + 15);
}

// ---------- HUD ----------
export function updateHud(state) {
  const p = state.player;
  $('top-gold').textContent = Math.floor(p.gold).toLocaleString();
  const cryEl = $('top-crystals');
  if (cryEl) cryEl.textContent = Math.floor(p.crystals).toLocaleString();
  $('top-level').textContent = p.level;
  const xpNeeded = xpForLevel(p.level);
  $('top-xp-fill').style.width = `${Math.min(100, (p.xp / xpNeeded) * 100)}%`;

  // Per-tier ore chips
  const rail = $('ore-rail');
  if (rail) {
    rail.innerHTML = ORES.map((ore, i) => {
      const c = p.oreByTier[i] || 0;
      return `<div class="ore-chip ${c === 0 ? 'zero' : ''}" title="${ore.name}">
        <div class="nugget" style="background:${ore.color}"></div>
        <span class="count">${c}</span>
      </div>`;
    }).join('');
  }

  // Pulse the shop button when the next pickaxe tier is affordable.
  const shopBtn = $('btn-shop');
  if (shopBtn) {
    const nextPk = PICKAXES.find(pk => pk.tier > p.pickaxeTier);
    const canUpgrade = nextPk && p.gold >= nextPk.price;
    shopBtn.classList.toggle('pulse', !!canUpgrade);
  }
}

export function renderLog(state) {
  const el = $('log');
  if (!el) return;
  el.innerHTML = state.log.slice(0, 3).map(e => `<div>${e}</div>`).join('');
}

// ---------- Popups ----------
export function openPopup(name) {
  document.querySelectorAll('.popup').forEach(el => el.classList.remove('open'));
  const t = $('popup-' + name);
  if (t) t.classList.add('open');
}

export function closeAllPopups() {
  document.querySelectorAll('.popup').forEach(el => el.classList.remove('open'));
}

export function initPopups(state) {
  $('btn-gear').onclick = () => { resetInventoryPicker(); renderInventory(state); openPopup('gear'); };
  $('btn-shop').onclick = () => { ensureMarket(state); renderShop(state); openPopup('shop'); };
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.onclick = () => closeAllPopups();
  });
  document.querySelectorAll('.popup').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) {
        // Clicking the backdrop: close only the topmost popup. The item-detail
        // popup layers on top of the gear popup, so only it should dismiss.
        if (el.id === 'popup-item-detail') closeItemDetail();
        else closeAllPopups();
      }
    });
  });
  // Item-detail popup close button (doesn't use [data-close] so the gear popup
  // underneath stays open).
  document.querySelectorAll('[data-close-item-detail]').forEach(btn => {
    btn.onclick = () => closeItemDetail();
  });
  // Tap forge or portal on the canvas
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (WORLD.viewW / rect.width);
    const sy = (e.clientY - rect.top) * (WORLD.viewH / rect.height);
    const worldX = sx + state.camera.x;
    const worldY = sy + state.camera.y;

    // Screen-space CTA buttons take priority over the world hit-test — they're
    // the obvious tap target while the building itself is just a backdrop.
    const hitInRect = (r) => r && sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
    const promptHits = state._promptHitbox || {};
    if (state.nearForge && hitInRect(promptHits.forge)) {
      renderForge(state);
      openPopup('forge');
      return;
    }
    if (state.nearShop && hitInRect(promptHits.shop)) {
      ensureMarket(state);
      renderShop(state);
      openPopup('shop');
      return;
    }

    const fb = WORLD.forgeBuilding;
    if (fb) {
      const d = Math.hypot(worldX - fb.x, worldY - fb.y);
      if (d <= fb.size / 2 + 14 && state.nearForge) {
        renderForge(state);
        openPopup('forge');
        return;
      }
    }

    const sb = WORLD.shopBuilding;
    if (sb) {
      const d = Math.hypot(worldX - sb.x, worldY - sb.y);
      if (d <= sb.size / 2 + 14 && state.nearShop) {
        ensureMarket(state);
        renderShop(state);
        openPopup('shop');
        return;
      }
    }

    const tryTapPortal = (portal, near) => {
      if (!portal || !near) return false;
      const d = Math.hypot(worldX - portal.x, worldY - portal.y);
      if (d > portal.size / 2 + 14) return false;
      const meetsReq = state.player.pickaxeTier >= (portal.requiresPickaxe || 0);
      if (!meetsReq) {
        const need = PICKAXES[portal.requiresPickaxe];
        showToast(need ? `Requires ${need.name}` : 'Locked');
        return true;
      }
      travelToZone(state, portal.toZone);
      _forgeRenderKey = ''; // forge may be absent in the new zone
      return true;
    };

    if (tryTapPortal(WORLD.portal,     state.nearPortal))     return;
    if (tryTapPortal(WORLD.exitPortal, state.nearExitPortal)) return;
  });
}

// ---------- Inventory ----------
// When the user taps a "+ Add gem" slot on an item, we remember which item and
// show a gem picker at the top of the popup until they pick or cancel.
let _socketPickerFor = null;
// Active tab in inventory popup: 'items' | 'gems' | 'pets'
let _inventoryTab = 'items';
// Slot chip tapped in the paperdoll — used to highlight matching item in the list.
let _highlightedSlot = null;

export function resetInventoryPicker() {
  _socketPickerFor = null;
  _inventoryTab = 'items';
  _highlightedSlot = null;
  _inventoryKey = '';
}

let _inventoryKey = '';

// Build a structural key for the inventory popup. Intentionally excludes live
// HP (which regenerates every frame) — that value is refreshed in-place by
// refreshInventoryLive. Without this guard, hover on cards flickered because
// the DOM was replaced every 0.25s.
function inventoryRenderKey(state) {
  const p = state.player;
  const eqIds = SLOT_ORDER.map(k => {
    const it = p.equipped[k];
    return it ? `${it.id}:${it.stat}:${it.upgradeLevel}:${(it.gems || []).length}` : '0';
  }).join(',');
  const invIds = p.inventory.map(it =>
    `${it.id}:${it.stat}:${it.upgradeLevel}:${(it.gems || []).length}`
  ).join(',');
  const petKey = p.activePet
    ? `${p.activePet.type}:${p.activePet.rarity}:${p.activePet.level}:${p.activePet.xp}`
    : '0';
  return [
    _inventoryTab,
    p.level,
    eqIds,
    invIds,
    p.gemInventory.length,
    p.eggs.length,
    p.pets.length,
    petKey,
  ].join('|');
}

export function renderInventory(state) {
  const el = $('inventory-content');
  if (!el) return;
  const p = state.player;
  const stats = getPlayerStats(p);

  const key = inventoryRenderKey(state);
  if (key === _inventoryKey && el.querySelector('.char-sheet')) {
    // Structural state unchanged — just refresh live numbers (HP).
    refreshInventoryLive(state, stats);
    return;
  }
  _inventoryKey = key;

  let html = '';
  html += renderCharSheet(p, stats);
  html += renderInvTabs(p);

  if (_inventoryTab === 'items')      html += renderItemsTab(state, p);
  else if (_inventoryTab === 'gems')  html += renderGemsTab(p);
  else if (_inventoryTab === 'pets')  html += renderPetsTab(p);

  el.innerHTML = html;
  wireInventoryEvents(state, el);
}

// Updates only the live-changing number (HP) in the character sheet, without
// rebuilding the DOM. Called every frame while the inventory popup is open.
function refreshInventoryLive(state, stats) {
  const tile = $('inventory-content')?.querySelector('.stat-tile.stat-hp .tile-val');
  if (!tile) return;
  const hp = Math.max(0, Math.round(state.player.hp));
  const maxHp = Math.round(stats.maxHp);
  tile.textContent = `${fmtNum(hp)}/${fmtNum(maxHp)}`;
}

// ----- Item detail popup -----
// Opens when a paperdoll slot or an inventory card is tapped. Hosts Equip /
// Upgrade / Sell actions and interactive sockets, so the inventory grid and
// paperdoll stay read-only and compact.
let _itemDetailId = null;
let _itemDetailKey = '';

function openItemDetail(state, itemId) {
  _itemDetailId = itemId;
  _socketPickerFor = null;
  _itemDetailKey = '';
  renderItemDetail(state);
  $('popup-item-detail').classList.add('open');
}

function closeItemDetail() {
  _itemDetailId = null;
  _socketPickerFor = null;
  _itemDetailKey = '';
  $('popup-item-detail').classList.remove('open');
}

export function renderItemDetail(state) {
  const popup = $('popup-item-detail');
  if (!popup || !popup.classList.contains('open')) return;
  if (_itemDetailId == null) { closeItemDetail(); return; }

  const p = state.player;
  const item = findEquippedOrInvItem(p, _itemDetailId);
  if (!item) { closeItemDetail(); return; }

  // Skip the DOM replace if nothing user-visible changed. Without this the
  // periodic re-render from the main frame loop eats hover state and swallows
  // the first click on Equip/Sell. We only rebuild when a field that the popup
  // actually displays moves — stats, level, sockets, afford state, equipped flag.
  const nextCost = item.upgradeLevel < MAX_UPGRADE_LEVEL
    ? upgradeCost(item.baseSellPrice, item.upgradeLevel)
    : null;
  const canAffordUpgrade = nextCost !== null && p.gold >= nextCost ? 1 : 0;
  const isEq = p.equipped[item.slot]?.id === item.id ? 1 : 0;
  const pickerGems = _socketPickerFor === item.id ? p.gemInventory.length : -1;
  const key = [
    item.id, item.stat, item.upgradeLevel, (item.gems || []).length,
    canAffordUpgrade, isEq, _socketPickerFor, pickerGems,
  ].join('|');
  if (key === _itemDetailKey) return;
  _itemDetailKey = key;

  const slot = SLOTS[item.slot];
  const isEquipped = p.equipped[item.slot]?.id === item.id;
  const gemsVal = (item.gems || []).reduce((s, g) => s + (g.sellValue || 0), 0);
  const sellPrice = totalSellPrice(item.baseSellPrice, item.totalUpgradeCost, gemsVal);

  const inner = itemCardInner(item, item.slot);
  const border = inner.rarityColor ? ` style="border-color:${hexToRgba(inner.rarityColor, 0.6)}"` : '';
  const socketsHtml = item.sockets > 0 ? renderItemSockets(item) : '';
  const picker = _socketPickerFor === item.id ? renderSocketPicker(p, item) : '';

  $('item-detail-sub').textContent = `${slot.label.toUpperCase()}${isEquipped ? ' · EQUIPPED' : ''}`;
  $('item-detail-body').innerHTML = `
    <div class="slot-card detail ${inner.statCls}"${border}>${inner.html}</div>
    ${socketsHtml}
    ${picker}
    <div class="item-detail-actions">
      ${isEquipped
        ? `<button class="item-action equip" disabled>EQUIPPED</button>`
        : `<button class="item-action equip" data-detail-equip="${item.id}">EQUIP</button>`}
      ${nextCost !== null
        ? `<button class="item-action upgrade" data-detail-upgrade="${item.id}" ${p.gold < nextCost ? 'disabled' : ''}>UPGRADE<span class="sub">Lv ${item.upgradeLevel + 1} · ${goldCost(nextCost)}</span></button>`
        : `<button class="item-action upgrade" disabled>MAXED<span class="sub">Lv ${MAX_UPGRADE_LEVEL}</span></button>`}
      <button class="item-action sell" data-detail-sell="${item.id}" data-sell-from="${isEquipped ? 'eq' : 'inv'}">SELL<span class="sub">${goldCost(sellPrice)}</span></button>
    </div>
  `;

  wireItemDetailEvents(state);
}

function wireItemDetailEvents(state) {
  const body = $('item-detail-body');
  if (!body) return;
  body.querySelectorAll('[data-detail-equip]').forEach(btn => {
    btn.onclick = () => {
      equipItem(state, +btn.dataset.detailEquip);
      renderItemDetail(state);
      renderInventory(state);
    };
  });
  body.querySelectorAll('[data-detail-upgrade]').forEach(btn => {
    btn.onclick = () => {
      upgradeItem(state, +btn.dataset.detailUpgrade);
      renderItemDetail(state);
      renderInventory(state);
    };
  });
  body.querySelectorAll('[data-detail-sell]').forEach(btn => {
    btn.onclick = () => {
      sellItem(state, +btn.dataset.detailSell, btn.dataset.sellFrom === 'eq');
      closeItemDetail();
      renderInventory(state);
    };
  });
  body.querySelectorAll('[data-open-picker]').forEach(btn => {
    btn.onclick = () => { _socketPickerFor = +btn.dataset.openPicker; renderItemDetail(state); };
  });
  body.querySelectorAll('[data-unsocket]').forEach(btn => {
    btn.onclick = () => {
      const [itemId, idx] = btn.dataset.unsocket.split(':').map(Number);
      unsocketGem(state, itemId, idx);
      renderItemDetail(state);
      renderInventory(state);
    };
  });
  body.querySelectorAll('[data-pick-gem]').forEach(btn => {
    btn.onclick = () => {
      if (_socketPickerFor == null) return;
      const res = socketGem(state, _socketPickerFor, +btn.dataset.pickGem);
      _socketPickerFor = null;
      renderItemDetail(state);
      renderInventory(state);
      if (!res.ok) showToast(res.reason);
    };
  });
  body.querySelectorAll('[data-close-picker]').forEach(btn => {
    btn.onclick = () => { _socketPickerFor = null; renderItemDetail(state); };
  });
}

// Paperdoll layout matches the visual grid below the top stat tiles:
// helmet / weapon on row 1, armor / ring on row 2.
const PAPERDOLL_ORDER = ['helmet', 'weapon', 'armor', 'ring'];

// Compact number formatter: 17300 → "17.3k", 382500 → "382k", 1.2M etc.
function fmtNum(n) {
  if (n < 1000) return Math.round(n).toString();
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1000000) return Math.round(n / 1000) + 'k';
  if (n < 10000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n < 1000000000) return Math.round(n / 1000000) + 'M';
  return (n / 1000000000).toFixed(1) + 'B';
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Price label with the gold coin icon instead of a literal "g" suffix.
// Matches the HUD coin style so the gold currency reads consistently everywhere.
const COIN_IC = '<span class="coin-ic">$</span>';
function goldCost(n) { return `${fmtNum(n)}${COIN_IC}`; }

function renderCharSheet(p, stats) {
  const hp = Math.max(0, Math.round(p.hp));
  const maxHp = Math.round(stats.maxHp);
  const power = computePower(p);
  const dps = stats.damage * stats.attackSpeed;

  const topTilesHtml = `
    <div class="stat-tiles">
      <div class="stat-tile stat-dmg">
        <div class="tile-lbl">ATTACK</div>
        <div class="tile-val">${fmtNum(stats.damage)}</div>
        <div class="tile-sub">${fmtNum(dps)}/s</div>
      </div>
      <div class="stat-tile stat-hp">
        <div class="tile-lbl">HEALTH</div>
        <div class="tile-val">${fmtNum(hp)}/${fmtNum(maxHp)}</div>
        <div class="tile-sub">+${fmtNum(stats.hpRegen)}/s</div>
      </div>
    </div>`;

  let cardsHtml = '<div class="slot-grid-v2">';
  for (const key of PAPERDOLL_ORDER) cardsHtml += renderSlotCard(p, key);
  cardsHtml += '</div>';

  const critPct = Math.round(stats.critChance * 100);
  const drPct = Math.round(stats.damageReduction * 100);
  const pillsHtml = `
    <div class="stat-pills">
      <div class="stat-pill"><span class="pl-k">CRIT</span><span class="pl-v">${critPct}% ×${stats.critMultiplier.toFixed(1)}</span></div>
      <div class="stat-pill"><span class="pl-k">DR</span><span class="pl-v">${drPct}%</span></div>
      <div class="stat-pill"><span class="pl-k">MINE</span><span class="pl-v">${fmtNum(stats.pickaxeDamage)}</span></div>
      <div class="stat-pill pl-power"><span class="pl-k">POWER</span><span class="pl-v">${fmtNum(power)}</span></div>
    </div>`;

  return `<div class="char-sheet">${topTilesHtml}${cardsHtml}${pillsHtml}</div>`;
}

// Shared card body — the rarity header + icon + big stat + type + socket dots.
// Reused by paperdoll, inventory grid, craft-result cards, and the item-detail popup.
function itemCardInner(item, slotKey) {
  const slot = SLOTS[slotKey];
  const ic = iconHtml(SLOT_ICON_KEY[slotKey]);
  const statCls = slot.stat === 'damage' ? 'slot-dmg' : 'slot-hp';
  const statLabel = slot.stat === 'damage' ? 'DAMAGE' : 'HEALTH';

  if (!item) {
    return {
      html: `
        <div class="slot-card-hdr">${slot.label.toUpperCase()}</div>
        <div class="slot-card-body">
          <div class="slot-card-ic">${ic}</div>
          <div class="slot-card-stat">
            <div class="stat-num">—</div>
            <div class="stat-type">EMPTY</div>
          </div>
        </div>`,
      statCls, rarityColor: null, isEmpty: true,
    };
  }

  const r = getRarityByKey(item.rarity);
  const hdrBg = hexToRgba(r.color, 0.22);
  const upgradePrefix = item.upgradeLevel > 0 ? `+${item.upgradeLevel} ` : '';
  const title = `${upgradePrefix}${item.rarity.toUpperCase()} ${item.oreName.toUpperCase()} ${slot.label.toUpperCase()}`;

  let socketsHtml = '';
  if (item.sockets > 0) {
    socketsHtml = '<div class="slot-card-sockets">';
    for (let i = 0; i < item.sockets; i++) {
      const filled = i < (item.gems?.length || 0);
      socketsHtml += `<span class="socket-dot${filled ? ' filled' : ''}"></span>`;
    }
    socketsHtml += '</div>';
  }

  return {
    html: `
      <div class="slot-card-hdr" style="background:${hdrBg};color:${r.color}">${title}</div>
      <div class="slot-card-body">
        <div class="slot-card-ic">${ic}</div>
        <div class="slot-card-stat">
          <div class="stat-num">${fmtNum(item.stat)}</div>
          <div class="stat-type">${statLabel}</div>
        </div>
        ${socketsHtml}
      </div>`,
    statCls, rarityColor: r.color, isEmpty: false,
  };
}

function renderSlotCard(p, slotKey) {
  const item = p.equipped[slotKey];
  const active = _highlightedSlot === slotKey ? ' active' : '';
  const inner = itemCardInner(item, slotKey);
  const emptyCls = inner.isEmpty ? ' empty' : '';
  const border = inner.rarityColor ? ` style="border-color:${hexToRgba(inner.rarityColor, 0.6)}"` : '';
  return `<div class="slot-card ${inner.statCls}${active}${emptyCls}" data-slot-chip="${slotKey}"${border}>${inner.html}</div>`;
}

// Inventory card: clickable (opens item-detail popup), always equipped-slot colored.
function renderInventoryCard(item) {
  const inner = itemCardInner(item, item.slot);
  const border = inner.rarityColor ? ` style="border-color:${hexToRgba(inner.rarityColor, 0.6)}"` : '';
  return `<div class="slot-card ${inner.statCls}" data-item-id="${item.id}"${border}>${inner.html}</div>`;
}

function renderInvTabs(p) {
  const itemCount = SLOT_ORDER.filter(k => p.equipped[k]).length + p.inventory.length;
  const gemCount = p.gemInventory.length;
  const petCount = p.eggs.length + p.pets.length + (p.activePet ? 1 : 0);
  return `
    <div class="inv-tabs">
      <button class="inv-tab ${_inventoryTab === 'items' ? 'active' : ''}" data-tab="items">${iconHtml('sword')} ITEMS (${itemCount})</button>
      <button class="inv-tab ${_inventoryTab === 'gems' ? 'active' : ''}" data-tab="gems">${iconHtml('gem')} GEMS (${gemCount})</button>
      <button class="inv-tab ${_inventoryTab === 'pets' ? 'active' : ''}" data-tab="pets">🐾 PETS (${petCount})</button>
    </div>`;
}

function renderItemsTab(state, p) {
  // Equipped items live in the paperdoll at the top of this popup — no need
  // to also list them here. Inventory = the backlog waiting to be equipped/sold.
  if (p.inventory.length === 0) {
    return '<div class="empty">No items — craft at the forge</div>';
  }
  let html = `<div class="sect-title">INVENTORY (${p.inventory.length})</div>`;
  html += '<div class="inv-grid">';
  for (const item of p.inventory) html += renderInventoryCard(item);
  html += '</div>';
  return html;
}

function renderGemsTab(p) {
  if (p.gemInventory.length === 0) {
    return '<div class="empty">No gems — defeat tougher mobs to find them</div>';
  }
  return renderGemsList(p, /*pickable*/ false, /*slotKey*/ null);
}

// ----- Pets tab -----
function petPrimaryLabel(pet) {
  const def = PET_TYPES[pet.type];
  const v = petPrimaryValue(pet);
  if (def.primaryStat === 'hp_regen_pct_max') return `+${(v * 100).toFixed(2)}%/s HP`;
  return `+${(v * 100).toFixed(1)}% ${def.primaryLabel}`;
}

function petSecondaryLabel(pet) {
  const def = PET_TYPES[pet.type];
  const s = petSecondaryParams(pet);
  if (!s) return '';
  if (pet.type === 'wolf')
    return `+${(s.perStack * 100).toFixed(2)}% atk spd / crit · max +${(s.maxStack * 100).toFixed(1)}%`;
  if (pet.type === 'bat')
    return `${(s.doubleHit * 100).toFixed(1)}% double-hit chance`;
  if (pet.type === 'fairy')
    return `+${(s.hiHpDmg * 100).toFixed(1)}% damage when HP > 80%`;
  if (pet.type === 'golem')
    return `Counter ${(s.counterMult * 100).toFixed(0)}% of player damage`;
  return def.secondaryLabel;
}

function renderPetCard(pet, opts = {}) {
  const def = PET_TYPES[pet.type];
  const rarity = getRarityByKey(pet.rarity);
  const xpNeeded = pet.level >= PET_MAX_LEVEL ? 0 : petXpForLevel(pet.level);
  const xpPct = xpNeeded ? Math.min(100, (pet.xp / xpNeeded) * 100) : 100;
  const action = opts.activeBadge
    ? `<button class="pet-act danger" data-pet-dismiss>Stash</button>`
    : `<button class="pet-act" data-pet-activate="${opts.benchIndex}">Activate</button>`;
  return `
    <div class="pet-card" style="border-color:${hexToRgba(rarity.color, 0.6)}">
      <div class="pet-head">
        <span class="pet-emoji" style="background:${def.color}">${petGlyph(pet.type)}</span>
        <div class="pet-main">
          <div class="pet-name" style="color:${rarity.color}">
            ${pet.name} <span class="pet-lvl">L${pet.level}/${PET_MAX_LEVEL}</span>
            ${opts.activeBadge ? '<span class="pet-active-badge">ACTIVE</span>' : ''}
          </div>
          <div class="pet-stat">${petPrimaryLabel(pet)}</div>
          <div class="pet-sec">${petSecondaryLabel(pet)}</div>
        </div>
        ${action}
      </div>
      <div class="pet-xp">
        <div class="pet-xp-bar"><div class="pet-xp-fill" style="width:${xpPct}%;background:${rarity.color}"></div></div>
        <div class="pet-xp-text">${pet.level >= PET_MAX_LEVEL ? 'MAX' : `${pet.xp} / ${xpNeeded} XP`}</div>
      </div>
    </div>`;
}

function petGlyph(typeKey) {
  return { wolf: '🐺', bat: '🦇', fairy: '🧚', golem: '🗿' }[typeKey] || '🐾';
}

function renderEggCard(egg, idx, hasActivePet) {
  const def = PET_TYPES[egg.type];
  const rarity = getRarityByKey(egg.rarity);
  const sacXp = eggSacrificeXP(egg.rarity);
  const sacrifice = hasActivePet
    ? `<button class="pet-act subtle" data-egg-sacrifice="${idx}">Feed +${sacXp}xp</button>`
    : '';
  return `
    <div class="egg-card" style="border-color:${hexToRgba(rarity.color, 0.6)}">
      <div class="pet-head">
        <span class="pet-emoji egg" style="background:${def.color}">🥚</span>
        <div class="pet-main">
          <div class="pet-name" style="color:${rarity.color}">${egg.rarity} ${def.name} Egg</div>
          <div class="pet-sec">Hatches into a ${def.name} (${def.primaryLabel})</div>
        </div>
        <div class="egg-actions">
          <button class="pet-act primary" data-egg-hatch="${idx}">Hatch</button>
          ${sacrifice}
        </div>
      </div>
    </div>`;
}

function renderPetsTab(p) {
  const empty = !p.activePet && p.pets.length === 0 && p.eggs.length === 0;
  if (empty) {
    return '<div class="empty">No pets — eggs drop from defeated mobs</div>';
  }
  let html = '';
  if (p.activePet) {
    html += `<div class="sect-title">ACTIVE PET</div>`;
    html += `<div class="pet-list">${renderPetCard(p.activePet, { activeBadge: true })}</div>`;
  }
  if (p.pets.length) {
    html += `<div class="sect-title">BENCH (${p.pets.length})</div><div class="pet-list">`;
    for (let i = 0; i < p.pets.length; i++) {
      html += renderPetCard(p.pets[i], { benchIndex: i });
    }
    html += '</div>';
  }
  if (p.eggs.length) {
    html += `<div class="sect-title">EGGS (${p.eggs.length})</div><div class="pet-list">`;
    for (let i = 0; i < p.eggs.length; i++) {
      html += renderEggCard(p.eggs[i], i, !!p.activePet);
    }
    html += '</div>';
  }
  return html;
}

function findEquippedOrInvItem(p, itemId) {
  for (const k of SLOT_ORDER) if (p.equipped[k]?.id === itemId) return p.equipped[k];
  return p.inventory.find(i => i.id === itemId) || null;
}

function renderSocketPicker(p, item) {
  const slot = SLOTS[item.slot];
  const noGems = p.gemInventory.length === 0;
  return `
    <div class="socket-picker">
      <div class="sp-head">
        <span>Choose gem for <b>${slot.label}</b></span>
        <button class="sp-cancel" data-close-picker>✕</button>
      </div>
      ${noGems
        ? '<div class="empty">No gems in inventory</div>'
        : renderGemsList(p, /*pickable*/ true, item.slot)}
    </div>
  `;
}

function renderGemsList(p, pickable, slotKey) {
  // Group gems by type+tier so duplicates collapse to a count.
  const groups = {};
  for (let i = 0; i < p.gemInventory.length; i++) {
    const g = p.gemInventory[i];
    const key = `${g.type}-${g.tier}`;
    if (!groups[key]) groups[key] = { gem: g, firstIdx: i, n: 0 };
    groups[key].n++;
  }
  let html = '<div class="gem-grid">';
  for (const { gem, firstIdx, n } of Object.values(groups)) {
    const side = slotKey ? gemSideForSlot(slotKey) : null;
    const bonusText = formatGemBonus(gem, side);
    const action = pickable
      ? `<button class="gem-pick" data-pick-gem="${firstIdx}">Socket</button>`
      : `<button class="gem-sell" data-sell-gem="${firstIdx}">${goldCost(gem.sellValue)}</button>`;
    html += `
      <div class="gem-row">
        <div class="gem-icon" style="background:${gem.color}"></div>
        <div class="gem-main">
          <div class="gem-name" style="color:${gem.color}">${gem.name}${n > 1 ? ` ×${n}` : ''}</div>
          <div class="gem-bonus">${bonusText}</div>
        </div>
        ${action}
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// Format a gem's bonus. If `side` is null show both weapon- and armor-side; if
// 'weapon' or 'armor' show only the relevant one.
function formatGemBonus(gem, side = null) {
  const def = GEM_TYPES[gem.type];
  if (!def) return '';
  const wIc = iconHtml('sword');
  const aIc = iconHtml('shield');
  const wTxt = `${wIc} ${formatStatBonus(def.weaponStat, def.weaponValues[gem.tier])}`;
  const aTxt = `${aIc} ${formatStatBonus(def.armorStat, def.armorValues[gem.tier])}`;
  if (side === 'weapon') return wTxt;
  if (side === 'armor')  return aTxt;
  return `${wTxt} · ${aTxt}`;
}

function formatStatBonus(stat, value) {
  if (stat === 'hp_regen_pct_max') return `+${(value * 100).toFixed(1)}%/s HP`;
  const pct = Math.round(value * 100);
  const labels = {
    combat_dmg:       `+${pct}% damage`,
    max_hp_pct:       `+${pct}% max HP`,
    crit_chance:      `+${pct}% crit`,
    atk_speed_pct:    `+${pct}% atk speed`,
    damage_reduction: `+${pct}% dmg reduction`,
  };
  return labels[stat] || `+${pct}% ${stat}`;
}

function renderItemSockets(item) {
  const gems = item.gems || [];
  const slotSide = gemSideForSlot(item.slot);
  const filled = gems.map((g, i) => {
    const def = GEM_TYPES[g.type];
    const values = slotSide === 'weapon' ? def.weaponValues : def.armorValues;
    const stat = slotSide === 'weapon' ? def.weaponStat : def.armorStat;
    const tip = formatStatBonus(stat, values[g.tier]);
    return `<button class="socket filled"
              data-unsocket="${item.id}:${i}"
              style="border-color:${g.color};color:${g.color}"
              title="${tip}">◆ ${GEM_TIERS[g.tier]} ${def.name}</button>`;
  }).join('');
  const emptyCount = item.sockets - gems.length;
  const empties = [];
  for (let i = 0; i < emptyCount; i++) {
    empties.push(`<button class="socket empty" data-open-picker="${item.id}">◇ add gem</button>`);
  }
  return `<div class="sockets">${filled}${empties.join('')}</div>`;
}

function wireInventoryEvents(state, el) {
  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      _inventoryTab = btn.dataset.tab;
      _highlightedSlot = null;
      renderInventory(state);
    };
  });
  // Paperdoll slot tap → open the equipped item's detail popup. Empty slots do nothing.
  el.querySelectorAll('[data-slot-chip]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.slotChip;
      const item = state.player.equipped[key];
      if (item) openItemDetail(state, item.id);
    };
  });
  // Inventory card tap → open item detail popup.
  el.querySelectorAll('[data-item-id]').forEach(btn => {
    btn.onclick = () => openItemDetail(state, +btn.dataset.itemId);
  });
  // Gem selling stays on the gems tab (no detail popup for gems).
  el.querySelectorAll('[data-sell-gem]').forEach(btn => {
    btn.onclick = () => {
      sellGem(state, +btn.dataset.sellGem);
      renderInventory(state);
    };
  });
  // Pet actions
  el.querySelectorAll('[data-egg-hatch]').forEach(btn => {
    btn.onclick = () => { hatchEgg(state, +btn.dataset.eggHatch); renderInventory(state); };
  });
  el.querySelectorAll('[data-egg-sacrifice]').forEach(btn => {
    btn.onclick = () => { sacrificeEgg(state, +btn.dataset.eggSacrifice); renderInventory(state); };
  });
  el.querySelectorAll('[data-pet-activate]').forEach(btn => {
    btn.onclick = () => { setActivePet(state, +btn.dataset.petActivate); renderInventory(state); };
  });
  el.querySelectorAll('[data-pet-dismiss]').forEach(btn => {
    btn.onclick = () => { dismissActivePet(state); renderInventory(state); };
  });
}

// ---------- Forge (по референсу) ----------
// Keyed snapshot so we only do full re-render when something structural changes.
let _forgeRenderKey = '';

function forgeRenderKey(state) {
  const p = state.player;
  return [
    state.forge.level,
    state.forge.xp,
    p.selectedOreTier,
    ...p.oreByTier,
  ].join('|');
}

export function renderForge(state) {
  const el = $('forge-content');
  if (!el) return;
  const key = forgeRenderKey(state);
  if (key === _forgeRenderKey && el.querySelector('#forge-slider')) {
    // Structure unchanged. Just refresh the craft button's availability.
    refreshForgeCraftButton(state);
    return;
  }
  _forgeRenderKey = key;

  const p = state.player;
  $('forge-level-label').textContent = `Level ${state.forge.level}`;

  const xpNeeded = xpForForgeLevel(state.forge.level);
  const xpPct = Math.min(100, (state.forge.xp / xpNeeded) * 100);

  const tier = p.selectedOreTier;
  // Slider can't exceed current stock. Round down to the step (10) so the
  // rail always lands on a legal value. After a craft this recalculates and
  // the slider re-renders at the new cap — so leftovers drive the next craft.
  const stock = p.oreByTier[tier] || 0;
  const sliderMax = Math.max(10, Math.floor(stock / 10) * 10);
  const hasStock = stock >= 10;

  // Preserve slider value across re-renders, but clamp to the new max.
  const existingSlider = $('forge-slider');
  const prevVal = existingSlider ? +existingSlider.value : 10;
  const sliderVal = Math.min(Math.max(10, prevVal), sliderMax);
  const attempts = forgeAttempts(sliderVal);

  const chances = forgeChances(state.forge.level);
  const allowedKeys = availableRarities(state.forge.level).map(r => r.key);

  const matHtml = ORES.map((ore, i) => {
    const count = p.oreByTier[i] || 0;
    const active = i === tier;
    return `
      <div class="mat-card ${active ? 'active' : ''}" data-tier="${i}">
        <div class="mat-icon" style="color:${ore.color}"></div>
        <div class="mat-name">${ore.name}</div>
        <div class="mat-count">${count}</div>
      </div>
    `;
  }).join('');

  const totalChance = Object.values(chances).reduce((s, v) => s + v, 0) || 1;
  const barSegs = RARITIES
    .filter(r => allowedKeys.includes(r.key))
    .map(r => {
      const c = chances[r.key] || 0;
      const pct = (c / totalChance) * 100;
      return `<div class="seg" style="width:${pct}%;background:${r.color}"></div>`;
    })
    .join('');

  const outcomeRows = RARITIES.map(r => {
    const c = chances[r.key] || 0;
    const pct = (c * 100).toFixed(c < 0.01 ? 2 : 1);
    const disabled = !allowedKeys.includes(r.key);
    return `
      <div class="outcome-row" style="${disabled ? 'opacity:0.3' : ''}">
        <span class="dot" style="background:${r.color}"></span>
        <span class="name">${r.key}</span>
        <span class="pct" style="color:${r.color}">${disabled ? '—' : pct + '%'}</span>
      </div>
    `;
  }).join('');

  const canCraft = p.oreByTier[tier] >= sliderVal;

  el.innerHTML = `
    <div class="forge-xp-bar"><div class="fill" style="width:${xpPct}%"></div></div>

    <div class="forge-section-label">MATERIAL</div>
    <div class="material-rail" id="mat-rail">
      ${matHtml}
    </div>

    <div class="infusion-card">
      <div class="infusion-head">
        <div>
          <div class="infusion-title">INFUSION AMOUNT</div>
          <div class="infusion-amount"><span id="infusion-val">${sliderVal}</span><span class="unit" id="infusion-unit">${ORES[tier].name}</span></div>
        </div>
        <div class="infusion-quality">
          <div class="quality-val" id="infusion-quality">QUALITY ×${attempts}</div>
          <div class="quality-luck" id="infusion-attempts">${attempts} attempt${attempts !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="slider-wrap">
        <input id="forge-slider" type="range" min="10" max="${sliderMax}" step="10" value="${sliderVal}" ${hasStock ? '' : 'disabled'}>
        <div class="slider-labels">
          <span>MIN 10</span>
          <span>STOCK ${stock}</span>
        </div>
      </div>
    </div>

    <div class="forge-section-label">OUTCOME CHANCES</div>
    <div class="outcome-bar">${barSegs}</div>
    <div class="outcome-grid">${outcomeRows}</div>

    <button id="forge-btn" class="forge-action" ${canCraft ? '' : 'disabled'}>
      <span class="ic">⚒</span>
      <span>Forge Item</span>
    </button>
  `;

  // Material card click — triggers structural re-render
  el.querySelectorAll('.mat-card').forEach(card => {
    card.onclick = () => {
      selectOreTier(state, +card.dataset.tier);
      _forgeRenderKey = '';
      renderForge(state);
    };
  });

  // Slider: update only the live numbers + button state, no re-render
  const s = $('forge-slider');
  s.oninput = () => {
    const v = +s.value;
    const a = forgeAttempts(v);
    $('infusion-val').textContent = v;
    $('infusion-quality').textContent = `QUALITY ×${a}`;
    $('infusion-attempts').textContent = `${a} attempt${a !== 1 ? 's' : ''}`;
    refreshForgeCraftButton(state);
  };

  $('forge-btn').onclick = () => {
    const res = craftItem(state, +s.value);
    if (!res.ok) showToast(res.reason);
    _forgeRenderKey = '';
    renderForge(state);
  };
}

function refreshForgeCraftButton(state) {
  const btn = $('forge-btn');
  const slider = $('forge-slider');
  if (!btn || !slider) return;
  const p = state.player;
  const v = +slider.value;
  const canCraft = p.oreByTier[p.selectedOreTier] >= v;
  btn.disabled = !canCraft;
}

// ---------- Shop ----------
let _shopTab = 'tools';  // 'tools' | 'market'
let _shopRenderKey = '';

// Shop gets re-called every 0.25s from the main frame loop. Without a key
// guard, hover state on Buy buttons gets wiped constantly. The key captures
// everything structural — tab, pickaxe tier, item ids — but deliberately
// EXCLUDES gold/crystals and the rotation countdown. Those live fields are
// refreshed in-place by refreshShopAffordance / updateMarketTimer.
function shopRenderKey(state) {
  const p = state.player;
  const parts = [_shopTab, p.pickaxeTier];
  if (_shopTab === 'market' && state.market?.items) {
    parts.push(state.market.items.map(it => it?.id || 0).join(','));
    parts.push(state.market.gem?.id || 0);
    parts.push(state.market.egg?.id || 0);
  }
  return parts.join('|');
}

export function renderShop(state) {
  const el = $('shop-content');
  if (!el) return;

  const key = shopRenderKey(state);
  if (key === _shopRenderKey && el.querySelector('.shop-tabs')) {
    // Same structure — just tick the live bits.
    refreshShopAffordance(state);
    updateMarketTimer(state);
    return;
  }
  _shopRenderKey = key;

  const tabsHtml = `
    <div class="shop-tabs">
      <button class="shop-tab ${_shopTab === 'tools' ? 'active' : ''}" data-tab="tools">⛏ TOOLS</button>
      <button class="shop-tab ${_shopTab === 'market' ? 'active' : ''}" data-tab="market">💎 MARKET</button>
    </div>
  `;

  const body = _shopTab === 'tools' ? renderShopTools(state.player) : renderShopMarket(state);
  el.innerHTML = tabsHtml + body;

  el.querySelectorAll('[data-tab]').forEach(btn => {
    btn.onclick = () => {
      _shopTab = btn.dataset.tab;
      _shopRenderKey = '';
      renderShop(state);
    };
  });

  if (_shopTab === 'tools') {
    el.querySelectorAll('[data-buy]').forEach(btn => {
      btn.onclick = () => {
        const res = buyPickaxe(state, +btn.dataset.buy);
        if (!res.ok) showToast(res.reason);
        _shopRenderKey = '';
        renderShop(state);
      };
    });
  } else {
    el.querySelectorAll('[data-buy-market]').forEach(btn => {
      btn.onclick = () => {
        const res = buyMarketItem(state, +btn.dataset.buyMarket);
        if (!res.ok) showToast(res.reason);
        _shopRenderKey = '';
        renderShop(state);
      };
    });
    const buyGemBtn = el.querySelector('[data-buy-gem]');
    if (buyGemBtn) buyGemBtn.onclick = () => {
      const res = buyMarketGem(state);
      if (!res.ok) showToast(res.reason);
      _shopRenderKey = '';
      renderShop(state);
    };
    const buyEggBtn = el.querySelector('[data-buy-egg]');
    if (buyEggBtn) buyEggBtn.onclick = () => {
      const res = buyMarketEgg(state);
      if (!res.ok) showToast(res.reason);
      _shopRenderKey = '';
      renderShop(state);
    };
    const refreshBtn = el.querySelector('[data-refresh-market]');
    if (refreshBtn) {
      refreshBtn.onclick = () => {
        const res = refreshMarket(state);
        if (!res.ok) showToast(res.reason);
        _shopRenderKey = '';
        renderShop(state);
      };
    }
  }
}

// Flip afford/disabled state on Buy buttons without rebuilding the DOM. Runs
// on every frame tick while the shop is open.
function refreshShopAffordance(state) {
  const p = state.player;
  const el = $('shop-content');
  if (!el) return;
  if (_shopTab === 'tools') {
    el.querySelectorAll('[data-buy]').forEach(btn => {
      const tier = +btn.dataset.buy;
      const pk = PICKAXES[tier];
      if (!pk) return;
      const owned = p.pickaxeTier >= pk.tier;
      if (owned) return;  // OWNED/EQUIPPED buttons never toggle
      const afford = p.gold >= pk.price;
      btn.classList.toggle('afford', afford);
      btn.disabled = !afford;
    });
  } else {
    el.querySelectorAll('[data-buy-market]').forEach(btn => {
      const itemId = +btn.dataset.buyMarket;
      const item = state.market?.items?.find(it => it && it.id === itemId);
      if (!item) return;
      const afford = p.crystals >= item.price;
      btn.classList.toggle('afford', afford);
      btn.disabled = !afford;
    });
    const buyGemBtn = el.querySelector('[data-buy-gem]');
    if (buyGemBtn && state.market?.gem) {
      const afford = p.crystals >= state.market.gem.price;
      buyGemBtn.classList.toggle('afford', afford);
      buyGemBtn.disabled = !afford;
    }
    const buyEggBtn = el.querySelector('[data-buy-egg]');
    if (buyEggBtn && state.market?.egg) {
      const afford = p.crystals >= state.market.egg.price;
      buyEggBtn.classList.toggle('afford', afford);
      buyEggBtn.disabled = !afford;
    }
    const refreshBtn = el.querySelector('[data-refresh-market]');
    if (refreshBtn) {
      const canAfford = p.crystals >= 2;
      refreshBtn.classList.toggle('afford', canAfford);
      refreshBtn.disabled = !canAfford;
    }
  }
}

function updateMarketTimer(state) {
  const timerEl = $('shop-content')?.querySelector('.market-timer');
  if (!timerEl || !state.market) return;
  const msLeft = Math.max(0, state.market.nextRotationAt - Date.now());
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');
  timerEl.textContent = `Rotation in ${minutes}:${seconds}`;
}

// Shop Tools — pickaxes as full-width cards. Header is tinted by ore tier so
// the upgrade path (stone → copper → iron → silver → gold → crystal) reads
// visually, not just by name. Mining damage is the big number; swing speed
// is a secondary pill in the header bar.
function renderShopTools(p) {
  return `
    <div class="sect-title">PICKAXES</div>
    <div class="shop-tools-list">
      ${PICKAXES.map(pk => {
        const owned = p.pickaxeTier >= pk.tier;
        const equipped = p.pickaxeTier === pk.tier;
        const afford = p.gold >= pk.price;
        const ore = ORES[pk.tier] || ORES[0];
        const hdrBg = hexToRgba(ore.color, 0.22);
        const border = ` style="border-color:${hexToRgba(ore.color, 0.6)}"`;

        let action;
        if (equipped) {
          action = `<button class="buy-btn current" disabled>EQUIPPED</button>`;
        } else if (owned) {
          action = `<button class="buy-btn owned" disabled>OWNED</button>`;
        } else {
          // Always emit data-buy so refreshShopAffordance can toggle the
          // disabled state in-place when gold accrues without a full re-render.
          const cls = afford ? 'buy-btn afford' : 'buy-btn';
          const dis = afford ? '' : ' disabled';
          action = `<button class="${cls}" data-buy="${pk.tier}"${dis}>BUY<span class="sub">${goldCost(pk.price)}</span></button>`;
        }

        return `
          <div class="slot-card slot-dmg tool-card${equipped ? ' equipped' : ''}"${border}>
            <div class="slot-card-hdr" style="background:${hdrBg};color:${ore.color}">
              <span>${pk.name.toUpperCase()}</span>
              <span class="tool-spd">⚡ ${pk.speed}/s</span>
            </div>
            <div class="slot-card-body">
              <div class="slot-card-ic">${iconHtml('pickaxe')}</div>
              <div class="slot-card-stat">
                <div class="stat-num">${fmtNum(pk.damage)}</div>
                <div class="stat-type">MINE DAMAGE</div>
              </div>
            </div>
            ${action}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Shop Market — gear offers from wandering traders. Reuses the inventory card
// component so the visual language stays consistent; price button below uses
// crystals instead of gold.
function renderShopMarket(state) {
  const p = state.player;
  const market = state.market;
  if (!market || !market.items) {
    return '<div class="empty">Market is empty — come back later</div>';
  }

  const msLeft = Math.max(0, market.nextRotationAt - Date.now());
  const minutes = Math.floor(msLeft / 60000);
  const seconds = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, '0');

  const itemsHtml = market.items.map(item => {
    if (!item) {
      return `
        <div class="slot-card empty market-sold">
          <div class="slot-card-hdr">SOLD</div>
          <div class="slot-card-body">
            <div class="slot-card-stat">
              <div class="stat-num">—</div>
              <div class="stat-type">GONE</div>
            </div>
          </div>
        </div>
      `;
    }
    const afford = p.crystals >= item.price;
    const inner = itemCardInner(item, item.slot);
    const border = inner.rarityColor ? ` style="border-color:${hexToRgba(inner.rarityColor, 0.6)}"` : '';
    const action = afford
      ? `<button class="buy-btn market afford" data-buy-market="${item.id}">BUY<span class="sub">${item.price}<span class="cry-ic">◆</span></span></button>`
      : `<button class="buy-btn market" disabled>${item.price}<span class="cry-ic">◆</span></button>`;
    return `
      <div class="slot-card ${inner.statCls} market-card"${border}>
        ${inner.html}
        ${action}
      </div>
    `;
  }).join('');

  const refreshAfford = p.crystals >= 2;
  const refreshBtn = refreshAfford
    ? `<button class="buy-btn afford small" data-refresh-market>🔄 REFRESH · 2<span class="cry-ic">◆</span></button>`
    : `<button class="buy-btn small" disabled>🔄 REFRESH · 2<span class="cry-ic">◆</span></button>`;

  // Bonus row: 1 gem + 1 egg
  const gemOffer = market.gem;
  const eggOffer = market.egg;
  let bonusHtml = '';
  if (gemOffer || eggOffer) {
    bonusHtml = '<div class="market-bonus-grid">';
    if (gemOffer) bonusHtml += renderMarketGemCard(p, gemOffer);
    else          bonusHtml += renderMarketSoldCard('GEM');
    if (eggOffer) bonusHtml += renderMarketEggCard(p, eggOffer);
    else          bonusHtml += renderMarketSoldCard('EGG');
    bonusHtml += '</div>';
  }

  return `
    <div class="market-head-row">
      <div class="market-timer muted">Rotation in ${minutes}:${seconds}</div>
      ${refreshBtn}
    </div>
    <div class="market-grid">${itemsHtml}</div>
    ${bonusHtml}
    <div class="empty market-foot">
      Rare gear from wandering traders. Legendary and above — forge only.
    </div>
  `;
}

function renderMarketSoldCard(label) {
  return `
    <div class="slot-card empty market-sold">
      <div class="slot-card-hdr">SOLD ${label}</div>
      <div class="slot-card-body">
        <div class="slot-card-stat">
          <div class="stat-num">—</div>
          <div class="stat-type">GONE</div>
        </div>
      </div>
    </div>`;
}

function renderMarketGemCard(p, offer) {
  const gem = offer.gem;
  const def = GEM_TYPES[gem.type];
  const afford = p.crystals >= offer.price;
  const action = afford
    ? `<button class="buy-btn market afford" data-buy-gem="1">BUY<span class="sub">${offer.price}<span class="cry-ic">◆</span></span></button>`
    : `<button class="buy-btn market" disabled>${offer.price}<span class="cry-ic">◆</span></button>`;
  const wTxt = `+${Math.round(def.weaponValues[gem.tier] * 100 * 100) / 100}% ${def.weaponStat.replace(/_/g, ' ')}`;
  return `
    <div class="slot-card market-card market-special" style="border-color:${hexToRgba(gem.color, 0.6)}">
      <div class="slot-card-hdr" style="background:${hexToRgba(gem.color, 0.22)};color:${gem.color}">${gem.name.toUpperCase()}</div>
      <div class="slot-card-body">
        <div class="slot-card-ic"><span class="gem-icon" style="background:${gem.color};width:22px;height:22px;display:inline-block"></span></div>
        <div class="slot-card-stat">
          <div class="stat-num">T${gem.tier + 1}</div>
          <div class="stat-type">GEM</div>
        </div>
      </div>
      ${action}
    </div>`;
}

function renderMarketEggCard(p, offer) {
  const egg = offer.egg;
  const def = PET_TYPES[egg.type];
  const rarity = getRarityByKey(egg.rarity);
  const afford = p.crystals >= offer.price;
  const action = afford
    ? `<button class="buy-btn market afford" data-buy-egg="1">BUY<span class="sub">${offer.price}<span class="cry-ic">◆</span></span></button>`
    : `<button class="buy-btn market" disabled>${offer.price}<span class="cry-ic">◆</span></button>`;
  return `
    <div class="slot-card market-card market-special" style="border-color:${hexToRgba(rarity.color, 0.6)}">
      <div class="slot-card-hdr" style="background:${hexToRgba(rarity.color, 0.22)};color:${rarity.color}">${egg.rarity.toUpperCase()} ${def.name.toUpperCase()} EGG</div>
      <div class="slot-card-body">
        <div class="slot-card-ic" style="font-size:22px">🥚</div>
        <div class="slot-card-stat">
          <div class="stat-num">${petGlyph(egg.type)}</div>
          <div class="stat-type">${def.primaryLabel.toUpperCase()}</div>
        </div>
      </div>
      ${action}
    </div>`;
}

// ---------- Craft result popup ----------
let _craftResultShownFor = null;

export function renderCraftResult(state) {
  const popup = $('popup-craft-result');
  if (!popup) return;
  const item = state.lastCraftedItem;
  if (!item) {
    popup.classList.remove('open');
    _craftResultShownFor = null;
    return;
  }
  // Already rendered for this item — just ensure popup is open.
  if (_craftResultShownFor === item.id) {
    popup.classList.add('open');
    return;
  }
  _craftResultShownFor = item.id;

  const p = state.player;
  const slot = SLOTS[item.slot];
  const newRar = getRarityByKey(item.rarity);
  const current = p.equipped[item.slot];

  // Delta divider between NEW (top) and EQUIPPED (bottom). The coloured dash
  // row replaces the old "BETTER/WORSE" block — the delta number with arrow
  // carries the same verdict visually while taking less vertical space.
  let dividerHtml = '';
  if (current) {
    const diff = item.stat - current.stat;
    if (diff > 0) {
      dividerHtml = `<div class="cr-divider up"><span class="line"></span><span class="delta">▲ +${fmtNum(diff)}</span><span class="line"></span></div>`;
    } else if (diff < 0) {
      dividerHtml = `<div class="cr-divider down"><span class="line"></span><span class="delta">▼ ${fmtNum(diff)}</span><span class="line"></span></div>`;
    } else {
      dividerHtml = `<div class="cr-divider same"><span class="line"></span><span class="delta">= EQUAL</span><span class="line"></span></div>`;
    }
  } else {
    dividerHtml = `<div class="cr-divider up"><span class="line"></span><span class="delta">★ NEW SLOT</span><span class="line"></span></div>`;
  }

  const subtitle = current
    ? `${slot.label} · comparing to equipped`
    : `${slot.label} · slot is empty`;
  $('craft-result-sub').textContent = subtitle;

  // Card renderer reuses the shared paperdoll/inventory visual. Full-width in
  // the stacked layout so long titles like "+5 MYTHICAL EMERALD" never truncate.
  const renderCRCard = (it, tagText, dim = false) => {
    const dimCls = dim ? ' dim' : '';
    if (!it) {
      return `
        <div class="cr-card-slot${dimCls}">
          <div class="cr-tag">${tagText}</div>
          <div class="slot-card empty">
            <div class="slot-card-hdr">${slot.label.toUpperCase()}</div>
            <div class="slot-card-body">
              <div class="slot-card-stat">
                <div class="stat-num">—</div>
                <div class="stat-type">EMPTY</div>
              </div>
            </div>
          </div>
        </div>`;
    }
    const inner = itemCardInner(it, it.slot);
    const border = inner.rarityColor ? ` style="border-color:${hexToRgba(inner.rarityColor, 0.6)}"` : '';
    return `
      <div class="cr-card-slot${dimCls}">
        <div class="cr-tag">${tagText}</div>
        <div class="slot-card ${inner.statCls}"${border}>${inner.html}</div>
      </div>`;
  };

  $('craft-result-body').innerHTML = `
    <div class="cr-compare-stack">
      ${renderCRCard(item, 'NEW')}
      ${dividerHtml}
      ${renderCRCard(current, 'EQUIPPED', /*dim*/ true)}
    </div>
    <div class="cr-actions">
      <button class="cr-btn equip" id="cr-equip">Equip</button>
      <button class="cr-btn sell"  id="cr-sell">Sell</button>
      <button class="cr-btn keep"  id="cr-keep">Keep</button>
    </div>
  `;

  popup.classList.add('open');

  $('cr-equip').onclick = () => {
    equipItem(state, item.id);
    dismissCraftResult(state);
    renderCraftResult(state);
    // If forge popup is open, re-render it (ore count may have changed earlier)
    if ($('popup-forge').classList.contains('open')) renderForge(state);
  };
  $('cr-sell').onclick = () => {
    sellItem(state, item.id, false);
    dismissCraftResult(state);
    renderCraftResult(state);
    if ($('popup-forge').classList.contains('open')) renderForge(state);
  };
  $('cr-keep').onclick = () => {
    dismissCraftResult(state);
    renderCraftResult(state);
    if ($('popup-forge').classList.contains('open')) renderForge(state);
  };
}

// ---------- Perk modal ----------
let _perkModalShownFor = null;

export function renderPerkModal(state) {
  const el = $('perk-modal');
  if (!el) return;
  if (!state.currentPerkOffer) {
    el.classList.remove('open');
    _perkModalShownFor = null;
    return;
  }
  // Already rendered for this offer — just keep it open.
  if (_perkModalShownFor === state.currentPerkOffer) {
    el.classList.add('open');
    return;
  }
  _perkModalShownFor = state.currentPerkOffer;

  el.classList.add('open');
  const body = $('perk-options');
  body.innerHTML = state.currentPerkOffer.map((offer, i) => {
    const r = getRarityByKey(offer.rarity);
    return `
      <button class="perk-option" style="border-color:${r.color}" data-perk="${i}">
        <div class="perk-rarity" style="color:${r.color}">${offer.rarity}</div>
        <div class="perk-name">${offer.name}</div>
        <div class="perk-desc">${formatPerk(offer)}</div>
      </button>
    `;
  }).join('');
  body.querySelectorAll('[data-perk]').forEach(btn => {
    // Stop the joystick listener (on document) from swallowing the click
    // by blocking bubbling of the initial press events.
    btn.addEventListener('mousedown', (e) => e.stopPropagation());
    btn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    btn.onclick = () => { choosePerk(state, +btn.dataset.perk); renderPerkModal(state); };
  });
}

// ---------- Toast ----------
let toastT;
export function showToast(msg) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1500);
}

// ---------- Floating joystick ----------
export function initFloatingJoystick(state) {
  const joy = $('joy');
  const stick = $('joy-stick');
  if (!joy || !stick) return;

  const R = 48;              // max stick displacement from center
  const JOY_SIZE = 130;      // css size of .joy
  let active = false;
  let pointerId = null;
  let originX = 0, originY = 0;    // screen pos of joystick center

  // Elements that should NOT trigger joystick
  // Any button, input, or anything inside a popup/modal/side-buttons is safe.
  function isUiTarget(el) {
    if (!el) return false;
    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'LABEL') return true;
    return !!el.closest('.side-btn, .popup, .modal, button, input, label');
  }
  function setOriginFromClient(cx, cy) {
    const phoneRect = $('phone').getBoundingClientRect();
    const px = cx - phoneRect.left;
    const py = cy - phoneRect.top;
    originX = px;
    originY = py;
    joy.style.left = (px - JOY_SIZE / 2) + 'px';
    joy.style.top  = (py - JOY_SIZE / 2) + 'px';
    joy.classList.add('visible');
  }

  function updateFromClient(cx, cy) {
    const phoneRect = $('phone').getBoundingClientRect();
    const dx = (cx - phoneRect.left) - originX;
    const dy = (cy - phoneRect.top) - originY;
    const mag = Math.hypot(dx, dy);
    const m = Math.min(1, mag / R);
    const angle = Math.atan2(dy, dx);
    const sx = Math.cos(angle) * R * m;
    const sy = Math.sin(angle) * R * m;
    stick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
    state.player.moveX = Math.cos(angle) * m;
    state.player.moveY = Math.sin(angle) * m;
  }

  function hide() {
    joy.classList.remove('visible');
    stick.style.transform = 'translate(-50%, -50%)';
    state.player.moveX = 0;
    state.player.moveY = 0;
    active = false;
    pointerId = null;
  }

  // Touch
  document.addEventListener('touchstart', (e) => {
    if (isUiTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    if (active) return;
    active = true;
    pointerId = t.identifier;
    setOriginFromClient(t.clientX, t.clientY);
    updateFromClient(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = [...e.changedTouches].find(tc => tc.identifier === pointerId);
    if (!t) return;
    updateFromClient(t.clientX, t.clientY);
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!active) return;
    const ended = [...e.changedTouches].some(tc => tc.identifier === pointerId);
    if (ended) hide();
  });
  document.addEventListener('touchcancel', hide);

  // Mouse (for desktop testing)
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isUiTarget(e.target)) return;
    active = true;
    setOriginFromClient(e.clientX, e.clientY);
    updateFromClient(e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (!active) return;
    updateFromClient(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', () => { if (active) hide(); });
  document.addEventListener('mouseleave', () => { if (active) hide(); });

  // Keyboard (WASD)
  const keys = { w: 0, a: 0, s: 0, d: 0 };
  window.addEventListener('keydown', (e) => {
    if (e.key in keys) { keys[e.key] = 1; updateKeys(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key in keys) { keys[e.key] = 0; updateKeys(); }
  });
  function updateKeys() {
    state.player.moveX = keys.d - keys.a;
    state.player.moveY = keys.s - keys.w;
  }
}
