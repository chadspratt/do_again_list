import datetime

from rest_framework import serializers

from do_again_list import models
from do_again_list.utils import humanize_timedelta, parse_time_offset


class HumanReadableDurationField(serializers.DurationField):
    def to_representation(self, value) -> str:
        # Setting `format=None` (as was done it `__init__`) causes
        # `to_representation` to return a `timedelta`
        # https://www.django-rest-framework.org/api-guide/fields/#durationfield
        # duration = cast(datetime.timedelta, super().to_representation(value))
        return humanize_timedelta(value)

    def to_internal_value(self, value) -> datetime.timedelta:
        internal = parse_time_offset(value)
        if internal is None:
            return datetime.timedelta()
        return internal


class ActivitySerializer(serializers.ModelSerializer):
    max_duration_between_events = HumanReadableDurationField(
        allow_null=True, required=False
    )
    min_duration_between_events = HumanReadableDurationField(
        allow_null=True, required=False
    )

    class Meta:
        model = models.Activity
        exclude = ("owner",)


class OccuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Occurance
        fields = "__all__"


class GameStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.GameState
        exclude = ("owner",)


class ActivityActionSerializer(serializers.Serializer):
    kill_streak = serializers.IntegerField(default=0)
    at_time = serializers.DateTimeField()


class StatModifierSerializer(serializers.Serializer):
    attack = serializers.IntegerField()
    defense = serializers.IntegerField()
    speed = serializers.IntegerField()


class SpawnEnemySerializer(serializers.Serializer):
    level = serializers.IntegerField()
    modifiers = StatModifierSerializer()


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
    hero_buffs = StatModifierSerializer()
    pending_heal = serializers.BooleanField()
    pending_fatigue = serializers.BooleanField()
    resource_ref = ResourceRefSerializer(allow_null=True)


class ErrorResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    error = serializers.CharField()
