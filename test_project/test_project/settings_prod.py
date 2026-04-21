"""
Production settings for do_again_list.

Imports everything from the base settings, then overrides for production.
All secrets come from environment variables.
"""

import os

from .settings import *  # noqa: F401, F403

DEBUG = False

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "incrementallist.com,www.incrementallist.com").split(",")

# Database — PostgreSQL via environment variables
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "do_again_list"),
        "USER": os.environ.get("DB_USER", "do_again_list"),
        "PASSWORD": os.environ["DB_PASSWORD"],
        "HOST": os.environ.get("DB_HOST", "db"),
        "PORT": os.environ.get("DB_PORT", "5432"),
    }
}

# Static files — served by whitenoise
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405

STATIC_ROOT = "/app/staticfiles"

# Security
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [
    "https://incrementallist.com",
    "https://www.incrementallist.com",
]

CORS_ALLOWED_ORIGINS = [
    "https://incrementallist.com",
    "https://www.incrementallist.com",
]
