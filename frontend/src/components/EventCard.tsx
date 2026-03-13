import { useState, useMemo, useRef } from 'react';
import type { DoAgainEvent } from '../types';
import { computeTimerText } from '../utils';
import { useEventInputs } from '../hooks/useEventInputs';

interface EventCardProps {
  event: DoAgainEvent;
  now: number;
  onUpdate: (eventId: number, action: string, startDatetime?: string, endDatetime?: string, nextTime?: string) => void;
  onDelete: (eventId: number) => void;
  onOpenSettings: (event: DoAgainEvent) => void;
  dataEventId?: number;
  useCodeNames?: boolean;
  hintCodeNames?: boolean;
}

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function EventCard({ event, now, onUpdate, onDelete, onOpenSettings, dataEventId, useCodeNames, hintCodeNames }: EventCardProps) {
  const {
    startInput, setStartInput,
    endInput, setEndInput,
    nextInput, setNextInput,
    handleStart, handleEnd, handleNext
  } = useEventInputs(event.id, onUpdate);
  const [isHovered, setIsHovered] = useState(false);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (wrapperRef.current) {
      setWrapperHeight(wrapperRef.current.offsetHeight);
    }
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setWrapperHeight(null);
  }

  const hasMin = event.min_time_between_events && event.min_time_between_events.trim() !== '';
  const hasMax = event.max_time_between_events && event.max_time_between_events.trim() !== '';
  const cardKind = hasMax && !hasMin ? 'event-good' : hasMin && !hasMax ? 'event-bad' : '';

  const timerText = computeTimerText(
    now,
    event.start_time,
    event.end_time,
    event.min_duration,
    event.max_duration,
    event.min_time_between_events,
    event.max_time_between_events,
    event.next_time,
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

  return (
    <div
      className="event-card-wrapper"
      ref={wrapperRef}
      data-event-id={dataEventId}
      style={wrapperHeight !== null ? { minHeight: wrapperHeight } : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
    <div
      className={`event-card${cardKind ? ' ' + cardKind : ''}${isHovered ? ' hovered' : ''}`}
    >
      {event.value !== undefined && event.value !== 1.0 && (
        <span className="event-value-badge" title={`Value: ${event.value}`}>
          ×{event.value}
        </span>
      )}
      <span className="delete-icon" onClick={() => onDelete(event.id)} title="Delete event">
        🗑️
      </span>
      <span className={`settings-icon${hintCodeNames ? ' settings-glow' : ''}`} onClick={() => onOpenSettings(event)} title="Event settings">
        ⚙️
      </span>
      <div className="event-title" title={useCodeNames && event.code_name ? event.display_name : undefined}>{useCodeNames && event.code_name ? event.code_name : event.display_name}</div>
      <div className="event-date" style={{ whiteSpace: 'pre-line' }}>
        {dateDisplay}
      </div>
      <div className="event-timer">{timerText}</div>

    {isHovered && (
      <>
        {!event.is_built_in && (
          <>
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
          </>
        )}

        { event.end_time &&
            <div className="event-actions" style={{ marginTop: '6px' }}>
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
        }
      </>
    )}
    </div>
    </div>
  );
}
