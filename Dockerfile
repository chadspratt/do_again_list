FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=test_project.settings_prod

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install the package and production dependencies
COPY pyproject.toml README.md ./
COPY do_again_list/ do_again_list/
COPY test_project/ test_project/
RUN pip install --no-cache-dir . gunicorn psycopg[binary] whitenoise

# Copy pre-built frontend static assets (build frontend before docker build)
COPY static/ static/

# Collect static files
RUN python test_project/manage.py collectstatic --noinput

EXPOSE 8000

CMD ["gunicorn", "test_project.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2"]
