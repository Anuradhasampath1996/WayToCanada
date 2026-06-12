#!/bin/bash
# Patch backend/.env for Docker Compose production (does NOT touch the database).
# OAuth secrets: set GitHub Actions secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET,
# or export them before running this script on the server.
set -euo pipefail

ENV_FILE="${1:-/opt/waytocanada/backend/.env}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-secret}"
APP_URL="${APP_URL:-http://www.rcicmaster.com}"

if [ ! -f "$ENV_FILE" ]; then
  cp "$(dirname "$ENV_FILE")/.env.example" "$ENV_FILE" 2>/dev/null || \
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
set_var APP_URL "$APP_URL"
set_var LOG_CHANNEL stderr
set_var LOG_LEVEL warning

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

set_var SESSION_DRIVER cookie
set_var QUEUE_CONNECTION database
set_var CACHE_STORE database

# Live frontend URLs (OAuth redirects after login)
set_var PUBLIC_FRONTEND_URL "http://www.rcicmaster.com"
set_var CONSULTANT_FRONTEND_URL "http://consultant.rcicmaster.com"
set_var CONSULTANT_DASHBOARD_URL "http://portal.rcicmaster.com"
set_var FRONTEND_URL "http://www.rcicmaster.com"
set_var PUBLIC_DASHBOARD_URL "http://app.rcicmaster.com"

set_var SANCTUM_STATEFUL_DOMAINS "www.rcicmaster.com,admin.rcicmaster.com,app.rcicmaster.com,consultant.rcicmaster.com,portal.rcicmaster.com,rcicmaster.com"

# Google OAuth — callback must match Google Cloud Console (add this URI there)
set_var GOOGLE_REDIRECT_URI "http://www.rcicmaster.com/api/v1/auth/google/callback"

if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  set_var GOOGLE_CLIENT_ID "$GOOGLE_CLIENT_ID"
fi
if [ -n "${GOOGLE_CLIENT_SECRET:-}" ]; then
  set_var GOOGLE_CLIENT_SECRET "$GOOGLE_CLIENT_SECRET"
fi

echo "Production .env patched (database unchanged):"
echo "  APP_URL=$APP_URL"
echo "  DB host=postgres"
echo "  GOOGLE_REDIRECT_URI=http://www.rcicmaster.com/api/v1/auth/google/callback"
if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
  echo "  GOOGLE_CLIENT_ID=set"
else
  echo "  GOOGLE_CLIENT_ID=not set (add GitHub secret GOOGLE_CLIENT_ID)"
fi
