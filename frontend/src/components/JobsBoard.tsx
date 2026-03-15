import type { GameState } from '../types';
import type { QuestDef } from '../game/questEngine';

interface JobsBoardProps {
  quests: QuestDef[];
  gameState: GameState;
  onAccept: (quest: QuestDef) => void;
}

export function JobsBoard({ quests, gameState, onAccept }: JobsBoardProps) {
  return (
    <div className="jobs-board-overlay">
      <div className="jobs-board">
        <h2>📜 Jobs Board</h2>
        <p className="jobs-board-tokens">
          Quest Tokens: <strong>{gameState.quest_tokens}</strong>
        </p>
        <div className="jobs-board-list">
          {quests.map((q, i) => {
            const canAfford = gameState.quest_tokens >= q.cost;
            return (
              <div key={i} className={`jobs-board-card ${canAfford ? '' : 'disabled'}`}>
                <div className="quest-header">
                  <span className="quest-label">{q.label}</span>
                  <span className="quest-cost">{q.cost} 🎫</span>
                </div>
                <p className="quest-desc">{q.description}</p>
                <div className="quest-details">
                  <span>📦 Collect {q.boxesRequired} boxes</span>
                  <span>⚔️ Enemy Lv {q.enemyLevel}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!canAfford}
                  onClick={() => onAccept(q)}
                >
                  {canAfford ? 'Accept Quest' : 'Not enough tokens'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
