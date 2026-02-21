import { useLayoutEffect, useRef } from 'react';
import type { DoAgainEvent } from '../types';
import { EventCard } from './EventCard';

interface EventGridProps {
  events: DoAgainEvent[];
  now: number;
  onUpdate: (eventId: number, action: string, datetime: string, endDatetime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
}

/** Duration of the FLIP reorder animation in ms */
const FLIP_DURATION = 800;

export function EventGrid({ events, now, onUpdate, onDelete, onOpenSettings }: EventGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Stores the bounding rect of each card (keyed by event id) from the *previous* render
  const prevRectsRef = useRef<Map<number, DOMRect>>(new Map());
  // Stores the previous ordering of event IDs so we only animate on actual reorder
  const prevOrderRef = useRef<string>('');

  const currentOrder = events.map(e => e.id).join(',');
  const orderChanged = prevOrderRef.current !== '' && prevOrderRef.current !== currentOrder;

  // Always keep rects up-to-date, but only animate when order changes.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const children = Array.from(grid.children) as HTMLElement[];
    const prevRects = prevRectsRef.current;

    // --- LAST: capture where each card ended up after this render ---
    const newRects = new Map<number, DOMRect>();
    for (const child of children) {
      const id = Number(child.dataset.eventId);
      if (!Number.isNaN(id)) {
        newRects.set(id, child.getBoundingClientRect());
      }
    }

    // --- INVERT + PLAY (only when tiles actually reordered) ---
    if (orderChanged) {
      for (const child of children) {
        const id = Number(child.dataset.eventId);
        const prev = prevRects.get(id);
        const curr = newRects.get(id);
        if (!prev || !curr) continue;

        const dx = prev.left - curr.left;
        const dy = prev.top - curr.top;

        if (dx === 0 && dy === 0) continue;

        // Jump to old position instantly (Invert)
        child.style.transform = `translate(${dx}px, ${dy}px)`;
        child.style.transition = 'none';

        // Force a reflow so the browser registers the starting position
        void child.offsetHeight;

        // Animate to the natural (new) position (Play)
        child.style.transition = `transform ${FLIP_DURATION}ms ease`;
        child.style.transform = '';
      }
    }

    // Save current rects & order for next render
    prevRectsRef.current = newRects;
    prevOrderRef.current = currentOrder;
  });

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
      <div className="events-grid" ref={gridRef}>
        {events.map(event => (
          <EventCard
            key={event.id}
            event={event}
            now={now}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onOpenSettings={onOpenSettings}
            dataEventId={event.id}
          />
        ))}
      </div>
    </div>
  );
}
