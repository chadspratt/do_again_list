import datetime
from operator import mod
from do_again_list import models
from django.utils import timezone


class TestPastEventModel:
    def test_state__pending(self, past_event, historical_event_factory):
        # GIVEN a past event has no historical events
        # THEN the past event will have state PENDING
        assert past_event.state == models.PastEvent.ActivityState.PENDING

    def test_state__inactive_with_next(self, past_event, historical_event_factory):
        # GIVEN a past event has a historical event
        # AND the historical event has a start time
        # AND the historical event has an end time
        # AND the historical event has next_time set
        # THEN the past event will have state INACTIVE
        historical_event_factory(
            next_time=timezone.now(), start_time=timezone.now(), end_time=timezone.now()
        )
        assert past_event.state == models.PastEvent.ActivityState.INACTIVE

    def test_state__inactive_no_next(self, past_event, historical_event_factory):
        # GIVEN a past event has a historical event
        # AND the historical event has a start time
        # AND the historical event has an end time
        # AND the historical event has no next_time set
        # THEN the past event will have state INACTIVE
        historical_event_factory(start_time=timezone.now(), end_time=timezone.now())
        assert past_event.state == models.PastEvent.ActivityState.INACTIVE

    def test_state__active(self, past_event, historical_event_factory):
        # GIVEN a past event has a historical event
        # AND the historical event has a start time
        # AND the historical event has no end time
        # THEN the past event will have state INACTIVE
        historical_event_factory(start_time=timezone.now())
        assert past_event.state == models.PastEvent.ActivityState.ACTIVE

    def test_moral_quality__good(self, past_event):
        past_event.max_duration_between_events = datetime.timedelta(seconds=1)
        assert past_event.moral_quality == models.PastEvent.MoralQuality.GOOD

    def test_moral_quality__bad(self, past_event):
        past_event.min_duration_between_events = datetime.timedelta(seconds=1)
        assert past_event.moral_quality == models.PastEvent.MoralQuality.BAD

    def test_moral_quality__neutral_both(self, past_event):
        past_event.min_duration_between_events = datetime.timedelta(seconds=1)
        past_event.max_duration_between_events = datetime.timedelta(seconds=1)
        assert past_event.moral_quality == models.PastEvent.MoralQuality.NEUTRAL

    def test_moral_quality__neutral_neither(self, past_event):
        assert past_event.moral_quality == models.PastEvent.MoralQuality.NEUTRAL
