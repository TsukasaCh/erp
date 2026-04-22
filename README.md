# ERP Marketplace MVP — TikTok Shop & Shopee

Full-stack MVP ERP untuk integrasi order & inventory dari **TikTok Shop** dan **Shopee** dalam satu dashboard.

## Tech Stack

**Backend** (`/`)
- Node.js + TypeScript + Express
- PostgreSQL via Prisma ORM
- node-cron untuk polling order tiap 5 menit
- OAuth flow + webhook receiver + auto refresh token

**Frontend** (`/web`)
- Next.js 15 (App Router) + React 19
- Tailwind CSS + Recharts
- SWR untuk data fetching

## Struktur Folder

```
ERP/
├── prisma/schema.prisma          # 7 tabel: Product, PlatformSku, Order, OrderItem,
│                                 # ShopCredentials, WebhookEvent, SyncLog
├── src/                          # Backend
│   ├── index.ts                  # Express entry (port 3000)
│   ├── config/env.ts
│   ├── db/client.ts
│   ├── routes/
│   │   ├── dashboard.ts          # GET /api/dashboard?range=7
│   │   ├── orders.ts             # GET /api/orders?status=to_ship
│   │   ├── products.ts           # CRUD + auto-push stock
│   │   ├── auth.ts               # OAuth install + callback + refresh
│   │   └── webhooks.ts           # POST /api/webhooks/{shopee,tiktok}
│   ├── services/
│   │   ├── shopee.ts             # HMAC-signed Shopee Open API
│   │   ├── tiktok.ts             # TikTok Shop API
│   │   ├── auth.ts               # Token exchange + refresh
│   │   └── sync.ts               # Order pull + stock push orchestrator
│   ├── utils/statusMapper.ts
│   └── workers/orderSyncCron.ts  # Cron tiap 5 menit
└── web/                          # Frontend
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # Dashboard (charts + KPI)
    │   ├── orders/page.tsx       # Tabs: Perlu Dikirim / Selesai
    │   └── products/page.tsx     # Inventory + edit stock
    ├── components/Nav.tsx
    └── lib/api.ts
```

## Setup — Cara Cepat (Docker)

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose exec api npx tsx src/seed.ts   # (opsional) seed data dummy
```
Buka http://localhost:3001

## Setup — Manual Dev Mode

Butuh Postgres lokal (install sendiri atau jalankan cuma container postgres-nya: `docker compose up -d postgres`).

```bash
# di root /
npm install
cp .env.example .env             # isi DATABASE_URL (contoh: postgresql://erp:erp_secret@localhost:5432/erp)
npm run db:migrate
npm run db:generate
npx tsx src/seed.ts              # (opsional) seed data dummy

# Terminal 1 — API server (port 3000)
npm run dev

# Terminal 2 — Sync worker
npm run dev:worker
```

## Setup — Frontend

```bash
cd web
npm install
cp .env.example .env.local       # set NEXT_PUBLIC_API_BASE=http://localhost:3000

npm run dev                      # http://localhost:3001
```

## Kredensial Marketplace

### Shopee
1. Daftar di [partner.shopeemobile.com](https://partner.shopeemobile.com), buat app.
2. Catat `partner_id` + `partner_key` ke `.env`.
3. Buka `http://localhost:3000/api/auth/shopee/install` di browser → authorize shop.
4. Token & `shop_id` otomatis tersimpan di tabel `ShopCredentials`.

### TikTok Shop
1. Daftar di [partner.tiktokshop.com](https://partner.tiktokshop.com), buat app.
2. Catat `app_key` + `app_secret` ke `.env`.
3. Buka `http://localhost:3000/api/auth/tiktok/install` → authorize seller.

## API Endpoints

### Dashboard
```
GET /api/dashboard?range=7
→ { total_orders, gross_revenue, by_platform[], by_status[], daily[] }
```

### Orders
```
GET /api/orders?status=to_ship&platform=all&page=1&pageSize=25
GET /api/orders/:id
```

### Products
```
GET   /api/products
POST  /api/products              # body: { sku, name, stock, price, platformSkus[] }
PATCH /api/products/:id/stock    # body: { stock }   → auto-push ke marketplace
```

### Auth
```
GET  /api/auth/shopee/install
GET  /api/auth/shopee/callback?code=…&shop_id=…
GET  /api/auth/tiktok/install
GET  /api/auth/tiktok/callback?code=…&shop_id=…
POST /api/auth/refresh/:platform/:shopId
```

### Webhooks (signature verified)
```
POST /api/webhooks/shopee        # Auth header HMAC SHA256
POST /api/webhooks/tiktok        # X-Tts-Signature header
```

## Deploy dengan Docker

Satu perintah untuk spin up semua service (Postgres + API + Worker + Web):

```bash
# 1. copy env & isi credentials marketplace
cp .env.docker.example .env

# 2. build & start semua service
docker compose up -d --build

# 3. cek status
docker compose ps
docker compose logs -f api       # tail log API
docker compose logs -f worker    # tail log cron sync

# 4. (opsional) seed data dummy — pakai versi COMPILED (di production tidak ada src/)
docker compose exec api node dist/seed.js
# atau setelah update:
docker compose exec api npm run seed:prod
```

Setelah up, akses:
- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **Postgres**: `localhost:5432` (user=`erp`, pass=`erp_secret` sesuai `.env`)

### Perintah berguna

```bash
# Stop semua service (data DB tetap ada di volume)
docker compose down

# Stop + hapus volume (data DB terhapus)
docker compose down -v

# Rebuild satu service tanpa cache
docker compose build --no-cache api

# Jalankan seed data (production image hanya berisi dist/)
docker compose exec api node dist/seed.js

# Masuk ke shell container
docker compose exec api sh
docker compose exec postgres psql -U erp -d erp
```

### Deploy ke cloud

| Komponen   | Rekomendasi                                            |
|-----------|--------------------------------------------------------|
| Database  | Managed Postgres (Supabase / Neon / AWS RDS / DO)     |
| API+Worker| Push image ke registry → Railway / Fly.io / ECS / K8s |
| Frontend  | Vercel (build ulang), atau deploy image ke container   |
| Webhooks  | Expose API via HTTPS, register URL di marketplace      |

Cara umum:
```bash
# Tag & push ke registry
docker build -t ghcr.io/<user>/erp-api:latest .
docker build -t ghcr.io/<user>/erp-web:latest --build-arg NEXT_PUBLIC_API_BASE=https://api.example.com ./web
docker push ghcr.io/<user>/erp-api:latest
docker push ghcr.io/<user>/erp-web:latest
```

> **Catatan**: `NEXT_PUBLIC_API_BASE` di-bake saat build time — kalau berubah, rebuild image `web`.

## Deploy Manual (non-Docker)

| Komponen   | Service                        | Command                  |
|-----------|--------------------------------|--------------------------|
| Database  | Supabase (free tier)           | salin `DATABASE_URL`     |
| API       | Railway / Render               | `npm run start`          |
| Worker    | Railway worker process         | `npm run start:worker`   |
| Frontend  | Vercel                         | dari folder `web/`       |
| Webhooks  | gunakan ngrok untuk dev        | publish ke marketplace dashboard |

## Catatan Implementasi

- **Polling-first**: order ditarik tiap 5 menit (default `SYNC_INTERVAL_CRON`). Webhook di-enable kalau marketplace mendukung (ditrigger juga sync untuk safety).
- **Idempotency**: `Order` di-upsert via `(platform, externalOrderId)` unique key — aman dipanggil berulang.
- **Stock decrement**: hanya saat insert order baru, tidak double-count saat re-sync.
- **Stock push**: saat user edit stock di UI → fire-and-forget ke kedua marketplace.
- **Token rotation**: `auth.ensureFresh()` cek expiry < 5 menit → auto-refresh.
- **Audit**: tabel `SyncLog` (per sync) + `WebhookEvent` (raw payload) untuk debug.
- **Status mapping**: marketplace status → 4 status internal (`to_ship`, `shipped`, `completed`, `cancelled`) di [statusMapper.ts](src/utils/statusMapper.ts).
