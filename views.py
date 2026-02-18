import json
from datetime import datetime

from django.contrib import messages
from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import HistoricalEvent, PastEvents


def dashboard(request):
    """Main page: show all past events."""
    events = PastEvents.objects.order_by(
        F('end_time').desc(nulls_first=True)
    )
    
    return render(request, 'do_again_list/dashboard.html', {
        'events': events,
    })


def create_event(request):
    """Create a new past event."""
    if request.method == 'POST':
        title = request.POST.get('title', '').strip()
        date_str = request.POST.get('date', '').strip()
        
        if title and date_str:
            try:
                # Parse ISO format from JavaScript
                from dateutil import parser
                event_date = parser.isoparse(date_str)
                PastEvents.objects.create(title=title, start_time=event_date)
                messages.success(request, 'Event added.')
            except (ValueError, Exception) as e:
                messages.error(request, f'Invalid date format: {e}')
        else:
            messages.error(request, 'Title and date are required.')
    
    return redirect('/do_again/')


@require_POST
def update_event(request, event_id):
    """Update an event's times. Supports 'start' and 'end' actions."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        action = data.get('action', 'end')

        from dateutil import parser as dt_parser

        # Only archive if the event already has an end_time set
        if event.end_time is not None:
            HistoricalEvent.objects.create(
                past_event=event,
                start_time=event.start_time,
                end_time=event.end_time,
            )

        # Update start_time from the provided datetime, unless this is an
        # open event that has no end_time yet.
        if event.end_time is not None:
            event.start_time = dt_parser.isoparse(data['datetime'])

        # Determine end_time
        end_time_str = data.get('end_datetime', '').strip()
        if end_time_str:
            event.end_time = dt_parser.isoparse(end_time_str)
        elif action == 'start':
            event.end_time = None
        else:  # action == 'end'
            event.end_time = timezone.now()

        event.save()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def delete_event(request, event_id):
    """Delete an event."""
    try:
        event = get_object_or_404(PastEvents, id=event_id)
        event.delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def set_default_duration(request, event_id):
    """Update the default_duration (minutes) for an event."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        event.default_duration = int(data.get('default_duration', 0))
        event.save(update_fields=['default_duration'])
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def set_min_time(request, event_id):
    """Update the min_time_between_events for an event."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        event.min_time_between_events = data.get('min_time_between_events', '').strip()
        event.save(update_fields=['min_time_between_events'])
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

