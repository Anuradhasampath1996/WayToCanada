#!/usr/bin/env bash
# Compatibility entry point for the registry-based deployment.
# Images are built in CI and pulled from ECR; EC2 never rebuilds the stack.
set -euo pipefail

SERVICES="${1:-api,frontend,frontend-admin,frontend-users,frontend-consultant-site,frontend-consultant-dash}"

exec bash /opt/waytocanada/deploy/deploy-from-ecr.sh "$SERVICES"
