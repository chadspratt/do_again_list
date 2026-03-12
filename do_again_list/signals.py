from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from do_again_list.services import ADD_TO_LIST_TITLE


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_built_in_activities(sender, instance, created, **kwargs):
    """Create the default built-in Activities for every newly-registered user."""
    if not created:
        return

    from do_again_list.models import Activity

    Activity.objects.create(
        owner=instance,
        title=ADD_TO_LIST_TITLE,
        is_built_in=True,
    )
