import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState } from '../types';
import {
  createQuestState,
  questTick,
  generateQuests,
  startQuest,
  type QuestState,
  type QuestDef,
} from '../game/questEngine';
import { renderQuestFrame } from '../game/questRenderer';
import { syncBattleState, acceptQuest, runOverRun } from '../api';
import { JobsBoard } from './JobsBoard';
import { GameHUD } from './GameHUD';

interface QuestLaneProps {
  gameState: GameState;
  onGameStateUpdate: (gs: GameState) => void;
  /** Called when the quest is fully complete (returned to guild). */
  onQuestComplete: (goldEarned: number, xpEarned: number) => void;
  /** Called if the hero dies during the quest – triggers Run Over screen. */
  onQuestFailed: (soulsEarned: number, gs: GameState) => void;
}

export function QuestLane({ gameState, onGameStateUpdate, onQuestComplete, onQuestFailed }: QuestLaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const questRef = useRef<QuestState | null>(null);
  const gameStateRef = useRef(gameState);
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const [showBoard, setShowBoard] = useState(false);
  const [quests, setQuests] = useState<QuestDef[]>([]);
  const [questPhase, setQuestPhase] = useState<string>('walk_to_guild');

  gameStateRef.current = gameState;

  // Init quest state
  useEffect(() => {
    questRef.current = createQuestState(gameState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAcceptQuest = useCallback(async (quest: QuestDef) => {
    try {
      const gs = await acceptQuest(quest.cost);
      onGameStateUpdate(gs);
      const qs = questRef.current;
      if (qs) {
        startQuest(qs, quest);
        setShowBoard(false);
        setQuestPhase('quest_active');
      }
    } catch (err) {
      console.error('Failed to accept quest:', err);
    }
  }, [onGameStateUpdate]);

  const gameLoop = useCallback((timestamp: number) => {
    const qs = questRef.current;
    const canvas = canvasRef.current;
    if (!qs || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
    lastTimeRef.current = timestamp;

    const result = questTick(qs, gameStateRef.current, dt);
    setQuestPhase(qs.phase);

    // Sync rewards
    if (result.goldEarned > 0 || result.xpEarned > 0) {
      syncBattleState(result.goldEarned, result.xpEarned, 0, qs.hero.hp)
        .then(gs => onGameStateUpdate(gs))
        .catch(err => console.error('Quest sync failed:', err));
    }

    renderQuestFrame(ctx, qs);

    // Arrived at guild — show jobs board
    if (result.arrivedAtGuild) {
      setShowBoard(true);
      setQuests(generateQuests(gameStateRef.current));
      // Don't cancel the loop — still render the guild scene
    }

    // Quest complete — return to guild
    if (result.questComplete) {
      cancelAnimationFrame(animationRef.current);
      // brief delay so the player sees the guild, then complete
      setTimeout(() => {
        onQuestComplete(qs.goldEarned, qs.xpEarned);
      }, 800);
      return;
    }

    // Hero died — trigger the run-over flow (same as normal battle death)
    if (result.heroDied) {
      cancelAnimationFrame(animationRef.current);
      setTimeout(() => {
        runOverRun()
          .then(({ game, souls_earned }) => onQuestFailed(souls_earned, game))
          .catch(err => console.error('Quest run_over failed:', err));
      }, 1500);
      return;
    }

    animationRef.current = requestAnimationFrame(gameLoop);
  }, [onGameStateUpdate, onQuestComplete, onQuestFailed]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [gameLoop]);

  // When the board is showing and user picks a quest, restart the animation loop
  useEffect(() => {
    if (!showBoard && questPhase === 'quest_active') {
      lastTimeRef.current = 0;
      animationRef.current = requestAnimationFrame(gameLoop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBoard, questPhase]);

  return (
    <div className="quest-lane-wrapper">
      <canvas
        ref={canvasRef}
        width={1500}
        height={150}
        className="battle-canvas"
      />
      <GameHUD gameState={gameState} />
      {showBoard && (
        <JobsBoard
          quests={quests}
          gameState={gameState}
          onAccept={handleAcceptQuest}
        />
      )}
    </div>
  );
}
