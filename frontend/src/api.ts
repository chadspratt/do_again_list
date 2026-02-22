import type { DoAgainEvent, EventSettings, GameState } from './types';

const API_BASE = '/do_again/api';

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

interface ApiResponse {
  success: boolean;
  error?: string;
  game?: import('./types').GameState;
  game_messages?: string[];
  spawn_enemy?: { level: number; stat_modifier?: { attack?: number; defense?: number; speed?: number } } | null;
  hero_buffs?: { stat: 'attack' | 'defense' | 'speed'; amount: number; label: string }[];
  pending_heal?: boolean;
  pending_fatigue?: boolean;
}

async function apiPost(url: string, body: object): Promise<ApiResponse> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': getCsrfToken(),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchEvents(): Promise<DoAgainEvent[]> {
  const res = await fetch(`${API_BASE}/events/`);
  return res.json();
}

export async function createEvent(title: string, date: string): Promise<ApiResponse> {
  return apiPost(`${API_BASE}/events/create/`, { title, date });
}

export async function updateEvent(
  eventId: number,
  action: string,
  datetime: string,
  endDatetime?: string,
  killStreak?: number,
): Promise<ApiResponse> {
  const body: Record<string, string | number> = { action, datetime };
  if (endDatetime) body.end_datetime = endDatetime;
  if (killStreak !== undefined) body.kill_streak = killStreak;
  return apiPost(`${API_BASE}/events/${eventId}/update/`, body);
}

export async function deleteEvent(eventId: number): Promise<ApiResponse> {
  return apiPost(`${API_BASE}/events/${eventId}/delete/`, {});
}

export async function updateEventSettings(
  eventId: number,
  settings: EventSettings,
): Promise<ApiResponse> {
  return apiPost(`${API_BASE}/events/${eventId}/settings/`, settings);
}

export async function fetchGameState(): Promise<GameState> {
  const res = await fetch(`${API_BASE}/game/`);
  return res.json();
}

export async function syncBattleState(gold: number, xp: number, streak: number, heroHp: number): Promise<GameState> {
  const res = await apiPost(`${API_BASE}/game/sync/`, { gold, xp, streak, hero_hp: heroHp });
  return res.game!;
}
