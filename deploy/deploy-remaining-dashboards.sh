#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
sudo -u github-actions git fetch origin main
sudo -u github-actions git -C /opt/waytocanada reset --hard origin/main
sudo -u github-actions bash deploy/bootstrap-prod-env.sh backend/.env

if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] && sudo swapon /swapfile || sudo bash deploy/add-swap.sh
fi

sudo cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
sudo ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
sudo nginx -t
sudo systemctl reload nginx

sudo -u github-actions bash /tmp/deploy-remaining-docker.sh
