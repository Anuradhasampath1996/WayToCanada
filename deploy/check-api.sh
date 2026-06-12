#!/bin/bash
sudo -u github-actions docker exec wtc_api grep DB_CWS /var/www/.env
echo "---"
curl -s http://127.0.0.1:8000/up
echo ""
echo "--- logs ---"
sudo -u github-actions docker logs wtc_api --tail 20
