from django.apps import AppConfig


class DoAgainListConfig(AppConfig):
    name = "do_again_list"
    verbose_name = "Do Again List"

    def ready(self):
        import do_again_list.signals  # noqa: F401 – register signal handlers
