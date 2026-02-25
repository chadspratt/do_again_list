import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText, parseTimeOffset, parseTimeOffsetMs } from '../utils';

interface OneTimePanelProps {
  events: DoAgainEvent[];
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string, nextTime?: string) => void;
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
  const [nextInput, setNextInput] = useState('');

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
        event.next_time,
      );

  function handleStart() {
    const startDate = startInput.trim() ? parseTimeOffset(startInput) : new Date();
    onUpdate(event.id, 'start', startDate.toISOString());
    setStartInput('');
  }

  function handleEnd() {
    const endDate = endInput.trim() ? parseTimeOffset(endInput) : null;
    const startDate = startInput.trim() ? parseTimeOffset(startInput) : new Date();
    const nextTime = nextInput.trim()
      ? new Date(Date.now() + parseTimeOffsetMs(nextInput)).toISOString()
      : undefined;
    onUpdate(
      event.id,
      'end',
      startDate.toISOString(),
      endDate ? endDate.toISOString() : undefined,
      nextTime,
    );
    setStartInput('');
    setEndInput('');
    setNextInput('');
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
      <div className="pending-actions" style={{ marginTop: '6px' }}>
        <input
          type="text"
          placeholder="next e.g. 2d"
          value={nextInput}
          onChange={(e) => setNextInput(e.target.value)}
        />
        <button className="btn btn-secondary btn-sm" onClick={() => {
          const nextTime = nextInput.trim()
            ? new Date(Date.now() + parseTimeOffsetMs(nextInput)).toISOString()
            : undefined;
          if (nextTime) {
            onUpdate(event.id, 'set_next', new Date().toISOString(), undefined, nextTime);
            setNextInput('');
          }
        }}>Next</button>
      </div>
    </div>
  );
}

export function OneTimePanel({ events, now, onUpdate, onDelete, onOpenSettings }: OneTimePanelProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const visibleEvents = showCompleted
    ? events
    : events.filter(e => e.end_time === null);
  const hiddenCount = events.length - events.filter(e => e.end_time === null).length;

  return (
    <div className="onetime-panel">
      <div className="onetime-header">One-Time</div>
      {hiddenCount > 0 && (
        <label className="onetime-show-completed">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed ({hiddenCount})
        </label>
      )}
      {visibleEvents.length === 0 ? (
        <div className="onetime-empty">No one-time events.</div>
      ) : (
        visibleEvents.map((event) => (
          <OneTimeCard
            key={event.id}
            event={event}
            now={now}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpenSettings={onOpenSettings}
          />
        ))
      )}
    </div>
  );
}
