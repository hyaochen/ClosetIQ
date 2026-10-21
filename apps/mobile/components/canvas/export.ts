import { Platform } from 'react-native';
import { API_BASE } from '@/lib/images';
import { api, tokenStorage } from '@/lib/api';

/** 下載 /api/outfits/:id/export.png（需要 Bearer，所以用 fetch 取 blob 再觸發瀏覽器下載） */
export async function exportOutfitPng(id: string, name?: string): Promise<void> {
  if (Platform.OS !== 'web') throw new Error('目前只支援在網頁版匯出圖片');
  // 先打一次需驗證的 API，讓過期的 token 自動換新
  await api('/api/auth/me').catch(() => null);
  const token = await tokenStorage.get('accessToken');
  const res = await fetch(`${API_BASE}/api/outfits/${id}/export.png`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(e.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(name || '穿搭').replace(/[\/:*?"<>|]/g, '_')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
