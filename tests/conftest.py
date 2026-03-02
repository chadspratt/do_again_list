from django.contrib.auth import get_user_model
from do_again_list import models
import pytest


@pytest.fixture
def user_factory(db):
    resource_model = get_user_model()
    resources = []

    def _factory(username="test-user", email="test@us.er", **kwargs):
        resource, _ = resource_model.objects.get_or_create(
            username=username, email=email, **kwargs
        )
        resources.append(resource)
        return resource

    yield _factory
    for resource in resources:
        try:
            resource.delete()
        except resource_model.DoesNotExist:
            pass


@pytest.fixture
def user(user_factory):
    return user_factory()


@pytest.fixture
def past_event_factory(user):
    resource_model = models.PastEvent
    resources = []

    def _factory(owner=user, **kwargs):
        resource, _ = resource_model.objects.get_or_create(owner=owner, **kwargs)
        resources.append(resource)
        return resource

    yield _factory
    for resource in resources:
        try:
            resource.delete()
        except resource_model.DoesNotExist:
            pass


@pytest.fixture
def past_event(past_event_factory, user_factory):
    return past_event_factory()


@pytest.fixture
def historical_event_factory(past_event):
    resource_model = models.HistoricalEvent
    resources = []

    def _factory(past_event=past_event, **kwargs):
        resource, _ = resource_model.objects.get_or_create(
            past_event=past_event, **kwargs
        )
        resources.append(resource)
        return resource

    yield _factory
    for resource in resources:
        try:
            resource.delete()
        except resource_model.DoesNotExist:
            pass


@pytest.fixture
def historical_event(historical_event_factory, past_event_factory):
    return historical_event_factory()
