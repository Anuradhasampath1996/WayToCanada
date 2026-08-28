#!/bin/bash
# Fix rcicmaster.ca SSL (re-attach Let's Encrypt cert after nginx config overwrite).
# Run on EC2 as root:
#   sudo bash /opt/waytocanada/deploy/fix-ssl-ca.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"

echo ">>> Installing nginx config..."
cp "$DEPLOY_PATH/deploy/nginx/rcicmaster.conf" /etc/nginx/sites-available/rcicmaster.ca
ln -sf /etc/nginx/sites-available/rcicmaster.ca /etc/nginx/sites-enabled/rcicmaster.ca
rm -f /etc/nginx/sites-enabled/rcicmaster.com /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo ">>> Re-installing SSL for rcicmaster.ca (all subdomains)..."
certbot --nginx \
  --cert-name rcicmaster.ca \
  -d rcicmaster.ca -d www.rcicmaster.ca \
  -d apply.rcicmaster.ca \
  -d admin.rcicmaster.ca -d app.rcicmaster.ca \
  -d consultant.rcicmaster.ca \
  --expand \
  --non-interactive \
  --agree-tos \
  --redirect

nginx -t
systemctl reload nginx

echo ">>> Verifying certificate served for rcicmaster.ca..."
echo | openssl s_client -connect 127.0.0.1:443 -servername rcicmaster.ca 2>/dev/null \
  | openssl x509 -noout -subject -dates 2>/dev/null || true

echo ">>> HTTPS checks:"
curl -sI "https://rcicmaster.ca/" | head -3
curl -sI "https://consultant.rcicmaster.ca/" | head -3
curl -sI "https://www.rcicmaster.com/" | grep -i '^location:' || true

echo ">>> Done."
