#!/usr/bin/env bash
#
# EC2 first-time setup script.
# Run on a fresh Ubuntu 24.04 EC2 instance.
#
# Usage:
#   1. scp this repo to the instance (or git clone)
#   2. ssh into the instance
#   3. bash deploy/setup.sh
#
set -euo pipefail

DOMAIN="incrementallist.com"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL environment variable (e.g. export CERTBOT_EMAIL=you@example.com)}"

echo "=== Installing Docker ==="
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"

# Group membership only takes effect in a new session. Check now and bail if needed.
if ! docker info &>/dev/null; then
    echo ""
    echo ">>> Docker installed. You must log out and back in for group permissions to apply."
    echo ">>> Run: exit"
    echo ">>> Then reconnect and re-run: bash deploy/setup.sh"
    echo ""
    exit 1
fi

echo "=== Creating .env file ==="
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate a random secret key
    RANDOM_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(50))")
    sed -i "s|change-me-to-a-long-random-string|$RANDOM_KEY|" .env
    echo ">>> IMPORTANT: Edit .env and set a strong DB_PASSWORD before continuing!"
    echo ">>> Run: nano .env"
    exit 1
fi

echo "=== Installing Node.js ==="
if ! command -v npm &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "=== Building frontend ==="
(cd frontend && npm ci && npm run build)

echo "=== Phase 1: Start with HTTP-only nginx to get SSL cert ==="
# Activate the HTTP-only nginx config (no SSL certs needed yet)
cp nginx/nginx-initial.conf nginx/active.conf

docker compose up -d db app nginx

echo "=== Obtaining SSL certificate ==="
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

echo "=== Phase 2: Switch to full SSL nginx config ==="
cp nginx/nginx.conf nginx/active.conf
docker compose exec nginx nginx -s reload

echo "=== Running database migrations ==="
docker compose exec app python test_project/manage.py migrate

echo "=== Creating superuser ==="
echo "Create a Django admin superuser:"
docker compose exec -it app python test_project/manage.py createsuperuser

echo ""
echo "=== Done! ==="
echo "Your site should be live at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f          # View logs"
echo "  docker compose exec app python test_project/manage.py migrate   # Run migrations"
echo "  docker compose down             # Stop everything"
echo "  docker compose up -d            # Start everything"
