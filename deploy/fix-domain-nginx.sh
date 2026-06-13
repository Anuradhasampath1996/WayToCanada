#!/bin/bash
# Switch production nginx from lightersmenia.com → rcicmaster.com.
# Run on EC2 as root (or with sudo):
#   sudo bash /opt/waytocanada/deploy/fix-domain-nginx.sh
set -euo pipefail

cd /opt/waytocanada

echo ">>> Removing old lightersmenia nginx site (if present)..."
rm -f /etc/nginx/sites-enabled/lightersmenia.com
rm -f /etc/nginx/sites-enabled/default
rm -f /etc/nginx/sites-available/lightersmenia.com

echo ">>> Installing rcicmaster.com nginx config..."
cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com

echo ">>> Patching backend .env URLs..."
bash deploy/bootstrap-prod-env.sh backend/.env

nginx -t
systemctl reload nginx

echo ">>> Done. Test:"
echo "  curl -sI -H 'Host: www.rcicmaster.com' http://127.0.0.1/ | head -3"
curl -sI -H 'Host: www.rcicmaster.com' http://127.0.0.1/ | head -3 || true
