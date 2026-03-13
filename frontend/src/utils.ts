import type { DoAgainEvent } from './types';


const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = MS_PER_MINUTE * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;
const MS_PER_WEEK = MS_PER_DAY * 7;
const MS_PER_MONTH = MS_PER_DAY * 30;
const MS_PER_YEAR = MS_PER_DAY * 365;
/**
 * Parse a time offset string like "1d5h30m" to milliseconds.
 * Returns 0 if blank or invalid.
 */
export function parseTimeOffsetMs(input: string): number {
  if (!input || input.trim() === '') return 0;
  let totalMs = 0;
  const yearMatch = input.match(/(\d+)y/);
  const monthMatch = input.match(/(\d+)mo/);
  const weekMatch = input.match(/(\d+)w/);
  const dayMatch = input.match(/(\d+)d/);
  const hourMatch = input.match(/(\d+)h/);
  const minMatch = input.match(/(\d+)m/);
  const secMatch = input.match(/(\d+)s/);
  if (yearMatch) totalMs += parseInt(yearMatch[1]) * MS_PER_YEAR;
  if (monthMatch) totalMs += parseInt(monthMatch[1]) * MS_PER_MONTH;
  if (weekMatch) totalMs += parseInt(weekMatch[1]) * MS_PER_WEEK;
  if (dayMatch) totalMs += parseInt(dayMatch[1]) * MS_PER_DAY;
  if (hourMatch) totalMs += parseInt(hourMatch[1]) * MS_PER_HOUR;
  if (minMatch) totalMs += parseInt(minMatch[1]) * MS_PER_MINUTE;
  if (secMatch) totalMs += parseInt(secMatch[1]) * 1000;
  return totalMs;
}

/**
 * Regex for clock-time formats: "10:30am", "1pm", "13:30", "1:05 PM", etc.
 */
const CLOCK_TIME_RE = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i;

/**
 * Check whether an input string looks like a clock time rather than
 * a duration offset.
 */
export function isClockTime(input: string): boolean {
  return CLOCK_TIME_RE.test(input.trim());
}

/**
 * Parse a clock-time string into { hours, minutes } in 24-hour format.
 * Returns null if the string doesn't match.
 */
export function parseClockTime(input: string): { hours: number; minutes: number } | null {
  const m = input.trim().match(CLOCK_TIME_RE);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();

  if (ampm === 'am') {
    if (hours === 12) hours = 0;           // 12am = midnight
  } else if (ampm === 'pm') {
    if (hours !== 12) hours += 12;         // 1pm = 13, 12pm stays 12
  }
  // No am/pm → treat as 24-hour format already

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Resolve a clock-time string to the most recent past occurrence of
 * that time (for start/end inputs).
 */
export function clockTimeToPast(input: string): Date | null {
  const parsed = parseClockTime(input);
  if (!parsed) return null;
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(parsed.hours, parsed.minutes, 0, 0);
  // If the candidate is in the future (or more than a few seconds ahead),
  // roll back one day.
  if (candidate.getTime() > now.getTime()) {
    candidate.setDate(candidate.getDate() - 1);
  }
  return candidate;
}

/**
 * Resolve a clock-time string to the next future occurrence of that
 * time (for next_time input).
 */
export function clockTimeToFuture(input: string): Date | null {
  const parsed = parseClockTime(input);
  if (!parsed) return null;
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(parsed.hours, parsed.minutes, 0, 0);
  // If the candidate is in the past (or equal), roll forward one day.
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

/**
 * Parse a time offset string and return a Date that many ms before now.
 * Also supports clock-time strings like "10:30am", "1pm", "13:30"
 * which resolve to the most recent past occurrence of that time.
 * Returns current date if blank.
 */
export function subtractTimeOffset(input: string): Date {
  if (!input || input.trim() === '') return new Date();
  if (isClockTime(input)) {
    return clockTimeToPast(input) ?? new Date();
  }
  return new Date(Date.now() - parseTimeOffsetMs(input));
}

/**
 * Parse a time input for next_time and return a future Date.
 * Supports duration offsets ("1d5h") added to now, as well as
 * clock-time strings ("10:30am", "1pm") resolved to the next
 * future occurrence.
 * Returns null if blank.
 */
export function addTimeOffset(input: string): Date | null {
  if (!input || input.trim() === '') return null;
  if (isClockTime(input)) {
    return clockTimeToFuture(input) ?? null;
  }
  return new Date(Date.now() + parseTimeOffsetMs(input));
}

/**
 * Format a countdown with a label. Supports negative values (overtime).
 */
export function formatCountdown(ms: number, label: string): string {
  const abs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';
  const years = Math.floor(abs / MS_PER_YEAR);
  const months = Math.floor((abs % MS_PER_YEAR) / MS_PER_MONTH);
  const weeks = Math.floor((abs % MS_PER_MONTH) / MS_PER_WEEK);
  const days = Math.floor((abs % MS_PER_WEEK) / MS_PER_DAY);
  const hours = Math.floor((abs % MS_PER_DAY) / MS_PER_HOUR);
  const mins = Math.floor((abs % MS_PER_HOUR) / MS_PER_MINUTE);
  const secs = Math.floor((abs % MS_PER_MINUTE) / 1000);
  let time: string;
  if (years > 0) {
    time = `${sign}${years}y ${months}mo`;
  } else if (months > 0) {
    time = `${sign}${months}mo ${weeks}w`;
  } else if (weeks > 0) {
    time = `${sign}${weeks}w ${days}d`;
  } else if (days > 0) {
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
  const years = Math.floor(ms / MS_PER_YEAR);
  const months = Math.floor((ms % MS_PER_YEAR) / MS_PER_MONTH);
  const weeks = Math.floor((ms % MS_PER_MONTH) / MS_PER_WEEK);
  const days = Math.floor((ms % MS_PER_WEEK) / MS_PER_DAY);
  const hours = Math.floor((ms % MS_PER_DAY) / MS_PER_HOUR);
  const mins = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  const secs = Math.floor((ms % MS_PER_MINUTE) / 1000);
  if (years > 0) {
    return `${years}y ${months}mo ago`;
  } else if (months > 0) {
    return `${months}mo ${weeks}w ago`;
  } else if (weeks > 0) {
    return `${weeks}w ${days}d ago`;
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
  nextTime?: string | null,
): string {
  if (!startTime) return '';
  const startMs = new Date(startTime).getTime();
  const hasEnd = !!endTime;
  const endMs = hasEnd ? new Date(endTime).getTime() : 0;
  const minDurMs = parseTimeOffsetMs(minDuration);
  const maxDurMs = parseTimeOffsetMs(maxDuration);
  const minTimeMs = parseTimeOffsetMs(minTimeBetween);
  const maxTimeMs = parseTimeOffsetMs(maxTimeBetween);

  // Event is started (no end_time) — ignore next_time
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
  // If next_time is set, it overrides min/max between for the timer
  if (nextTime) {
    const nextMs = new Date(nextTime).getTime();
    const remaining = nextMs - now;
    return formatCountdown(remaining, 'Next in');
  }

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

      // If next_time is set, use it as the deadline instead of max interval
      if (e.next_time) {
        const nextMs = new Date(e.next_time).getTime();
        if (now >= nextMs) {
          // Overdue past next_time
          return [4, -(now - nextMs)];
        } else {
          // Counting down to next_time
          return [5, nextMs];
        }
      }

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
