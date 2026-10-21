import { useQuery, useMutation } from '@tanstack/react-query';
import {
  resolveCurrentSeason,
  isOutOfSeason,
  type LaundryStatus,
} from '@closet/shared';
import { api } from './api';
import { queryClient } from './query-client';
import { useAuthStore } from './auth-store';

export type Me = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  currentSeason: string | null;
  autoDirtyOnWear: boolean;
  effectiveSeason: string;
};

export type StorageLocation = {
  id: string;
  name: string;
  sortOrder: number;
  isOffSeason: boolean;
  itemCount: number;
};

/** 目前使用者設定（季節、穿後自動待洗） */
export function useMe() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => (await api('/api/auth/me')).user,
    enabled: isAuthenticated,
    staleTime: 1000 * 60,
  });
}

/** 目前季節：沒載入前先用台灣月份推算，避免畫面閃動 */
export function useEffectiveSeason(): string {
  const { data } = useMe();
  return data?.effectiveSeason ?? resolveCurrentSeason(null);
}

export function itemIsOffSeason(item: { seasons: string[] }, season: string) {
  return isOutOfSeason(item.seasons, season);
}

export function useStorageLocations() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<{ locations: StorageLocation[]; unassignedCount: number }>({
    queryKey: ['storage-locations'],
    queryFn: () => api('/api/storage-locations'),
    enabled: isAuthenticated,
  });
}

export function useLaundry() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<{ items: any[] }>({
    queryKey: ['laundry'],
    queryFn: () => api('/api/items/laundry'),
    enabled: isAuthenticated,
  });
}

/** 衣物狀態變動後，讓所有受影響的清單重新整理 */
export function invalidateWardrobe() {
  queryClient.invalidateQueries({ queryKey: ['items'] });
  queryClient.invalidateQueries({ queryKey: ['items-builder'] });
  queryClient.invalidateQueries({ queryKey: ['laundry'] });
  queryClient.invalidateQueries({ queryKey: ['storage-locations'] });
  queryClient.invalidateQueries({ queryKey: ['off-season-items'] });
}

export async function setLaundryStatus(itemIds: string[], status: LaundryStatus) {
  await api('/api/items/laundry', { method: 'POST', body: JSON.stringify({ itemIds, status }) });
  invalidateWardrobe();
  queryClient.invalidateQueries({ queryKey: ['suggestions'], refetchType: 'none' });
}

export async function updateSettings(patch: { currentSeason?: string | null; autoDirtyOnWear?: boolean }) {
  const res = await api('/api/auth/settings', { method: 'PATCH', body: JSON.stringify(patch) });
  queryClient.setQueryData(['me'], res.user);
  queryClient.invalidateQueries({ queryKey: ['items'] });
  queryClient.invalidateQueries({ queryKey: ['off-season-items'] });
  queryClient.invalidateQueries({ queryKey: ['suggestions'] });
  return res.user as Me;
}

export function useUpdateSettings() {
  return useMutation({ mutationFn: updateSettings });
}

/** 記錄穿著（今日穿搭、單品、穿搭詳情共用）；伺服器會把上衣/下身/洋裝/內衣褲轉待洗 */
export async function logWear(args: { itemIds: string[]; outfitId?: string; weatherTemp?: number; occasion?: string; date?: string }) {
  const body = {
    itemIds: args.itemIds,
    outfitId: args.outfitId,
    occasion: args.occasion,
    weatherTemp: args.weatherTemp,
    date: args.date ?? localDateString(),
  };
  const res = await api('/api/wear-logs', { method: 'POST', body: JSON.stringify(body) });
  queryClient.invalidateQueries({ queryKey: ['wear-logs'] });
  queryClient.invalidateQueries({ queryKey: ['stats'] });
  queryClient.invalidateQueries({ queryKey: ['outfits'] });
  queryClient.invalidateQueries({ queryKey: ['suggestions'], refetchType: 'none' });
  invalidateWardrobe();
  return res;
}

/** 本機日期 YYYY-MM-DD（不能用 toISOString，會被 UTC 位移成前一天） */
export function localDateString(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** wear log 的 date 欄位是 DB date（UTC 午夜），取其 YYYY-MM-DD 即為記錄的日期 */
export function logDateKey(value: string): string {
  return value.slice(0, 10);
}
