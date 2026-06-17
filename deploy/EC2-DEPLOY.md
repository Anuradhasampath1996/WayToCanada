# WayToCanada — AWS EC2 Production Bootstrap Guide

**Instance:** Ubuntu 24.04 LTS · AWS Canada Central (`ca-central-1`)  
**Domain:** `rcicmaster.com` · `www.rcicmaster.com`  
**Stack:** Laravel API (Docker `:8000`) + React frontend (Docker `:3000`)

---

## Quick start

### 1. Upload and run `setup.sh` on the EC2 instance

From your **local machine** (Windows PowerShell example):

```powershell
# Copy the script to the server (use your EC2 key — NOT the github-actions key)
scp -i "C:\Users\anura\Downloads\waytocanada-ssh-key.pem" `
  deploy/setup.sh ubuntu@<EC2_PUBLIC_IP>:/home/ubuntu/

# SSH into the instance
ssh -i "C:\Users\anura\Downloads\waytocanada-ssh-key.pem" ubuntu@<EC2_PUBLIC_IP>

# On the server — run as root
chmod +x setup.sh
sudo ./setup.sh
```

> **Security:** `waytocanada-ssh-key.pem` is your **EC2 login key** only.  
> Never commit it to Git or paste it into GitHub Secrets.

---

### 2. DNS configuration

In your domain registrar (Namecheap or Route 53), create **A records** pointing to your EC2 public IP:

| Host | Subdomain | Service |
|------|-----------|---------|
| `@` | `rcicmaster.com` | Apex → redirects to www |
| `www` | `www.rcicmaster.com` | Public marketing site |
| `admin` | `admin.rcicmaster.com` | Admin dashboard |
| `app` | `app.rcicmaster.com` | Client / user dashboard |
| `consultant` | `consultant.rcicmaster.com` | Consultant website |
| `portal` | `portal.rcicmaster.com` | Consultant workspace |

Wait for propagation (5–30 minutes, sometimes longer).

After DNS propagates, apply nginx and TLS:

```bash
sudo bash /opt/waytocanada/deploy/apply-nginx.sh
sudo certbot --nginx -d rcicmaster.com -d www.rcicmaster.com \
  -d admin.rcicmaster.com -d app.rcicmaster.com \
  -d consultant.rcicmaster.com -d portal.rcicmaster.com
```

---

### 3. Docker port mapping (after you add production `docker-compose`)

Nginx on the host expects containers bound to **localhost**:

```yaml
services:
  api:
    ports:
      - "127.0.0.1:8000:8000"   # Laravel

  frontend:
    ports:
      - "127.0.0.1:3000:3000"   # React
```

Traffic flow:

```
Internet :80  →  Nginx (host)  →  127.0.0.1:3000  (React, path /)
                                 →  127.0.0.1:8000  (Laravel, path /api/)
```

---

## GitHub Actions deploy user — SSH key setup

The `setup.sh` script creates user `github-actions` with:

- Membership in the `docker` group (run `docker` without `sudo`)
- `/home/github-actions/.ssh/` with permissions `700` (dir) / `600` (files)
- App directory: `/opt/waytocanada`

You must **generate a separate SSH key pair** for CI/CD deployments.

### Option A — Generate the key **on the EC2 server** (recommended)

SSH in as `ubuntu`, then:

```bash
# Become the deploy user
sudo -u github-actions -i

# Generate a dedicated deploy key (no passphrase — required for unattended CI)
ssh-keygen -t ed25519 -C "github-actions-deploy-waytocanada" -f ~/.ssh/github_deploy -N ""

# Authorize the public key for SSH login
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Show the PRIVATE key — copy this ENTIRE output into GitHub Secrets
cat ~/.ssh/github_deploy
```

Copy **everything** from `-----BEGIN OPENSSH PRIVATE KEY-----` through `-----END OPENSSH PRIVATE KEY-----` (inclusive).

### Step 2 — Register the **same public key** as a GitHub Deploy Key (required for `git pull`)

SSH login working but deploy fails with `git@github.com: Permission denied (publickey)` means this step was skipped.

On the server (as `github-actions`):

```bash
cat ~/.ssh/github_deploy.pub
```

In GitHub: **Repository → Settings → Deploy keys → Add deploy key**

| Field | Value |
|-------|-------|
| Title | `waytocanada-ec2-deploy` |
| Key | Paste full output of `github_deploy.pub` |
| Allow write access | **unchecked** (read-only is enough) |

> Use the **same key pair**: private key → `SSH_PRIVATE_KEY` secret; public key → Deploy keys **and** `authorized_keys` on the server.

### Option B — Generate the key **on your local machine**

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy-waytocanada" -f github_deploy -N ""
```

Then on the server:

```bash
# Append the LOCAL public key to the server
sudo bash -c 'cat >> /home/github-actions/.ssh/authorized_keys' < github_deploy.pub
sudo chown github-actions:github-actions /home/github-actions/.ssh/authorized_keys
sudo chmod 600 /home/github-actions/.ssh/authorized_keys
```

Use the **local** `github_deploy` (private) file contents for GitHub Secrets.

---

## GitHub Repository Secrets

In **GitHub → Repository → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|-------------|-------|
| `SSH_PRIVATE_KEY` | Full private key file contents (`github_deploy`), including BEGIN/END lines |
| `SSH_HOST` | EC2 public IP or `www.rcicmaster.com` (after DNS works) |
| `SSH_USER` | `github-actions` |
| `SSH_PORT` | `22` (optional; default) |

Example minimal deploy step in a workflow:

```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@v1
  with:
    host: ${{ secrets.SSH_HOST }}
    username: ${{ secrets.SSH_USER }}
    key: ${{ secrets.SSH_PRIVATE_KEY }}
    script: |
      cd /opt/waytocanada
      git pull origin main
      docker compose pull
      docker compose up -d --build
      sudo nginx -t && sudo systemctl reload nginx
```

---

## TLS / HTTPS (after DNS is live)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rcicmaster.com -d www.rcicmaster.com
```

Certbot will update the Nginx config for HTTPS and set up auto-renewal.

---

## Verify installation

```bash
# Docker
docker run --rm hello-world

# Nginx
sudo nginx -t
curl -I http://localhost

# Deploy user can use Docker
sudo -u github-actions docker ps

# Firewall
sudo ufw status
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `502 Bad Gateway` | Containers not running or wrong ports — check `docker ps` and `127.0.0.1:3000` / `:8000` |
| GitHub Actions SSH fails | Verify `authorized_keys` on server, `SSH_PRIVATE_KEY` has correct newlines, security group allows port 22 |
| `git fetch` Permission denied (publickey) | Add `~/.ssh/github_deploy.pub` as a **Deploy key** under repo Settings → Deploy keys (see Step 2 above) |
| Permission denied (docker) | `sudo usermod -aG docker github-actions` then re-login |
| Domain not resolving | Confirm A records and wait for DNS propagation |
| `rcicmaster.com` redirects to `lightersmenia.com` | Old nginx config on EC2 — run `sudo bash /opt/waytocanada/deploy/fix-domain-nginx.sh` |
| `www.rcicmaster.com` does not resolve | Add **A record** `www` → EC2 public IP in Namecheap DNS |

### Fix: rcicmaster.com → lightersmenia.com redirect

EC2 nginx still has the old `lightersmenia` site enabled. On the server:

```bash
ssh ubuntu@<EC2_IP>
cd /opt/waytocanada && git pull origin main
sudo bash deploy/fix-domain-nginx.sh
```

Or trigger GitHub Actions workflow **Fix nginx domain (rcicmaster)** (`fix-nginx-domain.yml`) after pushing this repo.

Verify:

```bash
curl -sI -H 'Host: rcicmaster.com' http://127.0.0.1/ | grep -i location
# Expected: Location: http://www.rcicmaster.com/
```

Also add DNS **A records** in Namecheap (all → EC2 IP `3.96.127.94`):

| Host | Points to |
|------|-----------|
| `@` | EC2 IP |
| `www` | EC2 IP |
| `admin`, `app`, `consultant`, `portal` | EC2 IP |

Without `www`, apex redirect will fail after nginx is fixed.

---

## Files in this repo

| File | Purpose |
|------|---------|
| `deploy/setup.sh` | One-shot EC2 bootstrap script |
| `deploy/EC2-DEPLOY.md` | This guide |
