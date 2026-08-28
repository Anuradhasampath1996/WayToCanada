#!/bin/bash
# Enable permanent rcicmaster.com → rcicmaster.ca redirects (HTTP + HTTPS).
# Run on EC2 as root:
#   sudo bash /opt/waytocanada/deploy/setup-com-redirects.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"

cp "$DEPLOY_PATH/deploy/nginx/rcicmaster.conf" /etc/nginx/sites-available/rcicmaster.ca
ln -sf /etc/nginx/sites-available/rcicmaster.ca /etc/nginx/sites-enabled/rcicmaster.ca

# Renew .com cert if needed (DNS must point to this server)
certbot renew --cert-name rcicmaster.com --quiet 2>/dev/null || \
  certbot certonly --nginx \
    -d rcicmaster.com -d www.rcicmaster.com \
    -d apply.rcicmaster.com -d admin.rcicmaster.com \
    -d app.rcicmaster.com -d consultant.rcicmaster.com -d portal.rcicmaster.com \
    --non-interactive --agree-tos --register-unsafely-without-email 2>/dev/null || true

nginx -t
systemctl reload nginx

echo ">>> Re-installing SSL for rcicmaster.ca (certbot overwrites are restored here)..."
bash "$DEPLOY_PATH/deploy/fix-ssl-ca.sh"

echo ">>> Redirect tests (expect 301 → https://*.rcicmaster.ca):"
for host in www.rcicmaster.com apply.rcicmaster.com admin.rcicmaster.com app.rcicmaster.com portal.rcicmaster.com; do
  echo -n "  http://$host → "
  curl -sI "http://$host/" | grep -i '^location:' | tr -d '\r'
  echo -n "  https://$host → "
  curl -sI "https://$host/" | grep -i '^location:' | tr -d '\r'
done

echo ">>> Done."
