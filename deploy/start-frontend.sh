#!/bin/bash
set -e
cd /opt/waytocanada
docker compose -f docker-compose.prod.yml up -d frontend
sleep 10
docker compose -f docker-compose.prod.yml ps
curl -sI http://127.0.0.1:3000/ | head -3
curl -sI http://127.0.0.1/ -H 'Host: www.lightersmenia.com' | head -5
