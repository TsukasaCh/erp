#!/usr/bin/env bash
#
# Install nginx + Alucurv ERP reverse-proxy config di server reverse proxy.
# Jalanin di SERVER REVERSE PROXY (172.16.0.102), bukan di backend ERP.
#
# Usage:
#   bash install-on-proxy.sh                              # HTTP only, IP-based
#   bash install-on-proxy.sh alucurv.ngelinx.com          # HTTPS + auto certbot
#
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $*"; }
ok()   { echo -e "${GREEN}✓${NC} $*"; }
err()  { echo -e "${RED}✗${NC} $*" >&2; exit 1; }

DOMAIN="${1:-}"
[[ "$EUID" -eq 0 ]] || err "Harus jalanin sebagai root (atau pakai sudo)"

# ----- detect & install nginx -----
if ! command -v nginx >/dev/null 2>&1; then
  log "Installing nginx..."
  apt-get update -qq
  apt-get install -y nginx
fi
ok "nginx $(nginx -v 2>&1 | cut -d/ -f2)"

# ----- pilih config -----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "$DOMAIN" ]]; then
  log "Mode HTTPS: $DOMAIN"

  # Install certbot dulu kalau belum ada
  if ! command -v certbot >/dev/null 2>&1; then
    log "Installing certbot..."
    apt-get install -y certbot python3-certbot-nginx
  fi

  # Pasang HTTP config dulu (biar certbot bisa challenge)
  cp "$SCRIPT_DIR/alucurv-erp.conf" /etc/nginx/sites-available/alucurv-erp
  sed -i "s|server_name alucurv.ngelinx.com 172.16.0.102 _;|server_name $DOMAIN;|" /etc/nginx/sites-available/alucurv-erp

  ln -sf /etc/nginx/sites-available/alucurv-erp /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default

  nginx -t || err "nginx config error"
  systemctl reload nginx

  log "Requesting Let's Encrypt cert untuk $DOMAIN..."
  read -rp "Email untuk Let's Encrypt notifications: " EMAIL
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect

  # Replace dgn HTTPS config kita (yg sudah include security headers)
  cp "$SCRIPT_DIR/alucurv-erp-https.conf" /etc/nginx/sites-available/alucurv-erp
  sed -i "s|alucurv.ngelinx.com|$DOMAIN|g" /etc/nginx/sites-available/alucurv-erp

else
  log "Mode HTTP-only (IP-based)"
  cp "$SCRIPT_DIR/alucurv-erp.conf" /etc/nginx/sites-available/alucurv-erp
  ln -sf /etc/nginx/sites-available/alucurv-erp /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
fi

# ----- test & reload -----
nginx -t || err "nginx config error — cek /etc/nginx/sites-available/alucurv-erp"
systemctl reload nginx
ok "nginx reloaded"

# ----- test connectivity ke backend ERP -----
log "Testing connectivity ke backend ERP (172.16.0.62)..."
if curl -s --max-time 5 http://172.16.0.62:3000/health >/dev/null; then
  ok "API 172.16.0.62:3000 reachable"
else
  echo -e "${YELLOW}⚠${NC}  API 172.16.0.62:3000 TIDAK reachable. Cek:"
  echo "   - ERP container running? (di backend VM: docker compose ps)"
  echo "   - Firewall backend allow 3000? (sudo ufw allow 3000)"
  echo "   - Network reachable? (ping 172.16.0.62)"
fi

if curl -s --max-time 5 -o /dev/null -w "%{http_code}" http://172.16.0.62:3001/ | grep -qE '^(200|301|302|307|308)'; then
  ok "Web 172.16.0.62:3001 reachable"
else
  echo -e "${YELLOW}⚠${NC}  Web 172.16.0.62:3001 TIDAK reachable. Cek setup ERP."
fi

# ----- summary -----
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  NGINX REVERSE PROXY SUDAH JALAN${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
if [[ -n "$DOMAIN" ]]; then
  echo "  Akses    : https://$DOMAIN"
  echo "  HTTP→HTTPS redirect: aktif"
else
  THIS_IP=$(hostname -I | awk '{print $1}')
  echo "  Akses    : http://${THIS_IP}/"
fi
echo "  Config   : /etc/nginx/sites-available/alucurv-erp"
echo "  Logs     : /var/log/nginx/alucurv-erp.{access,error}.log"
echo "  Test     : nginx -t"
echo "  Reload   : systemctl reload nginx"
echo ""
echo -e "${YELLOW}⚠  PENTING — Step terakhir di backend ERP (172.16.0.62):${NC}"
if [[ -n "$DOMAIN" ]]; then
  echo "  1. SSH ke 172.16.0.62"
  echo "  2. cd erp && nano .env"
  echo "  3. Ubah baris: NEXT_PUBLIC_API_BASE=https://${DOMAIN}"
else
  THIS_IP=$(hostname -I | awk '{print $1}')
  echo "  1. SSH ke 172.16.0.62"
  echo "  2. cd erp && nano .env"
  echo "  3. Ubah baris: NEXT_PUBLIC_API_BASE=http://${THIS_IP}"
fi
echo "  4. Rebuild web container:"
echo "     docker compose build web && docker compose up -d web"
echo ""
echo "  Tanpa step ini, frontend masih nge-call API ke 172.16.0.62:3000"
echo "  langsung (bypass nginx) — bakal gagal kalau browser gak bisa"
echo "  reach IP itu."
echo ""
