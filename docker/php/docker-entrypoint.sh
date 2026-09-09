#!/bin/sh
set -e

cd /var/www

mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache

# Runtime bootstrap (skipped during image build to avoid needing .env)
if [ -f .env ]; then
  php artisan package:discover --ansi || true
  php artisan config:clear --ansi || true
  php artisan route:clear --ansi || true
  php artisan view:clear --ansi || true
  # public/storage → storage/app/public (needed for /storage/* via artisan serve)
  php artisan storage:link --ansi || true
  php artisan migrate --force --no-ansi || true

  # Long jobs (CICC sync, legislation) need dedicated workers inside the API container.
  pkill -f "artisan queue:work" 2>/dev/null || true
  nohup php artisan queue:work database --sleep=2 --tries=1 --timeout=28800 --memory=512 \
    >> /tmp/queue-worker-1.log 2>&1 &
  nohup php artisan queue:work database --sleep=2 --tries=1 --timeout=28800 --memory=512 \
    >> /tmp/queue-worker-2.log 2>&1 &
fi

exec "$@"
