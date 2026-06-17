#!/bin/bash
# Apply rcicmaster nginx on EC2 (run as root):
#   sudo bash /opt/waytocanada/deploy/apply-nginx.sh
set -euo pipefail
exec bash "$(dirname "$0")/fix-domain-nginx.sh"
