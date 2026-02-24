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
import { PendingPanel } from './components/PendingPanel';
import { OneTimePanel } from './components/OneTimePanel';
import { BattleLane, type BattleLaneHandle } from './components/BattleLane';
import { sortEventsByDue } from './utils';
import './App.css';

export default function App() {
  const [events, setEvents] = useState<DoAgainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [settingsEvent, setSettingsEvent] = useState<DoAgainEvent | null>(null);
  const [now, setNow] = useState(Date.now());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [sortMode, setSortMode] = useState<'default' | 'due'>('default');
  const battleLaneRef = useRef<BattleLaneHandle>(null);

  // One-time (repeats === false) takes priority over pending for panel assignment
  const oneTimeEvents = events.filter(e => !e.repeats);
  const pendingEvents = events.filter(e => e.repeats && e.start_time === null && e.end_time === null);
  const activeEvents = events.filter(e => e.repeats && e.start_time !== null);
  const displayedEvents = sortMode === 'due' ? sortEventsByDue(activeEvents, now) : activeEvents;

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
    async (title: string, date: string, pending?: boolean, repeats?: boolean) => {
      const result = await createEvent(title, date, pending, repeats);
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
    async (eventId: number, action: string, datetime: string, endDatetime?: string, nextTime?: string) => {
      const killStreak = battleLaneRef.current?.getKillStreak() ?? 0;
      const result = await updateEvent(eventId, action, datetime, endDatetime, killStreak, nextTime);
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

  const handleGameStateUpdate = useCallback(
    (gs: GameState) => setGameState(gs),
    [],
  );

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Header
        onAddClick={() => setShowNewModal(true)}
        sortMode={sortMode}
        onSortToggle={() => setSortMode(m => m === 'default' ? 'due' : 'default')}
      />
      {gameState && (
        <BattleLane ref={battleLaneRef} gameState={gameState} onGameStateUpdate={handleGameStateUpdate} />
      )}
      <div className="page-layout">
        <PendingPanel
          events={pendingEvents}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenSettings={(event) => setSettingsEvent(event)}
        />
        <div className="main-panel">
          <EventGrid
            events={displayedEvents}
            now={now}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onOpenSettings={(event) => setSettingsEvent(event)}
          />
        </div>
        <OneTimePanel
          events={oneTimeEvents}
          now={now}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenSettings={(event) => setSettingsEvent(event)}
        />
      </div>
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
