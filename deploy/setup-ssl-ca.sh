#!/bin/bash
# Install Let's Encrypt SSL for rcicmaster.ca
set -euo pipefail

DOMAINS="-d rcicmaster.ca -d www.rcicmaster.ca \
  -d apply.rcicmaster.ca \
  -d admin.rcicmaster.ca -d app.rcicmaster.ca \
  -d consultant.rcicmaster.ca"

echo ">>> Requesting SSL certificates for rcicmaster.ca..."
sudo certbot --nginx $DOMAINS \
  --non-interactive \
  --agree-tos \
  --register-unsafely-without-email \
  --redirect

sudo nginx -t
sudo systemctl reload nginx

echo ">>> HTTPS ready."
curl -sI "https://consultant.rcicmaster.ca/" | head -3
curl -sI "https://admin.rcicmaster.ca/admindashboard" | head -3
