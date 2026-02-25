import type { AuthUser } from '../api';
import { AuthControls } from './AuthControls';

interface HeaderProps {
  onAddClick: () => void;
  sortMode: 'default' | 'due';
  onSortToggle: () => void;
  user: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => void;
}

export function Header({ onAddClick, sortMode, onSortToggle, user, onLogin, onRegister, onLogout }: HeaderProps) {
  return (
    <div className="header">
      <h1>⏱️ Do Again List</h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <AuthControls user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
        <button
          className={`btn ${sortMode === 'due' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onSortToggle}
          title={sortMode === 'due' ? 'Currently sorted by due time — click for default' : 'Sort by due time'}
        >
          Sorted By {sortMode === 'due' ? 'Time Till Due' : 'Time Since Last'}
        </button>
        <button className="btn btn-primary" onClick={onAddClick}>
          + Add Event
        </button>
      </div>
    </div>
  );
}
