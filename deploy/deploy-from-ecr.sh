#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="/opt/waytocanada"
COMPOSE_FILE="docker-compose.prod.yml"
SERVICES_CSV="${1:-}"

: "${ECR_REGISTRY:?ECR_REGISTRY is required}"
: "${AWS_REGION:?AWS_REGION is required}"
: "${IMAGE_TAG:?IMAGE_TAG is required}"

cd "$DEPLOY_PATH"
export IMAGE_PREFIX="${ECR_REGISTRY%/}/"
export IMAGE_TAG

if [[ -z "$SERVICES_CSV" ]]; then
  echo "No changed services to deploy."
  exit 0
fi

IFS=',' read -r -a SERVICES <<< "$SERVICES_CSV"

if [[ -f deploy/bootstrap-prod-env.sh ]]; then
  bash deploy/bootstrap-prod-env.sh backend/.env
fi

declare -A REPOSITORIES=(
  [api]="waytocanada-api"
  [frontend]="waytocanada-frontend-public"
  [frontend-admin]="waytocanada-frontend-admin"
  [frontend-users]="waytocanada-frontend-users"
  [frontend-consultant-site]="waytocanada-frontend-consultant-site"
  [frontend-consultant-dash]="waytocanada-frontend-consultant-dash"
)

declare -A CONTAINERS=(
  [api]="wtc_api"
  [frontend]="wtc_frontend"
  [frontend-admin]="wtc_frontend_admin"
  [frontend-users]="wtc_frontend_users"
  [frontend-consultant-site]="wtc_frontend_consultant_site"
  [frontend-consultant-dash]="wtc_frontend_consultant_dash"
)

declare -A HEALTH_URLS=(
  [api]="http://127.0.0.1:8000/up"
  [frontend]="http://127.0.0.1:3000/"
  [frontend-admin]="http://127.0.0.1:3001/"
  [frontend-users]="http://127.0.0.1:3002/"
  [frontend-consultant-site]="http://127.0.0.1:3003/"
  [frontend-consultant-dash]="http://127.0.0.1:3005/"
)

for service in "${SERVICES[@]}"; do
  if [[ -z "${REPOSITORIES[$service]:-}" ]]; then
    echo "Unknown deployment service: $service"
    exit 1
  fi
done

echo ">>> Logging in to ECR"
aws ecr get-login-password --region "$AWS_REGION" |
  docker login --username AWS --password-stdin "$ECR_REGISTRY"

declare -A PREVIOUS_TAGS=()
api_changed=false

for service in "${SERVICES[@]}"; do
  repository="${REPOSITORIES[$service]}"
  container="${CONTAINERS[$service]}"
  image="${ECR_REGISTRY%/}/$repository:$IMAGE_TAG"

  previous_image="$(docker inspect --format '{{.Config.Image}}' "$container" 2>/dev/null || true)"
  if [[ "$previous_image" == *:* ]]; then
    PREVIOUS_TAGS[$service]="${previous_image##*:}"
  fi

  echo ">>> Pulling $image"
  docker pull "$image"
  [[ "$service" == "api" ]] && api_changed=true
done

rollback() {
  echo ">>> Rolling back failed deployment"
  for service in "${SERVICES[@]}"; do
    previous_tag="${PREVIOUS_TAGS[$service]:-}"
    if [[ -z "$previous_tag" ]]; then
      echo "No previous image tag available for $service"
      continue
    fi
    repository="${REPOSITORIES[$service]}"
    docker pull "${ECR_REGISTRY%/}/$repository:$previous_tag" || true
    export IMAGE_TAG="$previous_tag"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps "$service" || true
  done
}

echo ">>> Restarting: $SERVICES_CSV"
if ! docker compose -f "$COMPOSE_FILE" up -d --no-deps "${SERVICES[@]}"; then
  echo "Deployment failed while restarting services."
  rollback
  exit 1
fi

health_check() {
  local service="$1"
  local url="${HEALTH_URLS[$service]}"
  local attempt

  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      echo ">>> Health check passed: $service"
      return 0
    fi
    sleep 2
  done

  echo "Health check failed: $service ($url)"
  return 1
}

for service in "${SERVICES[@]}"; do
  if ! health_check "$service"; then
    rollback
    exit 1
  fi
done

if [[ "$api_changed" == true ]]; then
  echo ">>> Running database migrations"
  if ! docker exec wtc_api php artisan migrate --force --no-ansi; then
    rollback
    exit 1
  fi
fi

export IMAGE_TAG
echo ">>> Deployment finished successfully: $IMAGE_TAG"
