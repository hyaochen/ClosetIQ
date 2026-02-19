# ClosetIQ

> Smart Digital Wardrobe Management System / 智慧電子衣櫃管理系統

---

## Features

- **衣物管理** — 拍照/相簿上傳，自動產生三種尺寸（原圖/展示/縮圖），支援多張圖片
- **智慧分類** — 8 大分類、13 種色系、7 種圖案，多維度篩選搜尋
- **品牌/材質快速輸入** — 品牌下拉自動完成，複合材質 Chip 多選
- **穿搭組合** — 自由搭配衣物建立穿搭，評分與場合標記
- **穿著紀錄** — 記錄每日穿著，追蹤穿著頻率與歷史
- **天氣推薦** — GPS 自動定位 + OpenWeatherMap 即時天氣，智慧推薦當日穿搭
- **統計分析** — 穿著頻率排行、分類分布、每次穿著成本計算
- **斷捨離助手** — 自動篩選低頻/低效衣物，輔助決策捐贈/售出/丟棄
- **深色模式** — 全站支援 Light/Dark 主題切換
- **Cloudflare Tunnel** — 支援外網存取，手機隨時管理衣櫃
- **備份還原** — 一鍵備份/還原資料庫與圖片

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Expo (React Native Web) + Expo Router v4 |
| Styling | NativeWind v4 (Tailwind CSS for RN) |
| State | TanStack Query + Zustand |
| Backend | Fastify + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Image Processing | Sharp (WebP output) |
| Auth | JWT (access + refresh token) + argon2 |
| Validation | Zod |
| Monorepo | Turborepo + npm workspaces |
| Container | Docker Compose |
| Tunnel | Cloudflare Tunnel (optional) |

---

## Prerequisites

- **Node.js** >= 20
- **Docker Desktop** (for PostgreSQL, or full Docker deployment)
- **npm** >= 10

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ClosetIQ.git
cd ClosetIQ
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
```

Edit `.env` and set your own values:

```env
# Database password (change this!)
DB_PASSWORD=your_secure_password

# PostgreSQL connection
DATABASE_URL=postgresql://closet:your_secure_password@localhost:5432/closet

# JWT secrets (change these! use random strings >= 32 chars)
JWT_SECRET=your_random_jwt_secret_at_least_32_characters
JWT_REFRESH_SECRET=your_random_refresh_secret_at_least_32_chars

# API
API_PORT=3001
API_HOST=0.0.0.0

# Image storage
IMAGE_STORAGE_PATH=./data/images

# CORS (add your domain if using tunnel)
# CORS_ORIGIN=http://localhost:8083,https://your-domain.com

# OpenWeatherMap API key (free tier, optional)
# OPENWEATHER_API_KEY=your_api_key_here
```

> **Important**: `JWT_SECRET` and `JWT_REFRESH_SECRET` are **required**. The server will refuse to start without them.

### 3. Start Database

```bash
docker compose up -d db
```

### 4. Run Database Migration

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

### 5. Start Development Servers

**Option A — Batch scripts (Windows):**

```bash
start-all.bat       # Start DB + API + Web
```

**Option B — Manual:**

```bash
# Terminal 1: API server
cd apps/api
npx tsx src/server.ts

# Terminal 2: Web frontend
cd apps/mobile
npx expo start --web --port 8083
```

**Option C — Full Docker:**

```bash
docker compose up -d --build
```

### 6. Open Browser

Navigate to http://localhost:8083

---

## Default Account

| Field | Value |
|-------|-------|
| Email | `test@closet.com` |
| Password | `test` |

> **Security Warning**: Change the default password immediately after first login. This account is for initial setup only.

To register a new account, use the registration page. There are no restrictions on email format or password complexity for ease of development.

---

## Project Structure

```
ClosetIQ/
├── apps/
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── server.ts       # Entry point
│   │   │   ├── plugins/        # Auth plugin
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # Business logic
│   │   │   └── prisma/         # Schema & migrations
│   │   └── Dockerfile
│   └── mobile/                 # Expo frontend (Web + future iOS)
│       ├── app/
│       │   ├── (tabs)/         # Tab navigation
│       │   │   ├── index.tsx       # Dashboard
│       │   │   ├── wardrobe.tsx    # Wardrobe browser
│       │   │   ├── outfits.tsx     # Outfit management
│       │   │   ├── suggest.tsx     # Smart suggestions
│       │   │   └── profile.tsx     # Settings & stats
│       │   ├── item/
│       │   │   ├── [id].tsx        # Item detail
│       │   │   ├── add.tsx         # Add item
│       │   │   └── edit.tsx        # Edit item
│       │   ├── outfit/
│       │   │   ├── [id].tsx        # Outfit detail
│       │   │   └── builder.tsx     # Outfit builder
│       │   ├── declutter.tsx       # Declutter assistant
│       │   └── wear-history.tsx    # Wear history
│       ├── components/         # Shared UI components
│       ├── hooks/              # Custom hooks
│       └── Dockerfile
├── packages/
│   └── shared/                 # Shared between frontend & backend
│       └── src/
│           ├── enums.ts        # Category, color, season enums
│           ├── schemas.ts      # Zod validation schemas
│           ├── types.ts        # TypeScript types
│           └── utils.ts        # Utility functions
├── docker-compose.yml          # Base: DB + API + Web
├── docker-compose.tunnel.yml   # Override: adds Cloudflare Tunnel
├── .env.example                # Environment template
├── turbo.json                  # Turborepo config
└── *.bat                       # Windows batch scripts
```

---

## API Endpoints

All routes are prefixed with `/api` and require JWT authentication (except auth routes and health check).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |

### Items (Clothing)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/items` | List items (with filters) |
| GET | `/api/items/:id` | Get item detail |
| POST | `/api/items` | Create item |
| PUT | `/api/items/:id` | Update item |
| DELETE | `/api/items/:id` | Delete item |
| GET | `/api/items/brands` | List used brands |
| GET | `/api/items/materials` | List used materials |

### Images
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/images/upload/:itemId` | Upload image(s) |
| GET | `/api/images/:id/:size` | Get image (public) |
| DELETE | `/api/images/:id` | Delete image |

### Outfits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/outfits` | List outfits |
| GET | `/api/outfits/:id` | Get outfit detail |
| POST | `/api/outfits` | Create outfit |
| PUT | `/api/outfits/:id` | Update outfit |
| DELETE | `/api/outfits/:id` | Delete outfit |

### Wear Logs
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wear-logs` | List wear logs |
| POST | `/api/wear-logs` | Create wear log |
| DELETE | `/api/wear-logs/:id` | Delete wear log |

### Stats & Suggestions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Wardrobe statistics |
| GET | `/api/suggestions` | Smart outfit suggestions |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |

---

## Data Model

### Clothing Categories

| Code | Label |
|------|-------|
| TOP | 上衣 |
| BOTTOM | 下身 |
| OUTERWEAR | 外套 |
| DRESS | 洋裝/連身 |
| SHOES | 鞋子 |
| ACCESSORY | 配件 |
| UNDERWEAR | 內衣褲 |
| BAG | 包包 |

### Color Families

紅、橘、黃、綠、藍、紫、粉紅、黑、白、灰、棕、米、多色

### Seasons & Occasions

- **Seasons**: 春、夏、秋、冬 (multi-select)
- **Occasions**: 休閒、上班、正式、運動、居家 (multi-select)

---

## Batch Scripts (Windows)

| Script | Description |
|--------|-------------|
| `start-all.bat` | Start DB + API + Web (dev mode) |
| `start-all-tunnel.bat` | Start DB + API + Web + Tunnel (dev mode) |
| `start-with-tunnel.bat` | Start all in Docker (including tunnel) |
| `start.bat` | Start all in Docker |
| `start-db.bat` | Start database only |
| `start-api.bat` | Start API server only |
| `start-web.bat` | Start web frontend only |
| `start-tunnel.bat` | Start Cloudflare Tunnel only |
| `stop.bat` | Stop all Docker services |
| `backup.bat` | Backup database + images |
| `restore.bat` | Restore from backup |
| `migrate-images.bat` | Migrate local images to Docker volume |

---

## Cloudflare Tunnel (Optional)

To access the app from external networks (e.g., mobile without WiFi):

### 1. Install cloudflared

Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

### 2. Create a Named Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create closet
```

### 3. Configure DNS

```bash
cloudflared tunnel route dns closet your-domain.com
cloudflared tunnel route dns closet api.your-domain.com
```

### 4. Create Tunnel Config

Create `~/.cloudflared/closet-config.yml`:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: ~/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: api.your-domain.com
    service: http://localhost:3001
  - hostname: your-domain.com
    service: http://localhost:8083
  - service: http_status:404
```

### 5. Set Environment Variables

Add to your `.env`:

```env
CORS_ORIGIN=http://localhost:8083,https://your-domain.com
TUNNEL_API_URL=https://api.your-domain.com
TUNNEL_NAME=closet
CLOUDFLARED_CONFIG_DIR=~/.cloudflared
```

### 6. Start with Tunnel

```bash
# Docker mode
start-with-tunnel.bat

# Or dev mode
start-all-tunnel.bat
```

---

## Backup & Restore

### Backup

```bash
backup.bat
```

Creates a timestamped folder in `backups/` containing:
- `database.dump` — PostgreSQL custom format dump
- `images.tar.gz` — Compressed image files

### Restore

```bash
restore.bat
```

Lists available backups and prompts for which one to restore. **Warning**: This overwrites existing data.

---

## Docker Deployment

### Local (default)

```bash
docker compose up -d --build
```

Services:
- `closet-db` — PostgreSQL 16 on port 5432
- `closet-api` — Fastify API on port 3001
- `closet-web` — Expo Web on port 8083

### With Cloudflare Tunnel

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
```

Additional service:
- `closet-tunnel` — Cloudflare Tunnel

### View Logs

```bash
docker compose logs -f          # All services
docker compose logs -f api      # API only
docker compose logs -f web      # Web only
```

---

## Image Processing

Uploaded images are automatically processed by Sharp:

| Size | Max Width | Format | Usage |
|------|-----------|--------|-------|
| Original | — | WebP | Archive |
| Display | 800px | WebP | Detail view |
| Thumbnail | 300px | WebP | Grid/list view |

- Max file size: 10MB per image
- Max files per upload: 5
- MIME type validation applied
- Images re-encoded to strip metadata

---

## iOS Migration Path

Since the frontend uses Expo, migrating to native iOS requires minimal changes:

```bash
npx expo prebuild --platform ios
# Test on simulator
npx expo run:ios
# Build for distribution
eas build --platform ios
```

~90% of the codebase is shared between web and iOS with no modifications needed.

---

## Development Notes

- UI language: Traditional Chinese (繁體中文)
- The `EXPO_PUBLIC_*` environment variables are inlined at Metro bundle time, not runtime. If you change them, restart the Expo dev server with `--clear`
- Material field stores multiple materials joined by `、` (e.g., `棉、聚酯纖維`)
- Passwords are hashed with argon2
- Rate limiting: 100 requests/minute (general), 5 requests/minute (auth endpoints)

---

## License

This project is for personal use and educational purposes.
