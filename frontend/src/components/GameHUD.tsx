import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types';

const BONUS_XP_CAP = 50;
const BONUS_XP_RATE = 1 / 60; // per second

interface GameHUDProps {
  gameState: GameState;
  /** Optional extra stats to show (e.g. kill streak). */
  extraStats?: React.ReactNode;
  /** If provided, the quest-token stat becomes a button that calls this. */
  onQuestClick?: () => void;
}

export function GameHUD({ gameState, extraStats, onQuestClick }: GameHUDProps) {
  const [displayBonusXp, setDisplayBonusXp] = useState(gameState.bonus_xp);
  // Track the server value + time it was received so we can interpolate forward
  const serverRef = useRef({ value: gameState.bonus_xp, receivedAt: Date.now() });

  // When the server sends a new bonus_xp (e.g. after a kill resets it to 0),
  // reset the reference point.
  useEffect(() => {
    serverRef.current = { value: gameState.bonus_xp, receivedAt: Date.now() };
    setDisplayBonusXp(gameState.bonus_xp);
  }, [gameState.bonus_xp]);

  // Tick every second to animate the gradual fill.
  useEffect(() => {
    const id = setInterval(() => {
      const { value, receivedAt } = serverRef.current;
      const elapsedSeconds = (Date.now() - receivedAt) / 1000;
      setDisplayBonusXp(Math.min(BONUS_XP_CAP, value + elapsedSeconds * BONUS_XP_RATE));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const tokenStat = onQuestClick && gameState.quest_tokens > 0
    ? (
        <button
          className="stat stat-btn"
          title="Go to the guild hall to pick a quest"
          onClick={onQuestClick}
        >
          🎫 {gameState.quest_tokens} Quest {gameState.quest_tokens === 1 ? 'Token' : 'Tokens'} — Go!
        </button>
      )
    : <span className="stat" title="Quest Tokens">🎫 {gameState.quest_tokens}</span>;

  return (
    <>
      <div className="battle-stats">
        <span className="stat" title="Total Attack">🗡️ {gameState.total_attack}</span>
        <span className="stat" title="Total Defense">🛡️ {gameState.total_defense}</span>
        <span className="stat" title="Total Speed">⚡ {gameState.total_speed}</span>
        <span className="stat" title="Level">⭐ Lv {gameState.level}</span>
        <span className="stat" title="Gold">💰 {gameState.gold}</span>
        <span className="stat" title="Souls">👻 {gameState.souls}</span>
        {tokenStat}
        {extraStats}
      </div>
      <div className="xp-bar-container">
        <div className="xp-bar-fill" style={{ width: `${(gameState.xp / gameState.xp_to_next_level) * 100}%` }} />
        <span className="xp-bar-text">{gameState.xp} / {gameState.xp_to_next_level} XP</span>
      </div>
      <div className="bonus-xp-bar-container" title="Bonus XP — builds up over time; awarded automatically on your next kill">
        <div className="bonus-xp-bar-fill" style={{ width: `${(displayBonusXp / BONUS_XP_CAP) * 100}%` }} />
        <span className="xp-bar-text">✨ {Math.floor(displayBonusXp)} / {BONUS_XP_CAP} Bonus XP</span>
      </div>
    </>
  );
}
