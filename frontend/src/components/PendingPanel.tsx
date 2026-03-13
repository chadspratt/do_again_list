import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { useEventInputs } from '../hooks/useEventInputs';

interface PendingPanelProps {
  events: DoAgainEvent[];
  onUpdate: (eventId: number, action: string, startDatetime?: string, endDatetime?: string, nextTime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
  useCodeNames?: boolean;
  hintCodeNames?: boolean;
}

function PendingCard({
  event,
  onUpdate,
  onDelete,
  onOpenSettings,
  useCodeNames,
  hintCodeNames,
}: {
  event: DoAgainEvent;
  onUpdate: PendingPanelProps['onUpdate'];
  onDelete: PendingPanelProps['onDelete'];
  onOpenSettings: PendingPanelProps['onOpenSettings'];
  useCodeNames?: boolean;
  hintCodeNames?: boolean;
}) {
  const {
    startInput, setStartInput,
    endInput, setEndInput,
    nextInput, setNextInput,
    handleStart, handleEnd, handleNext
  } = useEventInputs(event.id, onUpdate);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="pending-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete">🗑️</span>
      <span className={`settings-icon${hintCodeNames ? ' settings-glow' : ''}`} onClick={() => onOpenSettings(event)} title="Settings">⚙️</span>
      <div className="event-title" title={useCodeNames && event.code_name ? event.display_name : undefined}>{useCodeNames && event.code_name ? event.code_name : event.display_name}</div>
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
            <button className="btn btn-secondary btn-sm" onClick={handleNext} title="Set next time">
                Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PendingPanel({ events, onUpdate, onDelete, onOpenSettings, useCodeNames, hintCodeNames }: PendingPanelProps) {
  if (events.length === 0) {
    return (
      <div className="pending-panel">
        <div className="pending-header">Pending</div>
        <div className="pending-empty">No pending events.</div>
      </div>
    );
  }

  return (
    <div className="pending-panel">
      <div className="pending-header">Pending</div>
      {events.map((event) => (
        <PendingCard
          key={event.id}
          event={event}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onOpenSettings={onOpenSettings}
          useCodeNames={useCodeNames}
          hintCodeNames={hintCodeNames}
        />
      ))}
    </div>
  );
}
