# Generated migration: rename date -> end_time, add start_time

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0003_alter_historicalevent_options_and_more'),
    ]

    operations = [
        # PastEvents: rename date -> end_time
        migrations.RenameField(
            model_name='pastevents',
            old_name='date',
            new_name='end_time',
        ),
        # PastEvents: add start_time, initially copying end_time value
        migrations.AddField(
            model_name='pastevents',
            name='start_time',
            field=models.DateTimeField(default='2000-01-01T00:00:00Z'),
            preserve_default=False,
        ),
        migrations.RunSQL(
            sql="UPDATE past_events SET start_time = end_time;",
            reverse_sql="",
        ),
        # PastEvents: make end_time nullable
        migrations.AlterField(
            model_name='pastevents',
            name='end_time',
            field=models.DateTimeField(null=True, blank=True),
        ),
        # HistoricalEvent: rename date -> end_time
        migrations.RenameField(
            model_name='historicalevent',
            old_name='date',
            new_name='end_time',
        ),
        # HistoricalEvent: add start_time, initially copying end_time value
        migrations.AddField(
            model_name='historicalevent',
            name='start_time',
            field=models.DateTimeField(default='2000-01-01T00:00:00Z'),
            preserve_default=False,
        ),
        migrations.RunSQL(
            sql="UPDATE historical_event SET start_time = end_time;",
            reverse_sql="",
        ),
        # HistoricalEvent: make end_time nullable
        migrations.AlterField(
            model_name='historicalevent',
            name='end_time',
            field=models.DateTimeField(null=True, blank=True),
        ),
        # Update ordering
        migrations.AlterModelOptions(
            name='pastevents',
            options={'ordering': ['-end_time']},
        ),
        migrations.AlterModelOptions(
            name='historicalevent',
            options={'ordering': ['-end_time']},
        ),
    ]
