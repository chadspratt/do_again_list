from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='do_again_index'),
    path('api/events/', views.api_events, name='do_again_api_events'),
    path('api/events/create/', views.api_create_event, name='do_again_api_create_event'),
    path('api/events/<int:event_id>/update/', views.api_update_event, name='do_again_api_update_event'),
    path('api/events/<int:event_id>/delete/', views.api_delete_event, name='do_again_api_delete_event'),
    path('api/events/<int:event_id>/settings/', views.api_update_event_settings, name='do_again_api_update_event_settings'),
    path('api/game/', views.api_game_state, name='do_again_api_game_state'),
    path('api/game/distance/', views.api_report_distance, name='do_again_api_report_distance'),
]
