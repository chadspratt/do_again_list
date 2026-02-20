import re


def parse_time_offset_ms(value: str) -> int:
    """Parse a time offset string like '1d5h30m' into milliseconds.
    Returns 0 if blank or invalid.
    """
    if not value or not value.strip():
        return 0
    total = 0
    day = re.search(r'(\d+)d', value)
    hour = re.search(r'(\d+)h', value)
    minute = re.search(r'(\d+)m', value)
    sec = re.search(r'(\d+)s', value)
    if day:
        total += int(day.group(1)) * 24 * 60 * 60 * 1000
    if hour:
        total += int(hour.group(1)) * 60 * 60 * 1000
    if minute:
        total += int(minute.group(1)) * 60 * 1000
    if sec:
        total += int(sec.group(1)) * 1000
    return total
