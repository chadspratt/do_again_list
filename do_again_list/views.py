import json
from dataclasses import asdict
from typing import Any, cast

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models.manager import BaseManager
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from . import serializers, services
from .models import Activity, GameState, Occurance
from .utils import humanize_timedelta, parse_time_offset

# === Django Rest Framework Viewsets === #


class ActivityFilter(filters.FilterSet):
    """
    These can be refined a lot more, but first we should sort out the types
    and naming
    https://django-filter.readthedocs.io/en/stable/ref/filterset.html
    """

    class Meta:
        model = Activity
        fields = [
            "title",
            "default_duration",
            "min_duration",
            "max_duration",
            "min_time_between_events",
            "max_time_between_events",
            "value",
            "repeats",
        ]


class ActivityViewSet(viewsets.ModelViewSet):
    queryset = Activity.objects.all()
    serializer_class = serializers.ActivitySerializer
    filterset_class = ActivityFilter

    def get_queryset(self) -> BaseManager[Activity]: # type: ignore
        user = self.request.user
        return Activity.objects.filter(owner=user).prefetch_related("occurances")

    def _get_response_serializer(
        self, *, game_effect: services.GameEffect
    ) -> serializers.ActivityResponseSerializer:
        game_state, _ = GameState.objects.get_or_create(owner=self.request.user)
        game_state = services.GameStateService().update(
            game_state=game_state, game_effect=game_effect
        )
        serializer: serializers.ActivityResponseSerializer = cast(
            serializers.ActivityResponseSerializer,
            serializers.ActivityResponseSerializer(
                data={
                    "game": game_state,
                    "success": True,
                    "error": None,
                    "messages": game_effect.messages,
                    "spawn_enemy": asdict(game_effect.spawn_enemy)
                    if game_effect.spawn_enemy is not None
                    else None,
                    "hero_buffs": [asdict(buff) for buff in game_effect.hero_buffs],
                    "pending_heal": game_effect.pending_heal,
                    "pending_fatigue": game_effect.pending_fatigue,
                    "resource_ref": asdict(game_effect.resource_ref)
                    if game_effect.resource_ref is not None
                    else None,
                },
                context={},
            )
        )
        serializer.is_valid(raise_exception=True)
        return serializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """
        Override the default ``create`` behavior. The original implementation
        can be easily viewed at explored at:
        https://www.cdrf.co/3.16/rest_framework.viewsets/ModelViewSet.html#create
        """
        # parse and validate post body (and cast so that typehints chill out)
        serializer = cast(
            serializers.ActivitySerializer, self.get_serializer(data=request.data)
        )
        serializer.is_valid(raise_exception=True)
        try:
            # Do game action and get effects
            game_effect = services.ActivityService().create(
                serializer=serializer, owner=request.user
            )
            # send game response
            return Response(
                self._get_response_serializer(game_effect=game_effect).data,
                status=201,
            )
        except services.ActivityLifecycleException as exc:
            # send error response
            error_serializer = serializers.ErrorResponseSerializer(
                data={"success": False, "error": str(exc)}
            )
            error_serializer.is_valid(raise_exception=True)
            return Response(error_serializer.data, status=400)

    # --- Custom Actions --- #

    @extend_schema(
        responses={
            200: serializers.ActivityResponseSerializer,
            400: serializers.ErrorResponseSerializer,
        }
    )
    @action(
        detail=True,
        methods=["post"],
        serializer_class=serializers.ActivityActionSerializer,
    )
    def start(self, request, pk):
        return self._generic_activity_action(
            activity=self.get_object(),
            action="start",
            allowable_states=(
                Activity.State.INACTIVE,
                Activity.State.PENDING,
            ),
        )

    @extend_schema(
        responses={
            200: serializers.ActivityResponseSerializer,
            400: serializers.ErrorResponseSerializer,
        }
    )
    @action(
        detail=True,
        methods=["post"],
        serializer_class=serializers.ActivityActionSerializer,
    )
    def end(self, request, pk):
        return self._generic_activity_action(
            activity=self.get_object(),
            action="end",
            allowable_states=(
                Activity.State.ACTIVE,
                Activity.State.INACTIVE,
                Activity.State.PENDING,
            ),
        )

    @extend_schema(
        responses={
            200: serializers.ActivityResponseSerializer,
            400: serializers.ErrorResponseSerializer,
        }
    )
    @action(
        detail=True,
        methods=["post"],
        serializer_class=serializers.ActivityActionSerializer,
    )
    def set_next(self, request, pk):
        return self._generic_activity_action(
            activity=self.get_object(),
            action="set_next",
            allowable_states=(
                Activity.State.ACTIVE,
                Activity.State.INACTIVE,
                Activity.State.PENDING,
            ),
        )

    def _generic_activity_action(
        self,
        activity: Activity,
        action: str,
        allowable_states: tuple[Activity.State, ...],
    ) -> Response:
        if activity.state not in allowable_states:
            serializer = serializers.ErrorResponseSerializer(
                data={
                    "success": False,
                    "error": (
                        f"Cannot `{action}` for an activity in state `{activity.state}`"
                    ),
                }
            )
            serializer.is_valid(raise_exception=True)
            return Response(serializer.data, status=400)
        serializer = self.get_serializer(data=self.request.data) # type: ignore
        serializer.is_valid(raise_exception=True)
        try:
            game_effect = getattr(services.ActivityService(), action)(
                activity=activity, **serializer.validated_data
            )
            return Response(
                self._get_response_serializer(game_effect=game_effect).data,
            )
        except services.ActivityLifecycleException as exc:
            error_serializer = serializers.ErrorResponseSerializer(
                data={"success": False, "error": str(exc)}
            )
            error_serializer.is_valid(raise_exception=True)
            return Response(error_serializer.data, status=400)


class OccuranceFilter(filters.FilterSet):
    class Meta:
        model = Occurance
        fields = ["activity", "start_time", "end_time"]


class OccuranceViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Occurance.objects.all()
    serializer_class = serializers.OccuranceSerializer
    filterset_class = OccuranceFilter

    def get_queryset(self) -> BaseManager[Occurance]: # type: ignore
        user = self.request.user
        return Occurance.objects.filter(activity__owner=user)


class GameStateViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = GameState.objects.all()
    serializer_class = serializers.GameStateSerializer

    def get_queryset(self) -> BaseManager[GameState]: # type: ignore
        user = self.request.user
        return GameState.objects.filter(owner=user)

    @action(detail=False, methods=["post"])
    def sync(self, request: Request) -> Response:
        """Sync battle results (gold earned, xp earned, current streak, hero HP)."""
        game_state, _ = GameState.objects.get_or_create(owner=request.user)
        gold = max(0, int(request.data.get("gold", 0))) # type: ignore
        xp = max(0, int(request.data.get("xp", 0))) # type: ignore
        streak = max(0, int(request.data.get("streak", 0))) # type: ignore
        hero_hp = int(request.data.get("hero_hp", -1)) # type: ignore
        game_state.gold += gold
        game_state.streak = streak
        game_state.hero_hp = hero_hp
        game_state.add_xp(xp)
        game_state.save()
        return Response(serializers.GameStateSerializer(game_state).data)


# ─── Auth ────────────────────────────────────────────────────────────────────


@ensure_csrf_cookie
@require_GET
def api_auth_user(request):
    """Return the current user, or null if anonymous."""
    if request.user.is_authenticated:
        return JsonResponse({"user": {"username": request.user.username}})
    return JsonResponse({"user": None})


@ensure_csrf_cookie
@require_POST
def api_auth_register(request):
    """Create a new user account and log in."""
    try:
        data = json.loads(request.body)
        username = data.get("username", "").strip()
        password = data.get("password", "")
        if not username or not password:
            return JsonResponse(
                {"success": False, "error": "Username and password are required."}
            )
        if len(password) < 4:
            return JsonResponse(
                {"success": False, "error": "Password must be at least 4 characters."}
            )
        if User.objects.filter(username=username).exists():
            return JsonResponse({"success": False, "error": "Username already taken."})
        user = User.objects.create_user(username=username, password=password)
        login(request, user)
        return JsonResponse({"success": True, "user": {"username": user.username}})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)})


@ensure_csrf_cookie
@require_POST
def api_auth_login(request):
    """Log in with username/password."""
    try:
        data = json.loads(request.body)
        username = data.get("username", "").strip()
        password = data.get("password", "")
        user = authenticate(request, username=username, password=password)
        if user is None:
            return JsonResponse(
                {"success": False, "error": "Invalid username or password."}
            )
        login(request, user)
        return JsonResponse({"success": True, "user": {"username": user.username}})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)})


@ensure_csrf_cookie
@require_POST
def api_auth_logout(request):
    """Log out the current user."""
    logout(request)
    return JsonResponse({"success": True})
