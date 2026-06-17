#!/bin/bash
# Switch production nginx from lightersmenia.com → rcicmaster.com.
# Run on EC2 as root:
#   sudo bash /opt/waytocanada/deploy/fix-domain-nginx.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"
cd "$DEPLOY_PATH"

echo ">>> Scanning nginx for lightersmenia references..."
if grep -rIl 'lightersmenia' /etc/nginx/ 2>/dev/null; then
  echo ">>> Found old lightersmenia config (will remove/replace below)"
fi

echo ">>> Removing old lightersmenia + default nginx sites..."
rm -f /etc/nginx/sites-enabled/lightersmenia.com
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/lightersmenia.com

# Certbot sometimes leaves snippets with old server_name
for f in /etc/nginx/sites-enabled/* /etc/nginx/sites-available/*; do
  [ -f "$f" ] || continue
  if grep -q 'lightersmenia' "$f" 2>/dev/null; then
    echo ">>> Removing stale config: $f"
    rm -f "$f"
  fi
done

echo ">>> Installing rcicmaster.com nginx config..."
cp "$DEPLOY_PATH/deploy/nginx/rcicmaster.conf" /etc/nginx/sites-available/rcicmaster.com
ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com

echo ">>> Patching backend .env URLs (rcicmaster.com)..."
bash "$DEPLOY_PATH/deploy/bootstrap-prod-env.sh" "$DEPLOY_PATH/backend/.env"

echo ">>> Testing nginx configuration..."
nginx -t

echo ">>> Reloading nginx..."
systemctl reload nginx

echo ">>> Verifying redirects (should NOT mention lightersmenia):"
curl -sI -H 'Host: rcicmaster.com' http://127.0.0.1/ | grep -i '^location:' || true
curl -sI -H 'Host: www.rcicmaster.com' http://127.0.0.1/ | head -1 || true

if curl -sI -H 'Host: rcicmaster.com' http://127.0.0.1/ | grep -qi 'lightersmenia'; then
  echo "ERROR: nginx still redirects to lightersmenia — check /etc/nginx manually."
  exit 1
fi

echo ">>> Done. rcicmaster.com should redirect to www.rcicmaster.com (not lightersmenia)."
