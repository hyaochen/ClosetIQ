import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import type { JournalMonthResponse, JournalLog, MonthlyRecap, YearlyRecap } from '@closet/shared';
import { api } from './api';
import { queryClient } from './query-client';
import { useAuthStore } from './auth-store';
import { invalidateWardrobe } from './queries';

export const WEEKDAYS_MON = ['一', '二', '三', '四', '五', '六', '日'];
export const WEEKDAY_FULL = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
export const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function monthKey(year: number, monthIndex: number) {
  return `${year}-${pad(monthIndex + 1)}`;
}

export function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d.getFullYear(), d.getMonth());
}

/** 'YYYY-MM-DD' -> 星期幾（0 = 週日），不經過時區換算 */
export function weekdayOf(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function useJournalMonth(month: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<JournalMonthResponse>({
    queryKey: ['wear-logs', 'journal', month],
    queryFn: () => api(`/api/wear-logs?month=${month}`),
    enabled: isAuthenticated,
  });
}

export function useMonthlyRecap(month: string) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<MonthlyRecap>({
    queryKey: ['stats', 'monthly-recap', month],
    queryFn: () => api(`/api/stats/monthly-recap?month=${month}`),
    enabled: isAuthenticated,
  });
}

export function useYearlyRecap(year: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<YearlyRecap>({
    queryKey: ['stats', 'yearly-recap', year],
    queryFn: () => api(`/api/stats/yearly-recap?year=${year}`),
    enabled: isAuthenticated,
  });
}

/** 日記相關資料變動後重新整理：月曆、回顧、統計與衣物狀態 */
export function invalidateJournal() {
  queryClient.invalidateQueries({ queryKey: ['wear-logs'] });
  queryClient.invalidateQueries({ queryKey: ['stats'] });
  queryClient.invalidateQueries({ queryKey: ['outfits'] });
  queryClient.invalidateQueries({ queryKey: ['suggestions'], refetchType: 'none' });
  invalidateWardrobe();
}

export type PickedPhoto = { uri: string; mimeType: string; fileName: string; file?: Blob };

/** 取得一張照片：web 走檔案選擇（手機瀏覽器可直接拍照），native 依 source 開相機或相簿 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85, allowsEditing: false };
  if (Platform.OS !== 'web') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new Error(source === 'camera' ? '請允許使用相機' : '請允許存取相簿');
  }
  const res =
    source === 'camera' && Platform.OS !== 'web'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    mimeType: a.mimeType || 'image/jpeg',
    fileName: a.fileName || 'ootd.jpg',
    file: (a as any).file as Blob | undefined,
  };
}

async function toFormData(photo: PickedPhoto): Promise<FormData> {
  const fd = new FormData();
  if (Platform.OS === 'web') {
    const blob = photo.file ?? (await (await fetch(photo.uri)).blob());
    fd.append('file', blob, photo.fileName);
  } else {
    fd.append('file', { uri: photo.uri, type: photo.mimeType, name: photo.fileName } as any);
  }
  return fd;
}

/** 「拍今日穿搭」：依日期建立（或掛到既有）紀錄並上傳照片 */
export async function uploadOotdForDate(date: string, photo: PickedPhoto): Promise<{ log: JournalLog; created: boolean }> {
  const res = await api(`/api/wear-logs/photo?date=${date}`, { method: 'POST', body: await toFormData(photo) });
  invalidateJournal();
  return res;
}

/** 對指定紀錄上傳／取代照片 */
export async function uploadOotdForLog(logId: string, photo: PickedPhoto): Promise<{ log: JournalLog }> {
  const res = await api(`/api/wear-logs/${logId}/photo`, { method: 'POST', body: await toFormData(photo) });
  invalidateJournal();
  return res;
}

export async function deleteOotdPhoto(logId: string) {
  const res = await api(`/api/wear-logs/${logId}/photo`, { method: 'DELETE' });
  invalidateJournal();
  return res;
}

export async function updateLogItems(logId: string, itemIds: string[]) {
  const res = await api(`/api/wear-logs/${logId}`, { method: 'PATCH', body: JSON.stringify({ itemIds }) });
  invalidateJournal();
  return res;
}

export async function deleteLog(logId: string) {
  const res = await api(`/api/wear-logs/${logId}`, { method: 'DELETE' });
  invalidateJournal();
  return res;
}

/** 百分比顯示：0..1 小數 -> '34%' */
export function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}
