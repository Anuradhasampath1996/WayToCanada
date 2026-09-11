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
  php artisan db:seed --class=PathwayCatalogSeeder --force --no-ansi || true
  php artisan db:seed --class=GovernmentFormVersionSeeder --force --no-ansi || true
  # Restore missing official autofill PDFs into private storage (hash-matched Canada.ca download)
  php artisan government-forms:ensure-templates --no-ansi || true

  # Long jobs (CICC sync, legislation) need dedicated workers inside the API container.
  # Minimal images may lack pkill/kill — stop workers via /proc + posix_kill.
  php -r '
    foreach (glob("/proc/[0-9]*/cmdline") as $f) {
      $c = @file_get_contents($f);
      if ($c !== false && str_contains($c, "artisan queue:work")) {
        $pid = (int) basename(dirname($f));
        if ($pid > 1) { @posix_kill($pid, 9); }
      }
    }
  ' || true
  sleep 1
  # --tries must be >= Job::$tries (CICC sync uses 3) or restarts mark runs failed.
  nohup php artisan queue:work database --sleep=2 --tries=3 --timeout=28800 --memory=512 \
    >> /tmp/queue-worker-1.log 2>&1 &
  nohup php artisan queue:work database --sleep=2 --tries=3 --timeout=28800 --memory=512 \
    >> /tmp/queue-worker-2.log 2>&1 &
fi

exec "$@"
