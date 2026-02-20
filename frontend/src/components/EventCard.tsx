import { useState, useMemo } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText, isInCooldown, parseTimeOffset } from '../utils';

interface EventCardProps {
  event: DoAgainEvent;
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function EventCard({ event, now, onUpdate, onDelete, onOpenSettings }: EventCardProps) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const isRunning = event.end_time === null;
  const inCooldown = isInCooldown(now, event.end_time, event.min_time_between_events);

  const timerText = computeTimerText(
    now,
    event.start_time,
    event.end_time,
    event.min_duration,
    event.max_duration,
    event.min_time_between_events,
    event.max_time_between_events,
  );

  const dateDisplay = useMemo(() => {
    const startDate = new Date(event.start_time);
    let text = 'Start: ' + startDate.toLocaleString('en-US', DATE_OPTS);
    if (event.end_time) {
      const endDate = new Date(event.end_time);
      text += '\nEnd: ' + endDate.toLocaleString('en-US', DATE_OPTS);
    }
    return text;
  }, [event.start_time, event.end_time]);

  const showStartControls = !isRunning && !inCooldown;
  const showEndControls = !inCooldown;

  function handleStart() {
    const startDate = startInput.trim()
      ? parseTimeOffset(startInput)
      : new Date();
    onUpdate(event.id, 'start', startDate.toISOString());
    setStartInput('');
    setEndInput('');
  }

  function handleEnd() {
    const endDate = endInput.trim() ? parseTimeOffset(endInput) : null;

    let startDate: Date;
    if (startInput.trim()) {
      startDate = parseTimeOffset(startInput);
    } else if (event.end_time) {
      // Event already has end_time: apply default_duration offset if set
      const defaultDuration = event.default_duration || 0;
      if (defaultDuration > 0) {
        const endTime = endDate || new Date();
        startDate = new Date(endTime.getTime() - defaultDuration * 60 * 1000);
      } else {
        startDate = new Date();
      }
    } else {
      startDate = new Date();
    }

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
    <div className="event-card">
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete event">
        🗑️
      </span>
      <span className="settings-icon" onClick={() => onOpenSettings(event)} title="Event settings">
        ⚙️
      </span>
      <div className="event-title">{event.title}</div>
      <div className="event-date" style={{ whiteSpace: 'pre-line' }}>
        {dateDisplay}
      </div>
      <div className="event-timer">{timerText}</div>

      {showStartControls && (
        <div className="event-actions">
          <input
            type="text"
            placeholder="start e.g. 1h30m"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
          <button className="btn btn-success btn-sm" onClick={handleStart} title="Start">
            Start
          </button>
        </div>
      )}

      {showEndControls && (
        <div className="event-actions" style={{ marginTop: '6px' }}>
          <input
            type="text"
            placeholder="end e.g. 1h30m"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" onClick={handleEnd} title="End">
            End
          </button>
        </div>
      )}
    </div>
  );
}
