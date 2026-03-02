from collections.abc import Callable, Generator
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
def activity_factory(user):
    resource_model = models.Activity
    resources = []

    def _factory(owner=user, **kwargs) -> models.Activity:
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
def activity(activity_factory, user_factory):
    return activity_factory()


@pytest.fixture
def occurance_factory(activity):
    resource_model = models.Occurance
    resources = []

    def _factory(activity=activity, **kwargs) -> models.Occurance:
        resource, _ = resource_model.objects.get_or_create(activity=activity, **kwargs)
        resources.append(resource)
        return resource

    yield _factory
    for resource in resources:
        try:
            resource.delete()
        except resource_model.DoesNotExist:
            pass


@pytest.fixture
def occurance(occurance_factory, activity_factory):
    return occurance_factory()


@pytest.fixture
def game_state_factory(user):
    resource_model = models.GameState
    resources = []

    def _factory(owner=user, **kwargs) -> models.GameState:
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
def game_state(game_state_factory, activity_factory):
    return game_state_factory()
