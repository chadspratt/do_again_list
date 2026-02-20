import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventSettings,
  fetchGameState,
} from './api';
import type { DoAgainEvent, EventSettings, GameState } from './types';
import { Header } from './components/Header';
import { EventGrid } from './components/EventGrid';
import { NewEventModal } from './components/NewEventModal';
import { SettingsModal } from './components/SettingsModal';
import { BattleLane, type BattleLaneHandle } from './components/BattleLane';
import './App.css';

export default function App() {
  const [events, setEvents] = useState<DoAgainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [settingsEvent, setSettingsEvent] = useState<DoAgainEvent | null>(null);
  const [now, setNow] = useState(Date.now());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const battleLaneRef = useRef<BattleLaneHandle>(null);

  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGameState = useCallback(async () => {
    try {
      const data = await fetchGameState();
      setGameState(data);
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadGameState();
  }, [loadEvents, loadGameState]);

  // Tick every second to update timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Update game state from API response (returned by create/update/settings)
  const applyGameResponse = useCallback((data: {
    game?: GameState;
    game_messages?: string[];
    spawn_enemy?: { level: number; stat_modifier?: { attack?: number; defense?: number; speed?: number } } | null;
    hero_buffs?: { stat: 'attack' | 'defense' | 'speed'; amount: number; label: string }[];
    pending_heal?: boolean;
    pending_fatigue?: boolean;
  }) => {
    if (data.game) setGameState(data.game);
    if (data.game_messages && data.game_messages.length > 0) {
      console.log('🎮 Game:', data.game_messages.join(' | '));
    }
    const lane = battleLaneRef.current;
    if (lane) {
      // Spawn enemy if present
      if (data.spawn_enemy) {
        lane.spawnEnemy(data.spawn_enemy.level, data.spawn_enemy.stat_modifier);
      }
      // Apply buffs
      if (data.hero_buffs) {
        for (const buff of data.hero_buffs) {
          lane.applyBuff(buff.stat, buff.amount, buff.label);
        }
      }
      // Heal on perfect timing
      if (data.pending_heal) {
        lane.healHero();
      }
      // Fatigue on overtime
      if (data.pending_fatigue) {
        lane.fatigueHero();
      }
    }
  }, []);

  const handleCreate = useCallback(
    async (title: string, date: string) => {
      const result = await createEvent(title, date);
      if (result.success) {
        setShowNewModal(false);
        await loadEvents();
        applyGameResponse(result);
      } else {
        alert('Error creating event: ' + (result.error || ''));
      }
    },
    [loadEvents, applyGameResponse],
  );

  const handleUpdate = useCallback(
    async (eventId: number, action: string, datetime: string, endDatetime?: string) => {
      const killStreak = battleLaneRef.current?.getKillStreak() ?? 0;
      const result = await updateEvent(eventId, action, datetime, endDatetime, killStreak);
      if (result.success) {
        await loadEvents();
        applyGameResponse(result);
      } else {
        alert('Error updating event: ' + (result.error || ''));
      }
    },
    [loadEvents, applyGameResponse],
  );

  const handleDelete = useCallback(
    async (eventId: number) => {
      if (!confirm('Are you sure you want to delete this event?')) return;
      const result = await deleteEvent(eventId);
      if (result.success) {
        await loadEvents();
      } else {
        alert('Error deleting event');
      }
    },
    [loadEvents],
  );

  const handleSaveSettings = useCallback(
    async (eventId: number, settings: EventSettings) => {
      const result = await updateEventSettings(eventId, settings);
      if (result.success) {
        setSettingsEvent(null);
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, ...settings } : e)),
        );
        applyGameResponse(result);
      } else {
        alert('Error saving settings: ' + (result.error || ''));
      }
    },
    [applyGameResponse],
  );

  const handleGameGoldXp = useCallback(
    (gold: number, xp: number) => {
      // Optimistically update local game state from enemy kills
      setGameState(prev => {
        if (!prev) return prev;
        let newXp = prev.xp + xp;
        let newLevel = prev.level;
        while (newXp >= newLevel * 100) {
          newXp -= newLevel * 100;
          newLevel++;
        }
        return {
          ...prev,
          gold: prev.gold + gold,
          xp: newXp,
          level: newLevel,
          total_attack: prev.base_attack + newLevel,
          total_defense: prev.base_defense + Math.floor(newLevel / 2),
          xp_to_next_level: newLevel * 100,
        };
      });
    },
    [],
  );

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Header onAddClick={() => setShowNewModal(true)} />
      {gameState && (
        <BattleLane ref={battleLaneRef} gameState={gameState} onGoldXp={handleGameGoldXp} />
      )}
      <EventGrid
        events={events}
        now={now}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onOpenSettings={(event) => setSettingsEvent(event)}
      />
      <NewEventModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={handleCreate}
      />
      <SettingsModal
        event={settingsEvent}
        onClose={() => setSettingsEvent(null)}
        onSave={handleSaveSettings}
      />
    </>
  );
}
