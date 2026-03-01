
init:
    cd test_project && uv run manage.py migrate

run:
    cd test_project && uv run manage.py runserver 0.0.0.0:8000

makemigrations:
    cd test_project && uv run manage.py makemigrations

shell:
    cd test_project && uv run manage.py shell

lint:
    uv run ruff check --fix .
    uv run ruff format .

typecheck:
    uv run ty check