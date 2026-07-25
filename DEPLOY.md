# Skoolio – Azure Linux VM Deployment Guide

Full step-by-step guide to deploy Skoolio on a fresh Azure Ubuntu VM
using Docker + Docker Compose + Nginx.

---

## Overview

```
Browser
   │
   ▼
Azure VM  :80 / :443
   │
   ▼
Nginx (Docker container)
   ├──  /api/*  ──────────►  backend:5001  (Express)
   └──  /*  ──────────────►  frontend:3000 (Next.js)

External Azure services (no containers needed):
   • PostgreSQL – Azure Database for PostgreSQL
   • Redis      – Azure Managed Redis
   • Blob       – Azure Storage (logos, profiles, receipts)
```

---

## Part 1 – Azure VM Setup (do once)

### 1.1  Create the VM in Azure Portal

1. Go to **Azure Portal → Virtual Machines → Create**
2. Choose these settings:
   - **Image**: Ubuntu Server 24.04 LTS
   - **Size**: Standard_B2s (2 vCPU, 4 GB RAM) — minimum for building images
   - **Authentication**: SSH public key (paste your public key)
   - **Inbound ports**: Allow **SSH (22)**, **HTTP (80)**, **HTTPS (443)**
3. Click **Review + Create → Create**
4. Note the **Public IP address** once created

### 1.2  Open required ports in Network Security Group

In Azure Portal → VM → Networking → Add inbound port rule:

| Priority | Port | Protocol | Action |
|----------|------|----------|--------|
| 100      | 22   | TCP      | Allow  |
| 110      | 80   | TCP      | Allow  |
| 120      | 443  | TCP      | Allow  |

---

## Part 2 – Server Preparation (SSH into VM, do once)

SSH into your VM:
```bash
ssh azureuser@<YOUR_VM_PUBLIC_IP>
```

### 2.1  Update system packages

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2  Install Docker

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker apt repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine + Compose plugin
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
                    docker-buildx-plugin docker-compose-plugin

# Allow your user to run docker without sudo
sudo usermod -aG docker $USER

# Apply group change (or logout and back in)
newgrp docker

# Verify
docker --version
docker compose version
```

### 2.3  Install Git

```bash
sudo apt install -y git
```

### 2.4  Configure Git (if pushing from VM)

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

---

## Part 3 – Clone the Project

```bash
# Go to home directory
cd ~

# Clone your repo (use HTTPS or SSH)
git clone https://github.com/YOUR_USERNAME/school-pos.git
cd school-pos
```

If repo is private, use a personal access token:
```bash
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/school-pos.git
```

---

## Part 4 – Configure Environment Variables

The backend reads from `Backend/.env`. This file is in `.gitignore` so
you must create it on the server manually.

```bash
nano Backend/.env
```

Paste and fill in your values:
```env
PORT=5001
NODE_ENV=production

# Azure PostgreSQL
DB_HOST=stu-postgres.postgres.database.azure.com
DB_PORT=5432
DB_USER=ashok
DB_PASSWORD=YOUR_REAL_PASSWORD
DB_NAME=school_pos

# JWT
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING_AT_LEAST_32_CHARS
JWT_EXPIRES_IN=10d

# Redis (Azure Managed Redis)
REDIS_HOST=vapory-pin-rhodolite-27495.db.redis.io
REDIS_PORT=18091
REDIS_PASSWORD=YOUR_REDIS_PASSWORD
REDIS_DB=0

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sahashokme@gmail.com
SMTP_PASS=YOUR_APP_PASSWORD
SMTP_FROM=Skoolio <sahashokme@gmail.com>

# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=skoolio;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net
AZURE_STORAGE_ACCOUNT_NAME=skoolio
AZURE_LOGOS_CONTAINER=skoolio-logos
AZURE_PROFILES_CONTAINER=skoolio-profiles
AZURE_RECEIPTS_CONTAINER=school-receipts

# CORS – allow requests from nginx
CORS_ORIGIN=http://localhost
```

Save and exit: `Ctrl+X → Y → Enter`

---

## Part 5 – First Build and Run

```bash
# Make deploy script executable
chmod +x deploy.sh

# Build all images and start the stack
docker compose up -d --build
```

This will take **5–10 minutes** the first time (downloading base images,
installing npm packages, compiling TypeScript, building Next.js).

### Check it's running

```bash
# See all containers
docker compose ps

# Expected output:
# NAME                STATUS
# skoolio_backend     Up (healthy)
# skoolio_frontend    Up (healthy)
# skoolio_nginx       Up (healthy)
```

### Test the endpoints

```bash
# Health check
curl http://localhost/health
# → ok

# API health
curl http://localhost/api/health
# → {"status":"ok"}

# App in browser
# Open: http://YOUR_VM_PUBLIC_IP
```

---

## Part 6 – View Logs

```bash
# All services
docker compose logs -f

# Individual service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

---

## Part 7 – Future Deployments

Every time you push new code, SSH into the VM and run:

```bash
cd ~/school-pos
./deploy.sh
```

The script:
1. Pulls latest code from git
2. Rebuilds Docker images
3. Restarts changed containers only
4. Cleans up old images
5. Prints the live URL

---

## Part 8 – SSL with Let's Encrypt (when you have a domain)

Point your domain's A record to the VM's public IP, then:

### 8.1  Install Certbot on the VM (not inside Docker)

```bash
sudo apt install -y certbot
```

### 8.2  Get certificate (VM must be reachable on port 80 first)

Stop nginx temporarily so certbot can bind to port 80:
```bash
docker compose stop nginx
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

Certbot saves certs to `/etc/letsencrypt/live/yourdomain.com/`.

### 8.3  Copy certs into the project

```bash
mkdir -p ~/school-pos/nginx/certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ~/school-pos/nginx/certs/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   ~/school-pos/nginx/certs/
sudo chown $USER:$USER ~/school-pos/nginx/certs/*
```

### 8.4  Uncomment SSL in nginx/nginx.conf

In `nginx/nginx.conf`, uncomment:
- The HTTP → HTTPS redirect server block
- The `listen 443 ssl http2` line
- All `ssl_*` directives
- The `Strict-Transport-Security` header
- The volume mount `- ./nginx/certs:/etc/nginx/certs:ro` in docker-compose.yml

Also update `server_name _` to `server_name yourdomain.com www.yourdomain.com`.

### 8.5  Update CORS_ORIGIN in Backend/.env

```env
CORS_ORIGIN=https://yourdomain.com
```

### 8.6  Restart the stack

```bash
docker compose up -d --build
```

### 8.7  Auto-renew certs (cron job)

```bash
sudo crontab -e
```

Add this line (renews at 3am on the 1st of every month):
```
0 3 1 * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /home/azureuser/school-pos/nginx/certs/ && \
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   /home/azureuser/school-pos/nginx/certs/ && \
  cd /home/azureuser/school-pos && docker compose restart nginx
```

---

## Part 9 – Useful Commands

```bash
# Restart everything
docker compose restart

# Restart one service
docker compose restart backend
docker compose restart frontend
docker compose restart nginx

# Open shell inside a container
docker compose exec backend sh
docker compose exec frontend sh

# Check disk usage (images can be large)
docker system df

# Clean up stopped containers + dangling images
docker system prune -f

# Check VM resource usage
htop
```

---

## Troubleshooting

### Container not starting

```bash
docker compose logs backend    # read the error
docker compose logs frontend
```

### Port 80 already in use

```bash
sudo lsof -i :80               # find what's using port 80
sudo systemctl stop nginx      # if system nginx is running
sudo systemctl disable nginx   # prevent it from starting again
```

### Azure PostgreSQL connection refused

- Check the Azure PostgreSQL firewall rules allow the VM's public IP
- Or enable **Allow Azure services** in the PG firewall settings
- Test from the VM: `nc -zv stu-postgres.postgres.database.azure.com 5432`

### Out of disk space during build

```bash
docker system prune -a -f      # removes ALL unused images and containers
df -h                          # check disk space
```

### Cannot connect to Redis

```bash
# Test Redis connectivity from the VM
nc -zv vapory-pin-rhodolite-27495.db.redis.io 18091
```
