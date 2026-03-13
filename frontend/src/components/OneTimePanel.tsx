import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText } from '../utils';
import { useEventInputs } from '../hooks/useEventInputs';

interface OneTimePanelProps {
  events: DoAgainEvent[];
  now: number;
  onUpdate: (eventId: number, action: string, startDatetime?: string, endDatetime?: string, nextTime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
  useCodeNames?: boolean;
}

function OneTimeCard({
  event,
  now,
  onUpdate,
  onDelete,
  onOpenSettings,
  useCodeNames,
}: {
  event: DoAgainEvent;
  now: number;
  onUpdate: OneTimePanelProps['onUpdate'];
  onDelete: OneTimePanelProps['onDelete'];
  onOpenSettings: OneTimePanelProps['onOpenSettings'];
  useCodeNames?: boolean;
}) {
  const {
    startInput, setStartInput,
    endInput, setEndInput,
    nextInput, setNextInput,
    handleStart, handleEnd, handleNext
  } = useEventInputs(event.id, onUpdate);
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div
      className="onetime-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete">🗑️</span>
      <span className="settings-icon" onClick={() => onOpenSettings(event)} title="Settings">⚙️</span>
      <div className="event-title">{useCodeNames && event.code_name ? event.code_name : event.display_name}</div>
      {timerText && <div className="onetime-timer">{timerText}</div>}
      {isHovered && (
        <div className="card-hover-actions">
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
            <button className="btn btn-secondary btn-sm" onClick={handleNext}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OneTimePanel({ events, now, onUpdate, onDelete, onOpenSettings, useCodeNames }: OneTimePanelProps) {
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
            useCodeNames={useCodeNames}
          />
        ))
      )}
    </div>
  );
}
