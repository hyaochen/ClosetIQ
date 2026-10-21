import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { ForecastDay } from '@closet/shared';
import { api } from './api';
import { queryClient } from './query-client';
import { localDateString } from './queries';

// ---- P5：穿搭計畫與旅行打包 ----

export type Forecast = ForecastDay;

export type PlanItem = { id: string; name: string; category: string; colorFamily: string; thumbnail: string | null };
export type Plan = { id: string; date: string; outfitId: string | null; note: string | null; items: PlanItem[] };
export type PlanDay = { date: string; weekday: string; forecast: Forecast | null; plan: Plan | null; hasWearLog: boolean };
export type WeekCell = { date: string; weekday: string; forecast: Forecast | null; hasPlan: boolean; hasWearLog: boolean };

export type TripSummary = {
  id: string;
  name: string;
  destination: string;
  lat: number | null;
  lon: number | null;
  startDate: string;
  endDate: string;
  days: number;
  itemCount: number;
  packedCount: number;
};
export type TripItem = {
  id: string;
  clothingItemId: string | null;
  name: string;
  category: string | null;
  thumbnail: string | null;
  quantity: number;
  packed: boolean;
  reason: string | null;
  isAuto: boolean;
  sortOrder: number;
};
export type TripWeather = {
  days: { date: string; forecast: Forecast | null }[];
  minTemp: number | null;
  maxTemp: number | null;
  rainDates: string[];
  unknownDates: string[];
};
export type TripDetail = {
  trip: Omit<TripSummary, 'itemCount' | 'packedCount'>;
  items: TripItem[];
  weather: TripWeather;
};

/** 沒有定位權限時用台北（Open-Meteo 不需金鑰，所以一定有預報） */
export const DEFAULT_PLACE = { lat: 25.03, lon: 121.56 };

/** 已授權時用目前位置，否則台北；不主動跳權限詢問 */
export function usePlace() {
  const [place, setPlace] = useState(DEFAULT_PLACE);
  useEffect(() => {
    (async () => {
      try {
        const p = await Location.getForegroundPermissionsAsync();
        if (p.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        }
      } catch {
        /* 保持台北 */
      }
    })();
  }, []);
  return place;
}

// ---- 日期工具（本機日曆日，字串運算，避開時區位移） ----
export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return localDateString(new Date(y, m - 1, d + n));
}
export function diffDaysYmd(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
export function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}
const WEEKDAY_ZH = ['日', '一', '二', '三', '四', '五', '六'];
export function weekdayOf(ymd: string): string {
  const { y, m, d } = parseYmd(ymd);
  return WEEKDAY_ZH[new Date(y, m - 1, d).getDay()];
}
/** 10.25 */
export function dotMd(ymd: string): string {
  const { m, d } = parseYmd(ymd);
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}
/** 預報只有今天起 16 天；超過標「無預報」 */
export const FORECAST_HORIZON_DAYS = 16;

// ---- 查詢 ----
export function usePlanRange(from: string, to: string, place: { lat: number; lon: number }) {
  return useQuery<{ from: string; to: string; forecastAvailable: boolean; days: PlanDay[] }>({
    queryKey: ['plans', from, to, place.lat, place.lon],
    queryFn: () => api(`/api/plans?from=${from}&to=${to}&lat=${place.lat}&lon=${place.lon}`),
  });
}

export function usePlanWeek(place: { lat: number; lon: number }) {
  return useQuery<{ days: WeekCell[] }>({
    queryKey: ['plans-week', place.lat, place.lon],
    queryFn: () => api(`/api/plans/week?lat=${place.lat}&lon=${place.lon}`),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTrips() {
  return useQuery<{ trips: TripSummary[] }>({
    queryKey: ['trips'],
    queryFn: () => api('/api/trips'),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery<TripDetail>({
    queryKey: ['trip', id],
    queryFn: () => api(`/api/trips/${id}`),
    enabled: !!id,
  });
}

/** 計畫異動後，刷新計畫、今日頁 7 格與穿著相關快取 */
export function invalidatePlans() {
  queryClient.invalidateQueries({ queryKey: ['plans'] });
  queryClient.invalidateQueries({ queryKey: ['plans-week'] });
}

export function invalidateTrips(id?: string) {
  queryClient.invalidateQueries({ queryKey: ['trips'] });
  if (id) queryClient.invalidateQueries({ queryKey: ['trip', id] });
}

export async function savePlan(date: string, body: { itemIds?: string[]; outfitId?: string; note?: string }) {
  const res = await api(`/api/plans/${date}`, { method: 'PUT', body: JSON.stringify(body) });
  invalidatePlans();
  return res.plan as Plan;
}

export async function removePlan(date: string) {
  await api(`/api/plans/${date}`, { method: 'DELETE' });
  invalidatePlans();
}

/** 就穿這套：把當天計畫轉成穿著紀錄 */
export async function wearPlan(date: string) {
  const res = await api(`/api/plans/${date}/wear`, { method: 'POST' });
  invalidatePlans();
  queryClient.invalidateQueries({ queryKey: ['wear-logs'] });
  queryClient.invalidateQueries({ queryKey: ['stats'] });
  queryClient.invalidateQueries({ queryKey: ['outfits'] });
  queryClient.invalidateQueries({ queryKey: ['laundry'] });
  queryClient.invalidateQueries({ queryKey: ['items'] });
  queryClient.invalidateQueries({ queryKey: ['suggestions'], refetchType: 'none' });
  return res;
}

export type AutoPlanResult = {
  created: { date: string; weekday: string; forecast: Forecast | null; itemNames: string[] }[];
  skipped: { date: string; reason: string }[];
};

export async function autoPlan(from: string, to: string, place: { lat: number; lon: number }): Promise<AutoPlanResult> {
  const res = await api(`/api/plans/auto?from=${from}&to=${to}&lat=${place.lat}&lon=${place.lon}`, { method: 'POST' });
  invalidatePlans();
  return res;
}
