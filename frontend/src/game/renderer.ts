import type { BattleState, Enemy, FloatingText } from './engine';

const CANVAS_W = 600;
const CANVAS_H = 280;
const GROUND_Y = 230;
const SKY_COLOR = '#87CEEB';
const GROUND_COLOR = '#5b8c3e';
const GROUND_DARK = '#4a7a32';

export function renderFrame(ctx: CanvasRenderingContext2D, state: BattleState) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Sky
  ctx.fillStyle = SKY_COLOR;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // Parallax background hills
  drawHills(ctx, state.distance);

  // Ground
  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

  // Ground texture lines (scrolling)
  ctx.strokeStyle = GROUND_DARK;
  ctx.lineWidth = 1;
  const offset = state.distance % 40;
  for (let x = -offset; x < CANVAS_W + 40; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 10, CANVAS_H);
    ctx.stroke();
  }

  // Draw enemies
  for (const enemy of state.enemies) {
    drawEnemy(ctx, enemy, state.distance);
  }

  // Draw hero
  drawHero(ctx, state);

  // Draw floating texts
  for (const ft of state.floatingTexts) {
    drawFloatingText(ctx, ft);
  }

  // Death overlay
  if (!state.hero.alive) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('💀 Respawning...', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillText(`${state.hero.respawnTimer.toFixed(1)}s`, CANVAS_W / 2, CANVAS_H / 2 + 16);
    ctx.textAlign = 'left';
  }
}

function drawHills(ctx: CanvasRenderingContext2D, distance: number) {
  // Far hills (slow parallax)
  ctx.fillStyle = '#6aad5a';
  ctx.beginPath();
  ctx.moveTo(0, 230);
  for (let x = 0; x <= 600; x += 2) {
    const y = 195 + Math.sin((x + distance * 0.05) * 0.015) * 20 + Math.sin((x + distance * 0.05) * 0.008) * 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(600, 230);
  ctx.closePath();
  ctx.fill();

  // Near hills (faster parallax)
  ctx.fillStyle = '#5a9d4a';
  ctx.beginPath();
  ctx.moveTo(0, 230);
  for (let x = 0; x <= 600; x += 2) {
    const y = 210 + Math.sin((x + distance * 0.15) * 0.02) * 12 + Math.sin((x + distance * 0.15) * 0.035) * 6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(600, 230);
  ctx.closePath();
  ctx.fill();
}

function drawHero(ctx: CanvasRenderingContext2D, state: BattleState) {
  const h = state.hero;
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
  ctx.fillRect(x + 2, y - 6, 3, 3);

  // Sword (flash when attacking)
  const attacking = h.attackTimer > h.attackCooldown * 0.7;
  ctx.strokeStyle = attacking ? '#fff' : '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (attacking) {
    ctx.moveTo(x + h.width / 2, y + 8);
    ctx.lineTo(x + h.width / 2 + 25, y - 5);
  } else {
    ctx.moveTo(x + h.width / 2, y + 10);
    ctx.lineTo(x + h.width / 2 + 18, y + 5);
  }
  ctx.stroke();

  // HP bar
  drawHpBar(ctx, x, y - 22, 32, h.hp, h.maxHp, '#22c55e');
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, _distance: number) {
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
