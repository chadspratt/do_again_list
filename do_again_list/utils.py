import re
import datetime


def parse_time_offset_ms(value: str) -> int:
    """Parse a time offset string like '1d5h30m' into milliseconds.
    Returns 0 if blank or invalid.
    """
    if not value or not value.strip():
        return 0
    total = 0
    day = re.search(r"(\d+)d", value)
    hour = re.search(r"(\d+)h", value)
    minute = re.search(r"(\d+)m", value)
    sec = re.search(r"(\d+)s", value)
    if day:
        total += int(day.group(1)) * 24 * 60 * 60 * 1000
    if hour:
        total += int(hour.group(1)) * 60 * 60 * 1000
    if minute:
        total += int(minute.group(1)) * 60 * 1000
    if sec:
        total += int(sec.group(1)) * 1000
    return total


def parse_time_offset(value: str) -> datetime.timedelta | None:
    time_offset_ms = parse_time_offset_ms(value)
    if time_offset_ms == 0:
        return None
    return datetime.timedelta(milliseconds=time_offset_ms)


def humanize_seconds(seconds: int) -> str:
    """
    deparse a number of seconds (less than one day) into a string like
    "23h59m59s"
    """
    if seconds > 86399:
        # seconds is greater than 1 day. This is inappropriate!
        raise ValueError("Value greater than 1 day. fuck you")
    buffer = ""
    hours = seconds // 3600
    seconds -= hours * 3600
    if hours > 0:
        buffer += f"{hours}h"
    minutes = seconds // 60
    seconds -= minutes * 60
    if minutes > 0:
        buffer += f"{minutes}m"
    if seconds > 0:
        buffer += f"{seconds}s"
    return buffer


def humanize_timedelta(duration: datetime.timedelta) -> str:
    buffer = ""
    if duration.days > 0:
        buffer += f"{duration.days}d"
    buffer += humanize_seconds(duration.seconds)
    return buffer
