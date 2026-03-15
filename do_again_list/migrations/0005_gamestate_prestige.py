# Generated migration for prestige / meta-progression fields on GameState

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('do_again_list', '0004_activity_code_name_activity_display_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='gamestate',
            name='souls',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='gamestate',
            name='perm_attack',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='gamestate',
            name='perm_defense',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='gamestate',
            name='perm_speed',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='gamestate',
            name='perm_hp',
            field=models.IntegerField(default=0),
        ),
    ]
