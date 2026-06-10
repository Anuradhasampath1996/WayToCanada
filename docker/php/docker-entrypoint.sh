#!/bin/sh
set -e

cd /var/www

# Runtime bootstrap (skipped during image build to avoid needing .env)
if [ -f .env ]; then
  php artisan package:discover --ansi || true
  php artisan config:cache --ansi || true
  php artisan route:cache --ansi || true
  php artisan migrate --force --no-ansi || true
fi

exec "$@"
