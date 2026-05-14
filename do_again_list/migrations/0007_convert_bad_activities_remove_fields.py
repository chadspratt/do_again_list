"""
Migration: convert BAD activities to "Break from: X" and remove
min_time_between_events / max_duration from Activity.

For each Activity whose min_time_between_events is set (i.e. a BAD event):
  - title     → "Break from: {title}"
  - min_duration           ← old min_time_between_events
  - max_time_between_events ← old max_duration
"""

from django.db import migrations, models
import datetime


def convert_bad_activities(apps, schema_editor):
    Activity = apps.get_model("do_again_list", "Activity")
    zero = datetime.timedelta(0)
    for activity in Activity.objects.filter(
        min_time_between_events__isnull=False
    ).exclude(min_time_between_events=zero):
        activity.title = f"Break from: {activity.title}"
        activity.min_duration = activity.min_time_between_events
        if activity.max_duration and activity.max_duration > zero:
            activity.max_time_between_events = activity.max_duration
        activity.min_time_between_events = None
        activity.max_duration = None
        activity.save()


def reverse_convert_bad_activities(apps, schema_editor):
    # Best-effort reversal: strip "Break from: " prefix and restore fields.
    Activity = apps.get_model("do_again_list", "Activity")
    prefix = "Break from: "
    for activity in Activity.objects.filter(title__startswith=prefix):
        activity.title = activity.title[len(prefix):]
        activity.min_time_between_events = activity.min_duration
        activity.max_duration = activity.max_time_between_events
        activity.min_duration = None
        activity.max_time_between_events = None
        activity.save()


class Migration(migrations.Migration):

    dependencies = [
        ("do_again_list", "0006_gamestate_quest_tokens"),
    ]

    operations = [
        migrations.RunPython(
            convert_bad_activities,
            reverse_code=reverse_convert_bad_activities,
        ),
        migrations.RemoveField(
            model_name="activity",
            name="min_time_between_events",
        ),
        migrations.RemoveField(
            model_name="activity",
            name="max_duration",
        ),
    ]
