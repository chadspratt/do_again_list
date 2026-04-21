#!/usr/bin/env bash
#
# Deploy a new version of the app.
# Run on the EC2 instance from the project root.
#
set -euo pipefail

echo "=== Pulling latest code ==="
git pull

echo "=== Building frontend ==="
if command -v npm &> /dev/null; then
    (cd frontend && npm ci && npm run build)
fi

echo "=== Rebuilding Docker image ==="
docker compose build app

echo "=== Restarting app ==="
docker compose up -d app

echo "=== Running migrations ==="
docker compose exec app python test_project/manage.py migrate

echo "=== Done ==="
