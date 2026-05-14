import { useState } from 'react';
import type { GameState } from '../types';
import type { UpgradeType } from '../api';

interface RunOverScreenProps {
  gameState: GameState;
  soulsEarned: number;
  levelReached: number;
  onUpgrade: (upgrade: UpgradeType) => Promise<void>;
  onStartNewRun: () => void;
}

interface UpgradeDef {
  key: UpgradeType;
  label: string;
  emoji: string;
  currentLevel: (gs: GameState) => number;
  nextEffect: (gs: GameState) => string;
  /** Custom cost function; defaults to the standard (level+1)*10 formula. */
  costFn?: (gs: GameState) => number;
  /** Returns true when no further upgrade is available. */
  isMaxed?: (gs: GameState) => boolean;
  /** Custom level label; defaults to "Lv {n}". */
  levelLabel?: (gs: GameState) => string;
}

const GAME_SPEED_TIER_COSTS: Record<number, number> = { 1: 10, 2: 20, 4: 40 };
const GAME_SPEED_TIER_NEXT: Record<number, number> = { 1: 2, 2: 4, 4: 8 };

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
  {
    key: 'game_speed',
    label: 'Turbo Engine',
    emoji: '⏩',
    currentLevel: gs => gs.max_game_speed,
    levelLabel: gs => `${gs.max_game_speed}×`,
    nextEffect: gs => {
      const next = GAME_SPEED_TIER_NEXT[gs.max_game_speed];
      return next ? `Unlock ${next}× game speed` : 'Maximum speed reached';
    },
    costFn: gs => GAME_SPEED_TIER_COSTS[gs.max_game_speed] ?? 0,
    isMaxed: gs => !(gs.max_game_speed in GAME_SPEED_TIER_COSTS),
  },
];

function upgradeCost(currentLevel: number): number {
  return (currentLevel + 1) * 10;
}

export function RunOverScreen({ gameState, soulsEarned, levelReached, onUpgrade, onStartNewRun }: RunOverScreenProps) {
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
            <span className="stat-value">⭐ {levelReached}</span>
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
            const maxed = upg.isMaxed ? upg.isMaxed(gameState) : false;
            const cost = maxed ? 0 : (upg.costFn ? upg.costFn(gameState) : upgradeCost(upg.currentLevel(gameState)));
            const canAfford = !maxed && gameState.souls >= cost;
            const levelDisplay = upg.levelLabel ? upg.levelLabel(gameState) : `Lv ${upg.currentLevel(gameState)}`;
            return (
              <div key={upg.key} className={`upgrade-card ${canAfford ? '' : 'upgrade-card--locked'}`}>
                <div className="upgrade-card-header">
                  <span className="upgrade-emoji">{upg.emoji}</span>
                  <span className="upgrade-name">{upg.label}</span>
                  <span className="upgrade-level">{levelDisplay}</span>
                </div>
                <div className="upgrade-effect">{upg.nextEffect(gameState)}</div>
                <button
                  className={`btn ${canAfford ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={maxed || !canAfford || pending !== null}
                  onClick={() => handleUpgrade(upg.key)}
                >
                  {maxed ? 'Maxed' : pending === upg.key ? '...' : `🔮 ${cost} souls`}
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
