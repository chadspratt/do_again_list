import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateEventSettings,
  fetchGameState,
  fetchAuthUser,
  authRegister,
  authLogin,
  authLogout,
} from './api';
import type { DoAgainEvent, EventSettings, GameState } from './types';
import type { AuthUser } from './api';
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
  const [sortMode, setSortMode] = useState<'recent' | 'due'>('due');
  const [useCodeNames, setUseCodeNames] = useState(false);
  const battleLaneRef = useRef<BattleLaneHandle>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  // One-time (repeats === false) takes priority over pending for panel assignment
  const oneTimeEvents = events.filter(e => !e.repeats);
  const pendingEvents = events.filter(e => e.repeats && e.start_time === null && e.end_time === null);
  const activeEvents = events.filter(e => e.repeats && e.start_time !== null);
  const displayedEvents = sortMode === 'due' ? sortEventsByDue(activeEvents, now) : activeEvents;
  const hintCodeNames = useCodeNames && !events.some(e => e.code_name && e.code_name.trim() !== '');

  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchEvents();
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        // Unauthenticated or unexpected response – treat as empty
        setEvents([]);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGameState = useCallback(async () => {
    try {
      const data = await fetchGameState();
      if (data && !('detail' in data)) {
        setGameState(data);
      } else {
        setGameState(null);
      }
    } catch (err) {
      console.error('Failed to load game state:', err);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadGameState();
    fetchAuthUser().then(setUser);
  }, [loadEvents, loadGameState]);

  // Tick every second to update timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Update game state from API response (returned by create/update/settings)
  const applyGameResponse = useCallback((data: {
    game?: GameState;
    messages?: string[];
    spawn_enemy?: { level: number; stat_modifier?: { attack?: number; defense?: number; speed?: number } } | null;
    hero_buffs?: { stat: 'ATTACK' | 'DEFENSE' | 'SPEED'; amount: number; label: string }[];
    pending_heal?: boolean;
    pending_fatigue?: boolean;
  }) => {
    if (data.game) setGameState(data.game);
    if (data.messages && data.messages.length > 0) {
      console.log('🎮 Game:', data.messages.join(' | '));
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
    async (eventId: number, action: string, startDatetime?: string, endDatetime?: string, nextTime?: string) => {
      const killStreak = battleLaneRef.current?.getKillStreak() ?? 0;
      const result = await updateEvent(eventId, action, startDatetime, endDatetime, nextTime, killStreak);
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

  const handleLogin = useCallback(async (username: string, password: string): Promise<string | null> => {
    const res = await authLogin(username, password);
    if (res.success && res.user) {
      setUser(res.user);
      loadEvents();
      loadGameState();
      return null;
    }
    return res.error || 'Login failed.';
  }, [loadEvents, loadGameState]);

  const handleRegister = useCallback(async (username: string, password: string): Promise<string | null> => {
    const res = await authRegister(username, password);
    if (res.success && res.user) {
      setUser(res.user);
      loadEvents();
      loadGameState();
      return null;
    }
    return res.error || 'Registration failed.';
  }, [loadEvents, loadGameState]);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setUser(null);
    loadEvents();
    loadGameState();
  }, [loadEvents, loadGameState]);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      <Header
        user={user}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onLogout={handleLogout}
      />
      {gameState && (
        <BattleLane ref={battleLaneRef} gameState={gameState} onGameStateUpdate={handleGameStateUpdate} />
      )}
      <div className="event-toolbar">
        <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
          + Add Event
        </button>
        <button
          className={`btn ${sortMode === 'due' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSortMode(m => m === 'recent' ? 'due' : 'recent')}
          title={sortMode === 'due' ? 'Sort by most recent' : 'Sort by due time'}
        >
          Sorted By {sortMode === 'due' ? 'Time Till Due' : 'Time Since Last'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => setUseCodeNames(v => !v)}
          title={useCodeNames ? 'Use normal names' : 'Use code names'}
          style={{ fontSize: '1.2rem', lineHeight: 1, padding: '4px 8px' }}
        >
          {useCodeNames ? '🧶' : '🪩'}
        </button>
      </div>
      <div className="page-layout">
        <PendingPanel
          events={pendingEvents}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenSettings={(event) => setSettingsEvent(event)}
          useCodeNames={useCodeNames}
          hintCodeNames={hintCodeNames}
        />
        <div className="main-panel">
          <EventGrid
            events={displayedEvents}
            now={now}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onOpenSettings={(event) => setSettingsEvent(event)}
            useCodeNames={useCodeNames}
            hintCodeNames={hintCodeNames}
          />
        </div>
        <OneTimePanel
          events={oneTimeEvents}
          now={now}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onOpenSettings={(event) => setSettingsEvent(event)}
          useCodeNames={useCodeNames}
          hintCodeNames={hintCodeNames}
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
        useCodeNames={useCodeNames}
        hintCodeNames={hintCodeNames}
      />
    </>
  );
}
