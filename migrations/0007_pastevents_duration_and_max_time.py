# Generated migration: add min_duration, max_duration, max_time_between_events

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0006_pastevents_min_time_between_events'),
    ]

    operations = [
        migrations.AddField(
            model_name='pastevents',
            name='min_duration',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='pastevents',
            name='max_duration',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
        migrations.AddField(
            model_name='pastevents',
            name='max_time_between_events',
            field=models.CharField(blank=True, default='', max_length=50),
        ),
    ]
