/*
 * PS: This component's behavior doesn't make sense to me.
 *
 * It seems to offer 3 fields and 3 buttons which route to 1 API code path.
 * - One of the buttons uses all three fields (potentially)
 * - One of the buttons definitely only uses one field
 * - One of the buttons uses one field (which is potentially null) and sends an
 *   arbitrary unused field along for the ride.
 *
 * From the UI/UX perspective, the component may be confusing to users because
 * some buttons use all the data while other buttons only use the field they are
 * adjacent to.
 *
 * The polymorphism of that data requires the API to be needlessly complex.
 * Recommend refactor such that the three distinct actions use three distinct API code
 * paths. The API provides actions on the activity for `start`, `end`, and `set_next`.
 * Either:
 * - Redesign the user flow to limit the actions available to the user based on
 *   activity state: (preferred)
 *   - only show end when a task is active
 *   - only show start when a task is inactive/pending
 *   - allow next time to be set through a different path altogether since it
 *     is not coupled to start or end
 * - Utilize these directly to sequentially perform the several actions that any one
 *   button press may imply. (least effort)
 * - Update the API actions to accept additional (and correctly named) inputs
 *   for each of the times that the user may specify in the transaction.
 *
 */

import { useState } from 'react';
import type { DoAgainEvent } from '../types';
import { parseTimeOffset, parseTimeOffsetMs } from '../utils';

interface PendingPanelProps {
  events: DoAgainEvent[];
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string, nextTime?: string) => void;
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
  const [nextInput, setNextInput] = useState('');
  const [isHovered, setIsHovered] = useState(false);

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
    <div
      className="pending-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete">🗑️</span>
      <span className="settings-icon" onClick={() => onOpenSettings(event)} title="Settings">⚙️</span>
      <div className="event-title">{event.title}</div>
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
      )}
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
