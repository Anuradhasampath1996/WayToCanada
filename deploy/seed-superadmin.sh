#!/bin/bash
set -euo pipefail
cd /opt/waytocanada
echo ">>> Seeding roles and permissions..."
docker exec wtc_api php artisan db:seed --class=RolesAndPermissionsSeeder --force --no-ansi
echo ">>> Seeding super admin..."
docker exec wtc_api php artisan db:seed --class=SuperAdminSeeder --force --no-ansi
echo ">>> Super admin ready."
