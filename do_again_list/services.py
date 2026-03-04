from __future__ import annotations

import datetime
from dataclasses import dataclass, field, fields

from do_again_list import models, serializers


class Addable:
    def __add__(self, other):
        for _field in fields(other.__class__):
            current_value = getattr(self, _field.name)
            current_value += getattr(other, _field.name)
            setattr(self, _field.name, current_value)
        return self


@dataclass
class GameStateDelta(Addable):
    xp: int = 0
    gold: int = 0
    level: int = 0
    base_attack: int = 0
    base_defense: int = 0
    base_speed: int = 0
    streak: int = 0
    hero_hp: int = 0
    # items: list[Item] = []


@dataclass
class StatModifier(Addable):
    attack: int = 0
    defense: int = 0
    speed: int = 0

    def times(self, scalar: int) -> StatModifier:
        return StatModifier(
            attack=self.attack * scalar,
            defense=self.defense * scalar,
            speed=self.speed * scalar,
        )


@dataclass
class SpawnEnemy:
    level: int = 1
    modifiers: StatModifier = field(default_factory=StatModifier)


@dataclass
class ResourceRef:
    klass: str
    pk: int


@dataclass
class GameEffect:
    game_state_delta: GameStateDelta = field(default_factory=GameStateDelta)
    spawn_enemy: SpawnEnemy | None = None
    hero_buff: StatModifier = field(default_factory=StatModifier)
    reset_streak: bool = False
    messages: list[str] = field(default_factory=list)
    pending_heal: bool = False
    pending_fatigue: bool = False
    resource_ref: ResourceRef | None = None


class ActivityLifecycleException(Exception):
    pass


class ActivityService:
    def create(self, serializer: serializers.ActivitySerializer, owner) -> GameEffect:
        instance = serializer.save(owner=owner)
        return GameEffect(
            game_state_delta=GameStateDelta(base_attack=1),
            resource_ref=ResourceRef(klass="Activity", pk=instance.pk),
        )

    def _get_latest_completed_occurrance(
        self, activity: models.Activity
    ) -> models.Occurance | None:
        try:
            return models.Occurance.objects.filter(
                activity=activity, end_time__isnull=False
            ).latest("end_time")
        except models.Occurance.DoesNotExist:
            return None

    def start(
        self, *, activity: models.Activity, at_time: datetime.datetime, **kwargs
    ) -> GameEffect:
        game_effect = GameEffect()
        created = False
        try:
            occurance = models.Occurance.objects.get(activity=activity, end_time=None)
        except models.Occurance.DoesNotExist:
            created = True
            occurance = models.Occurance.objects.create(
                activity=activity, start_time=at_time
            )
        if not created and occurance.start_time:
            # this occurrance already existed with a start time
            # Checks at the view level should prevent this
            raise ActivityLifecycleException("Cannot start an active activity")

        occurance.start_time = at_time
        occurance.save()

        return game_effect

    def end(
        self,
        *,
        activity: models.Activity,
        at_time: datetime.datetime,
        kill_streak: int = 0,
        **kwargs,
    ):
        game_effect = GameEffect()
        latest_completed_occurance = self._get_latest_completed_occurrance(
            activity=activity
        )

        occurance = models.Occurance.objects.filter(
            activity=activity, end_time__isnull=True
        ).first()
        if occurance is None:
            # A task was ended which was never started!
            raise ActivityLifecycleException("Cannot end an inactive activity")
        occurance.end_time = at_time
        occurance.save()

        max_ok = True
        min_ok = True
        # Apply bonuses
        if activity.next_time is not None:
            # compare when this occurance was scheduled to begin
            max_ok = occurance.start_time < activity.next_time
            min_ok = True
        elif latest_completed_occurance is not None:
            # compare when this occurance _ought_ to occur absent an explicit schedule
            time_since_last_occurance = at_time - latest_completed_occurance.end_time
            max_ok = (
                activity.max_duration_between_events is not None
                and time_since_last_occurance <= activity.max_duration_between_events
            )
            min_ok = (
                activity.min_duration_between_events is not None
                and time_since_last_occurance >= activity.min_duration_between_events
            )

        buff = StatModifier()
        if activity.moral_quality == models.Activity.MoralQuality.GOOD:
            if max_ok:
                buff.attack += 3
                buff.defense += 2
                buff.speed += 1
                game_effect.game_state_delta.gold += 15
                game_effect.messages.append("Good habit on time!")
            else:
                buff.attack += 1
                buff.defense += 1
                game_effect.game_state_delta.gold += 5
                game_effect.messages.append("Good habit but late — reduced reward.")
        elif activity.moral_quality == models.Activity.MoralQuality.BAD:
            if not min_ok:
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
                game_effect.game_state_delta.gold += 10
                game_effect.messages.append("Neutral event on schedule!")
            else:
                buff.attack += 1
                game_effect.game_state_delta.gold += 3
                game_effect.messages.append(
                    "Neutral event but timing was off — reduced reward."
                )

        game_effect.hero_buff = game_effect.hero_buff + buff
        game_effect.spawn_enemy = SpawnEnemy(
            level=(kill_streak // 3) + 1, modifiers=buff.times(-1)
        )
        return game_effect

    def set_next(
        self, *, activity: models.Activity, at_time: datetime.datetime, **kwargs
    ) -> GameEffect:
        game_effect = GameEffect()
        activity.next_time = at_time
        activity.save()
        return game_effect


class GameStateService:
    def update(
        self, *, game_state: models.GameState, game_effect: GameEffect
    ) -> models.GameState:
        for _field in models.GameState._meta.get_fields():
            try:
                delta = getattr(game_effect.game_state_delta, _field.name)
            except AttributeError:
                continue
            setattr(game_state, _field.name, getattr(game_state, _field.name) + delta)
        if game_effect.reset_streak:
            game_state.streak = 0
        game_state.save()
        return game_state
