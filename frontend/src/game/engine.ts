import type { GameState } from '../types';

// ── Entity types ──

export interface Entity {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  attackCooldown: number;
  attackTimer: number;
  width: number;
  height: number;
  facingRight: boolean;
}

export interface Hero extends Entity {
  alive: boolean;
  respawnTimer: number;
}

export interface Enemy extends Entity {
  id: number;
  level: number;
  goldReward: number;
  xpReward: number;
  dead: boolean;
  deathTimer: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface HeroBuff {
  stat: 'attack' | 'defense' | 'speed';
  amount: number;
  remaining: number;  // seconds remaining
  label: string;
}

export interface BattleState {
  hero: Hero;
  enemies: Enemy[];
  floatingTexts: FloatingText[];
  buffs: HeroBuff[];
  distance: number;
  running: boolean;
  enemyIdCounter: number;
  pendingHeal: boolean;
  pendingFatigue: boolean;
  killStreak: number;
}

// ── Constants ──

const GROUND_Y = 200;
const HERO_X = 80;
const RESPAWN_TIME = 2.0;
const ENEMY_BASE_HP = 30;
const ENEMY_BASE_ATK = 4;
const HERO_BASE_HP = 100;
const FLOAT_TEXT_DURATION = 1.2;
const DEATH_FADE_DURATION = 0.5;
const BUFF_DURATION = -1;  // seconds, -1 for until death

// ── Initialization ──

export function createBattleState(gameState: GameState): BattleState {
  return {
    hero: createHero(gameState),
    enemies: [],
    floatingTexts: [],
    buffs: [],
    distance: 0,
    running: true,
    enemyIdCounter: 0,
    pendingHeal: false,
    pendingFatigue: false,
    killStreak: 0,
  };
}

function createHero(gs: GameState): Hero {
  return {
    x: HERO_X,
    y: GROUND_Y,
    hp: HERO_BASE_HP + gs.level * 10,
    maxHp: HERO_BASE_HP + gs.level * 10,
    attack: gs.total_attack,
    defense: gs.total_defense,
    speed: 30 + gs.total_speed * 5,
    attackCooldown: Math.max(0.4, 1.2 - gs.total_speed * 0.05),
    attackTimer: 0,
    width: 28,
    height: 36,
    facingRight: true,
    alive: true,
    respawnTimer: 0,
  };
}

export interface EnemyStatModifier {
  attack?: number;
  defense?: number;
  speed?: number;
}

/**
 * Spawn an enemy at a specific level with optional stat modifiers.
 * Positive modifiers strengthen the enemy; negative weaken it.
 */
export function spawnEnemyFromEvent(
  state: BattleState,
  level: number,
  statModifier?: EnemyStatModifier,
): void {
  state.enemyIdCounter++;
  const mod = statModifier ?? {};
  const baseAtk = ENEMY_BASE_ATK + level * 2 + (mod.attack ?? 0);
  const baseDef = Math.floor(level / 2) + (mod.defense ?? 0);
  const baseSpd = 20 + level * 2 + (mod.speed ?? 0);
  const baseHp = ENEMY_BASE_HP + level * 8;
  const enemy: Enemy = {
    id: state.enemyIdCounter,
    x: 600 + Math.random() * 100,
    y: GROUND_Y,
    hp: baseHp,
    maxHp: baseHp,
    attack: Math.max(1, baseAtk),
    defense: Math.max(0, baseDef),
    speed: Math.max(5, baseSpd),
    attackCooldown: 1.5,
    attackTimer: 0,
    width: 26,
    height: 32,
    facingRight: false,
    level,
    goldReward: 3 + level * 2,
    xpReward: 10 + level * 5,
    dead: false,
    deathTimer: 0,
  };
  state.enemies.push(enemy);
  // Color: red for strengthened, yellow for weakened, default for neutral
  const totalMod = (mod.attack ?? 0) + (mod.defense ?? 0) + (mod.speed ?? 0);
  const color = totalMod > 0 ? '#ef4444' : totalMod < 0 ? '#facc15' : '#f97316';
  const label = totalMod > 0 ? 'Strengthened' : totalMod < 0 ? 'Weakened' : '';
  addFloatingText(state, 500, 140, `Enemy Lv${level}${label ? ' ' + label : ''}!`, color);
}

/**
 * Apply a temporary hero buff or debuff that is lost on death. Positive = buff, negative = debuff.
 */
export function applyBuff(state: BattleState, stat: 'attack' | 'defense' | 'speed', amount: number, label: string): void {
  state.buffs.push({ stat, amount, remaining: BUFF_DURATION, label });
  const emoji = stat === 'attack' ? '🗡️' : stat === 'defense' ? '🛡️' : '⚡';
  const sign = amount > 0 ? '+' : '';
  const color = amount > 0 ? '#a855f7' : '#ef4444';
  addFloatingText(state, state.hero.x, state.hero.y - 40, `${emoji}${sign}${amount} ${label}`, color);
}

function addFloatingText(state: BattleState, x: number, y: number, text: string, color: string) {
  state.floatingTexts.push({ x, y, text, color, life: FLOAT_TEXT_DURATION, maxLife: FLOAT_TEXT_DURATION });
}

/**
 * Compute total buff bonus for a stat.
 */
function buffBonus(buffs: HeroBuff[], stat: 'attack' | 'defense' | 'speed'): number {
  return buffs.filter(b => b.stat === stat).reduce((sum, b) => sum + b.amount, 0);
}

// ── Tick ──

export interface TickResult {
  goldEarned: number;
  xpEarned: number;
  heroDied: boolean;
  distance: number;
  killStreak: number;
}

export function tick(state: BattleState, gs: GameState, dt: number): TickResult {
  const result: TickResult = { goldEarned: 0, xpEarned: 0, heroDied: false, distance: state.distance, killStreak: state.killStreak };
  const hero = state.hero;

  // Update floating texts
  state.floatingTexts = state.floatingTexts.filter(ft => {
    ft.life -= dt;
    ft.y -= 30 * dt;
    return ft.life > 0;
  });

  // Update buffs — decrement timers, remove expired
  state.buffs = state.buffs.filter(b => {
    if (b.remaining == -1) return true;  // Permanent until death
    b.remaining -= dt;
    return b.remaining > 0;
  });

  // Apply buff bonuses to hero stats each frame
  hero.attack = gs.total_attack + buffBonus(state.buffs, 'attack');
  hero.defense = gs.total_defense + buffBonus(state.buffs, 'defense');
  const speedBuff = buffBonus(state.buffs, 'speed');
  hero.speed = 30 + (gs.total_speed + speedBuff) * 5;
  hero.attackCooldown = Math.max(0.4, 1.2 - (gs.total_speed + speedBuff) * 0.05);

  // Process pending effects from app actions
  if (state.pendingHeal && hero.alive) {
    hero.hp = hero.maxHp;
    addFloatingText(state, hero.x, hero.y - 30, 'HEALED!', '#22c55e');
    state.pendingHeal = false;
  }
  if (state.pendingFatigue && hero.alive) {
    const dmg = Math.max(1, Math.floor(hero.maxHp * 0.15));
    hero.hp -= dmg;
    addFloatingText(state, hero.x, hero.y - 30, `-${dmg} fatigue`, '#f97316');
    state.pendingFatigue = false;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.alive = false;
      hero.respawnTimer = RESPAWN_TIME;
      result.heroDied = true;
    }
  }

  // Hero dead → respawn countdown
  if (!hero.alive) {
    hero.respawnTimer -= dt;
    if (hero.respawnTimer <= 0) {
      const newHero = createHero(gs);
      Object.assign(hero, newHero);
      state.distance = 0;
      state.enemies = [];
    }
    state.enemies = state.enemies.filter(e => !e.dead || e.deathTimer > 0);
    state.enemies.forEach(e => { if (e.dead) e.deathTimer -= dt; });
    return result;
  }

  // Move hero forward (only if no living enemies nearby)
  const anyEnemyClose = state.enemies.some(e => !e.dead && e.x - hero.x < 120);
  if (!anyEnemyClose) {
    state.distance += hero.speed * dt;
    result.distance = state.distance;
  }

  // Move enemies toward hero & process dead enemy fading
  for (const enemy of state.enemies) {
    if (enemy.dead) {
      enemy.deathTimer -= dt;
      continue;
    }
    if (enemy.x > hero.x + 50) {
      enemy.x -= enemy.speed * dt;
    }
  }

  // Remove fully faded enemies
  state.enemies = state.enemies.filter(e => !e.dead || e.deathTimer > 0);

  // Find closest living enemy in range
  const livingEnemies = state.enemies.filter(e => !e.dead);
  const closestEnemy = livingEnemies.length > 0
    ? livingEnemies.reduce((a, b) => a.x < b.x ? a : b)
    : null;

  // Hero attacks
  hero.attackTimer -= dt;
  if (closestEnemy && closestEnemy.x - hero.x < 80 && hero.attackTimer <= 0) {
    const dmg = Math.max(1, hero.attack - closestEnemy.defense);
    closestEnemy.hp -= dmg;
    hero.attackTimer = hero.attackCooldown;
    addFloatingText(state, closestEnemy.x, closestEnemy.y - 20, `-${dmg}`, '#ef4444');

    if (closestEnemy.hp <= 0) {
      closestEnemy.dead = true;
      closestEnemy.deathTimer = DEATH_FADE_DURATION;
      result.goldEarned += closestEnemy.goldReward;
      result.xpEarned += closestEnemy.xpReward;
      state.killStreak++;
      result.killStreak = state.killStreak;
      addFloatingText(state, closestEnemy.x, closestEnemy.y - 40, `+${closestEnemy.goldReward}g`, '#eab308');
      if (state.killStreak > 1) {
        addFloatingText(state, closestEnemy.x, closestEnemy.y - 60, `${state.killStreak}x streak!`, '#f59e0b');
      }
    }
  }

  // Enemies attack hero
  for (const enemy of livingEnemies) {
    if (enemy.x - hero.x >= 80) continue;
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      const dmg = Math.max(1, enemy.attack - hero.defense);
      hero.hp -= dmg;
      enemy.attackTimer = enemy.attackCooldown;
      addFloatingText(state, hero.x, hero.y - 20, `-${dmg}`, '#f97316');

      if (hero.hp <= 0) {
        hero.hp = 0;
        hero.alive = false;
        hero.respawnTimer = RESPAWN_TIME;
        result.heroDied = true;
        state.buffs = [];       // Remove all buffs on death
        state.killStreak = 0;   // Reset streak on death
        result.killStreak = 0;
        break;
      }
    }
  }

  return result;
}
