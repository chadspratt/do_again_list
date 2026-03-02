from rest_framework import serializers
from do_again_list import models
from do_again_list.utils import humanize_timedelta, parse_time_offset
from typing import cast

import datetime


class HumanReadableDurationField(serializers.DurationField):
    def __init__(self, **kwargs):
        kwargs.pop("format", None)
        kwargs.pop("allow_null", None)
        super().__init__(allow_null=True, **kwargs)

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
    max_duration_between_events = HumanReadableDurationField()
    min_duration_between_events = HumanReadableDurationField()

    class Meta:
        model = models.Activity
        fields = "__all__"


class OccuranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.Occurance
        fields = "__all__"


class GameStateSerializer(serializers.ModelSerializer):
    class Meta:
        model = models.GameState
        fields = "__all__"


class ActivityActionSerializer(serializers.Serializer):
    at_time = serializers.DateTimeField()


class StatModifierSerializer(serializers.Serializer):
    attack = serializers.IntegerField(read_only=True)
    defense = serializers.IntegerField(read_only=True)
    speed = serializers.IntegerField(read_only=True)


class SpawnEnemySerializer(serializers.Serializer):
    level = serializers.IntegerField(read_only=True)
    modifiers = StatModifierSerializer(read_only=True)


class ActivityResponseSerializer(serializers.Serializer):
    # Success field isn't really necessary, should use HTTP return codes
    #  to indicate failures/success state
    success = serializers.BooleanField(read_only=True)
    error = serializers.CharField(read_only=True, allow_null=True)
    game = GameStateSerializer(allow_null=True, read_only=True)
    messages = serializers.ListField(read_only=True, child=serializers.CharField())
    spawn_enemy = SpawnEnemySerializer(read_only=True)
    hero_buffs = StatModifierSerializer(read_only=True)
    pending_heal = serializers.BooleanField(read_only=True)
    pending_fatigue = serializers.BooleanField(read_only=True)


class ErrorResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField(read_only=True)
    error = serializers.CharField(read_only=True)
