#!/bin/bash
# =============================================================
#  Skoolio – backup-db.sh
#  Nightly backup: local PostgreSQL → Azure Blob Storage
#  Runs via cron every night at 2:00 AM
#  Keeps last 7 days of backups, auto-deletes older ones
# =============================================================
set -e

# Load environment variables from .env
if [ -f "$(dirname "$0")/Backend/.env" ]; then
  set -a
  source "$(dirname "$0")/Backend/.env"
  set +a
fi

# ── Config ────────────────────────────────────────────────────
LOCAL_CONTAINER="skoolio_postgres"
LOCAL_USER="ashok"
LOCAL_DB="school_pos"
BACKUP_DIR="/tmp/pg_backups"
DATE=$(date +%Y-%m-%d_%H-%M)
BACKUP_FILE="skoolio_backup_${DATE}.sql.gz"
BLOB_CONTAINER="pg-backups"

# Azure Blob Storage (backup account)
# Read from environment variable — never hardcode secrets!
AZURE_CONNECTION_STRING="${BACKUP_STORAGE_CONNECTION_STRING}"

if [ -z "$AZURE_CONNECTION_STRING" ]; then
  echo "ERROR: BACKUP_STORAGE_CONNECTION_STRING not set in environment!"
  echo "Add it to Backend/.env and run: source Backend/.env"
  exit 1
fi

# ── Create backup directory ───────────────────────────────────
mkdir -p $BACKUP_DIR

echo "[$(date)] Starting backup..."

# ── Step 1: Dump from local PostgreSQL ───────────────────────
echo "[$(date)] Dumping database..."
docker exec $LOCAL_CONTAINER pg_dump \
  -U $LOCAL_USER \
  -d $LOCAL_DB \
  --no-owner \
  --no-acl \
  -F p \
  | gzip > $BACKUP_DIR/$BACKUP_FILE

echo "[$(date)] Dump complete: $BACKUP_FILE ($(du -sh $BACKUP_DIR/$BACKUP_FILE | cut -f1))"

# ── Step 2: Upload to Azure Blob Storage ─────────────────────
echo "[$(date)] Uploading to Azure Blob Storage..."
az storage blob upload \
  --connection-string "$AZURE_CONNECTION_STRING" \
  --container-name "$BLOB_CONTAINER" \
  --name "$BACKUP_FILE" \
  --file "$BACKUP_DIR/$BACKUP_FILE" \
  --overwrite

echo "[$(date)] Upload complete ✅"

# ── Step 3: Delete backups older than 7 days from blob ───────
echo "[$(date)] Cleaning up old backups (older than 7 days)..."
CUTOFF_DATE=$(date -d "7 days ago" +%Y-%m-%d)

az storage blob list \
  --connection-string "$AZURE_CONNECTION_STRING" \
  --container-name "$BLOB_CONTAINER" \
  --query "[?properties.lastModified < '$CUTOFF_DATE'].name" \
  --output tsv | while read blob_name; do
    if [ ! -z "$blob_name" ]; then
      az storage blob delete \
        --connection-string "$AZURE_CONNECTION_STRING" \
        --container-name "$BLOB_CONTAINER" \
        --name "$blob_name"
      echo "[$(date)] Deleted old backup: $blob_name"
    fi
done

# ── Step 4: Cleanup local temp file ──────────────────────────
rm -f $BACKUP_DIR/$BACKUP_FILE

echo "[$(date)] Backup complete ✅"
echo "[$(date)] File: $BACKUP_FILE uploaded to blob container: $BLOB_CONTAINER"
