#!/usr/bin/env bash
# Import RCIC Entry-to-Practice Exam LMS bundle into production db_lms.
set -euo pipefail

DEPLOY_PATH="/opt/waytocanada"
BUNDLE="${1:-$DEPLOY_PATH/deploy/course-bundles/rcic-epe-prep-3.json}"

if [[ ! -f "$BUNDLE" ]]; then
  echo "Missing bundle: $BUNDLE"
  exit 1
fi

# Copy into the API container workspace (mounted or docker cp).
docker cp "$BUNDLE" wtc_api:/tmp/rcic-epe-bundle.json
docker cp "$DEPLOY_PATH/backend/scripts/import-lms-course-bundle.php" wtc_api:/tmp/import-lms-course-bundle.php

docker exec wtc_api php artisan migrate --force --no-ansi
docker exec wtc_api php /tmp/import-lms-course-bundle.php /tmp/rcic-epe-bundle.json

echo ">>> RCIC EPE course import complete"
