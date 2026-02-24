from django.db import models


class PastEvents(models.Model):
    class Meta:
        db_table = 'past_events'
        ordering = ['-end_time']

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    ordering = models.IntegerField(default=0)
    default_duration = models.IntegerField(default=0)
    min_duration = models.CharField(max_length=50, blank=True, default='')
    max_duration = models.CharField(max_length=50, blank=True, default='')
    min_time_between_events = models.CharField(max_length=50, blank=True, default='')
    max_time_between_events = models.CharField(max_length=50, blank=True, default='')
    value = models.FloatField(default=1.0)

    def __str__(self):
        return f"{self.title} on {self.end_time}"
    
class HistoricalEvent(models.Model):
    class Meta:
        db_table = 'historical_event'
        ordering = ['-end_time']

    id = models.AutoField(primary_key=True)
    past_event = models.ForeignKey(PastEvents, on_delete=models.CASCADE, related_name='history')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.past_event.title} on {self.end_time}"


class GameState(models.Model):
    class Meta:
        db_table = 'game_state'

    id = models.AutoField(primary_key=True)
    xp = models.IntegerField(default=0)
    gold = models.IntegerField(default=0)
    level = models.IntegerField(default=1)
    base_attack = models.IntegerField(default=1)
    base_defense = models.IntegerField(default=0)
    base_speed = models.IntegerField(default=1)
    best_distance = models.IntegerField(default=0)
    streak = models.IntegerField(default=0)
    items = models.JSONField(default=list)
    hero_hp = models.IntegerField(default=-1)  # -1 = not persisted yet, use full HP

    def total_attack(self):
        return self.base_attack + self.level

    def total_defense(self):
        return self.base_defense + (self.level // 2)

    def total_speed(self):
        return self.base_speed + max(0, self.streak // 3)

    def xp_to_next_level(self):
        return self.level * 100

    def add_xp(self, amount):
        """Add XP and auto-level-up. Returns list of level-up messages."""
        self.xp += amount
        messages = []
        while self.xp >= self.xp_to_next_level():
            self.xp -= self.xp_to_next_level()
            self.level += 1
            messages.append(f'Level up! Now level {self.level}')
        return messages

    def __str__(self):
        return f"GameState Lv{self.level} ATK:{self.total_attack()} DEF:{self.total_defense()}"