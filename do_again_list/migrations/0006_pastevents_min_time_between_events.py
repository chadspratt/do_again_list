# Generated migration: add min_time_between_events to PastEvents

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0005_pastevents_default_duration'),
    ]

    operations = [
        migrations.AddField(
            model_name='pastevents',
            name='min_time_between_events',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
