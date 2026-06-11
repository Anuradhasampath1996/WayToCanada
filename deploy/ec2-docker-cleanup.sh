#!/bin/bash
# Free Docker disk space on EC2 before/after image loads.
set -euo pipefail

echo ">>> Disk before cleanup:"
df -h / | tail -1

docker builder prune -af 2>/dev/null || true
docker container prune -f 2>/dev/null || true
docker image prune -f 2>/dev/null || true

# Remove failed/partial containerd ingest data from interrupted loads
find /var/lib/docker/tmp -mindepth 1 -maxdepth 1 -mmin +30 -exec rm -rf {} + 2>/dev/null || true

echo ">>> Disk after cleanup:"
df -h / | tail -1
