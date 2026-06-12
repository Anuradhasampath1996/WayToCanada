#!/usr/bin/env bash
set -euo pipefail

cd /app/backend

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq libpq-dev unzip git libzip-dev libpng-dev curl
docker-php-ext-install -j"$(nproc)" pdo_pgsql bcmath zip gd

curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
composer install --no-interaction --prefer-dist --optimize-autoloader

cat > .env << 'ENVEOF'
APP_NAME=WayToCanada
APP_ENV=testing
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
LOG_CHANNEL=stderr
LOG_LEVEL=debug
DB_CONNECTION=cws
DB_CWS_HOST=127.0.0.1
DB_CWS_PORT=5432
DB_CWS_DATABASE=db_cws_test
DB_CWS_USERNAME=postgres
DB_CWS_PASSWORD=secret
SESSION_DRIVER=array
QUEUE_CONNECTION=sync
CACHE_STORE=array
MAIL_MAILER=array
GOOGLE_CLIENT_ID=dummy-ci
GOOGLE_CLIENT_SECRET=dummy-ci
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
GITHUB_CLIENT_ID=dummy-ci
GITHUB_CLIENT_SECRET=dummy-ci
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/github/callback
PUBLIC_FRONTEND_URL=http://localhost:3002
CONSULTANT_FRONTEND_URL=http://localhost:3001
CONSULTANT_DASHBOARD_URL=http://localhost:3004
ENVEOF

php artisan key:generate --force

for i in $(seq 1 30); do
  if php -r "try { new PDO('pgsql:host=127.0.0.1;port=5432;dbname=db_cws_test', 'postgres', 'secret'); exit(0); } catch (Throwable \$e) { exit(1); }"; then
    echo "Postgres ready"
    break
  fi
  echo "Waiting for Postgres... ($i/30)"
  sleep 2
done

php artisan migrate --force
php artisan test
