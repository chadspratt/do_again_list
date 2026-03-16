/**
 * Quest engine – handles the "collect lost boxes" quest gameplay.
 *
 * The quest scene re-uses the same canvas as the normal BattleLane.
 * The hero walks right. A mix of enemies and collectible boxes spawn
 * from the right.  Enemies are fought normally, boxes are auto-collected
 * when the hero reaches them.  Once enough boxes are collected the quest
 * completes and the hero walks back toward the guild.
 */

import type { GameState } from '../types';
import {
  CANVAS_W,
  GROUND_Y,
  type FloatingText,
} from './engine';
import { pickAttackTarget } from './combatUtils';

// ── Types ──

export interface QuestBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  collected: boolean;
  fadeTimer: number;
}

export interface QuestEnemy {
  id: number;
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
  level: number;
  dead: boolean;
  deathTimer: number;
}

export interface QuestHero {
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
  alive: boolean;
}

export type QuestPhase =
  | 'camera_swing'      // intro: camera pivots around the hero to the right to reveal the guild appearing from the left
  | 'walk_to_guild'     // hero walks right toward guild
  | 'at_guild'          // hero arrived, show Jobs Board (handled by React overlay)
  | 'quest_active'      // quest gameplay – enemies + boxes
  | 'return_to_guild'   // all boxes collected, hero walks back
  | 'quest_complete'    // hero arrived back at guild
  | 'leaving_guild';    // hero walks away from guild (guild scrolls off-screen left)

export interface QuestDef {
  label: string;
  description: string;
  boxesRequired: number;
  enemyLevel: number;
  cost: number;          // quest-token cost
}

export interface QuestState {
  phase: QuestPhase;
  hero: QuestHero;
  enemies: QuestEnemy[];
  boxes: QuestBox[];
  floatingTexts: FloatingText[];
  distance: number;
  guildX: number;            // world-x where the guild is placed
  boxesCollected: number;
  boxesRequired: number;
  enemyLevel: number;
  idCounter: number;
  spawnTimer: number;
  questLabel: string;
  goldEarned: number;
  xpEarned: number;
  /** 0→1 progress of the opening camera-swing intro animation */
  swingProgress: number;
}

// ── Constants ──

export const QUEST_HERO_X = 80;
export const GUILD_DISTANCE = 600;    // how far the hero walks to reach the guild
const HERO_X = QUEST_HERO_X;
const SWING_DURATION = 1.5;           // seconds for the opening camera-swing
const FLOAT_TEXT_DURATION = 1.2;
const DEATH_FADE = 0.5;
const BOX_FADE = 0.4;
const SPAWN_INTERVAL_MIN = 1.5;
const SPAWN_INTERVAL_MAX = 3.5;
const BOX_CHANCE = 0.55;              // chance a spawn is a box vs enemy

// ── Initialisation ──

export function createQuestState(gs: GameState, startDistance = 0): QuestState {
  const maxHp = gs.max_hp ?? (100 + gs.level * 10);
  return {
    phase: 'camera_swing',
    swingProgress: 0,
    hero: {
      x: HERO_X,
      y: GROUND_Y,
      hp: maxHp,
      maxHp,
      attack: gs.total_attack,
      defense: gs.total_defense,
      speed: 30 + gs.total_speed * 5,
      attackCooldown: Math.max(0.4, 1.2 - gs.total_speed * 0.05),
      attackTimer: 0,
      width: 28,
      height: 36,
      alive: true,
    },
    enemies: [],
    boxes: [],
    floatingTexts: [],
    distance: startDistance,
    guildX: startDistance + GUILD_DISTANCE,
    boxesCollected: 0,
    boxesRequired: 0,
    enemyLevel: 1,
    idCounter: 0,
    spawnTimer: 2,
    questLabel: '',
    goldEarned: 0,
    xpEarned: 0,
  };
}

/** Generate the list of available quests for the jobs board. */
export function generateQuests(gs: GameState): QuestDef[] {
  const baseLevel = Math.max(1, gs.level);
  return [
    {
      label: 'Lost Cargo (Easy)',
      description: `A merchant lost ${3} boxes fleeing bandits. Collect them!`,
      boxesRequired: 3,
      enemyLevel: Math.max(1, baseLevel - 1),
      cost: 1,
    },
    {
      label: 'Lost Cargo (Medium)',
      description: `A merchant lost ${5} boxes fleeing bandits. Collect them!`,
      boxesRequired: 5,
      enemyLevel: baseLevel,
      cost: 2,
    },
    {
      label: 'Lost Cargo (Hard)',
      description: `A merchant lost ${8} boxes fleeing bandits. Collect them!`,
      boxesRequired: 8,
      enemyLevel: baseLevel + 2,
      cost: 3,
    },
  ];
}

/** Start a quest after the player picks one from the board. */
export function startQuest(state: QuestState, quest: QuestDef): void {
  state.phase = 'quest_active';
  state.boxesRequired = quest.boxesRequired;
  state.boxesCollected = 0;
  state.enemyLevel = quest.enemyLevel;
  state.questLabel = quest.label;
  state.enemies = [];
  state.boxes = [];
  state.spawnTimer = 3;
  state.goldEarned = 0;
  state.xpEarned = 0;
}

// ── Helpers ──

function addFloat(state: QuestState, x: number, y: number, text: string, color: string) {
  state.floatingTexts.push({ x, y, text, color, life: FLOAT_TEXT_DURATION, maxLife: FLOAT_TEXT_DURATION });
}

function nextId(state: QuestState): number {
  return ++state.idCounter;
}

function spawnBox(state: QuestState): void {
  state.boxes.push({
    id: nextId(state),
    x: CANVAS_W + Math.random() * 120,
    y: GROUND_Y,
    width: 20,
    height: 18,
    collected: false,
    fadeTimer: 0,
  });
}

function spawnEnemy(state: QuestState): void {
  const lvl = state.enemyLevel;
  const hp = 30 + lvl * 8;
  state.enemies.push({
    id: nextId(state),
    x: CANVAS_W + Math.random() * 100,
    y: GROUND_Y,
    hp,
    maxHp: hp,
    attack: 4 + lvl * 2,
    defense: Math.floor(lvl / 2),
    speed: lvl * 1.5,
    attackCooldown: 1.5,
    attackTimer: 0,
    width: 26,
    height: 32,
    level: lvl,
    dead: false,
    deathTimer: 0,
  });
}

// ── Tick ──

export interface QuestTickResult {
  /** True when walk_to_guild phase finishes and we should show the board. */
  arrivedAtGuild: boolean;
  /** True when the quest is completed (hero returned to guild). */
  questComplete: boolean;
  /** True when the hero dies during a quest. */
  heroDied: boolean;
  /** True when the hero has walked far enough from the guild that it's off-screen. */
  leftGuild: boolean;
  /** Gold earned this tick. */
  goldEarned: number;
  /** XP earned this tick. */
  xpEarned: number;
}

export function questTick(state: QuestState, gs: GameState, dt: number): QuestTickResult {
  const result: QuestTickResult = {
    arrivedAtGuild: false,
    questComplete: false,
    heroDied: false,
    leftGuild: false,
    goldEarned: 0,
    xpEarned: 0,
  };
  const hero = state.hero;

  // Floating texts
  state.floatingTexts = state.floatingTexts.filter(ft => {
    ft.life -= dt;
    ft.y -= 30 * dt;
    return ft.life > 0;
  });

  // Sync hero stats from gameState each frame
  hero.attack = gs.total_attack;
  hero.defense = gs.total_defense;
  hero.speed = 30 + gs.total_speed * 5;
  hero.attackCooldown = Math.max(0.4, 1.2 - gs.total_speed * 0.05);
  const expectedMaxHp = gs.max_hp ?? (100 + gs.level * 10);
  if (expectedMaxHp > hero.maxHp) {
    hero.hp += expectedMaxHp - hero.maxHp;
    hero.maxHp = expectedMaxHp;
  }

  // ── Phase: camera_swing ──
  if (state.phase === 'camera_swing') {
    state.swingProgress = Math.min(1, state.swingProgress + dt / SWING_DURATION);
    if (state.swingProgress >= 1) {
      state.phase = 'walk_to_guild';
    }
    return result;
  }

  // ── Phase: walk_to_guild ──
  if (state.phase === 'walk_to_guild') {
    state.distance += hero.speed * dt;
    if (state.distance >= state.guildX) {
      state.distance = state.guildX;
      state.phase = 'at_guild';
      result.arrivedAtGuild = true;
    }
    return result;
  }

  // ── Phase: at_guild — no ticking, React handles it ──
  if (state.phase === 'at_guild') {
    return result;
  }

  // ── Phase: quest_active ──
  if (state.phase === 'quest_active') {
    if (!hero.alive) {
      result.heroDied = true;
      // Fade dead enemies
      state.enemies = state.enemies.filter(e => !e.dead || e.deathTimer > 0);
      state.enemies.forEach(e => { if (e.dead) e.deathTimer -= dt; });
      return result;
    }

    // Spawn timer
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const remaining = state.boxesRequired - state.boxesCollected - state.boxes.filter(b => !b.collected).length;
      if (remaining > 0) {
        if (Math.random() < BOX_CHANCE) {
            spawnBox(state);
        } else {
            spawnEnemy(state);
        }
      }
      state.spawnTimer = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }

    // Move hero forward if no enemy close
    const anyClose = state.enemies.some(e => !e.dead && e.x - hero.x < 120);
    if (!anyClose) {
      state.distance += hero.speed * dt;
    }

    // Move enemies toward hero
    for (const e of state.enemies) {
      if (e.dead) { e.deathTimer -= dt; continue; }
      if (e.x > hero.x + 50) e.x -= (e.speed + hero.speed) * dt;
    }
    state.enemies = state.enemies.filter(e => !e.dead || e.deathTimer > 0);

    // Move boxes toward hero (they scroll with distance or drift left slowly)
    for (const b of state.boxes) {
      if (b.collected) { b.fadeTimer -= dt; continue; }
      // Boxes are stationary in world-space, so approach as hero walks
      // We simulate by drifting them left at hero speed when hero moves
      if (!anyClose) b.x -= hero.speed * dt;
    }
    state.boxes = state.boxes.filter(b => !b.collected || b.fadeTimer > 0);

    // Collect boxes
    for (const b of state.boxes) {
      if (b.collected) continue;
      if (b.x - hero.x < 40 && b.x - hero.x > -20) {
        b.collected = true;
        b.fadeTimer = BOX_FADE;
        state.boxesCollected++;
        addFloat(state, b.x, b.y - 30, `📦 ${state.boxesCollected}/${state.boxesRequired}`, '#f59e0b');
      }
    }

    // Hero attacks lowest-health enemy in range
    const living = state.enemies.filter(e => !e.dead);
    const targetEnemy = pickAttackTarget(state.enemies, hero.x);

    hero.attackTimer -= dt;
    if (targetEnemy && hero.attackTimer <= 0) {
      const dmg = Math.max(1, hero.attack - targetEnemy.defense);
      targetEnemy.hp -= dmg;
      hero.attackTimer = hero.attackCooldown;
      addFloat(state, targetEnemy.x, targetEnemy.y - 20, `-${dmg}`, '#ef4444');
      if (targetEnemy.hp <= 0) {
        targetEnemy.dead = true;
        targetEnemy.deathTimer = DEATH_FADE;
        const goldR = 3 + targetEnemy.level * 2;
        const xpR = 10 + targetEnemy.level * 5;
        state.goldEarned += goldR;
        state.xpEarned += xpR;
        result.goldEarned += goldR;
        result.xpEarned += xpR;
        addFloat(state, targetEnemy.x, targetEnemy.y - 40, `+${goldR}g`, '#eab308');
      }
    }

    // Enemies attack hero
    for (const e of living) {
      if (e.x - hero.x >= 80) continue;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const dmg = Math.max(1, e.attack - hero.defense);
        hero.hp -= dmg;
        e.attackTimer = e.attackCooldown;
        addFloat(state, hero.x, hero.y - 20, `-${dmg}`, '#f97316');
        if (hero.hp <= 0) {
          hero.hp = 0;
          hero.alive = false;
          result.heroDied = true;
          break;
        }
      }
    }

    // Check if all boxes collected → return phase
    if (state.boxesCollected >= state.boxesRequired) {
      state.phase = 'return_to_guild';
      addFloat(state, hero.x, hero.y - 50, 'All boxes collected! Returning...', '#22c55e');
    }

    return result;
  }

  // ── Phase: return_to_guild ──
  if (state.phase === 'return_to_guild') {
    // Hero walks back  (distance decreases toward guildX)
    state.distance -= hero.speed * dt * 1.5;  // walk back faster than going out
    if (state.distance <= state.guildX) {
      state.distance = state.guildX;
      state.phase = 'quest_complete';
      result.questComplete = true;
    }
    return result;
  }

  // ── Phase: leaving_guild ──
  if (state.phase === 'leaving_guild') {
    state.distance += hero.speed * dt;
    // Guild screen position = HERO_X + (guildX - distance)
    // When that goes below -200 the guild is well off-screen left.
    const guildScreenX = 80 + (state.guildX - state.distance);
    if (guildScreenX < -200) {
      result.leftGuild = true;
    }
    return result;
  }

  return result;
}

/** Transition into the leaving_guild phase (hero walks away from the guild). */
export function beginLeavingGuild(state: QuestState): void {
  state.phase = 'leaving_guild';
  // Clear any quest entities so the walk-away scene is clean
  state.enemies = [];
  state.boxes = [];
}
