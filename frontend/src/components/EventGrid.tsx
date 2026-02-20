import type { DoAgainEvent } from '../types';
import { EventCard } from './EventCard';

interface EventGridProps {
  events: DoAgainEvent[];
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
}

export function EventGrid({ events, now, onUpdate, onDelete, onOpenSettings }: EventGridProps) {
  if (events.length === 0) {
    return (
      <div className="events-container">
        <div className="events-empty">
          No events yet. Click &quot;+ Add Event&quot; to create your first one.
        </div>
      </div>
    );
  }

  return (
    <div className="events-container">
      <div className="events-grid">
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            now={now}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpenSettings={onOpenSettings}
          />
        ))}
      </div>
    </div>
  );
}
