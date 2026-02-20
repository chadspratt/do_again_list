import { useState } from 'react';
import { parseTimeOffset } from '../utils';

interface NewEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, date: string) => void;
}

export function NewEventModal({ isOpen, onClose, onCreate }: NewEventModalProps) {
  const [title, setTitle] = useState('');
  const [timeAgo, setTimeAgo] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const date = parseTimeOffset(timeAgo);
    onCreate(title.trim(), date.toISOString());
    setTitle('');
    setTimeAgo('');
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay active" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>Add Past Event</h2>
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
