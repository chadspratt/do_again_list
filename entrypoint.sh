#!/bin/sh
set -e

python test_project/manage.py collectstatic --noinput
exec gunicorn test_project.wsgi:application --bind 0.0.0.0:8000 --workers 2
