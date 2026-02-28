import { useState } from 'react';
import type { AuthUser } from '../api';

interface AuthControlsProps {
  user: AuthUser | null;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => void;
}

export function AuthControls({ user, onLogin, onRegister, onLogout }: AuthControlsProps) {
  const [mode, setMode] = useState<'idle' | 'login' | 'register'>('idle');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <div className="auth-controls">
        <span className="auth-username">{user.username}</span>
        <button className="btn btn-secondary btn-sm" onClick={onLogout}>
          Log out
        </button>
      </div>
    );
  }

  if (mode === 'idle') {
    return (
      <div className="auth-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => setMode('login')}>
          Log in
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setMode('register')}>
          Register
        </button>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const fn = mode === 'login' ? onLogin : onRegister;
    const err = await fn(username, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setUsername('');
      setPassword('');
      setMode('idle');
    }
  }

  return (
    <form className="auth-controls auth-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoFocus
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
        {mode === 'login' ? 'Log in' : 'Register'}
      </button>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        onClick={() => { setMode('idle'); setError(''); }}
      >
        Cancel
      </button>
      {error && <span className="auth-error">{error}</span>}
    </form>
  );
}
