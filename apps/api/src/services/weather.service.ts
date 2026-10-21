import type { ForecastDay } from '@closet/shared';

// ---- P5 ----
// OpenWeatherMap 免費方案：5 天 / 3 小時預報（/data/2.5/forecast），彙整成每日摘要。
// 台北時區切日（UTC+8，無日光節約）；30 分鐘伺服器端快取，座標四捨五入到 0.1 度。

const BASE_URL = () => process.env.OPENWEATHER_BASE_URL || 'https://api.openweathermap.org';
const apiKey = () => {
  const k = process.env.OPENWEATHER_API_KEY;
  return k && k !== 'your_api_key_here' ? k : null;
};

export const DEFAULT_LAT = 25.03; // 台北
export const DEFAULT_LON = 121.56;
export const FORECAST_DAYS = 5; // 含今天，第 6 天以後無預報

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

const cache = new Map<string, { at: number; days: ForecastDay[] }>();
const geoCache = new Map<string, { at: number; value: { lat: number; lon: number; name: string } | null }>();

function trimCache<T>(m: Map<string, T>) {
  if (m.size <= MAX_CACHE) return;
  const first = m.keys().next().value;
  if (first !== undefined) m.delete(first);
}

function conditionFromId(id: number): ForecastDay['condition'] {
  // 雨/雪對應同 suggestions.ts；注意 suggestions.ts 把 id>=771 全當 WINDY（含 801-804 多雲），這裡不沿用該錯誤
  if (id >= 200 && id < 600) return 'RAINY';
  if (id >= 600 && id < 700) return 'SNOWY';
  if (id === 800) return 'SUNNY';
  if (id === 771 || id === 781) return 'WINDY'; // 狂風、龍捲風；801-804 多雲與 7xx 霧霾歸 CLOUDY
  return 'CLOUDY';
}

interface Slot {
  dt: number;
  main: { temp_min: number; temp_max: number };
  weather?: { id: number }[];
  pop?: number;
}

/** 純函式：把 3 小時預報切成台北時區每日摘要（可單獨測試） */
export function summarizeForecast(list: Slot[], today: string): ForecastDay[] {
  const byDate = new Map<string, Slot[]>();
  for (const slot of list) {
    const date = taipeiYmd(slot.dt * 1000);
    if (diffDays(today, date) < 0 || diffDays(today, date) >= FORECAST_DAYS) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(slot);
  }
  const out: ForecastDay[] = [];
  for (const [date, slots] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const min = Math.round(Math.min(...slots.map((s) => s.main.temp_min)));
    const max = Math.round(Math.max(...slots.map((s) => s.main.temp_max)));
    const rainChance = Math.round(Math.max(...slots.map((s) => s.pop ?? 0)) * 100);
    const counts = new Map<ForecastDay['condition'], number>();
    for (const s of slots) {
      const c = conditionFromId(s.weather?.[0]?.id ?? 0);
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    // 嚴重天氣優先：有雪 > 有雨 > 其餘取出現最多
    let condition: ForecastDay['condition'];
    if (counts.has('SNOWY')) condition = 'SNOWY';
    else if (counts.has('RAINY')) condition = 'RAINY';
    else condition = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'CLOUDY';
    out.push({ date, min, max, condition, rainChance });
  }
  return out;
}

/** 取得 5 天預報；沒有 API key 或上游失敗回 null（不快取失敗） */
export async function getForecast(lat: number, lon: number): Promise<ForecastDay[] | null> {
  const key = apiKey();
  if (!key) return null;

  const rl = Math.round(lat * 10) / 10;
  const ro = Math.round(lon * 10) / 10;
  const today = todayTaipei();
  const ck = `${rl},${ro}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) {
    // 快取跨日時重新切日
    if (hit.days.length === 0 || hit.days[0].date >= today) return hit.days;
  }

  try {
    const res = await fetch(`${BASE_URL()}/data/2.5/forecast?lat=${rl}&lon=${ro}&units=metric&appid=${key}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { list?: Slot[] };
    if (!Array.isArray(data.list)) return null;
    const days = summarizeForecast(data.list, today);
    cache.set(ck, { at: Date.now(), days });
    trimCache(cache);
    return days;
  } catch {
    return null;
  }
}

/** 城市名稱轉座標（OpenWeatherMap geocoding），快取一天 */
export async function geocodeCity(q: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const key = apiKey();
  if (!key) return null;
  const ck = q.trim().toLowerCase();
  const hit = geoCache.get(ck);
  if (hit && Date.now() - hit.at < GEO_TTL_MS) return hit.value;
  try {
    const res = await fetch(`${BASE_URL()}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${key}`);
    if (!res.ok) return null;
    const arr = (await res.json()) as { lat: number; lon: number; name: string }[];
    const value = arr[0] ? { lat: arr[0].lat, lon: arr[0].lon, name: arr[0].name } : null;
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
