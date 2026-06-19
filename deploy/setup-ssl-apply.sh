#!/bin/bash
# Add HTTPS for apply.rcicmaster.com (public applicant site).
# Run on EC2 as root after DNS A record exists:
#   sudo bash /opt/waytocanada/deploy/setup-ssl-apply.sh
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/waytocanada}"

echo ">>> Ensuring nginx config includes apply.rcicmaster.com..."
cp "$DEPLOY_PATH/deploy/nginx/rcicmaster.conf" /etc/nginx/sites-available/rcicmaster.com
ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
nginx -t
systemctl reload nginx

echo ">>> Expanding SSL certificate to include apply.rcicmaster.com..."
certbot --nginx \
  -d rcicmaster.com -d www.rcicmaster.com \
  -d apply.rcicmaster.com \
  -d admin.rcicmaster.com -d app.rcicmaster.com \
  -d consultant.rcicmaster.com -d portal.rcicmaster.com \
  --expand \
  --non-interactive \
  --agree-tos \
  --redirect

nginx -t
systemctl reload nginx

echo ">>> Verifying apply.rcicmaster.com serves public site (not www redirect)..."
curl -sI "https://apply.rcicmaster.com/" | head -5
TITLE=$(curl -s "https://apply.rcicmaster.com/" | grep -o '<title>[^<]*</title>' | head -1)
echo "Page title: $TITLE"
if echo "$TITLE" | grep -qi "Consultant Portal"; then
  echo "ERROR: apply.rcicmaster.com is serving consultant site — check nginx upstream."
  exit 1
fi

echo ">>> apply.rcicmaster.com HTTPS ready."
