#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
bash deploy/bootstrap-prod-env.sh backend/.env
bash deploy/build-all-frontends.sh
docker compose -f docker-compose.prod.yml up -d postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash
sudo cp deploy/nginx/lightersmenia.conf /etc/nginx/sites-available/lightersmenia.com
sudo ln -sf /etc/nginx/sites-available/lightersmenia.com /etc/nginx/sites-enabled/lightersmenia.com
sudo nginx -t
sudo systemctl reload nginx
docker compose -f docker-compose.prod.yml ps
