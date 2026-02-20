export interface DoAgainEvent {
  id: number;
  title: string;
  start_time: string;
  end_time: string | null;
  default_duration: number;
  min_duration: string;
  max_duration: string;
  min_time_between_events: string;
  max_time_between_events: string;
}

export interface EventSettings {
  default_duration: number;
  min_duration: string;
  max_duration: string;
  min_time_between_events: string;
  max_time_between_events: string;
}

export interface GameState {
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
  best_distance: number;
  streak: number;
  items: string[];
}
