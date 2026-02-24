import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { parseTimeOffset } from '../utils';

interface PendingPanelProps {
  events: DoAgainEvent[];
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
}

function PendingCard({
  event,
  onUpdate,
  onDelete,
  onOpenSettings,
}: {
  event: DoAgainEvent;
  onUpdate: PendingPanelProps['onUpdate'];
  onDelete: PendingPanelProps['onDelete'];
  onOpenSettings: PendingPanelProps['onOpenSettings'];
}) {
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');

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
    <div className="pending-card">
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete">🗑️</span>
      <span className="settings-icon" onClick={() => onOpenSettings(event)} title="Settings">⚙️</span>
      <div className="event-title">{event.title}</div>
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

export function PendingPanel({ events, onUpdate, onDelete, onOpenSettings }: PendingPanelProps) {
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
        />
      ))}
    </div>
  );
}
