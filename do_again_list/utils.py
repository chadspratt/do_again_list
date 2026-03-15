import datetime
import re


def parse_time_offset_ms(value: str) -> float:
    """Parse a time offset string like '1d5h30m' into milliseconds.
    Supports y, mo, w, d, h, m, s units.
    Returns 0 if blank or invalid.
    """
    if not value or not value.strip():
        return 0
    total = 0
    year = re.search(r"([\d\.]+)y", value)
    month = re.search(r"([\d\.]+)mo", value)
    week = re.search(r"([\d\.]+)w", value)
    day = re.search(r"([\d\.]+)d", value)
    hour = re.search(r"([\d\.]+)h", value)
    minute = re.search(r"([\d\.]+)m(?!o)", value)
    sec = re.search(r"([\d\.]+)s", value)
    if year:
        total += float(year.group(1)) * 365 * 24 * 60 * 60 * 1000
    if month:
        total += float(month.group(1)) * 30 * 24 * 60 * 60 * 1000
    if week:
        total += float(week.group(1)) * 7 * 24 * 60 * 60 * 1000
    if day:
        total += float(day.group(1)) * 24 * 60 * 60 * 1000
    if hour:
        total += float(hour.group(1)) * 60 * 60 * 1000
    if minute:
        total += float(minute.group(1)) * 60 * 1000
    if sec:
        total += float(sec.group(1)) * 1000
    return total


def parse_time_offset(value: str | int) -> datetime.timedelta | None:
    if isinstance(value, int):
        time_offset_ms = value * 1000
    elif isinstance(value, str):
        time_offset_ms = parse_time_offset_ms(value)
    if time_offset_ms == 0:
        return None
    return datetime.timedelta(milliseconds=time_offset_ms)


def humanize_seconds(seconds: float) -> str:
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
    days = duration.days
    if days >= 365:
        years = days // 365
        days -= years * 365
        buffer += f"{years}y"
    if days >= 30:
        months = days // 30
        days -= months * 30
        buffer += f"{months}mo"
    if days >= 7:
        weeks = days // 7
        days -= weeks * 7
        buffer += f"{weeks}w"
    if days > 0:
        buffer += f"{days}d"
    buffer += humanize_seconds(duration.seconds)
    return buffer
