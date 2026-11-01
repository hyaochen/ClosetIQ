import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PickedPhoto } from '@/lib/cutout';

export type TryonStatus = { enabled: boolean };

/** 前端只看這個狀態決定要不要顯示「試穿」入口（本機試穿服務沒開、或不在白名單就是 false）。 */
export function useTryonStatus() {
  return useQuery<TryonStatus>({
    queryKey: ['tryon-status'],
    queryFn: () => api('/api/tryon/status'),
    staleTime: 60_000,
    retry: false,
  });
}

/** FASHN 目前只支援這幾類，其他類別不顯示入口。 */
export const TRYON_CATEGORIES = ['TOP', 'OUTERWEAR', 'BOTTOM', 'DRESS'];

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('無法讀取結果'));
    r.readAsDataURL(blob);
  });
}

export type TryonJobView = {
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
  /** 只有 queued 時有：1 = 下一個輪到（前面有 1 張正在合成） */
  queuePosition?: number;
  elapsedMs: number;
};

/** 送出全身照 + 衣物，伺服器立刻回 jobId（背景合成，用 getTryonJob 輪詢）。 */
export async function submitTryon(itemId: string, photo: PickedPhoto): Promise<string> {
  const formData = new FormData();
  formData.append('itemId', itemId);
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    formData.append('file', blob, photo.fileName || 'person.jpg');
  } else {
    formData.append('file', { uri: photo.uri, type: photo.type || 'image/jpeg', name: photo.fileName || 'person.jpg' } as any);
  }
  const r = await api<{ jobId: string }>('/api/tryon', { method: 'POST', body: formData });
  return r.jobId;
}

export function getTryonJob(jobId: string): Promise<TryonJobView> {
  return api<TryonJobView>(`/api/tryon/jobs/${encodeURIComponent(jobId)}`);
}

/** 完成後取合成照，回傳 data URL（只存在記憶體）。 */
export async function fetchTryonResult(jobId: string): Promise<string> {
  const blob = await api<Blob>(`/api/tryon/jobs/${encodeURIComponent(jobId)}/result`, {}, 'blob');
  return blobToDataUrl(blob);
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 網頁版：觸發下載（手機瀏覽器可從下載/分享存進相簿）。 */
export function downloadDataUrl(dataUrl: string, fileName: string) {
  if (Platform.OS !== 'web') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
