import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react';
import type { GameState } from '../types';
import { createBattleState, tick, spawnEnemyFromEvent, applyBuff, type BattleState } from '../game/engine';
import { renderFrame } from '../game/renderer';

export interface BattleLaneHandle {
  spawnEnemy: (level: number, statModifier?: { attack?: number; defense?: number; speed?: number }) => void;
  applyBuff: (stat: 'attack' | 'defense' | 'speed', amount: number, label: string) => void;
  healHero: () => void;
  fatigueHero: () => void;
  getKillStreak: () => number;
}

interface BattleLaneProps {
  gameState: GameState;
  onGoldXp: (gold: number, xp: number) => void;
}

export const BattleLane = forwardRef<BattleLaneHandle, BattleLaneProps>(function BattleLane({ gameState, onGoldXp }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const battleRef = useRef<BattleState | null>(null);
  const gameStateRef = useRef(gameState);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accGold = useRef(0);
  const accXp = useRef(0);
  const reportTimer = useRef(0);
  const [killStreak, setKillStreak] = useState(0);

  // Keep gameState ref current
  gameStateRef.current = gameState;

  // Initialize battle state
  useEffect(() => {
    battleRef.current = createBattleState(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update hero stats when gameState changes (from server rewards)
  useEffect(() => {
    const battle = battleRef.current;
    if (!battle || !battle.hero.alive) return;
    const hero = battle.hero;
    hero.attack = gameState.total_attack;
    hero.defense = gameState.total_defense;
    hero.speed = 30 + gameState.total_speed * 5;
    hero.attackCooldown = Math.max(0.4, 1.2 - gameState.total_speed * 0.05);
    const newMaxHp = 100 + gameState.level * 10;
    if (newMaxHp > hero.maxHp) {
      hero.hp += newMaxHp - hero.maxHp;
      hero.maxHp = newMaxHp;
    }
  }, [gameState]);

  // Expose imperative methods to parent
  useImperativeHandle(ref, () => ({
    spawnEnemy(level: number, statModifier?: { attack?: number; defense?: number; speed?: number }) {
      const battle = battleRef.current;
      if (battle) spawnEnemyFromEvent(battle, level, statModifier);
    },
    applyBuff(stat: 'attack' | 'defense' | 'speed', amount: number, label: string) {
      const battle = battleRef.current;
      if (battle) applyBuff(battle, stat, amount, label);
    },
    healHero() {
      const battle = battleRef.current;
      if (battle && battle.hero.alive) {
        const heal = Math.floor(battle.hero.maxHp * 0.3);
        battle.hero.hp = Math.min(battle.hero.maxHp, battle.hero.hp + heal);
        battle.floatingTexts.push({
          x: battle.hero.x, y: battle.hero.y - 30,
          text: `+${heal} HP`, color: '#22c55e', life: 1.2, maxLife: 1.2,
        });
      }
    },
    fatigueHero() {
      const battle = battleRef.current;
      if (battle && battle.hero.alive) {
        const dmg = Math.floor(battle.hero.maxHp * 0.15);
        battle.hero.hp = Math.max(1, battle.hero.hp - dmg);
        battle.floatingTexts.push({
          x: battle.hero.x, y: battle.hero.y - 30,
          text: `Fatigue -${dmg}`, color: '#f97316', life: 1.2, maxLife: 1.2,
        });
      }
    },    getKillStreak() {
      return battleRef.current?.killStreak ?? 0;
    },  }), []);

  // Animation loop
  const gameLoop = useCallback((timestamp: number) => {
    const battle = battleRef.current;
    const canvas = canvasRef.current;
    if (!battle || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    const result = tick(battle, gameStateRef.current, dt);

    // Accumulate gold/xp from kills
    if (result.goldEarned > 0 || result.xpEarned > 0) {
      accGold.current += result.goldEarned;
      accXp.current += result.xpEarned;
    }

    // Sync kill streak display
    setKillStreak(result.killStreak);

    // Report gold/xp to parent every 2 seconds
    reportTimer.current += dt;
    if (reportTimer.current >= 2 && (accGold.current > 0 || accXp.current > 0)) {
      onGoldXp(accGold.current, accXp.current);
      accGold.current = 0;
      accXp.current = 0;
      reportTimer.current = 0;
    }

    renderFrame(ctx, battle);
    animationRef.current = requestAnimationFrame(gameLoop);
  }, [onGoldXp]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  // Expose methods to trigger heal / fatigue from parent via ref

  return (
    <div className="battle-lane-wrapper">
      <canvas
        ref={canvasRef}
        width={600}
        height={280}
        className="battle-canvas"
      />
      <div className="battle-stats">
        <span className="stat">🗡️ {gameState.total_attack}</span>
        <span className="stat">🛡️ {gameState.total_defense}</span>
        <span className="stat">⚡ {gameState.total_speed}</span>
        <span className="stat">⭐ Lv {gameState.level}</span>
        <span className="stat">💰 {gameState.gold}</span>
        <span className="stat">🔥 Streak: {killStreak}</span>
      </div>
      <div className="xp-bar-container">
        <div className="xp-bar-fill" style={{ width: `${(gameState.xp / gameState.xp_to_next_level) * 100}%` }} />
        <span className="xp-bar-text">{gameState.xp} / {gameState.xp_to_next_level} XP</span>
      </div>
    </div>
  );
});
