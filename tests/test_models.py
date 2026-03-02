import datetime
from operator import mod
from do_again_list import models
from django.utils import timezone


class TestActivityModel:
    def test_state__pending(self, activity, occurance_factory):
        # GIVEN a activity has no occurances
        # THEN the activity will have state PENDING
        assert activity.state == models.Activity.ActivityState.PENDING

    def test_state__inactive_with_next(self, activity, occurance_factory):
        # GIVEN a activity has an occurance
        # AND the occurance has a start time
        # AND the occurance has an end time
        # AND the occurance has next_time set
        # THEN the activity will have state INACTIVE
        occurance_factory(
            next_time=timezone.now(), start_time=timezone.now(), end_time=timezone.now()
        )
        assert activity.state == models.Activity.ActivityState.INACTIVE

    def test_state__inactive_no_next(self, activity, occurance_factory):
        # GIVEN a activity has an occurance
        # AND the occurance has a start time
        # AND the occurance has an end time
        # AND the occurance has no next_time set
        # THEN the activity will have state INACTIVE
        occurance_factory(start_time=timezone.now(), end_time=timezone.now())
        assert activity.state == models.Activity.ActivityState.INACTIVE

    def test_state__active(self, activity, occurance_factory):
        # GIVEN a activity has an occurance
        # AND the occurance has a start time
        # AND the occurance has no end time
        # THEN the activity will have state INACTIVE
        occurance_factory(start_time=timezone.now())
        assert activity.state == models.Activity.ActivityState.ACTIVE

    def test_moral_quality__good(self, activity):
        activity.max_duration_between_events = datetime.timedelta(seconds=1)
        assert activity.moral_quality == models.Activity.MoralQuality.GOOD

    def test_moral_quality__bad(self, activity):
        activity.min_duration_between_events = datetime.timedelta(seconds=1)
        assert activity.moral_quality == models.Activity.MoralQuality.BAD

    def test_moral_quality__neutral_both(self, activity):
        activity.min_duration_between_events = datetime.timedelta(seconds=1)
        activity.max_duration_between_events = datetime.timedelta(seconds=1)
        assert activity.moral_quality == models.Activity.MoralQuality.NEUTRAL

    def test_moral_quality__neutral_neither(self, activity):
        assert activity.moral_quality == models.Activity.MoralQuality.NEUTRAL
