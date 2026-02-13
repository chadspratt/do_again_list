from django.contrib import admin

from .models import HistoricalEvent, PastEvents


@admin.register(PastEvents)
class PastEventsAdmin(admin.ModelAdmin):
    list_display = ('title', 'date', 'ordering')
    list_editable = ('ordering',)
    ordering = ('-date',)
    search_fields = ('title',)
    date_hierarchy = 'date'


@admin.register(HistoricalEvent)
class HistoricalEventAdmin(admin.ModelAdmin):
    list_display = ('past_event', 'date')
    list_filter = ('past_event',)
    ordering = ('-date',)
    date_hierarchy = 'date'
    readonly_fields = ('date',)

