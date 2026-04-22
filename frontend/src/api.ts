import type { DoAgainEvent, EventSettings, GameState } from './types';

const API_BASE = '/api/do-again';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  game?: GameState;
  messages?: string[];
  spawn_enemy?: { level: number; stat_modifier?: { attack?: number; defense?: number; speed?: number } } | null;
  hero_buffs?: { stat: 'ATTACK' | 'DEFENSE' | 'SPEED'; amount: number; label: string }[];
  pending_heal?: boolean;
  pending_fatigue?: boolean;
  resource_ref?: { klass: string; pk: number };
}

async function apiRequest(url: string, method: string, body?: object): Promise<Response> {
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export async function fetchEvents(): Promise<DoAgainEvent[]> {
  const res = await fetch(`${API_BASE}/activities/`);
  return res.json();
}

export async function createEvent(title: string, _date: string, _pending?: boolean, repeats: boolean = true): Promise<ApiResponse> {
  const res = await apiRequest(`${API_BASE}/activities/`, 'POST', { title, repeats });
  if (res.ok) return res.json();
  const data = await res.json();
  return { success: false, error: data.detail || JSON.stringify(data) };
}

export async function updateEvent(
  event_id: number,
  action: string,
  start_time?: string,
  end_time?: string,
  next_time?: string,
  kill_streak?: number,
): Promise<ApiResponse> {
  const body = { start_time, end_time, next_time, kill_streak: kill_streak ?? 0 };
  const res = await apiRequest(`${API_BASE}/activities/${event_id}/${action}/`, 'POST', body);
  if (res.ok) return res.json();
  const data = await res.json();
  return { success: false, error: data.error || data.detail || JSON.stringify(data) };
}

export async function deleteEvent(eventId: number): Promise<ApiResponse> {
  const res = await apiRequest(`${API_BASE}/activities/${eventId}/`, 'DELETE');
  if (res.ok) return { success: true };
  const data = await res.json();
  return { success: false, error: data.detail || 'Delete failed' };
}

export async function updateEventSettings(
  eventId: number,
  settings: EventSettings,
): Promise<ApiResponse> {
  const res = await apiRequest(`${API_BASE}/activities/${eventId}/`, 'PATCH', settings);
  if (res.ok) return { success: true };
  const data = await res.json();
  return { success: false, error: data.detail || JSON.stringify(data) };
}

export async function fetchGameState(): Promise<GameState> {
  const res = await fetch(`${API_BASE}/game/`);
  const data = await res.json();
  // DRF list endpoint returns an array; take the first (singleton per user)
  return Array.isArray(data) ? data[0] : data;
}

export async function syncBattleState(gold: number, xp: number, streak: number, heroHp: number, questTokens: number = 0): Promise<GameState> {
  const res = await apiRequest(`${API_BASE}/game/sync/`, 'POST', {
    gold, xp, streak, hero_hp: heroHp, quest_tokens: questTokens,
  });
  return res.json();
}

export interface RunOverResponse {
  game: GameState;
  souls_earned: number;
}

/** Call when the hero's run ends. Converts current XP/level to souls and resets run state. */
export async function runOverRun(): Promise<RunOverResponse> {
  const res = await apiRequest(`${API_BASE}/game/run_over/`, 'POST');
  if (!res.ok) throw new Error('run_over failed');
  return res.json();
}

export type UpgradeType = 'attack' | 'defense' | 'speed' | 'hp';

/** Spend souls to buy one level of a permanent upgrade. */
export async function metaUpgrade(upgrade: UpgradeType): Promise<GameState> {
  const res = await apiRequest(`${API_BASE}/game/meta_upgrade/`, 'POST', { upgrade });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'meta_upgrade failed');
  }
  return res.json();
}

/** Spend quest tokens to accept a quest from the Jobs Board. */
export async function acceptQuest(cost: number): Promise<GameState> {
  const res = await apiRequest(`${API_BASE}/game/accept_quest/`, 'POST', { cost });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'accept_quest failed');
  }
  return res.json();
}

// ─── Auth (still uses legacy Django views) ──────────────────────────

const AUTH_BASE = '/do_again/api';

export interface AuthUser {
  username: string;
}

interface AuthResponse {
  success?: boolean;
  error?: string;
  user?: AuthUser | null;
}

export async function fetchAuthUser(): Promise<AuthUser | null> {
  const res = await fetch(`${AUTH_BASE}/auth/user/`);
  const data: AuthResponse = await res.json();
  return data.user ?? null;
}

export async function authRegister(username: string, password: string): Promise<AuthResponse> {
  const res = await apiRequest(`${AUTH_BASE}/auth/register/`, 'POST', { username, password });
  return res.json() as Promise<AuthResponse>;
}

export async function authLogin(username: string, password: string): Promise<AuthResponse> {
  const res = await apiRequest(`${AUTH_BASE}/auth/login/`, 'POST', { username, password });
  return res.json() as Promise<AuthResponse>;
}

export async function authLogout(): Promise<AuthResponse> {
  const res = await apiRequest(`${AUTH_BASE}/auth/logout/`, 'POST', {});
  return res.json() as Promise<AuthResponse>;
}

// ─── Data Import / Export ────────────────────────────────────────────────────

export interface DataImportResult {
  activities_created: number;
  activities_updated: number;
  occurances_added: number;
  game_state_updated: boolean;
}

export async function exportData(): Promise<object> {
  const res = await fetch(`${API_BASE}/data/export/?format=json`);
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.json();
}

export async function importData(data: object): Promise<DataImportResult> {
  const res = await apiRequest(`${API_BASE}/data/import/`, 'POST', data);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}
