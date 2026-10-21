import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { invalidateWardrobe } from '@/lib/queries';

export type CutoutState = {
  id: string;
  cutoutStatus: 'NONE' | 'PENDING' | 'DONE' | 'FAILED' | 'SKIPPED';
  cutoutPath: string | null;
  cutoutThumbPath: string | null;
  cutoutError?: string | null;
};

/** 輪詢間隔：後端全域限流每 IP 每分鐘 100 次，1.5 秒一次且只輪詢 PENDING 那張 */
export const CUTOUT_POLL_MS = 1500;

export type PickedPhoto = { uri: string; type?: string; fileName?: string };

export async function uploadItemImage(itemId: string, photo: PickedPhoto, primary: boolean) {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    formData.append('file', blob, photo.fileName || 'photo.jpg');
  } else {
    formData.append('file', { uri: photo.uri, type: photo.type || 'image/jpeg', name: photo.fileName || 'photo.jpg' } as any);
  }
  const res = await api(`/api/items/${itemId}/images?primary=${primary ? 'true' : 'false'}`, { method: 'POST', body: formData });
  return res.image as CutoutState & { id: string };
}

/** 輪詢單張圖的去背狀態；非 PENDING 就停止。 */
export function useCutoutStatus(imageId: string | null) {
  return useQuery<{ image: CutoutState; enabled: boolean }>({
    queryKey: ['cutout', imageId],
    queryFn: () => api(`/api/images/${imageId}/cutout`),
    enabled: !!imageId,
    refetchInterval: (q) => (q.state.data?.image?.cutoutStatus === 'PENDING' ? CUTOUT_POLL_MS : false),
    staleTime: 0,
    gcTime: 0,
  });
}

export async function recutout(imageId: string) {
  await api(`/api/images/${imageId}/cutout`, { method: 'POST' });
  queryClient.invalidateQueries({ queryKey: ['cutout', imageId] });
}

/** 「用原圖」：後端清掉去背檔並標 SKIPPED，之後不會被補跑撿起來。 */
export async function skipCutoutOnServer(imageId: string) {
  await api(`/api/images/${imageId}/cutout`, { method: 'DELETE' });
  queryClient.invalidateQueries({ queryKey: ['cutout', imageId] });
}

/** 放棄還沒存的草稿衣物：先刪圖（連檔案）再永久刪除衣物列 */
export async function discardDraft(itemId: string, imageIds: string[]) {
  for (const id of imageIds) await api(`/api/images/${id}`, { method: 'DELETE' }).catch(() => {});
  await api(`/api/items/${itemId}?permanent=true`, { method: 'DELETE' }).catch(() => {});
}

// ---- 整理舊照片（補跑去背） ----
export type BackfillJob = { total: number; done: number; failed: number; cancelled: boolean; running: boolean; startedAt: string };
export type BackfillState = { enabled: boolean; job: BackfillJob | null; remaining: number };

export function useBackfill() {
  return useQuery<BackfillState>({
    queryKey: ['cutout-backfill'],
    queryFn: () => api('/api/images/cutout/backfill'),
    refetchInterval: (q) => (q.state.data?.job?.running ? CUTOUT_POLL_MS : false),
  });
}

export async function startBackfill(limit = 100) {
  await api('/api/images/cutout/backfill', { method: 'POST', body: JSON.stringify({ limit }) });
  await queryClient.invalidateQueries({ queryKey: ['cutout-backfill'] });
}

export async function cancelBackfill() {
  await api('/api/images/cutout/backfill/cancel', { method: 'POST' });
  await queryClient.invalidateQueries({ queryKey: ['cutout-backfill'] });
}

export function refreshAfterCutout() {
  invalidateWardrobe();
}
