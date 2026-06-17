#!/bin/bash
# Run once on EC2 as ubuntu/root:
#   sudo bash /opt/waytocanada/deploy/fix-nginx-sudo.sh
# Grants github-actions passwordless sudo for nginx deploy steps.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-github-actions}"

cat > "/etc/sudoers.d/${DEPLOY_USER}-deploy" <<EOF
# Allow ${DEPLOY_USER} to manage nginx during deploys
${DEPLOY_USER} ALL=(ALL) NOPASSWD: /usr/bin/cp, /bin/cp, /bin/ln, /bin/rm, /usr/sbin/nginx, /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl restart nginx, ${DEPLOY_PATH:-/opt/waytocanada}/deploy/fix-domain-nginx.sh, /bin/bash ${DEPLOY_PATH:-/opt/waytocanada}/deploy/fix-domain-nginx.sh
EOF
chmod 440 "/etc/sudoers.d/${DEPLOY_USER}-deploy"
visudo -c -f "/etc/sudoers.d/${DEPLOY_USER}-deploy"
echo ">>> Sudo permissions updated for ${DEPLOY_USER}"
