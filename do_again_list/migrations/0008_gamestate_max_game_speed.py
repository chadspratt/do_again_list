from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("do_again_list", "0007_convert_bad_activities_remove_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="gamestate",
            name="max_game_speed",
            field=models.IntegerField(default=1),
        ),
    ]
