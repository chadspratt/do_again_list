# Running Tests

Tests use pytest-django. The `DJANGO_SETTINGS_MODULE` env var must be set because it is not configured in `pyproject.toml`.

```bash
DJANGO_SETTINGS_MODULE=test_project.settings uv run pytest
```

On Windows PowerShell:

```powershell
$env:DJANGO_SETTINGS_MODULE = "test_project.settings"; uv run pytest
```

To run a specific path (mirrors the `just test` recipe):

```bash
DJANGO_SETTINGS_MODULE=test_project.settings uv run pytest tests/test_models.py
```

Test files live in `tests/`. Django settings used by tests are in `test_project/test_project/settings.py`.

# Running Migrations

## Test / local SQLite database

```powershell
cd test_project; uv run manage.py migrate do_again_list
```

## Production MariaDB (via DjangoLocalApps)

The production MariaDB database is managed through a separate Django project at
`C:\Users\inter\Documents\sc_bot\web\DjangoLocalApps`. That project has a
`do_again_list` database alias in its `DATABASES` setting. `PYTHONPATH` must
include this repo so the `do_again_list` app is importable.

```powershell
cd C:\Users\inter\Documents\sc_bot\web\DjangoLocalApps
$env:DJANGO_SETTINGS_MODULE = "DjangoLocalApps.settings"
$env:PYTHONPATH = "C:\Users\inter\Documents\do_again_list"
.\venv\Scripts\python.exe manage.py migrate do_again_list --database=do_again_list
```
