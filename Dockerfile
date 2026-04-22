FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=test_project.settings_prod \
    PYTHONPATH=/app/test_project

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install the package and production dependencies
COPY pyproject.toml README.md ./
COPY do_again_list/ do_again_list/
COPY test_project/ test_project/
RUN pip install --no-cache-dir . gunicorn psycopg[binary] whitenoise

# static assets from the vite build are already inside do_again_list/static/
# collectstatic runs at container startup (needs env vars available then)
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 8000

CMD ["./entrypoint.sh"]
