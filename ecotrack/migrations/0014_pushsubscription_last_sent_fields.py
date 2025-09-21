from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ecotrack", "0013_rename_last_4_footprint_measurements_user_last_8_footprint_measurements_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="pushsubscription",
            name="last_sent_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="pushsubscription",
            name="last_sent_time",
            field=models.TimeField(blank=True, null=True),
        ),
    ]
