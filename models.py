from django.db import models


class PastEvents(models.Model):
    class Meta:
        db_table = 'past_events'
        ordering = ['-end_time']

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)
    ordering = models.IntegerField(default=0)
    default_duration = models.IntegerField(default=0)
    min_time_between_events = models.CharField(max_length=50, blank=True, default='')

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