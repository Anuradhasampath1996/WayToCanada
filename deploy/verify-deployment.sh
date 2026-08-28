#!/usr/bin/env bash
set -euo pipefail

SERVICES_CSV="${1:-}"

declare -A HEALTH_URLS=(
  [api]="http://127.0.0.1:8000/up"
  [frontend]="http://127.0.0.1:3000/"
  [frontend-admin]="http://127.0.0.1:3001/"
  [frontend-users]="http://127.0.0.1:3002/"
  [frontend-consultant-site]="http://127.0.0.1:3003/"
  [frontend-consultant-dash]="http://127.0.0.1:3005/"
)

if [[ -z "$SERVICES_CSV" ]]; then
  echo "No services supplied for health verification."
  exit 0
fi

IFS=',' read -r -a SERVICES <<< "$SERVICES_CSV"
for service in "${SERVICES[@]}"; do
  url="${HEALTH_URLS[$service]:-}"
  if [[ -z "$url" ]]; then
    echo "Unknown health-check service: $service"
    exit 1
  fi

  passed=false
  for _ in $(seq 1 15); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      passed=true
      break
    fi
    sleep 2
  done

  if [[ "$passed" != true ]]; then
    echo "Post-deploy health check failed: $service ($url)"
    exit 1
  fi
  echo "Post-deploy health check passed: $service"
done
