export interface DoAgainEvent {
  id: number;
  title: string;
  display_name: string;
  code_name: string | null;
  ordering: number;
  start_time: string | null;
  end_time: string | null;
  next_time: string | null;
  default_duration: string;
  min_duration: string;
  max_duration: string;
  min_time_between_events: string;
  max_time_between_events: string;
  value: number;
  repeats: boolean;
  is_built_in: boolean;
  state: 'pending' | 'active' | 'inactive';
}

export interface EventSettings {
  display_name?: string;
  title?: string;
  code_name?: string | null;
  default_duration: string;
  min_duration: string;
  max_duration: string;
  min_time_between_events: string;
  max_time_between_events: string;
  value: number;
  repeats: boolean;
}

export interface GameState {
  id: number;
  xp: number;
  gold: number;
  level: number;
  base_attack: number;
  base_defense: number;
  base_speed: number;
  total_attack: number;
  total_defense: number;
  total_speed: number;
  xp_to_next_level: number;
  streak: number;
  items: string[];
  hero_hp: number;
  spawn_first_enemy?: boolean;
}
