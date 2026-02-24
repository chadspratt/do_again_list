import type { DoAgainEvent } from './types';

/**
 * Parse a time offset string like "1d5h30m" to milliseconds.
 * Returns 0 if blank or invalid.
 */
export function parseTimeOffsetMs(input: string): number {
  if (!input || input.trim() === '') return 0;
  let totalMs = 0;
  const dayMatch = input.match(/(\d+)d/);
  const hourMatch = input.match(/(\d+)h/);
  const minMatch = input.match(/(\d+)m/);
  const secMatch = input.match(/(\d+)s/);
  if (dayMatch) totalMs += parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000;
  if (hourMatch) totalMs += parseInt(hourMatch[1]) * 60 * 60 * 1000;
  if (minMatch) totalMs += parseInt(minMatch[1]) * 60 * 1000;
  if (secMatch) totalMs += parseInt(secMatch[1]) * 1000;
  return totalMs;
}

/**
 * Parse a time offset string and return a Date that many ms before now.
 * Returns current date if blank.
 */
export function parseTimeOffset(input: string): Date {
  if (!input || input.trim() === '') return new Date();
  return new Date(Date.now() - parseTimeOffsetMs(input));
}

/**
 * Format a countdown with a label. Supports negative values (overtime).
 */
export function formatCountdown(ms: number, label: string): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';
  const days = Math.floor(abs / 86400000);
  const hours = Math.floor((abs % 86400000) / 3600000);
  const mins = Math.floor((abs % 3600000) / 60000);
  const secs = Math.floor((abs % 60000) / 1000);
  let time: string;
  if (days > 0) {
    time = `${sign}${days}d ${hours}h`;
  } else if (hours > 0) {
    time = `${sign}${hours}h ${mins}m`;
  } else if (mins > 0) {
    time = `${sign}${mins}m ${secs}s`;
  } else {
    time = `${sign}${secs}s`;
  }
  return `${label} ${time}`;
}

/**
 * Format elapsed time as "Xd Yh ago".
 */
export function formatElapsed(ms: number): string {
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (days > 365) {
    const years = Math.floor(days / 365);
    const remainingDays = days % 365;
    return `${years}y ${remainingDays}d ago`;
  } else if (days > 0) {
    return `${days}d ${hours}h ago`;
  } else if (hours > 0) {
    return `${hours}h ${mins}m ago`;
  } else if (mins > 0) {
    return `${mins}m ${secs}s ago`;
  } else {
    return `${secs}s ago`;
  }
}

/**
 * Compute the timer display text for an event.
 */
export function computeTimerText(
  now: number,
  startTime: string | null,
  endTime: string | null,
  minDuration: string,
  maxDuration: string,
  minTimeBetween: string,
  maxTimeBetween: string,
): string {
  if (!startTime) return '';
  const startMs = new Date(startTime).getTime();
  const hasEnd = !!endTime;
  const endMs = hasEnd ? new Date(endTime).getTime() : 0;
  const minDurMs = parseTimeOffsetMs(minDuration);
  const maxDurMs = parseTimeOffsetMs(maxDuration);
  const minTimeMs = parseTimeOffsetMs(minTimeBetween);
  const maxTimeMs = parseTimeOffsetMs(maxTimeBetween);

  // Event is started (no end_time)
  if (!hasEnd) {
    const elapsed = now - startMs;
    if (minDurMs && elapsed < minDurMs) {
      return formatCountdown(minDurMs - elapsed, 'Min in');
    }
    if (maxDurMs) {
      const remaining = (startMs + maxDurMs) - now;
      return formatCountdown(remaining, 'Max in');
    }
    return elapsed >= 0 ? formatElapsed(elapsed) : 'Future event';
  }

  // Event is ended (has end_time)
  const sinceEnd = now - endMs;
  if (minTimeMs && sinceEnd < minTimeMs) {
    return formatCountdown(minTimeMs - sinceEnd, 'Ready in');
  }
  if (maxTimeMs) {
    const remaining = (endMs + maxTimeMs) - now;
    return formatCountdown(remaining, 'Due in');
  }
  return sinceEnd >= 0 ? formatElapsed(sinceEnd) : 'Future event';
}

/**
 * Check if event controls should be hidden (in cooldown).
 */
export function isInCooldown(
  now: number,
  endTime: string | null,
  minTimeBetween: string,
): boolean {
  if (!endTime) return false;
  const endMs = new Date(endTime).getTime();
  const minTimeMs = parseTimeOffsetMs(minTimeBetween);
  if (!minTimeMs) return false;
  return (now - endMs) < minTimeMs;
}

/**
 * Sort events by urgency / due time.
 *
 * Started events (no end_time), ordered by group then key:
 *   0 – exceeded max_duration        → most overtime first
 *   1 – under max but ≥ min duration → least time until max first
 *   2 – no min/max or over min       → earliest start first
 *   3 – under min_duration           → least time until min first
 *
 * Ended events, ordered by group then key:
 *   4 – exceeded max_time_between    → most overdue first
 *   5 – over min but under max_time  → least time until max first
 *   6 – no min/max time_between      → oldest end_time first
 *   7 – under min_time_between       → least time until min first
 */
export function sortEventsByDue(events: DoAgainEvent[], now: number): DoAgainEvent[] {
  function classify(e: DoAgainEvent): [number, number] {
    if (!e.start_time) return [8, 0]; // Pending events go last
    const startMs = new Date(e.start_time).getTime();
    const minDurMs = parseTimeOffsetMs(e.min_duration);
    const maxDurMs = parseTimeOffsetMs(e.max_duration);
    const minTimeMs = parseTimeOffsetMs(e.min_time_between_events);
    const maxTimeMs = parseTimeOffsetMs(e.max_time_between_events);

    if (!e.end_time) {
      const elapsed = now - startMs;
      if (maxDurMs > 0 && elapsed >= maxDurMs) {
        // Most overtime first → smallest key = most overtime
        return [0, -(elapsed - maxDurMs)];
      }
      if (maxDurMs > 0) {
        // Least time until max first
        return [1, startMs + maxDurMs];
      }
      if (minDurMs > 0 && elapsed >= minDurMs) {
        // Least time since start first
        return [2, startMs];
      }
      if (minDurMs > 0 && elapsed < minDurMs) {
        // Least time until min first
        return [3, startMs + minDurMs];
      }
      // No active timer (no max, min already passed or absent): earliest start first
      return [2, startMs];
    } else {
      const endMs = new Date(e.end_time).getTime();
      const sinceEnd = now - endMs;
      if (maxTimeMs > 0 && sinceEnd >= maxTimeMs) {
        // Most overdue first → smallest key = most overtime
        return [4, -(sinceEnd - maxTimeMs)];
      }
      if (maxTimeMs > 0) {
        // Least time until max first
        return [5, endMs + maxTimeMs];
      }
      if (minTimeMs > 0 && sinceEnd >= minTimeMs) {
        // Least time since end first
        return [6, endMs];
      }
      if (minTimeMs > 0 && sinceEnd < minTimeMs) {
        // Least time until min first
        return [7, endMs + minTimeMs];
      }
      // No active timer: oldest end_time first
      return [6, endMs];
    }
  }

  return [...events].sort((a, b) => {
    const [bucketA, keyA] = classify(a);
    const [bucketB, keyB] = classify(b);
    if (bucketA !== bucketB) return bucketA - bucketB;
    return keyA - keyB;
  });
}
