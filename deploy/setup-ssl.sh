#!/bin/bash
# Install Let's Encrypt SSL (domains that have DNS A records only).
set -euo pipefail

DOMAINS="-d rcicmaster.com -d www.rcicmaster.com \
  -d admin.rcicmaster.com -d app.rcicmaster.com \
  -d consultant.rcicmaster.com -d portal.rcicmaster.com"

echo ">>> Requesting SSL certificates..."
sudo certbot --nginx $DOMAINS \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect

sudo nginx -t
sudo systemctl reload nginx

echo ">>> HTTPS ready."
curl -sI "https://portal.rcicmaster.com/" | head -3
curl -sI "https://admin.rcicmaster.com/dashboard/login/v1" | head -3
