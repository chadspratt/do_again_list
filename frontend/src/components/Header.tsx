import type { AuthUser } from '../api';
import { AuthControls } from './AuthControls';

interface HeaderProps {
  user: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => void;
}

export function Header({ user, onLogin, onRegister, onLogout }: HeaderProps) {
  return (
    <div className="header">
      <h1>⏱️ IncrementalList</h1>
      <AuthControls user={user} onLogin={onLogin} onRegister={onRegister} onLogout={onLogout} />
    </div>
  );
}
