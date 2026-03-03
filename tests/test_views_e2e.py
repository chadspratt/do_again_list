import datetime
from django.utils import timezone
from do_again_list import models
from rest_framework.test import APIClient


class TestActivityViewSetE2E:
    def test_create_activity(
        self, user_api_client: APIClient, game_state: models.GameState
    ):
        starting_base_attack = game_state.base_attack
        response = user_api_client.post(
            f"/api/do-again/activities/",
            {"title": "test activity", "max_duration_between_events": "1h29m35s"},
        )
        print(response.text)
        assert response.status_code == 201
        assert response.json()["spawn_enemy"] is None
        game_state.refresh_from_db()
        assert game_state.base_attack == starting_base_attack + 1
        created_activity = models.Activity.objects.get(
            pk=response.json()["resource_ref"]["pk"]
        )
        assert created_activity.max_duration_between_events == datetime.timedelta(
            hours=1, minutes=29, seconds=35
        )
        created_activity.delete()

    def test_end_activity(
        self, user_api_client: APIClient, activity, occurance_factory, game_state
    ):
        occurance_factory(start_time=timezone.now())

        response = user_api_client.post(
            f"/api/do-again/activities/{activity.pk}/end/",
            {"at_time": timezone.now(), "kill_streak": 3},
        )
        print(response.text)
        assert response.status_code == 200
        assert response.json()["spawn_enemy"]["level"] == 2
