from typing import TYPE_CHECKING
import datetime
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone

if TYPE_CHECKING:
    from django_stubs_ext.db.models.manager import RelatedManager


class Activity(models.Model):
    class MoralQuality(models.TextChoices):
        GOOD = "good"
        BAD = "bad"
        NEUTRAL = "neutral"

    class State(models.TextChoices):
        PENDING = "pending"
        ACTIVE = "active"
        INACTIVE = "inactive"

    owner = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    is_built_in = models.BooleanField(
        default=False,
        help_text="If True, this activity is a built-in that is automatically managed by the app.",
    )
    title = models.CharField(max_length=255)
    display_name = models.CharField(max_length=255, blank=True)
    code_name = models.CharField(max_length=255, null=True, blank=True)
    ordering = models.IntegerField(default=0)
    default_duration = models.DurationField(default=datetime.timedelta(0))
    next_time = models.DateTimeField(null=True, blank=True)
    min_duration = models.DurationField(blank=True, null=True)
    max_duration = models.DurationField(blank=True, null=True)
    max_time_between_events = models.DurationField(blank=True, null=True)
    min_time_between_events = models.DurationField(blank=True, null=True)
    value = models.FloatField(default=1.0)
    repeats = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        if not self.display_name:
            self.display_name = self.title
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} ({self.state})"

    if TYPE_CHECKING:
        occurances: RelatedManager["Occurance"]

    @property
    def state(self) -> State:
        if self.occurances.all().count() == 0:
            return self.__class__.State.PENDING
        if self.occurances.filter(end_time__isnull=True).exists():
            # at least one occurance has started and not ended
            return self.__class__.State.ACTIVE
        return self.__class__.State.INACTIVE

    @property
    def moral_quality(self) -> MoralQuality:
        has_max = self.max_time_between_events is not None
        has_min = self.min_time_between_events is not None

        if has_max and not has_min:
            return self.__class__.MoralQuality.GOOD
        elif has_min and not has_max:
            return self.__class__.MoralQuality.BAD
        return self.__class__.MoralQuality.NEUTRAL


class Occurance(models.Model):
    class Meta:
        ordering = ["-end_time"]

    activity = models.ForeignKey(
        Activity, on_delete=models.CASCADE, related_name="occurances"
    )
    planned_time = models.DateTimeField(null=True, blank=True)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.activity.title} on {self.end_time}"


class GameState(models.Model):
    owner = models.OneToOneField(get_user_model(), on_delete=models.PROTECT)

    xp = models.IntegerField(default=0)
    gold = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    base_attack = models.IntegerField(default=1)
    base_defense = models.IntegerField(default=0)
    base_speed = models.IntegerField(default=1)
    streak = models.IntegerField(default=0)
    items = models.JSONField(default=list)
    hero_hp = models.IntegerField(default=-1)  # -1 = not persisted yet, use full HP

    # ── Prestige / meta-progression ──
    # souls persists forever; gold/xp/level/items are wiped on run-over.
    souls = models.IntegerField(default=0)
    perm_attack = models.IntegerField(default=0)   # levels of permanent attack bonus
    perm_defense = models.IntegerField(default=0)  # levels of permanent defense bonus
    perm_speed = models.IntegerField(default=0)    # levels of permanent speed bonus
    perm_hp = models.IntegerField(default=0)       # levels of permanent HP bonus (+10 HP each)

    # ── Quest system ──
    quest_tokens = models.IntegerField(default=0)  # earned by completing activities

    # ── Computed stats ──

    def total_attack(self):
        return self.base_attack + self.level + self.perm_attack

    def total_defense(self):
        return self.base_defense + (self.level // 2) + self.perm_defense

    def total_speed(self):
        return self.base_speed + max(0, self.streak // 3) + self.perm_speed

    def max_hp(self):
        """Hero's maximum HP for this run, including permanent bonus."""
        return 100 + self.level * 10 + self.perm_hp * 10

    def xp_to_next_level(self):
        return self.level * 100

    def souls_for_run(self):
        """Calculate souls earned at end of run from current XP + level."""
        return max(1, (self.level - 1) * 5 + self.xp // 20)

    @staticmethod
    def upgrade_cost(current_level: int) -> int:
        """Soul cost to buy the next level of a permanent upgrade."""
        return (current_level + 1) * 10

    def add_xp(self, amount):
        """Add XP and auto-level-up. Returns list of level-up messages."""
        self.xp += amount
        messages = []
        while self.xp >= self.xp_to_next_level():
            self.xp -= self.xp_to_next_level()
            self.level += 1
            messages.append(f"Level up! Now level {self.level}")
        return messages

    def __str__(self):
        return f"GameState Lv{self.level} ATK:{self.total_attack()} DEF:{self.total_defense()}"
