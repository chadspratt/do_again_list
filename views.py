import json

from django.db.models import F
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from .models import GameState, HistoricalEvent, PastEvents


def _get_game_state():
    """Get or create the singleton game state."""
    state, _ = GameState.objects.get_or_create(id=1)
    return state


def _game_state_dict(state):
    return {
        'xp': state.xp,
        'gold': state.gold,
        'level': state.level,
        'base_attack': state.base_attack,
        'base_defense': state.base_defense,
        'base_speed': state.base_speed,
        'total_attack': state.total_attack(),
        'total_defense': state.total_defense(),
        'total_speed': state.total_speed(),
        'xp_to_next_level': state.xp_to_next_level(),
        'best_distance': state.best_distance,
        'streak': state.streak,
        'items': state.items,
    }


@ensure_csrf_cookie
def index(request):
    """Serve the React SPA."""
    return render(request, 'do_again_list/index.html')


@ensure_csrf_cookie
@require_GET
def api_events(request):
    """Return all events as JSON."""
    events = PastEvents.objects.order_by(
        F('end_time').desc(nulls_first=True)
    )
    data = [
        {
            'id': e.id,
            'title': e.title,
            'start_time': e.start_time.isoformat() if e.start_time else None,
            'end_time': e.end_time.isoformat() if e.end_time else None,
            'default_duration': e.default_duration,
            'min_duration': e.min_duration,
            'max_duration': e.max_duration,
            'min_time_between_events': e.min_time_between_events,
            'max_time_between_events': e.max_time_between_events,
        }
        for e in events
    ]
    return JsonResponse(data, safe=False)


@require_POST
def api_create_event(request):
    """Create a new event from JSON body."""
    try:
        data = json.loads(request.body)
        title = data.get('title', '').strip()
        date_str = data.get('date', '').strip()
        if not title or not date_str:
            return JsonResponse({'success': False, 'error': 'Title and date are required.'})
        from dateutil import parser
        event_date = parser.isoparse(date_str)
        event = PastEvents.objects.create(title=title, start_time=event_date)

        # Game reward: +1 base attack for creating an event type
        state = _get_game_state()
        state.base_attack += 1
        state.add_xp(25)
        state.save()

        return JsonResponse({'success': True, 'id': event.id, 'game': _game_state_dict(state)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def api_update_event(request, event_id):
    """Update an event's times. Supports 'start' and 'end' actions."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        action = data.get('action', 'end')

        from dateutil import parser as dt_parser

        ms_since_last_event = 0
        # Only archive if the event already has an end_time set
        if event.end_time is not None:
            ms_since_last_event = (timezone.now() - event.end_time).total_seconds() * 1000
            HistoricalEvent.objects.create(
                past_event=event,
                start_time=event.start_time,
                end_time=event.end_time,
            )

        # Update start_time unless this is an open event with no end_time
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

        # Game rewards based on action and timing
        state = _get_game_state()
        game_messages = []
        spawn_enemy = None
        hero_buffs = []

        from .utils import parse_time_offset_ms
        xp_to_award = 15
        gold_to_award = 5

        # Check time_between_events adherence and compute enemy level
        if ms_since_last_event != 0:
            min_interval_ms = parse_time_offset_ms(event.min_time_between_events)
            max_interval_ms = parse_time_offset_ms(event.max_time_between_events)
            min_is_good = min_interval_ms == 0 or ms_since_last_event >= min_interval_ms
            max_is_good = max_interval_ms == 0 or ms_since_last_event <= max_interval_ms
            if max_is_good:
                state.streak += 1
                game_messages.append(f'On schedule! Streak: {state.streak}')
            else:
                state.streak = 0
                game_messages.append('Off schedule — streak reset, enemies get tougher!')

            # Buffs based on time_between_events
            if min_is_good and max_is_good:
                hero_buffs.append({'stat': 'defense', 'amount': 2, 'label': 'On Schedule'})
                hero_buffs.append({'stat': 'speed', 'amount': 1, 'label': 'On Schedule'})
                game_messages.append('Buff: +2 defense, +1 speed (On Schedule)')
            elif max_is_good:
                hero_buffs.append({'stat': 'defense', 'amount': 1, 'label': 'Within Max'})
                game_messages.append('Buff: +1 defense (Within Max Time)')

        if action == 'start':
            xp_to_award += 10
        elif action == 'end':
            # Compute enemy level from ms_since_last_event
            # Base level 1, +1 per hour since last event, capped at level scaling
            if ms_since_last_event > 0:
                hours_since = ms_since_last_event / 3_600_000
                enemy_level = max(1, min(50, int(1 + hours_since)))
            else:
                enemy_level = 1
            spawn_enemy = {'level': enemy_level}

            # Duration-based rewards and buffs
            duration_ms = (event.end_time - event.start_time).total_seconds() * 1000
            min_dur_ms = parse_time_offset_ms(event.min_duration)
            max_dur_ms = parse_time_offset_ms(event.max_duration)

            max_is_good = max_dur_ms == 0 or duration_ms <= max_dur_ms
            min_is_good = min_dur_ms == 0 or duration_ms >= min_dur_ms
            if min_is_good:
                game_messages.append('Went the distance! +10 gold, +5 XP')
                xp_to_award += 5
                gold_to_award += 10
                hero_buffs.append({'stat': 'attack', 'amount': 2, 'label': 'Went Distance'})
            if max_is_good:
                game_messages.append('Stopped on time! +10 gold, +5 XP')
                xp_to_award += 5
                gold_to_award += 10
                hero_buffs.append({'stat': 'attack', 'amount': 1, 'label': 'On Time'})
                if min_is_good:
                    game_messages.append('Perfect timing! Bonus +5 gold, +5 XP, heal!')
                    xp_to_award += 5
                    gold_to_award += 5
                    hero_buffs.append({'stat': 'defense', 'amount': 2, 'label': 'Perfect'})
            elif not max_is_good:
                # Overtime: fatigue instead of buffs
                game_messages.append('Overtime — hero takes fatigue damage!')

        msgs = state.add_xp(xp_to_award)
        state.gold += gold_to_award
        game_messages.extend(msgs)

        state.save()

        return JsonResponse({
            'success': True,
            'game': _game_state_dict(state),
            'game_messages': game_messages,
            'spawn_enemy': spawn_enemy,
            'hero_buffs': hero_buffs,
            'pending_heal': action == 'end' and spawn_enemy is not None
                and parse_time_offset_ms(event.min_duration) > 0
                and parse_time_offset_ms(event.max_duration) > 0
                and (event.end_time - event.start_time).total_seconds() * 1000 >= parse_time_offset_ms(event.min_duration)
                and (event.end_time - event.start_time).total_seconds() * 1000 <= parse_time_offset_ms(event.max_duration),
            'pending_fatigue': action == 'end' and spawn_enemy is not None
                and parse_time_offset_ms(event.max_duration) > 0
                and (event.end_time - event.start_time).total_seconds() * 1000 > parse_time_offset_ms(event.max_duration),
        })
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def api_delete_event(request, event_id):
    """Delete an event."""
    try:
        event = get_object_or_404(PastEvents, id=event_id)
        event.delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@require_POST
def api_update_event_settings(request, event_id):
    """Update timing settings for an event."""
    try:
        data = json.loads(request.body)
        event = get_object_or_404(PastEvents, id=event_id)
        fields = []
        if 'default_duration' in data:
            event.default_duration = int(data['default_duration'])
            fields.append('default_duration')
        if 'min_duration' in data:
            event.min_duration = data['min_duration'].strip()
            fields.append('min_duration')
        if 'max_duration' in data:
            event.max_duration = data['max_duration'].strip()
            fields.append('max_duration')
        if 'min_time_between_events' in data:
            event.min_time_between_events = data['min_time_between_events'].strip()
            fields.append('min_time_between_events')
        if 'max_time_between_events' in data:
            event.max_time_between_events = data['max_time_between_events'].strip()
            fields.append('max_time_between_events')
        if fields:
            event.save(update_fields=fields)

        # Game reward: +10 XP for configuring settings
        state = _get_game_state()
        state.add_xp(10)
        state.save()

        return JsonResponse({'success': True, 'game': _game_state_dict(state)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})


@ensure_csrf_cookie
@require_GET
def api_game_state(request):
    """Return the current game state."""
    state = _get_game_state()
    return JsonResponse(_game_state_dict(state))


@require_POST
def api_report_distance(request):
    """Report a run distance from the client and update best distance."""
    try:
        data = json.loads(request.body)
        distance = int(data.get('distance', 0))
        state = _get_game_state()
        if distance > state.best_distance:
            state.best_distance = distance
            state.save(update_fields=['best_distance'])
            return JsonResponse({'success': True, 'new_record': True, 'best_distance': state.best_distance})
        return JsonResponse({'success': True, 'new_record': False, 'best_distance': state.best_distance})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

