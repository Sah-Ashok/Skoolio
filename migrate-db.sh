#!/bin/bash
# =============================================================
#  Skoolio – migrate-db.sh
#  Migrates data from Azure PostgreSQL → local Docker PostgreSQL
#  Run this ONCE on the VM after docker compose up -d
# =============================================================
set -e

echo ""
echo "======================================================"
echo "  Skoolio – Database Migration"
echo "  Azure PostgreSQL → Local Docker PostgreSQL"
echo "======================================================"

# Azure PostgreSQL connection details
AZURE_HOST="stu-postgres.postgres.database.azure.com"
AZURE_PORT="5432"
AZURE_USER="ashok"
AZURE_DB="school_pos"
AZURE_PASSWORD="Abhisah@21"

# Local PostgreSQL container
LOCAL_CONTAINER="skoolio_postgres"
LOCAL_USER="ashok"
LOCAL_DB="school_pos"

echo ""
echo "[1/4] Dumping data from Azure PostgreSQL..."
PGPASSWORD=$AZURE_PASSWORD /usr/lib/postgresql/18/bin/pg_dump \
  -h $AZURE_HOST \
  -p $AZURE_PORT \
  -U $AZURE_USER \
  -d $AZURE_DB \
  --no-owner \
  --no-acl \
  -F c \
  -f /tmp/skoolio_backup.dump

echo "      Dump complete ✅"

echo ""
echo "[2/4] Waiting for local PostgreSQL to be ready..."
until docker exec $LOCAL_CONTAINER pg_isready -U $LOCAL_USER -d $LOCAL_DB; do
  echo "      Waiting..."
  sleep 2
done
echo "      PostgreSQL ready ✅"

echo ""
echo "[3/4] Restoring data to local PostgreSQL..."
# Copy dump into container then restore using container's pg_restore
docker cp /tmp/skoolio_backup.dump $LOCAL_CONTAINER:/tmp/skoolio_backup.dump

docker exec $LOCAL_CONTAINER pg_restore \
  -U $LOCAL_USER \
  -d $LOCAL_DB \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  /tmp/skoolio_backup.dump

echo "      Restore complete ✅"

echo ""
echo "[4/4] Verifying migration..."
TABLE_COUNT=$(docker exec $LOCAL_CONTAINER psql \
  -U $LOCAL_USER \
  -d $LOCAL_DB \
  -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "      Tables in local DB: $TABLE_COUNT ✅"

# Cleanup
rm -f /tmp/skoolio_backup.dump
docker exec $LOCAL_CONTAINER rm -f /tmp/skoolio_backup.dump

echo ""
echo "======================================================"
echo "  Migration complete!"
echo "  Local PostgreSQL is ready with all your data ✅"
echo "======================================================"
