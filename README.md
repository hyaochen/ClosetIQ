# ClosetIQ

> 智慧電子衣櫃管理系統

---

## 功能特色

- **衣物管理** — 拍照/相簿上傳，自動產生三種尺寸（原圖/展示/縮圖），支援多張圖片
- **智慧分類** — 8 大分類、13 種色系、7 種圖案，多維度篩選搜尋
- **品牌/材質快速輸入** — 品牌下拉自動完成，複合材質 Chip 多選
- **穿搭組合** — 自由搭配衣物建立穿搭，評分與場合標記
- **穿著紀錄** — 記錄每日穿著，追蹤穿著頻率與歷史
- **天氣推薦** — GPS 自動定位 + OpenWeatherMap 即時天氣，智慧推薦當日穿搭
- **統計分析** — 穿著頻率排行、花費總覽、品牌分布、每次穿著成本計算
- **斷捨離助手** — 自動篩選低頻/低效衣物，輔助決策捐贈/售出/丟棄
- **深色模式** — 全站支援淺色/深色主題切換
- **外網存取** — 透過 Cloudflare Tunnel 支援手機隨時隨地管理衣櫃
- **備份還原** — 一鍵備份/還原資料庫與圖片

---

## 畫面截圖

<p align="center">
  <img src="docs/screenshots/home.png" width="180" alt="首頁" />
  <img src="docs/screenshots/outfits.png" width="180" alt="穿搭管理" />
  <img src="docs/screenshots/suggestions.png" width="180" alt="智慧推薦" />
  <img src="docs/screenshots/profile.png" width="180" alt="個人頁面" />
  <img src="docs/screenshots/analytics.png" width="180" alt="統計分析" />
</p>

| 首頁 | 穿搭管理 | 智慧推薦 | 個人設定 | 統計分析 |
|:---:|:---:|:---:|:---:|:---:|
| 快捷入口與每日推薦 | 穿搭組合與評分 | 依場合智慧搭配 | 主題切換與衣櫃總覽 | 花費總覽與品牌分布 |

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | Expo (React Native Web) + Expo Router v4 |
| 樣式 | NativeWind v4 (Tailwind CSS for RN) |
| 狀態管理 | TanStack Query + Zustand |
| 後端 | Fastify + TypeScript |
| ORM | Prisma |
| 資料庫 | PostgreSQL 16 |
| 圖片處理 | Sharp（輸出 WebP） |
| 認證 | JWT（access + refresh token）+ argon2 雜湊 |
| 驗證 | Zod |
| Monorepo | Turborepo + npm workspaces |
| 容器化 | Docker Compose |
| 外網通道 | Cloudflare Tunnel（選用） |

---

## 環境需求

- **Node.js** >= 20
- **Docker Desktop**（用於 PostgreSQL 或完整 Docker 部署）
- **npm** >= 10

---

## 快速開始

### 1. 複製專案並安裝依賴

```bash
git clone https://github.com/hyaochen/ClosetIQ.git
cd ClosetIQ
npm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`，填入你自己的設定值：

```env
# 資料庫密碼（請務必修改）
DB_PASSWORD=your_secure_password

# PostgreSQL 連線字串
DATABASE_URL=postgresql://closet:your_secure_password@localhost:5432/closet

# JWT 密鑰（請務必修改！使用 >= 32 字元的隨機字串）
JWT_SECRET=your_random_jwt_secret_at_least_32_characters
JWT_REFRESH_SECRET=your_random_refresh_secret_at_least_32_chars

# API 設定
API_PORT=3001
API_HOST=0.0.0.0

# 圖片儲存路徑
IMAGE_STORAGE_PATH=./data/images

# CORS（使用 Tunnel 時需加入你的網域）
# CORS_ORIGIN=http://localhost:8083,https://your-domain.com

# OpenWeatherMap API 金鑰（免費方案，選填）
# OPENWEATHER_API_KEY=your_api_key_here
```

> **重要**：`JWT_SECRET` 和 `JWT_REFRESH_SECRET` 為**必填項目**，未設定則伺服器將無法啟動。

### 3. 啟動資料庫

```bash
docker compose up -d db
```

### 4. 執行資料庫遷移

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

### 5. 啟動服務

**方式 A — 批次腳本（Windows）：**

```bash
start-all.bat       # 啟動 DB + API + Web
```

**方式 B — 手動啟動：**

```bash
# 終端 1：API 伺服器
cd apps/api
npx tsx src/server.ts

# 終端 2：Web 前端
cd apps/mobile
npx expo start --web --port 8083
```

**方式 C — 完整 Docker 部署：**

```bash
docker compose up -d --build
```

### 6. 開啟瀏覽器

前往 http://localhost:8083

---

## 預設帳號

| 欄位 | 值 |
|------|------|
| Email | `test@closet.com` |
| 密碼 | `00000000` |

> **安全提醒**：首次登入後請立即修改預設密碼。此帳號僅供初始設定使用。

可透過註冊頁面建立新帳號，為方便開發，目前未限制信箱格式與密碼複雜度。

---

## 專案結構

```
ClosetIQ/
├── apps/
│   ├── api/                    # Fastify 後端
│   │   ├── src/
│   │   │   ├── server.ts       # 程式進入點
│   │   │   ├── plugins/        # 認證外掛
│   │   │   ├── routes/         # API 路由
│   │   │   ├── services/       # 業務邏輯
│   │   │   └── prisma/         # Schema 與遷移檔
│   │   └── Dockerfile
│   └── mobile/                 # Expo 前端（Web + 未來 iOS）
│       ├── app/
│       │   ├── (tabs)/         # Tab 導航
│       │   │   ├── index.tsx       # 首頁/儀表板
│       │   │   ├── wardrobe.tsx    # 衣櫃瀏覽
│       │   │   ├── outfits.tsx     # 穿搭管理
│       │   │   ├── suggest.tsx     # 智慧推薦
│       │   │   └── profile.tsx     # 設定/統計
│       │   ├── item/
│       │   │   ├── [id].tsx        # 衣物詳情
│       │   │   ├── add.tsx         # 新增衣物
│       │   │   └── edit.tsx        # 編輯衣物
│       │   ├── outfit/
│       │   │   ├── [id].tsx        # 穿搭詳情
│       │   │   └── builder.tsx     # 穿搭組合器
│       │   ├── declutter.tsx       # 斷捨離助手
│       │   └── wear-history.tsx    # 穿著紀錄
│       ├── components/         # 共用 UI 元件
│       ├── lib/                # 工具函式與狀態管理
│       └── Dockerfile
├── packages/
│   └── shared/                 # 前後端共用程式碼
│       └── src/
│           ├── enums.ts        # 分類、色系、季節列舉
│           ├── schemas.ts      # Zod 驗證 schema
│           ├── types.ts        # TypeScript 型別
│           └── utils.ts        # 工具函式
├── docker-compose.yml          # 基礎：DB + API + Web
├── docker-compose.tunnel.yml   # 擴充：加入 Cloudflare Tunnel
├── .env.example                # 環境變數範本
├── turbo.json                  # Turborepo 設定
└── *.bat                       # Windows 批次腳本
```

---

## API 端點

所有路由以 `/api` 為前綴，除認證路由與健康檢查外皆需 JWT 認證。

### 認證
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊新帳號 |
| POST | `/api/auth/login` | 登入 |
| POST | `/api/auth/refresh` | 刷新 access token |
| GET | `/api/auth/me` | 取得目前使用者資訊 |

### 衣物
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/items` | 取得衣物列表（支援篩選） |
| GET | `/api/items/:id` | 取得衣物詳情 |
| POST | `/api/items` | 新增衣物 |
| PUT | `/api/items/:id` | 更新衣物 |
| DELETE | `/api/items/:id` | 刪除衣物 |
| GET | `/api/items/brands` | 取得已使用的品牌列表 |
| GET | `/api/items/materials` | 取得已使用的材質列表 |

### 圖片
| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/images/upload/:itemId` | 上傳圖片 |
| GET | `/api/images/:id/:size` | 取得圖片（公開） |
| DELETE | `/api/images/:id` | 刪除圖片 |

### 穿搭
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/outfits` | 取得穿搭列表 |
| GET | `/api/outfits/:id` | 取得穿搭詳情 |
| POST | `/api/outfits` | 新增穿搭 |
| PUT | `/api/outfits/:id` | 更新穿搭 |
| DELETE | `/api/outfits/:id` | 刪除穿搭 |

### 穿著紀錄
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/wear-logs` | 取得穿著紀錄 |
| POST | `/api/wear-logs` | 新增穿著紀錄 |
| DELETE | `/api/wear-logs/:id` | 刪除穿著紀錄 |

### 統計與推薦
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/stats` | 衣櫃統計數據 |
| GET | `/api/suggestions` | 智慧穿搭推薦 |

### 健康檢查
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/health` | 系統健康檢查 |

---

## 資料模型

### 衣物分類

| 代碼 | 中文名稱 |
|------|----------|
| TOP | 上衣 |
| BOTTOM | 下身 |
| OUTERWEAR | 外套 |
| DRESS | 洋裝/連身 |
| SHOES | 鞋子 |
| ACCESSORY | 配件 |
| UNDERWEAR | 內衣褲 |
| BAG | 包包 |

### 色系

紅、橘、黃、綠、藍、紫、粉紅、黑、白、灰、棕、米、多色

### 季節與場合

- **季節**：春、夏、秋、冬（可複選）
- **場合**：休閒、上班、正式、運動、居家（可複選）

---

## 批次腳本（Windows）

| 腳本 | 說明 |
|------|------|
| `start-all.bat` | 啟動 DB + API + Web（開發模式） |
| `start-all-tunnel.bat` | 啟動 DB + API + Web + Tunnel（開發模式） |
| `start-with-tunnel.bat` | Docker 全部啟動（含 Tunnel） |
| `start.bat` | Docker 全部啟動 |
| `start-db.bat` | 僅啟動資料庫 |
| `start-api.bat` | 僅啟動 API 伺服器 |
| `start-web.bat` | 僅啟動 Web 前端 |
| `start-tunnel.bat` | 僅啟動 Cloudflare Tunnel |
| `stop.bat` | 停止所有 Docker 服務 |
| `backup.bat` | 備份資料庫與圖片 |
| `restore.bat` | 從備份還原 |
| `migrate-images.bat` | 將本地圖片遷移至 Docker volume |

---

## Cloudflare Tunnel（選用）

透過 Cloudflare Tunnel 可從外網（如手機行動網路）存取系統。

### 1. 安裝 cloudflared

從 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/ 下載安裝。

### 2. 建立命名 Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create closet
```

### 3. 設定 DNS

```bash
cloudflared tunnel route dns closet your-domain.com
cloudflared tunnel route dns closet api.your-domain.com
```

### 4. 建立 Tunnel 設定檔

建立 `~/.cloudflared/closet-config.yml`：

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

### 5. 設定環境變數

在 `.env` 中加入：

```env
CORS_ORIGIN=http://localhost:8083,https://your-domain.com
TUNNEL_API_URL=https://api.your-domain.com
TUNNEL_NAME=closet
CLOUDFLARED_CONFIG_DIR=~/.cloudflared
```

### 6. 啟動（含 Tunnel）

```bash
# Docker 模式
start-with-tunnel.bat

# 或開發模式
start-all-tunnel.bat
```

---

## 備份與還原

### 備份

```bash
backup.bat
```

在 `backups/` 目錄下建立帶時間戳記的資料夾，包含：
- `database.dump` — PostgreSQL 自訂格式備份
- `images.tar.gz` — 壓縮的圖片檔案

### 還原

```bash
restore.bat
```

列出可用備份並選擇要還原的版本。**注意**：還原將覆蓋現有資料。

---

## Docker 部署

### 本地部署（預設）

```bash
docker compose up -d --build
```

服務列表：
- `closet-db` — PostgreSQL 16（連接埠 5432）
- `closet-api` — Fastify API（連接埠 3001）
- `closet-web` — Expo Web（連接埠 8083）

### 含 Cloudflare Tunnel

```bash
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build
```

額外服務：
- `closet-tunnel` — Cloudflare Tunnel

### 查看日誌

```bash
docker compose logs -f          # 所有服務
docker compose logs -f api      # 僅 API
docker compose logs -f web      # 僅 Web
```

---

## 圖片處理

上傳的圖片由 Sharp 自動處理：

| 尺寸 | 最大寬度 | 格式 | 用途 |
|------|----------|------|------|
| 原圖 | 不限 | WebP | 存檔 |
| 展示圖 | 800px | WebP | 詳情頁檢視 |
| 縮圖 | 300px | WebP | 網格/列表顯示 |

- 單張上限：10MB
- 單次上傳上限：5 張
- 自動驗證 MIME 類型
- 重新編碼以移除中繼資料（metadata）

---

## iOS 遷移路徑

前端採用 Expo 架構，遷移至原生 iOS 只需少量調整：

```bash
npx expo prebuild --platform ios
# 模擬器測試
npx expo run:ios
# 建置發佈版本
eas build --platform ios
```

約 90% 以上的程式碼可直接共用於 Web 與 iOS，無需修改。

---

## 開發備註

- 介面語言：繁體中文
- `EXPO_PUBLIC_*` 環境變數在 Metro 打包時就會被內嵌，並非執行時期讀取。若有修改，需以 `--clear` 重啟 Expo 開發伺服器
- 材質欄位以 `、` 分隔儲存多種材質（例如：`棉、聚酯纖維`）
- 密碼使用 argon2 雜湊加密
- 頻率限制：一般 API 每分鐘 100 次，認證端點每分鐘 5 次

---

## 授權

本專案供個人使用與教育用途。
