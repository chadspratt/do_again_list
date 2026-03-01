from django.urls import path
from rest_framework import routers
from . import views

app_name = "do_again"

router = routers.SimpleRouter()
router.register(r"activities", views.ActivityViewSet)
router.register(r"occurances", views.OccuranceViewSet)
router.register(r"game", views.GameStateViewSet)

urlpatterns = [
    path("", views.index, name="do_again_index"),
    path("api/events/", views.api_events, name="do_again_api_events"),
    path(
        "api/events/create/", views.api_create_event, name="do_again_api_create_event"
    ),
    path(
        "api/events/<int:event_id>/update/",
        views.api_update_event,
        name="do_again_api_update_event",
    ),
    path(
        "api/events/<int:event_id>/delete/",
        views.api_delete_event,
        name="do_again_api_delete_event",
    ),
    path(
        "api/events/<int:event_id>/settings/",
        views.api_update_event_settings,
        name="do_again_api_update_event_settings",
    ),
    path("api/game/", views.api_game_state, name="do_again_api_game_state"),
    path("api/game/sync/", views.api_sync_battle, name="do_again_api_sync_battle"),
    path("api/auth/user/", views.api_auth_user, name="do_again_api_auth_user"),
    path(
        "api/auth/register/", views.api_auth_register, name="do_again_api_auth_register"
    ),
    path("api/auth/login/", views.api_auth_login, name="do_again_api_auth_login"),
    path("api/auth/logout/", views.api_auth_logout, name="do_again_api_auth_logout"),
]
