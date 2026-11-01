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

/** 送出全身照 + 衣物，回傳合成照的 data URL（只存在記憶體，不會存到伺服器）。 */
export async function requestTryon(itemId: string, photo: PickedPhoto): Promise<string> {
  const formData = new FormData();
  formData.append('itemId', itemId);
  if (Platform.OS === 'web') {
    const blob = await (await fetch(photo.uri)).blob();
    formData.append('file', blob, photo.fileName || 'person.jpg');
  } else {
    formData.append('file', { uri: photo.uri, type: photo.type || 'image/jpeg', name: photo.fileName || 'person.jpg' } as any);
  }
  const blob = await api<Blob>('/api/tryon', { method: 'POST', body: formData }, 'blob');
  return blobToDataUrl(blob);
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
