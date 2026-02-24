import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText, parseTimeOffset } from '../utils';

interface OneTimePanelProps {
  events: DoAgainEvent[];
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
}

function OneTimeCard({
  event,
  now,
  onUpdate,
  onDelete,
  onOpenSettings,
}: {
  event: DoAgainEvent;
  now: number;
  onUpdate: OneTimePanelProps['onUpdate'];
  onDelete: OneTimePanelProps['onDelete'];
  onOpenSettings: OneTimePanelProps['onOpenSettings'];
}) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const isPending = event.start_time === null && event.end_time === null;
  const timerText = isPending
    ? null
    : computeTimerText(
        now,
        event.start_time,
        event.end_time,
        event.min_duration,
        event.max_duration,
        event.min_time_between_events,
        event.max_time_between_events,
      );

  function handleStart() {
    const startDate = startInput.trim() ? parseTimeOffset(startInput) : new Date();
    onUpdate(event.id, 'start', startDate.toISOString());
    setStartInput('');
  }

  function handleEnd() {
    const endDate = endInput.trim() ? parseTimeOffset(endInput) : null;
    const startDate = startInput.trim() ? parseTimeOffset(startInput) : new Date();
    onUpdate(
      event.id,
      'end',
      startDate.toISOString(),
      endDate ? endDate.toISOString() : undefined,
    );
    setStartInput('');
    setEndInput('');
  }

  return (
    <div className="onetime-card">
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete">🗑️</span>
      <span className="settings-icon" onClick={() => onOpenSettings(event)} title="Settings">⚙️</span>
      <div className="event-title">{event.title}</div>
      {timerText && <div className="onetime-timer">{timerText}</div>}
      <div className="pending-actions">
        <input
          type="text"
          placeholder="e.g. 1h30m"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
        />
        <button className="btn btn-success btn-sm" onClick={handleStart}>Start</button>
      </div>
      <div className="pending-actions" style={{ marginTop: '6px' }}>
        <input
          type="text"
          placeholder="e.g. 1h30m"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" onClick={handleEnd}>End</button>
      </div>
    </div>
  );
}

export function OneTimePanel({ events, now, onUpdate, onDelete, onOpenSettings }: OneTimePanelProps) {
  if (events.length === 0) {
    return (
      <div className="onetime-panel">
        <div className="onetime-header">One-Time</div>
        <div className="onetime-empty">No one-time events.</div>
      </div>
    );
  }

  return (
    <div className="onetime-panel">
      <div className="onetime-header">One-Time</div>
      {events.map((event) => (
        <OneTimeCard
          key={event.id}
          event={event}
          now={now}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onOpenSettings={onOpenSettings}
        />
      ))}
    </div>
  );
}
