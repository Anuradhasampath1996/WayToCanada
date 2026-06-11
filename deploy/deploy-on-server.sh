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

docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_lms'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_lms;"
docker exec wtc_postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='db_legal'" | grep -q 1 || \
  docker exec wtc_postgres psql -U postgres -c "CREATE DATABASE db_legal;"

sudo cp deploy/nginx/lightersmenia.conf /etc/nginx/sites-available/lightersmenia.com
sudo ln -sf /etc/nginx/sites-available/lightersmenia.com /etc/nginx/sites-enabled/lightersmenia.com
sudo nginx -t
sudo systemctl reload nginx

docker compose -f docker-compose.prod.yml ps
echo ">>> Disk after deploy:"
df -h / | tail -1
echo ">>> Deploy finished successfully."
