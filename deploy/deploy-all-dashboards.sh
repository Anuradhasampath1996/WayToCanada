#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
bash deploy/bootstrap-prod-env.sh backend/.env
bash deploy/build-all-frontends.sh
docker compose -f docker-compose.prod.yml up -d postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash
sudo cp deploy/nginx/rcicmaster.conf /etc/nginx/sites-available/rcicmaster.com
sudo ln -sf /etc/nginx/sites-available/rcicmaster.com /etc/nginx/sites-enabled/rcicmaster.com
sudo nginx -t
sudo systemctl reload nginx
docker compose -f docker-compose.prod.yml ps
