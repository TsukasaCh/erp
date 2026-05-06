# Nginx Reverse Proxy untuk Alucurv ERP

Setup nginx reverse proxy supaya akses ke ERP cuma lewat satu entry point
(satu domain / satu IP), tanpa perlu inget port 3000/3001.

## Topologi

```
                              ┌─────────────────────────┐
  Browser user                │  Reverse Proxy VM       │
  (LAN/internet) ─────────────▶  172.16.0.102 (nginx)   │
                              │  port 80 / 443          │
                              └────────────┬────────────┘
                                           │
                                  proxy_pass
                                           │
                              ┌────────────▼────────────┐
                              │  Backend ERP VM         │
                              │  172.16.0.62            │
                              │  ├─ web  :3001          │
                              │  └─ api  :3000          │
                              └─────────────────────────┘
```

Browser hit `http://172.16.0.102` (atau domain) → nginx route:
- `/api/*` & `/health` → API container di `172.16.0.62:3000`
- `/_next/*` & rest → Web container di `172.16.0.62:3001`

## File di folder ini

| File | Fungsi |
|---|---|
| `alucurv-erp.conf` | Config HTTP-only (IP-based atau domain tanpa SSL) |
| `alucurv-erp-https.conf` | Config HTTPS dengan Let's Encrypt + security headers |
| `install-on-proxy.sh` | Script install otomatis di VM reverse proxy |

## Setup cepat (HTTP only — IP based)

Di server reverse proxy `172.16.0.102`:

```bash
# 1. Copy folder nginx ke server (atau git clone repo)
scp -r nginx/ user@172.16.0.102:/tmp/

# 2. SSH ke server reverse proxy
ssh user@172.16.0.102
cd /tmp/nginx

# 3. Install nginx + setup config
sudo bash install-on-proxy.sh

# Output: http://172.16.0.102 sudah jalan
```

Lalu di backend ERP VM `172.16.0.62`:

```bash
ssh user@172.16.0.62
cd erp

# Edit .env — ubah NEXT_PUBLIC_API_BASE jadi URL via reverse proxy
nano .env
# Ubah: NEXT_PUBLIC_API_BASE=http://172.16.0.102

# Rebuild web container (env ini di-bake ke bundle JS saat build)
docker compose build web
docker compose up -d web
```

Selesai. Akses di browser: `http://172.16.0.102` → langsung ke login page Alucurv.

## Setup HTTPS dengan domain

Prerequisite:
- Domain udah punya A-record ke IP reverse proxy (mis. `erp.alucurv.com` → IP publik server)
- Port 80 & 443 reachable dari internet (firewall + NAT kalau di belakang router)

```bash
# Di server reverse proxy
sudo bash install-on-proxy.sh erp.alucurv.com
# Akan prompt email Let's Encrypt, lalu auto-request cert

# Di backend ERP
nano .env
# Ubah: NEXT_PUBLIC_API_BASE=https://erp.alucurv.com
docker compose build web && docker compose up -d web
```

Akses: `https://erp.alucurv.com` ✓

## Setup manual (kalau gak mau pakai script)

Di server reverse proxy:

```bash
sudo apt update && sudo apt install -y nginx
sudo cp alucurv-erp.conf /etc/nginx/sites-available/alucurv-erp
sudo ln -sf /etc/nginx/sites-available/alucurv-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t
sudo systemctl reload nginx

# Buka firewall
sudo ufw allow 80
sudo ufw allow 443
```

## Troubleshooting

### "502 Bad Gateway" saat akses
Berarti nginx gak bisa reach backend. Cek dari server reverse proxy:

```bash
curl -v http://172.16.0.62:3000/health    # API
curl -v http://172.16.0.62:3001/          # Web
```

Kalau gagal:
- Backend container running? `ssh 172.16.0.62 'cd erp && docker compose ps'`
- Firewall backend allow 3000+3001? `ssh 172.16.0.62 'sudo ufw status'`
- Network reachable? `ping 172.16.0.62`

### "Failed to fetch" di login page
Frontend masih nge-call API ke IP backend langsung (bypass nginx).

```bash
# Di backend ERP
cat .env | grep API_BASE
# Harusnya: NEXT_PUBLIC_API_BASE=http://172.16.0.102

# Kalau masih localhost atau salah, edit + rebuild
docker compose build web && docker compose up -d web

# Buka browser DevTools → Network → klik Login → cek URL request fail.
# Kalau URL-nya 172.16.0.62:3000/* berarti rebuild belum jalan.
```

### Certbot gagal (Let's Encrypt error)
- Pastikan domain udah resolve ke IP reverse proxy (`dig erp.alucurv.com`)
- Port 80 reachable dari internet (Let's Encrypt verify lewat HTTP-01)
- Cek log: `journalctl -u nginx | tail -50`

### Cookie / session hilang setelah refresh
Browser block cookie yang origin-nya beda. Pastikan SEMUA request (web + API)
lewat domain/IP yang SAMA — itu sebabnya kita pakai single-host setup di sini.

### Update config
```bash
# Edit
sudo nano /etc/nginx/sites-available/alucurv-erp

# Test
sudo nginx -t

# Reload (zero downtime)
sudo systemctl reload nginx

# Logs real-time
sudo tail -f /var/log/nginx/alucurv-erp.error.log
```

## Auto-renew Let's Encrypt cert

Certbot otomatis bikin systemd timer. Cek:

```bash
systemctl list-timers | grep certbot
# Harusnya ada certbot.timer aktif
```

Manual test renew:
```bash
sudo certbot renew --dry-run
```

## Nginx security hardening (opsional)

Edit `/etc/nginx/nginx.conf`, tambah di `http {}` block:

```nginx
# Sembunyikan versi nginx
server_tokens off;

# Rate limit untuk /api/auth (anti brute-force login)
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
```

Lalu di `alucurv-erp.conf`, tambah di `location /api/`:
```nginx
limit_req zone=auth_limit burst=20 nodelay;
```
