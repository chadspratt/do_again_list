import { useState, useEffect } from 'react';
import type { DoAgainEvent, EventSettings } from '../types';

interface SettingsModalProps {
  event: DoAgainEvent | null;
  onClose: () => void;
  onSave: (eventId: number, settings: EventSettings) => void;
}

export function SettingsModal({ event, onClose, onSave }: SettingsModalProps) {
  const [defaultDuration, setDefaultDuration] = useState(0);
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [minTime, setMinTime] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [value, setValue] = useState(1.0);

  useEffect(() => {
    if (event) {
      setDefaultDuration(event.default_duration || 0);
      setMinDuration(event.min_duration || '');
      setMaxDuration(event.max_duration || '');
      setMinTime(event.min_time_between_events || '');
      setMaxTime(event.max_time_between_events || '');
      setValue(event.value ?? 1.0);
    }
  }, [event]);

  if (!event) return null;

  function handleSave() {
    if (!event) return;
    onSave(event.id, {
      default_duration: defaultDuration,
      min_duration: minDuration,
      max_duration: maxDuration,
      min_time_between_events: minTime,
      max_time_between_events: maxTime,
      value,
    });
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>
          Event Settings —{' '}
          <span style={{ fontWeight: 'normal', color: '#555' }}>{event.title}</span>
        </h2>

        <div className="form-group">
          <label>Default Duration (minutes)</label>
          <input
            type="number"
            min={0}
            placeholder="e.g. 60"
            value={defaultDuration}
            onChange={(e) => setDefaultDuration(parseInt(e.target.value) || 0)}
            autoFocus
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            Auto-fill start time when clicking End and the start input is blank. 0 = disabled.
          </small>
        </div>

        <div className="form-group">
          <label>Min Duration (e.g. 1h30m)</label>
          <input
            type="text"
            placeholder="e.g. 30m"
            value={minDuration}
            onChange={(e) => setMinDuration(e.target.value)}
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            Countdown shown while event is active, until this duration has elapsed since start.
          </small>
        </div>

        <div className="form-group">
          <label>Max Duration (e.g. 2h)</label>
          <input
            type="text"
            placeholder="e.g. 2h"
            value={maxDuration}
            onChange={(e) => setMaxDuration(e.target.value)}
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            After min duration, counts down to this. Can go negative to show overtime.
          </small>
        </div>

        <div className="form-group">
          <label>Min Time Between Events (e.g. 1d5h)</label>
          <input
            type="text"
            placeholder="e.g. 1d5h"
            value={minTime}
            onChange={(e) => setMinTime(e.target.value)}
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            After ending, hides controls until this much time has passed. Countdown shown.
          </small>
        </div>

        <div className="form-group">
          <label>Max Time Between Events (e.g. 2d)</label>
          <input
            type="text"
            placeholder="e.g. 2d"
            value={maxTime}
            onChange={(e) => setMaxTime(e.target.value)}
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            After min cooldown, counts down to this. Can go negative to show overdue.
          </small>
        </div>

        <div className="form-group">
          <label>Value</label>
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="e.g. 1.5"
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          />
          <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
            Importance or difficulty of this event. Displayed on the tile.
          </small>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
