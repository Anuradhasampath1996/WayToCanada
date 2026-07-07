#!/bin/bash
# Migrate production from rcicmaster.com → rcicmaster.ca
# Run on EC2 as root:
#   sudo bash /opt/waytocanada/deploy/migrate-domain-to-ca.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"
cd "$DEPLOY_PATH"

echo ">>> Installing rcicmaster.ca nginx config..."
cp "$DEPLOY_PATH/deploy/nginx/rcicmaster.conf" /etc/nginx/sites-available/rcicmaster.ca
ln -sf /etc/nginx/sites-available/rcicmaster.ca /etc/nginx/sites-enabled/rcicmaster.ca
rm -f /etc/nginx/sites-enabled/rcicmaster.com
rm -f /etc/nginx/sites-enabled/default

echo ">>> Patching backend .env for rcicmaster.ca..."
APP_URL="https://rcicmaster.ca" \
  bash "$DEPLOY_PATH/deploy/bootstrap-prod-env.sh" "$DEPLOY_PATH/backend/.env"

echo ">>> Testing nginx..."
nginx -t
systemctl reload nginx

echo ">>> Requesting Let's Encrypt SSL for rcicmaster.ca..."
certbot --nginx \
  -d rcicmaster.ca \
  -d apply.rcicmaster.ca \
  -d admin.rcicmaster.ca -d app.rcicmaster.ca \
  -d consultant.rcicmaster.ca \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect

nginx -t
systemctl reload nginx

echo ">>> Restarting API to pick up new APP_URL..."
docker compose -f docker-compose.prod.yml restart api 2>/dev/null || \
  docker compose restart api 2>/dev/null || true

echo ">>> Verifying HTTPS..."
curl -sI "https://rcicmaster.ca/" | head -3
curl -sI "https://consultant.rcicmaster.ca/" | head -3
curl -sI "https://admin.rcicmaster.ca/admindashboard" | head -3
curl -sI "https://apply.rcicmaster.ca/" | head -3
curl -sI "https://app.rcicmaster.ca/" | head -3

echo ">>> Legacy .com redirect check..."
curl -sI "https://www.rcicmaster.com/" | grep -i '^location:' || true

echo ">>> Migration complete."
