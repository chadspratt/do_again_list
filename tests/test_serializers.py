import datetime
from unittest.mock import Mock

from rest_framework import serializers

from do_again_list import serializers as s


class TestHumanReadableDurationField:
    def test_parse(self):
        class TestSerializer(serializers.Serializer):
            human_readable_duration = s.HumanReadableDurationField()

        serializer = TestSerializer(data={"human_readable_duration": "2d1.5h25.25m40s"})
        serializer.is_valid(raise_exception=True)
        assert serializer.validated_data[
            "human_readable_duration"
        ] == datetime.timedelta(days=2, hours=1.5, minutes=25.25, seconds=40)

    def test_serialize(self):
        class TestSerializer(serializers.Serializer):
            human_readable_duration = s.HumanReadableDurationField()

        mock = Mock()
        mock.human_readable_duration = datetime.timedelta(days=2, seconds=9655)

        serializer = TestSerializer(mock)
        assert serializer.data["human_readable_duration"] == "2d2h40m55s"
