# Generated migration: add default_duration to PastEvents

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0004_rename_date_to_end_time_add_start_time'),
    ]

    operations = [
        migrations.AddField(
            model_name='pastevents',
            name='default_duration',
            field=models.IntegerField(default=0),
        ),
    ]
