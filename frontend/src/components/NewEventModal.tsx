import { useState } from 'react';
import { parseTimeOffset } from '../utils';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, date: string, pending?: boolean, repeats?: boolean) => void;
}

export function NewEventModal({ isOpen, onClose, onCreate }: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [timeAgo, setTimeAgo] = useState('');
  const [pending, setPending] = useState(false);
  const [oneTime, setOneTime] = useState(false);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const repeats = !oneTime;
    if (pending) {
      onCreate(title.trim(), '', true, repeats);
    } else {
      const date = parseTimeOffset(timeAgo);
      onCreate(title.trim(), date.toISOString(), false, repeats);
    }
    setTitle('');
    setTimeAgo('');
    setPending(false);
    setOneTime(false);
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>Add Event</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Started learning Python"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="pendingCheckbox"
              checked={pending}
              onChange={(e) => setPending(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="pendingCheckbox" style={{ fontWeight: 'normal', margin: 0, fontSize: '.9rem' }}>
              Add as <strong>Pending</strong> — no start time yet
            </label>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="oneTimeCheckbox"
              checked={oneTime}
              onChange={(e) => setOneTime(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <label htmlFor="oneTimeCheckbox" style={{ fontWeight: 'normal', margin: 0, fontSize: '.9rem' }}>
              <strong>One-Time</strong> — will not repeat
            </label>
          </div>
          {!pending && (
            <div className="form-group">
              <label>Time Ago</label>
              <input
                type="text"
                placeholder="Leave blank for now, or e.g. 1h30m, 2h, 45m"
                value={timeAgo}
                onChange={(e) => setTimeAgo(e.target.value)}
              />
              <small style={{ color: '#666', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
                Examples: blank = now, 1h = 1 hour ago, 1h30m = 1 hour 30 min ago, 2d = 2 days ago
              </small>
            </div>
          )}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
