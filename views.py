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
        'streak': state.streak,
        'items': state.items,
        'hero_hp': state.hero_hp,
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
            'value': e.value,
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
        gold_to_award = 5

        # Classify event: good / bad / neutral
        min_interval_ms = parse_time_offset_ms(event.min_time_between_events)
        max_interval_ms = parse_time_offset_ms(event.max_time_between_events)
        has_min = min_interval_ms > 0
        has_max = max_interval_ms > 0

        if has_max and not has_min:
            event_kind = 'good'
        elif has_min and not has_max:
            event_kind = 'bad'
        else:
            event_kind = 'neutral'

        # Timing compliance (only meaningful when we have a previous end_time)
        min_ok = not has_min or ms_since_last_event >= min_interval_ms
        max_ok = not has_max or ms_since_last_event <= max_interval_ms
        # First-ever occurrence counts as compliant
        if ms_since_last_event == 0:
            min_ok = True
            max_ok = True

        if action == 'start':
            pass  # no reward on start
        elif action == 'end':
            # Enemy level based on current kill streak sent by client
            kill_streak = int(data.get('kill_streak', 0))
            enemy_level = (kill_streak // 3) + 1

            # ── Compute stat delta based on event kind + timing ──
            delta = {'attack': 0, 'defense': 0, 'speed': 0}

            if event_kind == 'good':
                if max_ok:
                    # On time: full reward
                    delta = {'attack': 3, 'defense': 2, 'speed': 1}
                    gold_to_award += 15
                    game_messages.append(f'Good habit on time!')
                else:
                    # Late: smaller reward
                    delta = {'attack': 1, 'defense': 1, 'speed': 0}
                    gold_to_award += 5
                    game_messages.append('Good habit but late — reduced reward.')

            elif event_kind == 'bad':
                if not min_ok:
                    # Too soon: larger penalty
                    delta = {'attack': -3, 'defense': -2, 'speed': -1}
                    gold_to_award = 0
                    game_messages.append('Bad habit too soon! Large penalty.')
                else:
                    # Waited long enough: smaller penalty
                    delta = {'attack': -1, 'defense': -1, 'speed': 0}
                    gold_to_award += 5
                    game_messages.append('Bad habit, but you held off — minor penalty.')

            else:  # neutral
                if min_ok and max_ok:
                    # Fully compliant
                    delta = {'attack': 2, 'defense': 1, 'speed': 1}
                    gold_to_award += 10
                    game_messages.append(f'Neutral event on schedule!')
                else:
                    # Violated a bound
                    delta = {'attack': 1, 'defense': 0, 'speed': 0}
                    gold_to_award += 3
                    game_messages.append('Neutral event but timing was off — reduced reward.')

            # Hero buffs (positive deltas) and debuffs (negative deltas)
            buff_parts = []
            for stat, amount in delta.items():
                if amount != 0:
                    label = (
                        f"{event_kind.title()}"
                        f"{' (on time)' if event_kind == 'good' and max_ok else ''}"
                        f"{' (held off)' if event_kind == 'bad' and min_ok else ''}"
                    )
                    hero_buffs.append({'stat': stat, 'amount': amount, 'label': label})
                    
                    if amount > 0:
                        buff_parts.append(f'+{amount} {stat}')
                    elif amount < 0:
                        buff_parts.append(f'{amount} {stat}')

            # Enemy stat modifier is the opposite of hero delta
            enemy_stat_mod = {
                'attack': -delta['attack'],
                'defense': -delta['defense'],
                'speed': -delta['speed'],
            }
            spawn_enemy = {
                'level': enemy_level,
                'stat_modifier': enemy_stat_mod,
            }

            # Describe what happened
            if buff_parts:
                game_messages.append('Hero: ' + ', '.join(buff_parts))

        msgs = []
        state.gold += gold_to_award
        game_messages.extend(msgs)

        state.save()

        return JsonResponse({
            'success': True,
            'game': _game_state_dict(state),
            'game_messages': game_messages,
            'spawn_enemy': spawn_enemy,
            'hero_buffs': hero_buffs,
            'pending_heal': action == 'end' and event_kind == 'good' and max_ok,
            'pending_fatigue': action == 'end' and event_kind == 'bad' and not min_ok,
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
        if 'value' in data:
            event.value = float(data['value'])
            fields.append('value')
        if fields:
            event.save(update_fields=fields)

        # No XP reward for configuring settings
        state = _get_game_state()
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
def api_sync_battle(request):
    """Sync battle results (gold earned, xp earned, current streak) to the game state."""
    try:
        data = json.loads(request.body)
        gold = max(0, int(data.get('gold', 0)))
        xp = max(0, int(data.get('xp', 0)))
        streak = max(0, int(data.get('streak', 0)))
        hero_hp = int(data.get('hero_hp', -1))
        state = _get_game_state()
        state.gold += gold
        state.streak = streak
        state.hero_hp = hero_hp
        state.add_xp(xp)
        state.save()
        return JsonResponse({'success': True, 'game': _game_state_dict(state)})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

