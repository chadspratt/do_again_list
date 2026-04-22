import type { AuthUser } from '../api';
import { AuthControls } from './AuthControls';

interface HeaderProps {
  user: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => void;
  onAdmin?: () => void;
  adminActive?: boolean;
}

export function Header({ user, onLogin, onRegister, onLogout, onAdmin, adminActive }: HeaderProps) {
  return (
    <div className="header">
      <h1>⏱️ IncrementalList</h1>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {user && onAdmin && (
          <button
            className={`btn btn-sm ${adminActive ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onAdmin}
            title="Data administration"
          >
            ⚙ Admin
          </button>
        )}
        <AuthControls user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
      </div>
    </div>
  );
}
