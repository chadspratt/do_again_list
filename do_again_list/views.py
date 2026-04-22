import json
from dataclasses import asdict
from typing import Any, cast

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
# from django.db.models.manager import BaseManager
from django.db.models.query import QuerySet
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST
from django_filters import rest_framework as filters
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from . import serializers, services
from .models import Activity, GameState, Occurance

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
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[Activity]:
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
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[Occurance]:
        user = self.request.user
        return Occurance.objects.filter(activity__owner=user)


class GameStateViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = GameState.objects.all()
    serializer_class = serializers.GameStateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self) -> QuerySet[GameState]:
        user = self.request.user
        return GameState.objects.filter(owner=user)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        game_state, created = GameState.objects.get_or_create(owner=request.user)
        data = serializers.GameStateSerializer(game_state).data
        # Signal the frontend to spawn a welcome enemy on first login
        data["spawn_first_enemy"] = created
        return Response([data])

    @action(detail=False, methods=["post"])
    def sync(self, request: Request) -> Response:
        """Sync battle results (gold earned, xp earned, current streak, hero HP)."""
        game_state, _ = GameState.objects.get_or_create(owner=request.user)
        gold = max(0, int(request.data.get("gold", 0))) # type: ignore
        xp = max(0, int(request.data.get("xp", 0))) # type: ignore
        streak = max(0, int(request.data.get("streak", 0))) # type: ignore
        hero_hp = int(request.data.get("hero_hp", -1)) # type: ignore
        quest_tokens = max(0, int(request.data.get("quest_tokens", 0))) # type: ignore
        game_state.gold += gold
        game_state.streak = streak
        game_state.hero_hp = hero_hp
        game_state.add_xp(xp)
        game_state.quest_tokens += quest_tokens
        game_state.save()
        return Response(serializers.GameStateSerializer(game_state).data)

    @action(detail=False, methods=["post"])
    def run_over(self, request: Request) -> Response:
        """End the current run: convert progress to souls, then wipe run-local state.

        Permanent fields (souls, perm_*) are preserved.
        Run-local fields (xp, gold, level, base_*, streak, items, hero_hp) are reset.
        """
        game_state, _ = GameState.objects.get_or_create(owner=request.user)
        souls_earned = game_state.souls_for_run()
        game_state.souls += souls_earned
        # Reset run-local state
        game_state.xp = 0
        game_state.gold = 0
        game_state.level = 1
        game_state.base_attack = 1
        game_state.base_defense = 0
        game_state.base_speed = 1
        game_state.streak = 0
        game_state.items = []
        game_state.hero_hp = -1
        game_state.save()
        serializer = serializers.RunOverResponseSerializer(
            data={"game": serializers.GameStateSerializer(game_state).data, "souls_earned": souls_earned}
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def accept_quest(self, request: Request) -> Response:
        """Spend quest tokens to accept a quest from the Jobs Board.

        Expects body: { "cost": <int> }
        Returns updated GameState.
        """
        game_state, _ = GameState.objects.get_or_create(owner=request.user)
        cost = max(1, int(request.data.get("cost", 1)))
        if game_state.quest_tokens < cost:
            return Response(
                {"error": f"Not enough quest tokens. Need {cost}, have {game_state.quest_tokens}."},
                status=400,
            )
        game_state.quest_tokens -= cost
        game_state.save()
        return Response(serializers.GameStateSerializer(game_state).data)

    @action(detail=False, methods=["post"])
    def meta_upgrade(self, request: Request) -> Response:
        """Spend souls on a permanent upgrade.

        Expects body: { \"upgrade\": \"attack\" | \"defense\" | \"speed\" | \"hp\" }
        """
        serializer = serializers.MetaUpgradeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upgrade: str = serializer.validated_data["upgrade"]

        field_map = {
            "attack": "perm_attack",
            "defense": "perm_defense",
            "speed": "perm_speed",
            "hp": "perm_hp",
        }
        game_state, _ = GameState.objects.get_or_create(owner=request.user)
        field_name = field_map[upgrade]
        current_level: int = getattr(game_state, field_name)
        cost = GameState.upgrade_cost(current_level)

        if game_state.souls < cost:
            return Response(
                {"error": f"Not enough souls. Need {cost}, have {game_state.souls}."},
                status=400,
            )

        game_state.souls -= cost
        setattr(game_state, field_name, current_level + 1)
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
        return JsonResponse({"success": True, "user": {"username": user.get_username()}})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)})


@ensure_csrf_cookie
@require_POST
def api_auth_logout(request):
    """Log out the current user."""
    logout(request)
    return JsonResponse({"success": True})


# ─── Import / Export ─────────────────────────────────────────────────────────


class DataImportExportView(viewsets.GenericViewSet):
    """
    GET  /api/data/export/  — download all user data as JSON
    POST /api/data/import/  — upload a previously-exported JSON blob to restore data
    """

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="export")
    def export_data(self, request: Request) -> Response:
        data = services.DataImportExportService().export(owner=request.user)
        serializer = serializers.DataExportSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="import")
    def import_data(self, request: Request) -> Response:
        serializer = serializers.DataImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = services.DataImportExportService().do_import(
            owner=request.user,
            validated_data=serializer.validated_data,
        )
        result_serializer = serializers.DataImportResultSerializer(
            data={
                "activities_created": result.activities_created,
                "activities_updated": result.activities_updated,
                "occurances_added": result.occurances_added,
                "game_state_updated": result.game_state_updated,
            }
        )
        result_serializer.is_valid(raise_exception=True)
        return Response(result_serializer.data)
