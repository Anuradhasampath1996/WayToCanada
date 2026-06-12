#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
git fetch origin main
git reset --hard origin/main
bash deploy/bootstrap-prod-env.sh backend/.env
bash deploy/build-all-frontends.sh
docker compose -f docker-compose.prod.yml up -d --remove-orphans postgres api frontend frontend-admin frontend-users frontend-consultant-site frontend-consultant-dash
docker compose -f docker-compose.prod.yml ps
