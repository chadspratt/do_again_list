from django.db import models


class PastEvents(models.Model):
    class Meta:
        db_table = 'past_events'
        ordering = ['-date']

    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    date = models.DateTimeField()
    ordering = models.IntegerField(default=0)

    def __str__(self):
        return f"{self.title} on {self.date}"
    
class HistoricalEvent(models.Model):
    class Meta:
        db_table = 'historical_event'
        ordering = ['-date']

    id = models.AutoField(primary_key=True)
    past_event = models.ForeignKey(PastEvents, on_delete=models.CASCADE, related_name='history')
    date = models.DateTimeField()

    def __str__(self):
        return f"{self.past_event.title} on {self.date}"