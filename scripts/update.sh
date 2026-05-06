#!/usr/bin/env bash
#
# Alucurv ERP — update deployment.
#
# Pull latest code dari git, rebuild containers, push schema kalau ada
# perubahan, restart. Tidak menyentuh data (no seed wipe).
#
# Usage: bash scripts/update.sh
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

[[ -f docker-compose.yml ]] || err "Run dari root repo"
[[ -f .env ]] || err ".env tidak ada — jalankan deploy.sh dulu untuk first-time setup"

# Auto-backup before update (safety net)
if [[ -x scripts/backup.sh ]]; then
  log "Auto-backup database sebelum update..."
  bash scripts/backup.sh || warn "Backup gagal tapi update tetap lanjut"
fi

log "Pulling latest dari git..."
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" == "$REMOTE" ]]; then
  ok "Sudah up-to-date dengan origin/main"
else
  git pull origin main
  ok "Pulled $(git log --oneline ${LOCAL}..${REMOTE} | wc -l) commit baru"
fi

log "Rebuilding containers..."
docker compose build
ok "Build done"

log "Restart containers (zero-downtime untuk web, api restart)..."
docker compose up -d
ok "Containers updated"

# Wait for API
log "Waiting for API ready..."
for i in {1..20}; do
  if docker compose exec -T api node -e "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" >/dev/null 2>&1; then
    ok "API ready"
    break
  fi
  sleep 2
  if [[ $i -eq 20 ]]; then err "API tidak ready. Cek: docker compose logs api"; fi
done

# Push schema kalau ada perubahan Prisma (idempotent)
log "Sync schema (kalau ada migration baru)..."
docker compose exec -T api npx prisma db push --skip-generate
ok "Schema synced"

echo ""
echo -e "${GREEN}✓ Update selesai${NC}"
echo "  Cek: docker compose ps"
echo ""
