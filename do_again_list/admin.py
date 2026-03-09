from django.contrib import admin

from .models import Activity, Occurance


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("title", "ordering")
    list_editable = ("ordering",)
    search_fields = ("title",)


@admin.register(Occurance)
class OccuranceAdmin(admin.ModelAdmin):
    list_display = ("activity", "start_time")
    list_filter = ("activity",)
    ordering = ("-start_time",)
    date_hierarchy = "start_time"
    readonly_fields = ("start_time",)
