import datetime

from rest_framework import serializers

from do_again_list import models
from do_again_list.utils import humanize_timedelta, parse_time_offset


class HumanReadableDurationField(serializers.DurationField):
    def to_representation(self, value: datetime.timedelta) -> str:
        return humanize_timedelta(value)

    def to_internal_value(self, value: datetime.timedelta | str) -> datetime.timedelta:
        if isinstance(value, datetime.timedelta):
            return value
        internal = parse_time_offset(value)
        if internal is None:
            return datetime.timedelta()
        return internal


class ActivitySerializer(serializers.ModelSerializer):
    default_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_duration = HumanReadableDurationField(allow_null=True, required=False)
    min_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_time_between_events = HumanReadableDurationField(
        allow_null=True, required=False
    )
    min_time_between_events = HumanReadableDurationField(
        allow_null=True, required=False
    )
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()

    class Meta:
        model = models.Activity
        fields = (
            "id",
            "title",
            "ordering",
            "default_duration",
            "next_time",
            "min_duration",
            "max_duration",
            "max_time_between_events",
            "min_time_between_events",
            "value",
            "repeats",
            "is_built_in",
            "start_time",
            "end_time",
            "state",
        )
        read_only_fields = ("id", "is_built_in", "start_time", "end_time", "state")

    def _latest_occurance(self, obj: models.Activity) -> models.Occurance | None:
        """Return the active (end_time IS NULL) occurrence if one exists,
        otherwise the most-recently-ended occurrence."""
        active = obj.occurances.filter(end_time__isnull=True).first()
        if active is not None:
            return active
        return obj.occurances.first()  # ordered by -end_time via Meta

    def get_start_time(self, obj: models.Activity) -> str | None:
        latest = self._latest_occurance(obj)
        if latest and latest.start_time:
            return latest.start_time.isoformat()
        return None

    def get_end_time(self, obj: models.Activity) -> str | None:
        latest = self._latest_occurance(obj)
        if latest and latest.end_time:
            return latest.end_time.isoformat()
        return None

    def get_state(self, obj: models.Activity) -> str:
        return obj.state


class OccuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Occurance
        fields = "__all__"


class GameStateSerializer(serializers.ModelSerializer):
    total_attack = serializers.SerializerMethodField()
    total_defense = serializers.SerializerMethodField()
    total_speed = serializers.SerializerMethodField()
    xp_to_next_level = serializers.SerializerMethodField()

    class Meta:
        model = models.GameState
        exclude = ("owner",)

    def get_total_attack(self, obj: models.GameState | dict) -> int:
        if isinstance(obj, dict):
            return obj.get("total_attack", 0)
        return obj.total_attack()

    def get_total_defense(self, obj: models.GameState | dict) -> int:
        if isinstance(obj, dict):
            return obj.get("total_defense", 0)
        return obj.total_defense()

    def get_total_speed(self, obj: models.GameState | dict) -> int:
        if isinstance(obj, dict):
            return obj.get("total_speed", 0)
        return obj.total_speed()

    def get_xp_to_next_level(self, obj: models.GameState | dict) -> int:
        if isinstance(obj, dict):
            return obj.get("xp_to_next_level", 0)
        return obj.xp_to_next_level()

    def to_internal_value(self, data: object) -> object:
        if isinstance(data, models.GameState):
            return data
        return super().to_internal_value(data)  # type: ignore


class ActivityActionSerializer(serializers.Serializer):
    kill_streak = serializers.IntegerField(default=0)
    start_time = serializers.DateTimeField(allow_null=True, required=False)
    end_time = serializers.DateTimeField(allow_null=True, required=False)
    next_time = serializers.DateTimeField(allow_null=True, required=False)


class StatModifierSerializer(serializers.Serializer):
    attack = serializers.IntegerField()
    defense = serializers.IntegerField()
    speed = serializers.IntegerField()


class SpawnEnemySerializer(serializers.Serializer):
    level = serializers.IntegerField()
    stat_modifier = StatModifierSerializer()


class BuffSerializer(serializers.Serializer):
    stat = serializers.ChoiceField(
        choices=[("attack", "Attack"), ("defense", "Defense"), ("speed", "Speed")]
    )
    amount = serializers.IntegerField()

    # drf uses ``label`` as a standard keyword arg which collides with this
    #  during typechecking
    label = serializers.CharField()  # type: ignore


class ResourceRefSerializer(serializers.Serializer):
    klass = serializers.CharField()
    pk = serializers.IntegerField()


class ActivityResponseSerializer(serializers.Serializer):
    # Success field isn't really necessary, should use HTTP return codes
    #  to indicate failures/success state
    success = serializers.BooleanField()
    error = serializers.CharField(allow_null=True)
    game = GameStateSerializer(allow_null=True)
    messages = serializers.ListField(child=serializers.CharField())
    spawn_enemy = SpawnEnemySerializer(allow_null=True)
    hero_buffs = BuffSerializer(many=True)
    pending_heal = serializers.BooleanField()
    pending_fatigue = serializers.BooleanField()
    resource_ref = ResourceRefSerializer(allow_null=True)


class ErrorResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    error = serializers.CharField()
