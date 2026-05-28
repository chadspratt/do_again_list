from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("do_again_list", "0008_gamestate_max_game_speed"),
    ]

    operations = [
        migrations.AddField(
            model_name="gamestate",
            name="bonus_xp",
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name="gamestate",
            name="bonus_xp_updated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
