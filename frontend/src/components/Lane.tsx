import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useState,
} from 'react';
import type { GameState } from '../types';
import {
  createBattleState,
  tick,
  spawnEnemyFromEvent,
  queueEnemyFromEvent,
  applyBuff,
  type BattleState,
} from '../game/engine';
import {
  createQuestState,
  questTick,
  generateQuests,
  startQuest,
  beginLeavingGuild,
  type QuestState,
  type QuestDef,
} from '../game/questEngine';
import { renderFrame, renderQuestFrame } from '../game/renderer';
import { syncBattleState, acceptQuest, runOverRun } from '../api';
import { JobsBoard } from './JobsBoard';
import { GameHUD } from './GameHUD';

// ── Public handle (same as old BattleLane) ──

export interface LaneHandle {
  spawnEnemy: (
    level: number,
    statModifier?: { attack?: number; defense?: number; speed?: number },
  ) => void;
  applyBuff: (
    stat: 'ATTACK' | 'DEFENSE' | 'SPEED',
    amount: number,
    label: string,
  ) => void;
  healHero: () => void;
  fatigueHero: () => void;
  getKillStreak: () => number;
}

// ── Props ──

interface LaneProps {
  gameState: GameState;
  onGameStateUpdate: (gs: GameState) => void;
  /** Called with souls earned + updated GameState when the run ends (hero dies). */
  onRunOver: (soulsEarned: number, gs: GameState) => void;
  /** Whether the app wants quest mode active. */
  questActive: boolean;
  /** Called when the quest walk-away finishes successfully. */
  onQuestComplete: (goldEarned: number, xpEarned: number, heroHp: number) => void;
  /** Called when the hero dies during a quest. */
  onQuestFailed: (soulsEarned: number, gs: GameState) => void;
  /** Called when the player leaves the guild / exits quest voluntarily. */
  onExitQuest: () => void;
}

type Mode = 'battle' | 'quest';

// ── Component ──

export const Lane = forwardRef<LaneHandle, LaneProps>(function Lane(
  {
    gameState,
    onGameStateUpdate,
    onRunOver,
    questActive,
    onQuestComplete,
    onQuestFailed,
    onExitQuest,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // State refs — mutated in the animation loop, never trigger re-renders
  const battleRef = useRef<BattleState | null>(null);
  const questRef = useRef<QuestState | null>(null);
  const gameStateRef = useRef(gameState);
  const modeRef = useRef<Mode>('battle');

  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isRunOverRef = useRef(false);

  const [gameSpeed, setGameSpeed] = useState(1);
  const gameSpeedRef = useRef(1);

  // Callback to fire when the leaving_guild walk-away finishes
  const leaveCallbackRef = useRef<(() => void) | null>(null);

  // React state — only what the UI needs
  const [mode, setMode] = useState<Mode>('battle');
  const [killStreak, setKillStreak] = useState(gameState.streak);
  const [showBoard, setShowBoard] = useState(false);
  const [quests, setQuests] = useState<QuestDef[]>([]);

  // Keep gameState ref current
  gameStateRef.current = gameState;

  // ── Initialise battle state once ──
  useEffect(() => {
    isRunOverRef.current = false;
    const battle = createBattleState(gameState);
    // Restore persisted HP
    const savedHp = gameState.hero_hp;
    if (savedHp > 0) {
      battle.hero.hp = Math.min(savedHp, battle.hero.maxHp);
    }
    if (gameState.spawn_first_enemy) {
      spawnEnemyFromEvent(battle, 1);
    }
    battleRef.current = battle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync hero stats when gameState changes (server rewards, level-ups) ──
  useEffect(() => {
    const battle = battleRef.current;
    if (!battle || !battle.hero.alive) return;
    const hero = battle.hero;
    hero.attack = gameState.total_attack;
    hero.defense = gameState.total_defense;
    hero.speed = 30 + gameState.total_speed * 5;
    hero.attackCooldown = Math.max(0.4, 1.2 - gameState.total_speed * 0.05);
    const newMaxHp = gameState.max_hp ?? (100 + gameState.level * 10);
    if (newMaxHp > hero.maxHp) {
      hero.hp += newMaxHp - hero.maxHp;
      hero.maxHp = newMaxHp;
    }
  }, [gameState]);

  // ── Imperative handle (battle-mode helpers for App) ──
  useImperativeHandle(
    ref,
    () => ({
      spawnEnemy(
        level: number,
        statModifier?: {
          attack?: number;
          defense?: number;
          speed?: number;
        },
      ) {
        const battle = battleRef.current;
        if (battle) queueEnemyFromEvent(battle, level, statModifier);
      },
      applyBuff(
        stat: 'ATTACK' | 'DEFENSE' | 'SPEED',
        amount: number,
        label: string,
      ) {
        const battle = battleRef.current;
        if (battle) applyBuff(battle, stat, amount, label);
      },
      healHero() {
        const battle = battleRef.current;
        if (battle && battle.hero.alive) {
          const heal = Math.floor(battle.hero.maxHp * 0.3);
          battle.hero.hp = Math.min(battle.hero.maxHp, battle.hero.hp + heal);
          battle.floatingTexts.push({
            x: battle.hero.x,
            y: battle.hero.y - 30,
            text: `+${heal} HP`,
            color: '#22c55e',
            life: 1.2,
            maxLife: 1.2,
          });
        }
      },
      fatigueHero() {
        const battle = battleRef.current;
        if (battle && battle.hero.alive) {
          const dmg = Math.floor(battle.hero.maxHp * 0.15);
          battle.hero.hp = Math.max(1, battle.hero.hp - dmg);
          battle.floatingTexts.push({
            x: battle.hero.x,
            y: battle.hero.y - 30,
            text: `Fatigue -${dmg}`,
            color: '#f97316',
            life: 1.2,
            maxLife: 1.2,
          });
        }
      },
      getKillStreak() {
        return battleRef.current?.hero.killStreak ?? 0;
      },
    }),
    [],
  );

  // ── Transition: battle → quest ──
  const enterQuestMode = useCallback(() => {
    const battle = battleRef.current;
    if (!battle) return;
    const qs = createQuestState(gameStateRef.current, battle.distance);
    // Carry hero HP from the battle into the quest
    qs.hero.hp = battle.hero.hp;
    qs.hero.maxHp = battle.hero.maxHp;
    questRef.current = qs;
    modeRef.current = 'quest';
    setMode('quest');
    setShowBoard(false);
  }, []);

  // ── Transition: quest → battle ──
  const returnToBattle = useCallback(() => {
    const qs = questRef.current;
    const battle = battleRef.current;
    if (qs && battle) {
      // Carry distance so the parallax background is seamless
      battle.distance = qs.distance;
      // Carry hero HP back
      battle.hero.hp = Math.min(qs.hero.hp, battle.hero.maxHp);
    }
    questRef.current = null;
    modeRef.current = 'battle';
    setMode('battle');
    setShowBoard(false);
  }, []);

  // ── React to questActive prop changes ──
  const prevQuestActive = useRef(questActive);
  useEffect(() => {
    if (questActive && !prevQuestActive.current) {
      // App wants us to enter quest mode
      enterQuestMode();
    }
    prevQuestActive.current = questActive;
  }, [questActive, enterQuestMode]);

  // ── Quest: accept a quest from the board ──
  const handleAcceptQuest = useCallback(
    async (quest: QuestDef) => {
      try {
        const gs = await acceptQuest(quest.cost);
        onGameStateUpdate(gs);
        const qs = questRef.current;
        if (qs) {
          startQuest(qs, quest);
          setShowBoard(false);
        }
      } catch (err) {
        console.error('Failed to accept quest:', err);
      }
    },
    [onGameStateUpdate],
  );

  // ── Quest: begin leaving guild and call cb when walk-away finishes ──
  const triggerLeave = useCallback((cb: () => void) => {
    const qs = questRef.current;
    if (!qs) {
      cb();
      return;
    }
    leaveCallbackRef.current = cb;
    setShowBoard(false);
    beginLeavingGuild(qs);
  }, []);

  const handleExitBoard = useCallback(() => {
    triggerLeave(() => {
      returnToBattle();
      onExitQuest();
    });
  }, [triggerLeave, returnToBattle, onExitQuest]);

  const handleExitQuest = useCallback(() => {
    triggerLeave(() => {
      returnToBattle();
      onExitQuest();
    });
  }, [triggerLeave, returnToBattle, onExitQuest]);

  // ── Animation loop ──
  const gameLoop = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const rawDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      const dt = rawDt * gameSpeedRef.current;
      lastTimeRef.current = timestamp;

      const currentMode = modeRef.current;

      // ─── Battle mode ───
      if (currentMode === 'battle') {
        const battle = battleRef.current;
        if (!battle) {
          animationRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        const result = tick(battle, gameStateRef.current, dt);
        setKillStreak(result.killStreak);

        if (
          result.goldEarned > 0 ||
          result.xpEarned > 0 ||
          result.questTokensEarned > 0
        ) {
          syncBattleState(
            result.goldEarned,
            result.xpEarned,
            battle.hero.killStreak,
            battle.hero.hp,
            result.questTokensEarned,
          )
            .then((gs) => onGameStateUpdate(gs))
            .catch((error) =>
              console.error('Failed to sync battle state:', error),
            );
        }

        renderFrame(ctx, battle);

        if (result.runOver && !isRunOverRef.current) {
          isRunOverRef.current = true;
          cancelAnimationFrame(animationRef.current);
          runOverRun()
            .then(({ game, souls_earned }) => onRunOver(souls_earned, game))
            .catch((error) =>
              console.error('Failed to call run_over:', error),
            );
          return;
        }
      }

      // ─── Quest mode ───
      if (currentMode === 'quest') {
        const qs = questRef.current;
        if (!qs) {
          animationRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        const result = questTick(qs, gameStateRef.current, dt);

        // Sync rewards
        if (result.goldEarned > 0 || result.xpEarned > 0) {
          syncBattleState(result.goldEarned, result.xpEarned, 0, qs.hero.hp)
            .then((gs) => onGameStateUpdate(gs))
            .catch((err) => console.error('Quest sync failed:', err));
        }

        renderQuestFrame(ctx, qs);

        // Arrived at guild — show jobs board
        if (result.arrivedAtGuild) {
          setShowBoard(true);
          setQuests(generateQuests(gameStateRef.current));
        }

        // Quest complete — hero returned to guild, now walk away
        if (result.questComplete) {
          const heroHp = result.heroHpAfterHeal;
          // Sync completion XP + heal immediately so level-ups apply right away
          syncBattleState(0, result.completionXp, 0, heroHp)
            .then((gs) => onGameStateUpdate(gs))
            .catch((err) => console.error('Quest completion sync failed:', err));
          leaveCallbackRef.current = () => {
            returnToBattle();
            onQuestComplete(0, 0, heroHp);
          };
          setTimeout(() => {
            beginLeavingGuild(qs);
          }, 800);
        }

        // Hero walked far enough from the guild — fire the leave callback
        if (result.leftGuild) {
          cancelAnimationFrame(animationRef.current);
          const cb = leaveCallbackRef.current;
          leaveCallbackRef.current = null;
          if (cb) cb();
          // cb calls returnToBattle() which sets mode='battle'; restart loop
          lastTimeRef.current = 0;
          animationRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        // Hero died during quest
        if (result.heroDied) {
          cancelAnimationFrame(animationRef.current);
          setTimeout(() => {
            runOverRun()
              .then(({ game, souls_earned }) => {
                questRef.current = null;
                modeRef.current = 'battle';
                setMode('battle');
                onQuestFailed(souls_earned, game);
              })
              .catch((err) =>
                console.error('Quest run_over failed:', err),
              );
          }, 1500);
          return;
        }
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    },
    [onGameStateUpdate, onRunOver, onQuestComplete, onQuestFailed, returnToBattle],
  );

  // Start and clean up the animation loop
  useEffect(() => {
    lastTimeRef.current = 0;
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  // ── Render ──
  const isQuestMode = mode === 'quest';

  return (
    <div className="battle-lane-wrapper">
      <canvas
        ref={canvasRef}
        width={1500}
        height={150}
        className="battle-canvas"
      />
      <GameHUD
        gameState={gameState}
        extraStats={
          <>
            <span className="stat">🔥 Streak: {killStreak}</span>
            <span className="stat speed-controls">
              <button
                className="speed-btn"
                onClick={() => {
                  const next = Math.max(1, gameSpeed - 1);
                  setGameSpeed(next);
                  gameSpeedRef.current = next;
                }}
                disabled={gameSpeed <= 1}
                title="Decrease speed"
              >−</button>
              <span title="Game speed">{gameSpeed}×</span>
              <button
                className="speed-btn"
                onClick={() => {
                  const next = Math.min(8, gameSpeed + 1);
                  setGameSpeed(next);
                  gameSpeedRef.current = next;
                }}
                disabled={gameSpeed >= 8}
                title="Increase speed"
              >+</button>
            </span>
          </>
        }
        onQuestClick={!isQuestMode ? enterQuestMode : undefined}
      />
      {isQuestMode && (
        <button
          className="btn btn-secondary quest-exit-btn"
          onClick={handleExitQuest}
          title="Return to Battle Lane"
        >
          ✖ Exit Quest
        </button>
      )}
      {showBoard && (
        <JobsBoard
          quests={quests}
          gameState={gameState}
          onAccept={handleAcceptQuest}
          onExit={handleExitBoard}
        />
      )}
    </div>
  );
});
