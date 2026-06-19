#!/bin/bash
# Simple production deploy: git pull + build images on EC2 + start containers.
set -euo pipefail

DEPLOY_PATH="/opt/waytocanada"
cd "$DEPLOY_PATH"
export DOCKER_BUILDKIT=1
export COMPOSE_PARALLEL_LIMIT=1

echo ">>> Connected to $(hostname)"
echo ">>> Disk before deploy:"
df -h / | tail -1

echo ">>> Configuring GitHub SSH for git fetch..."
mkdir -p ~/.ssh
chmod 700 ~/.ssh
DEPLOY_KEY="$HOME/.ssh/github_deploy"
if [ -f "$DEPLOY_KEY" ]; then
  if [ ! -f ~/.ssh/config ] || ! grep -q "Host github.com" ~/.ssh/config; then
    cat >> ~/.ssh/config << EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ${DEPLOY_KEY}
  IdentitiesOnly yes
EOF
    chmod 600 ~/.ssh/config
  fi
  ssh-keyscan -t ed25519,rsa github.com >> ~/.ssh/known_hosts 2>/dev/null || true
fi

git remote set-url origin git@github.com:Anuradhasampath1996/WayToCanada.git

echo ">>> Pulling latest code from main..."
if ! git fetch origin main; then
  echo "ERROR: Server cannot read from GitHub (Permission denied publickey)."
  exit 1
fi
git reset --hard origin/main

echo ">>> Clearing stale Laravel caches..."
rm -f backend/bootstrap/cache/*.php

bash deploy/bootstrap-prod-env.sh backend/.env

echo ">>> Freeing Docker disk space..."
docker builder prune -af 2>/dev/null || true
docker image prune -f 2>/dev/null || true

echo ">>> Building images on server (one at a time)..."
bash deploy/build-all-frontends.sh

echo ">>> Starting containers..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans \
  postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash

echo ">>> Running database migrations..."
docker exec wtc_api php artisan config:clear --no-ansi || true
docker exec wtc_api php artisan migrate --force --no-ansi

echo ">>> Seeding consultant website features (idempotent)..."
docker exec wtc_api php artisan db:seed --class=ConsultantWebsiteFeatureSeeder --force --no-ansi || true

echo ">>> Seeding marketing services (idempotent)..."
docker exec wtc_api php artisan db:seed --class=MarketingServiceSeeder --force --no-ansi || true

echo ">>> Ensuring roles + super admin exist (idempotent)..."
docker exec wtc_api php artisan db:seed --class=RolesAndPermissionsSeeder --force --no-ansi || true
docker exec wtc_api php artisan db:seed --class=SuperAdminSeeder --force --no-ansi || true

docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_lms'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_lms;"
docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_legal'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_legal;"

echo ">>> Applying nginx (rcicmaster.com, remove lightersmenia)..."
if sudo -n bash deploy/fix-domain-nginx.sh 2>/dev/null; then
  echo ">>> Nginx updated via fix-domain-nginx.sh"
elif sudo -n cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com 2>/dev/null; then
  sudo -n rm -f /etc/nginx/sites-enabled/lightersmenia.com /etc/nginx/sites-available/lightersmenia.com /etc/nginx/sites-enabled/default
  sudo -n ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
  sudo -n /usr/sbin/nginx -t && sudo -n /bin/systemctl reload nginx
  echo ">>> Nginx config updated (fallback path)"
else
  echo ">>> WARNING: Could not update nginx automatically."
  echo "    SSH to EC2 and run: sudo bash /opt/waytocanada/deploy/fix-domain-nginx.sh"
fi

docker compose -f docker-compose.prod.yml ps
echo ">>> Disk after deploy:"
df -h / | tail -1
echo ">>> Deploy finished successfully."
