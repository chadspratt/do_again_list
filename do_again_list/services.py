from __future__ import annotations

import datetime
import enum
from dataclasses import asdict, dataclass, field, fields
from django.utils import timezone

from do_again_list import models, serializers

# Title of the built-in activity that is triggered when a new Activity is added.
ADD_TO_LIST_TITLE = "Add to list"


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
    stat_modifier: StatModifier = field(default_factory=StatModifier)


@dataclass
class ResourceRef:
    klass: str
    pk: int


# TODO: There is some design friction between this and the enemy spawn
#  stat_modifier. They could use the same model. The ``StatModifier`` model
#  seems better because it doesn't key off Literals. If new stats are added
#  they will affect contexts which are specific to the stat itself and must
#  resolve to the stat name (more like how ``StatModifier`` exists), see the
#  following pattern in `engine.ts`::
#
#     hero.attack = gs.total_attack + buffBonus(state.buffs, 'attack');
#     hero.defense = gs.total_defense + buffBonus(state.buffs, 'defense');
@dataclass
class Buff:
    stat: Stat
    amount: int
    label: str

class Stat(enum.Enum):
    ATTACK = "attack"
    DEFENSE = "defense"
    SPEED = "speed"


@dataclass
class GameEffect:
    game_state_delta: GameStateDelta = field(default_factory=GameStateDelta)
    spawn_enemy: SpawnEnemy | None = None
    hero_buffs: list[Buff] = field(default_factory=list)
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

        # Auto-complete the "Add to List" built-in activity
        add_to_list = models.Activity.objects.filter(
            owner=owner, is_built_in=True, title=ADD_TO_LIST_TITLE
        ).first()
        if add_to_list is not None:
            now = timezone.now()
            effect = self.end(activity=add_to_list, end_time=now)
        else:
            effect = GameEffect()

        effect.game_state_delta += GameStateDelta(base_attack=1)
        effect.resource_ref = ResourceRef(klass="Activity", pk=instance.pk)
        return effect

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
        self, *, activity: models.Activity, start_time: datetime.datetime, **kwargs
    ) -> GameEffect:
        game_effect = GameEffect()
        created = False
        try:
            occurance = models.Occurance.objects.get(activity=activity, end_time=None)
        except models.Occurance.DoesNotExist:
            created = True
            occurance = models.Occurance.objects.create(
                activity=activity, start_time=start_time
            )
        if not created and occurance.start_time:
            # this occurrance already existed with a start time
            # Checks at the view level should prevent this
            raise ActivityLifecycleException("Cannot start an active activity")

        occurance.start_time = start_time
        occurance.save()

        return game_effect

    def end(
        self,
        *,
        activity: models.Activity,
        end_time: datetime.datetime,
        start_time: datetime.datetime | None = None,
        next_time: datetime.datetime | None = None,
        kill_streak: int = 0,
        **kwargs,
    ):
        game_effect = GameEffect()
        latest_completed_occurance = self._get_latest_completed_occurrance(
            activity=activity
        )

        previous_next_time = activity.next_time
        activity.next_time = next_time
        activity.save()
        try:
            occurance = models.Occurance.objects.get(activity=activity, end_time=None)
        except models.Occurance.DoesNotExist:
            # if start_time is None then use default_duration to calculate a start_time
            start_time = start_time if start_time else end_time - activity.default_duration
            occurance = models.Occurance.objects.create(
                activity=activity, start_time=start_time, end_time=end_time, planned_time=previous_next_time
            )
        if occurance is None:
            # A task was ended which was never started!
            raise ActivityLifecycleException("Cannot end an inactive activity")
        occurance.end_time = end_time
        occurance.save()

        interval_ok = True
        duration_ok = True
        # Apply bonuses
        if previous_next_time is not None:
            # compare when this occurance was scheduled to begin
            interval_ok = occurance.start_time < previous_next_time
        if activity.max_duration is not None:
            duration_ok = end_time - occurance.start_time <= activity.max_duration
        if activity.min_duration is not None:
            duration_ok &= end_time - occurance.start_time >= activity.min_duration
        if latest_completed_occurance is not None:
            # compare when this occurance _ought_ to occur absent an explicit schedule
            time_since_last_occurance = end_time - latest_completed_occurance.end_time # type: ignore
            if activity.max_time_between_events is not None:
                interval_ok &= time_since_last_occurance <= activity.max_time_between_events
            if activity.min_time_between_events is not None:
                interval_ok &= time_since_last_occurance >= activity.min_time_between_events

        stat_modifier = StatModifier()
        buff_label = activity.title + f" [{activity.moral_quality}]"
        if activity.moral_quality == models.Activity.MoralQuality.GOOD:
            if interval_ok:
                stat_modifier.attack += 3
                stat_modifier.defense += 2
                stat_modifier.speed += 1
                game_effect.game_state_delta.gold += 15
                game_effect.messages.append("Good habit on time!")
                buff_label += " (on time)"
            else:
                stat_modifier.attack += 1
                stat_modifier.defense += 1
                game_effect.game_state_delta.gold += 5
                game_effect.messages.append("Good habit but late — reduced reward.")
        elif activity.moral_quality == models.Activity.MoralQuality.BAD:
            if not interval_ok:
                stat_modifier.attack += -3
                stat_modifier.defense += -2
                stat_modifier.speed += -1
                game_effect.messages.append("Bad habit too soon! Large penalty.")
            else:
                stat_modifier.attack += -1
                stat_modifier.defense += -1
                game_effect.messages.append(
                    "Bad habit, but you held off — minor penalty."
                )
                buff_label += " (held off)"
        else:
            if interval_ok:
                stat_modifier.attack += 2
                stat_modifier.defense += 1
                stat_modifier.speed += 0
                game_effect.game_state_delta.gold += 10
                game_effect.messages.append("Neutral event on schedule!")
            else:
                stat_modifier.attack += 1
                game_effect.game_state_delta.gold += 3
                game_effect.messages.append(
                    "Neutral event but timing was off — reduced reward."
                )

        for stat, amount in asdict(stat_modifier).items():
            stat = Stat[stat.upper()]
            game_effect.hero_buffs.append(
                Buff(stat=stat, amount=amount, label=buff_label)
            )
        game_effect.spawn_enemy = SpawnEnemy(
            level=(kill_streak // 3) + 1, stat_modifier=stat_modifier.times(-1)
        )
        return game_effect

    def set_next(
        self, *, activity: models.Activity, next_time: datetime.datetime, **kwargs
    ) -> GameEffect:
        game_effect = GameEffect()
        activity.next_time = next_time
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
