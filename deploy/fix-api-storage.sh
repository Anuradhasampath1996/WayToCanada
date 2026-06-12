#!/bin/bash
sudo -u github-actions docker exec wtc_api sh -c 'mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views bootstrap/cache && chmod -R 775 storage bootstrap/cache'
sudo -u github-actions docker exec wtc_api sh -c 'php artisan config:clear; php artisan route:clear; php artisan view:clear'
curl -sI http://127.0.0.1:8000/up | head -3
curl -sI http://127.0.0.1:8000/api/ | head -3
