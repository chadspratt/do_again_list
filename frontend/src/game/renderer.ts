/**
 * Unified renderer – draws both the battle scene and the quest scene
 * on the shared canvas, using identical visuals for sky, hills, ground,
 * hero, enemies, HP bars and floating text so there are no visual
 * inconsistencies when switching.
 */

import type { BattleState, FloatingText } from './engine';
import { CANVAS_W, CANVAS_H, GROUND_Y } from './engine';
import type { QuestState, QuestBox } from './questEngine';
import { QUEST_HERO_X, GUILD_DISTANCE } from './questEngine';

// Smoothstep easing: slow-fast-slow
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const SKY_COLOR = '#87CEEB';
const GROUND_COLOR = '#5b8c3e';
const GROUND_DARK = '#4a7a32';

// ── Shared drawing primitives ──

/** Common hero-like shape used by both scenes. */
interface DrawableHero {
  x: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  attackTimer: number;
  attackCooldown: number;
  alive: boolean;
}

/** Common enemy-like shape used by both scenes. */
interface DrawableEnemy {
  x: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  level: number;
  dead: boolean;
  deathTimer: number;
}

function drawSkyAndGround(ctx: CanvasRenderingContext2D, distance: number) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Sky
  ctx.fillStyle = SKY_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // Parallax background hills
  drawHills(ctx, distance);

  // Ground
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // Ground texture lines (scrolling)
  ctx.strokeStyle = GROUND_DARK;
  ctx.lineWidth = 1;
  const offset = distance % 40;
  for (let x = -offset; x < CANVAS_W + 40; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 10, CANVAS_H);
    ctx.stroke();
  }
}

function drawHills(ctx: CanvasRenderingContext2D, distance: number) {
  // Far hills (slow parallax)
  ctx.fillStyle = '#6aad5a';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= CANVAS_W; x += 2) {
    const y = GROUND_Y - 35 + Math.sin((x + distance * 0.05) * 0.015) * 20 + Math.sin((x + distance * 0.05) * 0.008) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // Near hills (faster parallax)
  ctx.fillStyle = '#5a9d4a';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (let x = 0; x <= CANVAS_W; x += 2) {
    const y = GROUND_Y - 20 + Math.sin((x + distance * 0.15) * 0.02) * 12 + Math.sin((x + distance * 0.15) * 0.035) * 6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

function drawHero(ctx: CanvasRenderingContext2D, h: DrawableHero, facingRight: boolean) {
  if (!h.alive) return;

  const x = h.x;
  const y = GROUND_Y - h.height;

  // Body
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(x - h.width / 2, y, h.width, h.height);

  // Head
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(x, y - 4, 10, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(facingRight ? x + 2 : x - 5, y - 6, 3, 3);

  // Sword (flash when attacking)
  const attacking = h.attackTimer > h.attackCooldown * 0.7;
  ctx.strokeStyle = attacking ? '#fff' : '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (facingRight) {
    if (attacking) {
      ctx.moveTo(x + h.width / 2, y + 8);
      ctx.lineTo(x + h.width / 2 + 25, y - 5);
    } else {
      ctx.moveTo(x + h.width / 2, y + 10);
      ctx.lineTo(x + h.width / 2 + 18, y + 5);
    }
  } else {
    if (attacking) {
      ctx.moveTo(x - h.width / 2, y + 8);
      ctx.lineTo(x - h.width / 2 - 25, y - 5);
    } else {
      ctx.moveTo(x - h.width / 2, y + 10);
      ctx.lineTo(x - h.width / 2 - 18, y + 5);
    }
  }
  ctx.stroke();

  // HP bar
  drawHpBar(ctx, x, y - 22, 32, h.hp, h.maxHp, '#22c55e');
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: DrawableEnemy) {
  if (enemy.dead) {
    ctx.globalAlpha = Math.max(0, enemy.deathTimer / 0.5);
  }

  const x = enemy.x;
  const y = GROUND_Y - enemy.height;

  // Body
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x - enemy.width / 2, y, enemy.width, enemy.height);

  // Head
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(x, y - 3, 9, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - 6, y - 5, 3, 3);
  ctx.fillRect(x - 1, y - 5, 3, 3);

  // Level tag
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.fillText(`L${enemy.level}`, x - 8, y - 14);

  // HP bar
  drawHpBar(ctx, x, y - 24, 28, enemy.hp, enemy.maxHp, '#ef4444');

  if (enemy.dead) {
    ctx.globalAlpha = 1;
  }
}

function drawHpBar(ctx: CanvasRenderingContext2D, cx: number, y: number, width: number, hp: number, maxHp: number, color: string) {
  const barX = cx - width / 2;
  // Background
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(barX, y, width, 5);
  // Fill
  const pct = Math.max(0, hp / maxHp);
  ctx.fillStyle = pct > 0.5 ? color : pct > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillRect(barX, y, width * pct, 5);
}

function drawFloatingText(ctx: CanvasRenderingContext2D, ft: FloatingText) {
  const alpha = ft.life / ft.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ft.color;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(ft.text, ft.x - 10, ft.y);
  ctx.globalAlpha = 1;
}

function drawDeathOverlay(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 10);
  ctx.font = '14px sans-serif';
  ctx.fillText(subtitle, CANVAS_W / 2, CANVAS_H / 2 + 16);
  ctx.textAlign = 'left';
}

// ── Battle frame ──

export function renderFrame(ctx: CanvasRenderingContext2D, state: BattleState) {
  drawSkyAndGround(ctx, state.distance);

  for (const enemy of state.enemies) {
    drawEnemy(ctx, enemy);
  }

  drawHero(ctx, state.hero, true);

  for (const ft of state.floatingTexts) {
    drawFloatingText(ctx, ft);
  }

  if (!state.hero.alive) {
    drawDeathOverlay(ctx, '💀 Run Over', 'Collecting souls...');
  }
}

// ── Quest frame ──

export function renderQuestFrame(ctx: CanvasRenderingContext2D, state: QuestState) {
  drawSkyAndGround(ctx, state.distance);

  // ── Camera-swing intro: guild sweeps in from left, scaled up as it comes closer ──
  if (state.phase === 'camera_swing') {
    const t = smoothstep(state.swingProgress);
    // Guild swings from off-screen left (small) to its normal start position (full size)
    const startX = -70;
    const endX   = QUEST_HERO_X + GUILD_DISTANCE; // 680 – normal position at start of walk
    const guildScreenX = lerp(startX, endX, t);
    const guildScale   = lerp(0.3, 1.0, t);

    // Guild appears behind the hero at first; hero faces left looking back at it,
    // then turns right once the guild has swung ahead of them.
    const facingRight = state.swingProgress >= 0.5;

    drawGuild(ctx, guildScreenX, guildScale);
    drawHero(ctx, state.hero, facingRight);
    for (const ft of state.floatingTexts) drawFloatingText(ctx, ft);
    drawQuestHUD(ctx, state);
    return;
  }

  // Guild building (normal phases – position computed from world distance)
  const guildScreenX = QUEST_HERO_X + (state.guildX - state.distance);
  drawGuild(ctx, guildScreenX, 1);

  // Boxes
  for (const box of state.boxes) {
    drawBox(ctx, box);
  }

  // Enemies
  for (const enemy of state.enemies) {
    drawEnemy(ctx, enemy);
  }

  // Hero faces left only when returning to guild; faces right otherwise
  const facingRight = state.phase !== 'return_to_guild';
  drawHero(ctx, state.hero, facingRight);

  // Floating texts
  for (const ft of state.floatingTexts) {
    drawFloatingText(ctx, ft);
  }

  // Quest HUD
  drawQuestHUD(ctx, state);

  // Death overlay
  if (!state.hero.alive) {
    drawDeathOverlay(ctx, '💀 Quest Failed', 'I thought this would be easy...');
  }
}

// ── Quest-specific drawing ──

/** Draw the guild hall at an explicit screen position and scale (1 = normal). */
function drawGuild(ctx: CanvasRenderingContext2D, screenX: number, scale: number) {
  if (screenX < -200 || screenX > CANVAS_W + 200) return;

  const guildW = 100 * scale;
  const guildH = 60 * scale;
  const baseY = GROUND_Y - guildH;

  // Building body
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(screenX - guildW / 2, baseY, guildW, guildH);

  // Roof (triangle)
  ctx.fillStyle = '#A0522D';
  ctx.beginPath();
  ctx.moveTo(screenX - guildW / 2 - 10 * scale, baseY);
  ctx.lineTo(screenX, baseY - 30 * scale);
  ctx.lineTo(screenX + guildW / 2 + 10 * scale, baseY);
  ctx.closePath();
  ctx.fill();

  // Door
  ctx.fillStyle = '#5C4033';
  ctx.fillRect(screenX - 10 * scale, baseY + 25 * scale, 20 * scale, 35 * scale);

  // Sign – only legible at reasonable sizes
  if (scale > 0.55) {
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(10 * scale)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText("Adventurers'", screenX, baseY + 12 * scale);
    ctx.fillText('Guild', screenX, baseY + 22 * scale);
    ctx.textAlign = 'left';
  }
}

function drawBox(ctx: CanvasRenderingContext2D, box: QuestBox) {
  if (box.collected) {
    ctx.globalAlpha = Math.max(0, box.fadeTimer / 0.4);
  }

  const x = box.x;
  const y = box.y - box.height;

  // Box body
  ctx.fillStyle = '#c2813d';
  ctx.fillRect(x - box.width / 2, y, box.width, box.height);

  // Box lid line
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - box.width / 2, y + 4);
  ctx.lineTo(x + box.width / 2, y + 4);
  ctx.stroke();

  // Cross straps
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + box.height);
  ctx.stroke();

  // Emoji label
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('📦', x, y - 2);
  ctx.textAlign = 'left';

  if (box.collected) ctx.globalAlpha = 1;
}

function drawQuestHUD(ctx: CanvasRenderingContext2D, state: QuestState) {
  if (state.phase === 'camera_swing' || state.phase === 'walk_to_guild') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Heading to the Adventurers\' Guild...', CANVAS_W / 2, 20);
    ctx.textAlign = 'left';
    return;
  }

  if (state.phase === 'quest_active' || state.phase === 'return_to_guild') {
    // Quest progress bar
    const barW = 200;
    const barH = 14;
    const barX = CANVAS_W / 2 - barW / 2;
    const barY = 6;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(barX, barY, barW, barH);
    const pct = Math.min(1, state.boxesCollected / state.boxesRequired);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(barX, barY, barW * pct, barH);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📦 ${state.boxesCollected} / ${state.boxesRequired}  –  ${state.questLabel}`, CANVAS_W / 2, barY + barH + 14);
    ctx.textAlign = 'left';
  }

  if (state.phase === 'return_to_guild') {
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Returning to guild...', CANVAS_W / 2, CANVAS_H / 2 - 20);
    ctx.textAlign = 'left';
  }
}
