# EC2 Deployment Architecture

## Overview

The app runs on a single EC2 instance (Ubuntu 24.04) using Docker Compose. All
services — web server, application, and database — run as containers on the same
host with no external cloud services required.

```
Internet
   │
   ▼
EC2 instance (incrementallist.com)
   │
   ├── nginx (ports 80/443)
   │     ├── HTTP (80) → redirect to HTTPS, and serve Let's Encrypt challenges
   │     └── HTTPS (443) → reverse proxy to app:8000
   │
   ├── app (port 8000, internal only)
   │     ├── gunicorn serving Django
   │     ├── Django serves the React frontend via a catch-all TemplateView
   │     └── Static files (CSS/JS) served by whitenoise middleware
   │
   └── db (port 5432, internal only)
         └── PostgreSQL 17 with data in a named Docker volume
```

## Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Builds the `app` image: installs Python deps, copies source |
| `entrypoint.sh` | Container startup: runs `collectstatic` then starts gunicorn |
| `docker-compose.yml` | Defines all four services: db, app, nginx, certbot |
| `nginx/nginx-initial.conf` | HTTP-only nginx config used during first-time SSL cert provisioning |
| `nginx/nginx.conf` | Full nginx config with SSL and HTTP→HTTPS redirect |
| `nginx/active.conf` | The currently active config (gitignored, written by setup/redeploy scripts) |
| `test_project/test_project/settings_prod.py` | Production Django settings (reads secrets from env vars) |
| `.env` | Environment variables for docker-compose (gitignored, never committed) |
| `.env.example` | Template for `.env` |
| `deploy/setup.sh` | First-time setup script (installs Docker, gets SSL cert, starts everything) |
| `deploy/redeploy.sh` | Redeploy script for code updates |
| `.github/workflows/deploy.yml` | GitHub Actions workflow: SSHes into EC2 and runs redeploy.sh on push to main |

## Docker Compose Services

### db
- Image: `postgres:17`
- Data persisted in the `pgdata` named volume (survives container restarts)
- Only reachable from other containers on the Docker network (not exposed to host)
- Health-checked; `app` waits for it before starting

### app
- Built from the project `Dockerfile`
- Runs gunicorn on port 8000 (exposed only to the Docker network, not the host)
- PYTHONPATH set to `/app/test_project` so the `test_project` package is importable
- `DJANGO_SETTINGS_MODULE` points to `settings_prod`
- Receives all secrets (DB password, Django secret key) via environment variables from `.env`
- On startup, `entrypoint.sh` runs `collectstatic` before gunicorn starts

### nginx
- Mounts `nginx/active.conf` as the live config (a file on the host, not a volume)
- Mounts the `certbot-etc` volume read-only for SSL certificate files
- Mounts the `certbot-var` volume read-only for Let's Encrypt webroot challenge files
- Terminates SSL and proxies all other traffic to `app:8000`
- Uses Docker's internal DNS resolver (`127.0.0.11`) so it can resolve `app` dynamically

### certbot
- Not a running service; invoked on-demand via `docker compose run`
- Writes certificates to the `certbot-etc` volume (shared with nginx read-only)
- Certificate renewal: run manually or add to cron:
  ```
  0 3 * * * cd ~/do_again_list && docker compose run --rm certbot renew && docker compose exec nginx nginx -s reload
  ```

## Named Volumes

| Volume | Contents |
|--------|---------|
| `pgdata` | PostgreSQL data files |
| `certbot-etc` | Let's Encrypt certificates and account info |
| `certbot-var` | Webroot files for ACME HTTP-01 challenges |

## First-Time Setup (setup.sh)

1. Installs Docker and Docker Compose plugin from the official Docker apt repo
2. Detects if the current shell session has Docker group permissions; exits with instructions if not (requires re-login after first Docker install)
3. Creates `.env` from `.env.example` with a generated `DJANGO_SECRET_KEY`; exits prompting you to set `DB_PASSWORD`
4. Installs Node.js 20 LTS (via NodeSource) if not present, then builds the Vite frontend
5. **Phase 1**: Copies `nginx-initial.conf` → `nginx/active.conf` and starts `db`, `app`, and `nginx` (HTTP only)
6. Runs certbot to obtain a Let's Encrypt certificate via the HTTP-01 webroot challenge
7. **Phase 2**: Copies `nginx.conf` → `nginx/active.conf` and force-recreates the nginx container to load the SSL config
8. Runs Django database migrations
9. Prompts to create a Django admin superuser

## Redeployment (redeploy.sh)

Called automatically by GitHub Actions on every push to `main`, or run manually on the EC2:

```bash
cd ~/do_again_list
bash deploy/redeploy.sh
```

Steps:
1. `git pull` — fetch latest code
2. `npm ci && npm run build` — rebuild the Vite frontend (skipped if npm not available)
3. `docker compose build app` — rebuild the app Docker image
4. `docker compose up -d app` — restart the app container with the new image (db and nginx are unaffected)
5. `docker compose exec app python test_project/manage.py migrate` — apply any new migrations

## GitHub Actions (Continuous Deployment)

`.github/workflows/deploy.yml` triggers on push to `main` and SSHes into the EC2 to run `redeploy.sh`. Requires three repository secrets:

| Secret | Value |
|--------|-------|
| `EC2_HOST` | EC2 IP or `incrementallist.com` |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | Full contents of the EC2 `.pem` private key |

## EC2 Security Group

The instance needs three inbound rules:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH access |
| 80 | TCP | HTTP (Let's Encrypt challenges + redirect to HTTPS) |
| 443 | TCP | HTTPS (production traffic) |

## Useful Commands (on EC2)

```bash
# View live logs
docker compose logs -f

# View logs for one service
docker compose logs -f app

# Run a management command
docker compose exec app python test_project/manage.py <command>

# Open a Django shell
docker compose exec app python test_project/manage.py shell

# Renew SSL certificate manually
docker compose run --rm certbot renew
docker compose exec nginx nginx -s reload

# Stop everything
docker compose down

# Start everything
docker compose up -d
```
