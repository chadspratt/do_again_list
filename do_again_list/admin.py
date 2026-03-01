from django.contrib import admin

from .models import HistoricalEvent, PastEvent


@admin.register(PastEvent)
class PastEventAdmin(admin.ModelAdmin):
    list_display = ("title", "start_time", "ordering")
    list_editable = ("ordering",)
    ordering = ("-start_time",)
    search_fields = ("title",)
    date_hierarchy = "start_time"


@admin.register(HistoricalEvent)
class HistoricalEventAdmin(admin.ModelAdmin):
    list_display = ("past_event", "start_time")
    list_filter = ("past_event",)
    ordering = ("-start_time",)
    date_hierarchy = "start_time"
    readonly_fields = ("start_time",)
