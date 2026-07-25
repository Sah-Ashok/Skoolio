#!/bin/bash
# =============================================================
#  Skoolio – deploy.sh
#  Run this on the Azure Linux VM to pull latest code and
#  restart the stack with zero-downtime rebuild.
#
#  Usage:
#    chmod +x deploy.sh
#    ./deploy.sh
# =============================================================
set -e  # exit immediately on any error

echo ""
echo "======================================================"
echo "  Skoolio – deploying latest build"
echo "======================================================"

# 1. Pull latest code from git
echo ""
echo "[1/5] Pulling latest code..."
git pull origin main

# 2. Build new images (no cache to guarantee fresh build)
echo ""
echo "[2/5] Building Docker images..."
docker compose build --no-cache

# 3. Bring up containers (recreate changed ones only)
echo ""
echo "[3/5] Starting containers..."
docker compose up -d --remove-orphans

# 4. Remove dangling images to free disk space
echo ""
echo "[4/5] Cleaning up old images..."
docker image prune -f

# 5. Show running containers
echo ""
echo "[5/5] Running containers:"
docker compose ps

echo ""
echo "======================================================"
echo "  Deploy complete!"
echo "  App is live at http://$(curl -s ifconfig.me)"
echo "======================================================"
