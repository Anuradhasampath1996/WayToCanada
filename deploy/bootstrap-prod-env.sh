#!/bin/bash
# Patch /opt/waytocanada/backend/.env for Docker Compose production (Postgres service).
set -euo pipefail

ENV_FILE="${1:-/opt/waytocanada/backend/.env}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-secret}"

if [ ! -f "$ENV_FILE" ]; then
  cp /opt/waytocanada/backend/.env.example "$ENV_FILE"
fi

set_var() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

set_var APP_ENV production
set_var APP_DEBUG false
set_var APP_URL "http://www.lightersmenia.com"

if ! grep -q '^APP_KEY=base64:' "$ENV_FILE" 2>/dev/null; then
  set_var APP_KEY "base64:$(openssl rand -base64 32)"
fi

for prefix in CWS LMS LEGAL; do
  set_var "DB_${prefix}_HOST" postgres
  set_var "DB_${prefix}_PORT" 5432
  set_var "DB_${prefix}_USERNAME" postgres
  set_var "DB_${prefix}_PASSWORD" "$POSTGRES_PASSWORD"
done

set_var DB_CWS_DATABASE db_cws
set_var DB_LMS_DATABASE db_lms
set_var DB_LEGAL_DATABASE db_legal

echo "Production .env patched: Postgres host=postgres, APP_URL=http://www.lightersmenia.com"
