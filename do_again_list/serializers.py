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
            "display_name",
            "code_name",
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
    max_hp = serializers.SerializerMethodField()

    class Meta:
        model = models.GameState
        exclude = ("owner",)

    def get_max_hp(self, obj: models.GameState | dict) -> int:
        if isinstance(obj, dict):
            return obj.get("max_hp", 100)
        return obj.max_hp()

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


class RunOverResponseSerializer(serializers.Serializer):
    """Response body for POST /game/run_over/."""
    game = GameStateSerializer()
    souls_earned = serializers.IntegerField()


class MetaUpgradeSerializer(serializers.Serializer):
    """Request body for POST /game/meta_upgrade/."""
    upgrade = serializers.ChoiceField(choices=["attack", "defense", "speed", "hp"])


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


# ─── Import / Export ─────────────────────────────────────────────────────────


class OccuranceImportSerializer(serializers.Serializer):
    planned_time = serializers.DateTimeField(allow_null=True, required=False)
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(allow_null=True, required=False)


class ActivityImportSerializer(serializers.Serializer):
    def validate_default_duration(self, value):
        # default_duration is non-nullable on the model; treat null as zero duration
        return value if value is not None else datetime.timedelta(0)

    title = serializers.CharField(max_length=255)
    display_name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    code_name = serializers.CharField(max_length=255, allow_null=True, required=False, default=None)
    ordering = serializers.IntegerField(default=0)
    default_duration = HumanReadableDurationField(allow_null=True, required=False)
    next_time = serializers.DateTimeField(allow_null=True, required=False)
    min_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_time_between_events = HumanReadableDurationField(allow_null=True, required=False)
    min_time_between_events = HumanReadableDurationField(allow_null=True, required=False)
    value = serializers.FloatField(default=1.0)
    repeats = serializers.BooleanField(default=True)
    is_built_in = serializers.BooleanField(default=False)
    occurances = OccuranceImportSerializer(many=True, required=False, default=list)


class GameStateImportSerializer(serializers.Serializer):
    xp = serializers.IntegerField(default=0)
    gold = serializers.IntegerField(default=0)
    level = serializers.IntegerField(default=1)
    base_attack = serializers.IntegerField(default=1)
    base_defense = serializers.IntegerField(default=0)
    base_speed = serializers.IntegerField(default=1)
    streak = serializers.IntegerField(default=0)
    items = serializers.ListField(default=list)
    hero_hp = serializers.IntegerField(default=-1)
    souls = serializers.IntegerField(default=0)
    perm_attack = serializers.IntegerField(default=0)
    perm_defense = serializers.IntegerField(default=0)
    perm_speed = serializers.IntegerField(default=0)
    perm_hp = serializers.IntegerField(default=0)
    quest_tokens = serializers.IntegerField(default=0)


class DataImportSerializer(serializers.Serializer):
    """
    Payload for POST /api/data/import/.

    ``activities`` are merged by title: existing activities are updated,
    unknown ones are created.  Occurrences are deduplicated by start_time.
    ``game_state`` fully replaces the current run-state when provided.
    """
    version = serializers.IntegerField(default=1)
    activities = ActivityImportSerializer(many=True, required=False, default=list)
    game_state = GameStateImportSerializer(required=False, allow_null=True, default=None)


class OccuranceExportSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Occurance
        fields = ("planned_time", "start_time", "end_time")


class ActivityExportSerializer(serializers.ModelSerializer):
    default_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_duration = HumanReadableDurationField(allow_null=True, required=False)
    min_duration = HumanReadableDurationField(allow_null=True, required=False)
    max_time_between_events = HumanReadableDurationField(allow_null=True, required=False)
    min_time_between_events = HumanReadableDurationField(allow_null=True, required=False)
    occurances = OccuranceExportSerializer(many=True, read_only=True)

    class Meta:
        model = models.Activity
        fields = (
            "title",
            "display_name",
            "code_name",
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
            "occurances",
        )


class DataExportSerializer(serializers.Serializer):
    version = serializers.IntegerField()
    exported_at = serializers.DateTimeField()
    user = serializers.DictField(child=serializers.CharField())
    activities = ActivityExportSerializer(many=True)
    game_state = GameStateSerializer(allow_null=True)


class DataImportResultSerializer(serializers.Serializer):
    activities_created = serializers.IntegerField()
    activities_updated = serializers.IntegerField()
    occurances_added = serializers.IntegerField()
    game_state_updated = serializers.BooleanField()
