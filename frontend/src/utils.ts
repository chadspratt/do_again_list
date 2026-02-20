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
  startTime: string,
  endTime: string | null,
  minDuration: string,
  maxDuration: string,
  minTimeBetween: string,
  maxTimeBetween: string,
): string {
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
