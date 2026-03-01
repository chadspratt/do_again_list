from __future__ import annotations

from operator import ge, mod
from do_again_list import models, serializers
import datetime
from dataclasses import dataclass, fields


class Addable:
    def __add__(self, other):
        for field in fields(other.__class__):
            current_value = getattr(self, field.name)
            current_value += getattr(other, field.name)
            setattr(self, field.name, current_value)
        return self


@dataclass
class GameStateDelta(Addable):
    xp: int = 0
    gold: int = 0
    level: int = 0
    base_attack: int = 0
    base_defense: int = 0
    base_speed: int = 0
    best_distance: int = 0
    streak: int = 0
    hero_hp: int = 0
    # items: list[Item] = []


@dataclass
class Buff(Addable):
    attack: int = 0
    defense: int = 0
    speed: int = 0

    def times(self, scalar: int) -> Buff:
        return Buff(
            attack=self.attack * scalar,
            defense=self.defense * scalar,
            speed=self.speed * scalar,
        )


@dataclass
class GameEffect(Addable):
    game_state_delta: GameStateDelta = GameStateDelta()
    gold: int = 0
    enemy_buff: Buff = Buff()
    hero_buff: Buff = Buff()
    messages: list[str] = []


class ActivityService:
    def create(self, data: serializers.PastEventSerializer) -> GameEffect:
        instance = data.save()
        return GameEffect(game_state_delta=GameStateDelta(base_attack=1))

    def _get_latest_completed_occurrance(
        self, activity: models.PastEvent
    ) -> models.HistoricalEvent | None:
        try:
            return models.HistoricalEvent.objects.filter(
                past_event=activity, end_time__isnull=False
            ).latest("end_time")
        except models.HistoricalEvent.DoesNotExist:
            return None

    def start_activity(
        self, *, activity: models.PastEvent, at_time: datetime.datetime
    ) -> GameEffect:
        # Look for open Occurances
        # - may have been pre-created by a `set_next`
        # - may have already been started (possibly bad state if user didn't end an activity)
        #   - ?? debounce by updating
        #   - ?? raise because of bad state?
        # - may not exist at all
        game_effect = GameEffect()
        created = False
        try:
            occurance = models.HistoricalEvent.objects.get(
                past_event=activity, end_time=None
            )
        except models.HistoricalEvent.DoesNotExist:
            created = True
            occurance = models.HistoricalEvent.objects.create(
                past_event=activity, start_time=at_time
            )
        if not created and occurance.start_time:
            # this occurrance already existed with a start time
            # - could be a repeated request (ignore if start time within certain
            #    proximity to existing start time)
            # - could be the player forgot to stop an activity (penalize?)
            # lots of possiblities for how to handle this.
            # TODO: how to handle this??
            # reset streak?
            game_effect.game_state_delta.streak = 0

        occurance.start_time = at_time
        occurance.save()

        return game_effect

    def end_activity(self, *, activity: models.PastEvent, at_time: datetime.datetime):
        game_effect = GameEffect()
        latest_completed_occurance = self._get_latest_completed_occurrance(
            activity=activity
        )

        occurance = models.HistoricalEvent.objects.filter(
            past_event=activity, end_time__isnull=True
        ).first()
        if occurance is None:
            # A task was ended which was never started!
            # TODO: determine penalty
            game_effect.game_state_delta.streak = 0
            game_effect.messages.append(f"Activity {activity} was never started!")
            return game_effect
        occurance.end_time = at_time
        occurance.save()

        max_ok = True
        min_ok = True
        # Apply bonuses
        if occurance.next_time is not None:
            # compare when this occurance was scheduled to begin
            max_ok = occurance.start_time < occurance.next_time
            min_ok = True
        elif latest_completed_occurance is not None:
            # compare when this occurance _ought_ to occur absent an explicit schedule
            time_since_last_occurance = at_time - latest_completed_occurance.end_time
            max_ok = (
                activity.max_duration_between_events is not None
                or time_since_last_occurance <= activity.max_duration_between_events
            )
            min_ok = (
                activity.min_duration_between_events is not None
                or time_since_last_occurance >= activity.min_duration_between_events
            )

        buff = Buff()
        label = ""
        if activity.moral_quality == models.PastEvent.MoralQuality.GOOD:
            if max_ok:
                buff.attack += 3
                buff.defense += 2
                buff.speed += 1
                game_effect.gold += 15
                game_effect.messages.append("Good habit on time!")
            else:
                buff.attack += 1
                buff.defense += 1
                game_effect.gold += 5
                game_effect.messages.append("Good habit but late — reduced reward.")
        elif activity.moral_quality == models.PastEvent.MoralQuality.BAD:
            if min_ok:
                buff.attack += -3
                buff.defense += -2
                buff.speed += -1
                game_effect.messages.append("Bad habit too soon! Large penalty.")
            else:
                buff.attack += -1
                buff.defense += -1
                game_effect.messages.append(
                    "Bad habit, but you held off — minor penalty."
                )
        else:
            if min_ok and max_ok:
                buff.attack += 2
                buff.defense += 1
                buff.speed += 0
                game_effect.gold += 10
                game_effect.messages.append(f"Neutral event on schedule!")
            else:
                buff.attack += 1
                game_effect.gold += 3
                game_effect.messages.append(
                    "Neutral event but timing was off — reduced reward."
                )

        game_effect.hero_buff = game_effect.hero_buff + buff
        game_effect.enemy_buff = game_effect.hero_buff + buff.times(-1)

        return game_effect

    def set_next_activity(
        self, *, activity: models.PastEvent, at_time: datetime.datetime
    ):
        return GameEffect()
