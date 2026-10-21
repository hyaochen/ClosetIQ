import type { ForecastDay } from '@closet/shared';

// ---- P5 ----
// 天氣唯一入口：Open-Meteo（不用金鑰）。現況 + 每日預報最多 16 天；地名查詢用 Open-Meteo geocoding。
// 30 分鐘伺服器端快取，座標四捨五入到 0.1 度；逾時 5 秒，任何錯誤降級回 null。

export const DEFAULT_LAT = 25.03; // 台北
export const DEFAULT_LON = 121.56;
export const FORECAST_DAYS = 16; // 含今天（Open-Meteo 上限），第 17 天以後無預報

const TTL_MS = 30 * 60 * 1000;
const GEO_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 500;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 台北時區的 YYYY-MM-DD */
export function taipeiYmd(ms: number): string {
  return new Date(ms + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}
export function todayTaipei(): string {
  return taipeiYmd(Date.now());
}
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function isValidYmd(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
/** YYYY-MM-DD 轉成 @db.Date 欄位用的 UTC 午夜 Date（與 wear-logs 的寫法一致） */
export function toDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}
export function ymdOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
export function weekdayLabel(ymd: string): string {
  return WEEKDAY_LABELS[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
}


const FORECAST_URL = () => process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com';
const GEOCODING_URL = () => process.env.OPEN_METEO_GEOCODING_URL || 'https://geocoding-api.open-meteo.com';
const TIMEOUT_MS = Number(process.env.WEATHER_TIMEOUT_MS) || 5000;
const NEGATIVE_TTL_MS = 60 * 1000; // 上游失敗後 1 分鐘內不再打，避免每個請求都吃 5 秒逾時

/** 強風門檻（km/h，約蒲福 6 級）。WMO 天氣代碼沒有風，所以風只靠風速判斷，雲量代碼 1-3 絕不代表大風。 */
export const WINDY_KMH = 40;

/**
 * WMO weather code -> WeatherCondition。
 * 0 晴、1 大致晴 -> SUNNY；2 局部多雲、3 陰、45/48 霧 -> CLOUDY；
 * 51-57 毛毛雨、61-67 雨（含凍雨）、80-82 陣雨、95/96/99 雷雨 -> RAINY；
 * 71-77 雪（含冰粒）、85/86 陣雪 -> SNOWY。未知代碼 -> CLOUDY。
 */
export const WMO_CONDITION: Record<number, ForecastDay['condition']> = {
  0: 'SUNNY',
  1: 'SUNNY',
  2: 'CLOUDY',
  3: 'CLOUDY',
  45: 'CLOUDY',
  48: 'CLOUDY',
  51: 'RAINY',
  53: 'RAINY',
  55: 'RAINY',
  56: 'RAINY',
  57: 'RAINY',
  61: 'RAINY',
  63: 'RAINY',
  65: 'RAINY',
  66: 'RAINY',
  67: 'RAINY',
  71: 'SNOWY',
  73: 'SNOWY',
  75: 'SNOWY',
  77: 'SNOWY',
  80: 'RAINY',
  81: 'RAINY',
  82: 'RAINY',
  85: 'SNOWY',
  86: 'SNOWY',
  95: 'RAINY',
  96: 'RAINY',
  99: 'RAINY',
};

/** 純函式：WMO 代碼（+ 選填風速 km/h）轉 WeatherCondition。雨雪優先，其次強風，最後才是晴/陰。 */
export function wmoToCondition(code: number | null | undefined, windKmh?: number | null): ForecastDay['condition'] {
  const base = code === null || code === undefined ? 'CLOUDY' : (WMO_CONDITION[code] ?? 'CLOUDY');
  if (base === 'RAINY' || base === 'SNOWY') return base;
  if (typeof windKmh === 'number' && windKmh >= WINDY_KMH) return 'WINDY';
  return base;
}

export interface CurrentWeather {
  temp: number; // 攝氏，四捨五入
  condition: ForecastDay['condition'];
  windKmh: number;
}

interface OpenMeteoResponse {
  current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    wind_speed_10m_max?: (number | null)[];
  };
}

/** 純函式：Open-Meteo daily 區塊轉 ForecastDay[]（缺溫度的日子略過） */
export function summarizeDaily(daily: OpenMeteoResponse['daily']): ForecastDay[] {
  const times = daily?.time ?? [];
  const out: ForecastDay[] = [];
  for (let i = 0; i < times.length; i++) {
    const max = daily?.temperature_2m_max?.[i];
    const min = daily?.temperature_2m_min?.[i];
    if (typeof max !== 'number' || typeof min !== 'number') continue;
    out.push({
      date: times[i],
      min: Math.round(min),
      max: Math.round(max),
      condition: wmoToCondition(daily?.weather_code?.[i], daily?.wind_speed_10m_max?.[i]),
      rainChance: Math.round(daily?.precipitation_probability_max?.[i] ?? 0),
    });
  }
  return out;
}

export function summarizeCurrent(cur: OpenMeteoResponse['current']): CurrentWeather | null {
  if (!cur || typeof cur.temperature_2m !== 'number') return null;
  const wind = typeof cur.wind_speed_10m === 'number' ? cur.wind_speed_10m : 0;
  return { temp: Math.round(cur.temperature_2m), condition: wmoToCondition(cur.weather_code, wind), windKmh: Math.round(wind) };
}

type Bundle = { current: CurrentWeather | null; days: ForecastDay[] };
const cache = new Map<string, { at: number; value: Bundle }>();
const failedAt = new Map<string, number>();

export interface GeoResult {
  lat: number;
  lon: number;
  name: string;
  timezone: string | null;
}
const geoCache = new Map<string, { at: number; value: GeoResult | null }>();

function trimCache<T>(m: Map<string, T>) {
  if (m.size <= MAX_CACHE) return;
  const first = m.keys().next().value;
  if (first !== undefined) m.delete(first);
}

/** 測試用：清掉所有快取 */
export function clearWeatherCache() {
  cache.clear();
  failedAt.clear();
  geoCache.clear();
}

async function loadBundle(lat: number, lon: number): Promise<Bundle | null> {
  const rl = Math.round(lat * 10) / 10;
  const ro = Math.round(lon * 10) / 10;
  const ck = `${rl},${ro}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const bad = failedAt.get(ck);
  if (bad && Date.now() - bad < NEGATIVE_TTL_MS) return null;

  try {
    const url =
      `${FORECAST_URL()}/v1/forecast?latitude=${rl}&longitude=${ro}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=${FORECAST_DAYS}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;
    const value: Bundle = { current: summarizeCurrent(data.current), days: summarizeDaily(data.daily) };
    if (value.days.length === 0 && !value.current) throw new Error('open-meteo empty');
    cache.set(ck, { at: Date.now(), value });
    trimCache(cache);
    failedAt.delete(ck);
    return value;
  } catch {
    failedAt.set(ck, Date.now());
    trimCache(failedAt);
    return null;
  }
}

/** 每日預報（最多 16 天，含今天；日期為該座標當地日期）；上游失敗回 null */
export async function getForecast(lat: number, lon: number): Promise<ForecastDay[] | null> {
  const b = await loadBundle(lat, lon);
  return b ? b.days : null;
}

/** 目前天氣；上游失敗回 null */
export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather | null> {
  const b = await loadBundle(lat, lon);
  return b ? b.current : null;
}

// Open-Meteo 的中文地名索引不全（實測「台北」「首爾」查不到），常用旅遊城市補一張別名表轉成英文再查。
const CITY_ALIASES: Record<string, string> = {
  台北: 'Taipei', 臺北: 'Taipei', 台北市: 'Taipei', 新北: 'New Taipei', 台中: 'Taichung', 臺中: 'Taichung',
  台南: 'Tainan', 臺南: 'Tainan', 高雄: 'Kaohsiung', 花蓮: 'Hualien', 台東: 'Taitung', 臺東: 'Taitung',
  首爾: 'Seoul', 釜山: 'Busan', 濟州: 'Jeju', 大阪: 'Osaka', 京都: 'Kyoto', 沖繩: 'Naha', 那霸: 'Naha',
  札幌: 'Sapporo', 福岡: 'Fukuoka', 名古屋: 'Nagoya', 曼谷: 'Bangkok', 新加坡: 'Singapore', 香港: 'Hong Kong',
  澳門: 'Macau', 吉隆坡: 'Kuala Lumpur', 河內: 'Hanoi', 胡志明市: 'Ho Chi Minh City', 峇里島: 'Denpasar',
  倫敦: 'London', 巴黎: 'Paris', 紐約: 'New York', 洛杉磯: 'Los Angeles', 雪梨: 'Sydney', 悉尼: 'Sydney',
};

async function geoSearch(name: string, language: string): Promise<GeoResult | null> {
  const res = await fetch(
    `${GEOCODING_URL()}/v1/search?name=${encodeURIComponent(name)}&count=1&language=${language}&format=json`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`geocoding ${res.status}`);
  const data = (await res.json()) as { results?: { latitude: number; longitude: number; name: string; timezone?: string }[] };
  const r = data.results?.[0];
  return r ? { lat: r.latitude, lon: r.longitude, name: r.name, timezone: r.timezone ?? null } : null;
}

/** 城市名稱轉座標（Open-Meteo geocoding），快取一天；失敗或找不到回 null */
export async function geocodeCity(q: string): Promise<GeoResult | null> {
  const name = q.trim();
  const ck = name.toLowerCase();
  if (!ck) return null;
  const hit = geoCache.get(ck);
  if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.value;
  try {
    let value = await geoSearch(name, 'zh');
    if (!value && CITY_ALIASES[name]) value = await geoSearch(CITY_ALIASES[name], 'zh');
    if (!value) value = await geoSearch(name, 'en');
    geoCache.set(ck, { at: Date.now(), value });
    trimCache(geoCache);
    return value;
  } catch {
    return null;
  }
}

/** 取得某天預報；超出範圍或無資料回 null */
export function forecastFor(days: ForecastDay[] | null, date: string): ForecastDay | null {
  return days?.find((d) => d.date === date) ?? null;
}
