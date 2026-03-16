import type { GameState } from '../types';

interface GameHUDProps {
  gameState: GameState;
  /** Optional extra stats to show (e.g. kill streak). */
  extraStats?: React.ReactNode;
  /** If provided, the quest-token stat becomes a button that calls this. */
  onQuestClick?: () => void;
}

export function GameHUD({ gameState, extraStats, onQuestClick }: GameHUDProps) {
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
    </>
  );
}
