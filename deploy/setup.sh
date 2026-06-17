#!/usr/bin/env bash
# =============================================================================
# WayToCanada — EC2 production bootstrap (Ubuntu 24.04 LTS)
# Domain : rcicmaster.com / www.rcicmaster.com
# Stack  : Laravel API (Docker :8000) + React frontend (Docker :3000)
# Region : AWS Canada Central (ca-central-1)
#
# Usage (run as root on a fresh EC2 instance):
#   chmod +x setup.sh
#   sudo ./setup.sh
#
# Optional environment overrides:
#   DOMAIN=example.com API_PORT=8000 FRONTEND_PORT=3000 ./setup.sh
# =============================================================================

set -euo pipefail

# ── Configurable variables ─────────────────────────────────────────────────────
DOMAIN="${DOMAIN:-rcicmaster.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.rcicmaster.com}"
API_PORT="${API_PORT:-8000}"           # Laravel container published port
FRONTEND_PORT="${FRONTEND_PORT:-3000}" # React container published port
DEPLOY_USER="${DEPLOY_USER:-github-actions}"
APP_DIR="${APP_DIR:-/opt/waytocanada}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/${DOMAIN}}"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo -e "\n\033[1;32m[setup]\033[0m $*"; }
warn() { echo -e "\033[1;33m[setup]\033[0m $*"; }
die()  { echo -e "\033[1;31m[setup] ERROR:\033[0m $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "Run this script as root: sudo ./setup.sh"
  fi
}

# =============================================================================
# 1. SYSTEM UPDATE
# =============================================================================
system_update() {
  log "Updating package lists and upgrading installed packages…"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get upgrade -y
  apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ufw \
    git \
    unzip \
    software-properties-common \
    apt-transport-https
}

# =============================================================================
# 2. DOCKER ENGINE + COMPOSE PLUGIN
# =============================================================================
install_docker() {
  if command -v docker &>/dev/null; then
    warn "Docker already installed — skipping engine install."
  else
    log "Installing Docker Engine (official repository)…"

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "${VERSION_CODENAME}") stable" \
      > /etc/apt/sources.list.d/docker.list

    apt-get update -y
    apt-get install -y \
      docker-ce \
      docker-ce-cli \
      containerd.io \
      docker-buildx-plugin \
      docker-compose-plugin
  fi

  log "Enabling Docker to start on boot…"
  systemctl enable docker
  systemctl start docker

  docker --version
  docker compose version
}

# =============================================================================
# 3. NGINX REVERSE PROXY
# =============================================================================
install_nginx() {
  if command -v nginx &>/dev/null; then
    warn "Nginx already installed — refreshing site config only."
  else
    log "Installing Nginx…"
    apt-get install -y nginx
  fi

  log "Writing Nginx server block for ${DOMAIN} and ${WWW_DOMAIN}…"

  cat > "${NGINX_SITE}" <<EOF
# Managed by deploy/setup.sh — WayToCanada production reverse proxy
# HTTP only (Port 80). Add Certbot/Let's Encrypt after DNS is pointed here.

upstream wtc_frontend {
    server 127.0.0.1:${FRONTEND_PORT};
    keepalive 16;
}

upstream wtc_api {
    server 127.0.0.1:${API_PORT};
    keepalive 16;
}

# Redirect bare domain → www (optional; comment out if you prefer apex as canonical)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    return 301 http://${WWW_DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${WWW_DOMAIN};

    # Security / size limits
    client_max_body_size 64M;
    server_tokens off;

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log warn;

    # ── Laravel API (all /api/* requests) ───────────────────────────────────
    location /api/ {
        proxy_pass         http://wtc_api;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Connection        "";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # ── Laravel health / artisan routes (if exposed at root) ─────────────────
    location ~ ^/(health|sanctum)(/|\$) {
        proxy_pass         http://wtc_api;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
    }

    # ── React frontend (everything else) ────────────────────────────────────
    location / {
        proxy_pass         http://wtc_frontend;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  ln -sf "${NGINX_SITE}" "/etc/nginx/sites-enabled/${DOMAIN}"
  rm -f /etc/nginx/sites-enabled/default

  log "Testing Nginx configuration…"
  nginx -t

  systemctl enable nginx
  systemctl restart nginx
}

# =============================================================================
# 4. CI/CD DEPLOY USER (GitHub Actions)
# =============================================================================
setup_deploy_user() {
  if id "${DEPLOY_USER}" &>/dev/null; then
    warn "User '${DEPLOY_USER}' already exists — updating groups and SSH dir."
  else
    log "Creating deploy user '${DEPLOY_USER}'…"
    useradd -m -s /bin/bash "${DEPLOY_USER}"
  fi

  log "Adding '${DEPLOY_USER}' to docker group…"
  usermod -aG docker "${DEPLOY_USER}"

  log "Preparing SSH directory for '${DEPLOY_USER}'…"
  local ssh_dir="/home/${DEPLOY_USER}/.ssh"
  mkdir -p "${ssh_dir}"
  chmod 700 "${ssh_dir}"

  # authorized_keys is created empty; you append the GitHub Actions *public* key later
  touch "${ssh_dir}/authorized_keys"
  chmod 600 "${ssh_dir}/authorized_keys"

  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${ssh_dir}"

  log "Creating application directory ${APP_DIR}…"
  mkdir -p "${APP_DIR}"
  chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${APP_DIR}"

  # Allow github-actions to reload nginx after deploy (optional but common)
  cat > "/etc/sudoers.d/${DEPLOY_USER}-deploy" <<EOF
# Allow ${DEPLOY_USER} to manage nginx during deploys
${DEPLOY_USER} ALL=(ALL) NOPASSWD: /usr/bin/cp, /bin/cp, /bin/ln, /bin/rm, /usr/sbin/nginx, /usr/sbin/nginx -t, /bin/systemctl reload nginx, /bin/systemctl restart nginx, ${APP_DIR}/deploy/fix-domain-nginx.sh, /bin/bash ${APP_DIR}/deploy/fix-domain-nginx.sh
EOF
  chmod 440 "/etc/sudoers.d/${DEPLOY_USER}-deploy"
}

# =============================================================================
# 5. BASIC FIREWALL (recommended for production EC2)
# =============================================================================
configure_firewall() {
  log "Configuring UFW (allow SSH, HTTP, HTTPS)…"
  ufw --force reset
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  ufw status verbose
}

# =============================================================================
# MAIN
# =============================================================================
main() {
  require_root

  log "Starting WayToCanada server bootstrap…"
  log "Domain: ${DOMAIN} / ${WWW_DOMAIN}"
  log "Proxy:  / → :${FRONTEND_PORT} (React)  |  /api/ → :${API_PORT} (Laravel)"

  system_update
  install_docker
  install_nginx
  setup_deploy_user
  configure_firewall

  log "Bootstrap complete."
  echo ""
  echo "══════════════════════════════════════════════════════════════════════"
  echo " NEXT STEPS (see deploy/EC2-DEPLOY.md for full guide)"
  echo "══════════════════════════════════════════════════════════════════════"
  echo " 1. Point DNS A records for ${DOMAIN} and ${WWW_DOMAIN} → this server's public IP"
  echo " 2. Generate an SSH deploy key for user '${DEPLOY_USER}' (instructions below)"
  echo " 3. Add GitHub Secrets: SSH_PRIVATE_KEY, SSH_HOST, SSH_USER"
  echo " 4. Publish Docker containers on 127.0.0.1:${API_PORT} and :${FRONTEND_PORT}"
  echo " 5. After DNS propagates, install TLS: sudo certbot --nginx -d ${DOMAIN} -d ${WWW_DOMAIN}"
  echo "══════════════════════════════════════════════════════════════════════"
}

main "$@"
