#!/bin/bash
uptime
sudo -u github-actions docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | head -12
docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep waytocanada | head -10
