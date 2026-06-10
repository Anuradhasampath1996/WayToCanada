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
  php artisan migrate --force --no-ansi || true
fi

exec "$@"
