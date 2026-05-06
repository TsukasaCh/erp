#!/usr/bin/env bash
#
# Alucurv ERP — restore database dari backup .sql.gz
#
# Usage:
#   bash scripts/restore.sh ./backups/alucurv-20260501-020000.sql.gz
#
# WARNING: ini destructive — semua data current akan di-replace dengan dump.
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: bash scripts/restore.sh <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/alucurv-*.sql.gz 2>/dev/null || echo "  (tidak ada di ./backups)"
  exit 1
fi

[[ -f "$BACKUP_FILE" ]] || { echo -e "${RED}File tidak ada: $BACKUP_FILE${NC}"; exit 1; }
[[ -f .env ]] || { echo -e "${RED}.env tidak ada${NC}"; exit 1; }
set -a; source .env; set +a

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  WARNING: RESTORE DATABASE DARI BACKUP${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo "  File   : $BACKUP_FILE ($SIZE)"
echo "  Target : ${POSTGRES_DB}"
echo ""
echo -e "${RED}  Semua data CURRENT akan dihapus dan diganti dengan isi backup.${NC}"
echo ""
read -rp "  Ketik 'YES' untuk lanjut: " CONFIRM
[[ "$CONFIRM" == "YES" ]] || { echo "Dibatalkan."; exit 1; }

# Drop & recreate schema
echo "Dropping & recreating schema public..."
docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "Restoring dari $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo ""
echo -e "${GREEN}✓ Restore selesai.${NC}"
echo "  Test: buka http://<vm>:3001 dan login."
