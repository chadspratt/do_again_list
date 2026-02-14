import json
from datetime import datetime

from django.contrib import messages
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import HistoricalEvent, PastEvents


def dashboard(request):
    """Main page: show all past events."""
    events = PastEvents.objects.all()
    
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
                PastEvents.objects.create(title=title, date=event_date)
                messages.success(request, 'Event added.')
            except (ValueError, Exception) as e:
                messages.error(request, f'Invalid date format: {e}')
        else:
            messages.error(request, 'Title and date are required.')
    
    return redirect('/do_again/')


@require_POST
def update_event(request, event_id):
    """Update an event's date to specified time."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        
        # Save the old date to history before updating
        HistoricalEvent.objects.create(
            past_event=event,
            date=event.date
        )
        
        from dateutil import parser
        event.date = parser.isoparse(data['datetime'])
        event.save()
        return JsonResponse({'success': True})
        
        return JsonResponse({'success': False, 'error': 'Invalid request'})
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

