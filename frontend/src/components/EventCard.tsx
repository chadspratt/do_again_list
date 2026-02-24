import { useState, useMemo } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText, parseTimeOffset } from '../utils';

interface EventCardProps {
  event: DoAgainEvent;
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
  dataEventId?: number;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function EventCard({ event, now, onUpdate, onDelete, onOpenSettings, dataEventId }: EventCardProps) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

  const hasMin = event.min_time_between_events.trim() !== '';
  const hasMax = event.max_time_between_events.trim() !== '';
  const cardKind = hasMax && !hasMin ? 'event-good' : hasMin && !hasMax ? 'event-bad' : '';

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
    if (!event.start_time) return '';
    const startDate = new Date(event.start_time);
    let text = 'Start: ' + startDate.toLocaleString('en-US', DATE_OPTS);
    if (event.end_time) {
      const endDate = new Date(event.end_time);
      text += '\nEnd: ' + endDate.toLocaleString('en-US', DATE_OPTS);
    }
    return text;
  }, [event.start_time, event.end_time]);

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
    <div className={`event-card${cardKind ? ' ' + cardKind : ''}`} data-event-id={dataEventId}>
      {event.value !== undefined && event.value !== 1.0 && (
        <span className="event-value-badge" title={`Value: ${event.value}`}>
          ×{event.value}
        </span>
      )}
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

    { event.end_time &&
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
    }

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
    </div>
  );
}
