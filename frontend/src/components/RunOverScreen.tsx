import { useState } from 'react';
import type { GameState } from '../types';
import type { UpgradeType } from '../api';

interface RunOverScreenProps {
  gameState: GameState;
  soulsEarned: number;
  onUpgrade: (upgrade: UpgradeType) => Promise<void>;
  onStartNewRun: () => void;
}

interface UpgradeDef {
  key: UpgradeType;
  label: string;
  emoji: string;
  currentLevel: (gs: GameState) => number;
  nextEffect: (gs: GameState) => string;
}

const UPGRADES: UpgradeDef[] = [
  {
    key: 'attack',
    label: 'Eternal Strength',
    emoji: '🗡️',
    currentLevel: gs => gs.perm_attack,
    nextEffect: gs => `+${gs.perm_attack + 1} permanent ATK`,
  },
  {
    key: 'defense',
    label: 'Eternal Guard',
    emoji: '🛡️',
    currentLevel: gs => gs.perm_defense,
    nextEffect: gs => `+${gs.perm_defense + 1} permanent DEF`,
  },
  {
    key: 'speed',
    label: 'Eternal Swiftness',
    emoji: '⚡',
    currentLevel: gs => gs.perm_speed,
    nextEffect: gs => `+${gs.perm_speed + 1} permanent SPD`,
  },
  {
    key: 'hp',
    label: 'Eternal Fortitude',
    emoji: '❤️',
    currentLevel: gs => gs.perm_hp,
    nextEffect: gs => `+${(gs.perm_hp + 1) * 10} permanent max HP`,
  },
];

function upgradeCost(currentLevel: number): number {
  return (currentLevel + 1) * 10;
}

export function RunOverScreen({ gameState, soulsEarned, onUpgrade, onStartNewRun }: RunOverScreenProps) {
  const [pending, setPending] = useState<UpgradeType | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const handleUpgrade = async (key: UpgradeType) => {
    setPending(key);
    setUpgradeError(null);
    try {
      await onUpgrade(key);
    } catch (e: unknown) {
      setUpgradeError(e instanceof Error ? e.message : 'Upgrade failed');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="run-over-overlay">
      <div className="run-over-panel">
        <h2 className="run-over-title">💀 Run Over</h2>

        <div className="run-over-stats">
          <div className="run-over-stat">
            <span className="stat-label">Level Reached</span>
            <span className="stat-value">⭐ {gameState.level}</span>
          </div>
          <div className="run-over-stat run-over-stat--highlight">
            <span className="stat-label">Souls Earned</span>
            <span className="stat-value">🔮 +{soulsEarned}</span>
          </div>
          <div className="run-over-stat">
            <span className="stat-label">Total Souls</span>
            <span className="stat-value">🔮 {gameState.souls}</span>
          </div>
        </div>

        <h3 className="run-over-upgrades-title">Permanent Upgrades</h3>

        <div className="run-over-upgrades">
          {UPGRADES.map(upg => {
            const level = upg.currentLevel(gameState);
            const cost = upgradeCost(level);
            const canAfford = gameState.souls >= cost;
            return (
              <div key={upg.key} className={`upgrade-card ${canAfford ? '' : 'upgrade-card--locked'}`}>
                <div className="upgrade-card-header">
                  <span className="upgrade-emoji">{upg.emoji}</span>
                  <span className="upgrade-name">{upg.label}</span>
                  <span className="upgrade-level">Lv {level}</span>
                </div>
                <div className="upgrade-effect">{upg.nextEffect(gameState)}</div>
                <button
                  className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={!canAfford || pending !== null}
                  onClick={() => handleUpgrade(upg.key)}
                >
                  {pending === upg.key ? '...' : `🔮 ${cost} souls`}
                </button>
              </div>
            );
          })}
        </div>

        {upgradeError && (
          <div className="run-over-error">{upgradeError}</div>
        )}

        <button className="btn btn-primary run-over-start-btn" onClick={onStartNewRun}>
          ▶ Start New Run
        </button>
      </div>
    </div>
  );
}
