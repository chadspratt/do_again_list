import datetime
from collections.abc import Callable

import pytest
from django.utils import timezone

from do_again_list import models as m
from do_again_list import services as s


class TestActivityService:
    def test_start(self, activity):
        # GIVEN there is no occurance
        # WHEN I start the activity with a start time value
        # THEN an occurance will be created for the activity
        # AND the occurance start time will match the given value
        assert activity.occurances.count() == 0
        given_time = timezone.now()
        s.ActivityService().start(activity=activity, at_time=given_time)
        assert activity.occurances.count() == 1
        assert activity.occurances.all()[0].start_time == given_time

    def test_start__with_start_time(
        self, activity, occurance_factory: Callable[..., m.Occurance]
    ):
        # GIVEN there is an occurance with a start time
        # WHEN I start the activity with a start time value
        # THEN an exception will be raised
        occurance_factory(start_time=timezone.now())
        given_time = timezone.now()
        with pytest.raises(Exception):
            s.ActivityService().start(activity=activity, at_time=given_time)

    def test_start__with_end_time(
        self, activity, occurance_factory: Callable[..., m.Occurance]
    ):
        # GIVEN there is an occurance with a start time and end time
        # WHEN I start the activity with a start time value
        # THEN a new occurance will be created for the activity
        # AND the occurance start time will match the given value
        old_time = timezone.now() - datetime.timedelta(minutes=10)
        occurance = occurance_factory(start_time=old_time, end_time=old_time)
        given_time = timezone.now()
        s.ActivityService().start(activity=activity, at_time=given_time)
        assert activity.occurances.count() == 2
        occurances = set(activity.occurances.all())
        # will not raise KeyError
        occurances.remove(occurance)
        new_occurance = occurances.pop()
        assert new_occurance.start_time == given_time


class TestGameStateService:
    def test_update(self, game_state_factory):
        game_effect = s.GameEffect(
            game_state_delta=s.GameStateDelta(
                xp=10,
                gold=2,
                level=1,
                base_attack=10,
                base_defense=-2,
                base_speed=12,
                streak=1,
                hero_hp=5,
            )
        )
        game_state = game_state_factory(
            xp=5,
            gold=10,
            level=3,
            base_attack=1,
            base_defense=1,
            base_speed=1,
            best_distance=110,
            streak=5,
            hero_hp=5,
        )
        returned_game_state = s.GameStateService().update(
            game_state=game_state, game_effect=game_effect
        )
        # Should be same database row still
        assert returned_game_state == game_state
        game_state.refresh_from_db()
        assert game_state.xp == 15
        assert game_state.gold == 12
        assert game_state.level == 4
        assert game_state.base_attack == 11
        assert game_state.base_defense == -1
        assert game_state.base_speed == 13
        assert game_state.best_distance == 110
        assert game_state.streak == 6
        assert game_state.hero_hp == 10

    def test_update__reset_streak(self, game_state_factory):
        game_effect = s.GameEffect(
            game_state_delta=s.GameStateDelta(
                streak=1,
            ),
            reset_streak=True,
        )
        game_state = game_state_factory(
            streak=5,
        )
        returned_game_state = s.GameStateService().update(
            game_state=game_state, game_effect=game_effect
        )
        # Should be same database row still
        assert returned_game_state == game_state
        game_state.refresh_from_db()
        assert game_state.streak == 0
