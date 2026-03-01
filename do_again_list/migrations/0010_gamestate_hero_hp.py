from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0009_pastevents_value'),
    ]

    operations = [
        migrations.AddField(
            model_name='gamestate',
            name='hero_hp',
            field=models.IntegerField(default=-1),
        ),
    ]
