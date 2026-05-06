#!/usr/bin/env bash
#
# Alucurv ERP — backup PostgreSQL ke file gzip.
#
# Usage:
#   bash scripts/backup.sh                  # backup ke ./backups/
#   bash scripts/backup.sh /path/to/dir     # backup ke folder lain
#
# Cron daily 02:00:
#   0 2 * * * cd /path/to/erp && bash scripts/backup.sh /backup >> /var/log/erp-backup.log 2>&1
#
# Retention: otomatis hapus backup > 30 hari di folder yang sama.
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

[[ -f docker-compose.yml ]] || err "Run dari root repo"
[[ -f .env ]] || err ".env tidak ada"

set -a; source .env; set +a

BACKUP_DIR="${1:-./backups}"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="${BACKUP_DIR}/alucurv-${TIMESTAMP}.sql.gz"

log "Dumping ${POSTGRES_DB} → ${FILE}..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" | gzip > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
ok "Backup OK: ${FILE} (${SIZE})"

# Retention: hapus backup > 30 hari
DELETED=$(find "$BACKUP_DIR" -name "alucurv-*.sql.gz" -mtime +30 -delete -print | wc -l)
if [[ $DELETED -gt 0 ]]; then
  log "Retention: hapus ${DELETED} backup > 30 hari"
fi

# Optional: upload ke remote (uncomment + sesuaikan kalau mau)
# rsync -avz "$FILE" user@remote-backup-host:/backups/
# aws s3 cp "$FILE" s3://my-bucket/erp-backups/

echo ""
echo "  Restore dari backup ini:"
echo "  gunzip -c ${FILE} | docker compose exec -T postgres psql -U ${POSTGRES_USER} ${POSTGRES_DB}"
