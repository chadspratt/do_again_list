from django.urls import path

from . import views

urlpatterns = [
    path('', views.dashboard, name='do_again_dashboard'),
    path('create-event/', views.create_event, name='do_again_create_event'),
    path('event/<int:event_id>/update/', views.update_event, name='do_again_update_event'),
    path('event/<int:event_id>/delete/', views.delete_event, name='do_again_delete_event'),
    path('event/<int:event_id>/settings/', views.update_event_settings, name='do_again_update_event_settings'),
]
