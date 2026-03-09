from django.urls import path
from rest_framework import routers

from . import views

app_name = "do_again"

router = routers.SimpleRouter()
router.register(r"activities", views.ActivityViewSet)
router.register(r"occurances", views.OccuranceViewSet)
router.register(r"game", views.GameStateViewSet)

# === LEGACY === #

urlpatterns = [
    path("api/auth/user/", views.api_auth_user, name="do_again_api_auth_user"),
    path(
        "api/auth/register/", views.api_auth_register, name="do_again_api_auth_register"
    ),
    path("api/auth/login/", views.api_auth_login, name="do_again_api_auth_login"),
    path("api/auth/logout/", views.api_auth_logout, name="do_again_api_auth_logout"),
]
