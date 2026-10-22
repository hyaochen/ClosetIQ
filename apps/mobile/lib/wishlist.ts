import { useQuery } from '@tanstack/react-query';
import type { WishlistAnalysis, WardrobeGap, WishlistStatus } from '@closet/shared';
import { api, tokenStorage } from './api';
import { API_BASE } from './images';
import { queryClient } from './query-client';
import { useAuthStore } from './auth-store';
import { Platform } from 'react-native';

export type WishlistItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  colorFamily: string;
  colors: string[];
  pattern: string | null;
  seasons: string[];
  occasions: string[];
  price: number | null;
  url: string | null;
  note: string | null;
  status: WishlistStatus;
  imageOriginalPath: string | null;
  imageDisplayPath: string | null;
  imageThumbnailPath: string | null;
  boughtItemId: string | null;
  createdAt: string;
  updatedAt: string;
  /** 列表 API 一次算好的購前分數（只有「想買」有值） */
  score?: number | null;
};

export const WISHLIST_STATUS_LABEL: Record<WishlistStatus, string> = {
  WANT: '想買',
  BOUGHT: '已買',
  DROPPED: '不買了',
};

/** 全部願望清單項目（一次抓，前端依狀態分組；數量通常很少） */
export function useWishlist() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<WishlistItem[]>({
    queryKey: ['wishlist', 'all'],
    queryFn: async () => (await api('/api/wishlist')).items,
    enabled: isAuthenticated,
  });
}

export function useWishlistItem(id: string | undefined) {
  return useQuery<WishlistItem>({
    queryKey: ['wishlist', 'item', id],
    queryFn: async () => (await api(`/api/wishlist/${id}`)).item,
    enabled: !!id,
  });
}

export function useWishlistAnalysis(id: string | undefined, enabled = true) {
  return useQuery<WishlistAnalysis>({
    queryKey: ['wishlist', 'analysis', id],
    queryFn: () => api(`/api/wishlist/${id}/analysis`),
    enabled: !!id && enabled,
    staleTime: 60_000,
  });
}

/** 缺口：API 直接回陣列 */
export function useWardrobeGaps() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<WardrobeGap[]>({
    queryKey: ['stats', 'wardrobe-gaps'],
    queryFn: async () => {
      const res = await api('/api/stats/wardrobe-gaps');
      return Array.isArray(res) ? res : res?.gaps ?? [];
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

/** 願望清單變動後，列表、分析與缺口都要重算（衣櫃變動也會影響分析） */
export function invalidateWishlist() {
  queryClient.invalidateQueries({ queryKey: ['wishlist'] });
  queryClient.invalidateQueries({ queryKey: ['stats', 'wardrobe-gaps'] });
}

export type PickedImage = { uri: string; type?: string; fileName?: string };

/** 上傳願望清單單張圖片（web 轉 blob，native 用 uri 物件） */
export async function uploadWishlistImage(id: string, img: PickedImage) {
  const token = await tokenStorage.get('accessToken');
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(img.uri)).blob();
    formData.append('file', blob, img.fileName || 'photo.jpg');
  } else {
    formData.append('file', { uri: img.uri, type: img.type || 'image/jpeg', name: img.fileName || 'photo.jpg' } as any);
  }
  const res = await fetch(`${API_BASE}/api/wishlist/${id}/image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '圖片上傳失敗');
  }
}

/** 商品連結只接受 http / https */
export function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatPrice(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null;
  return `NT$${Math.round(price).toLocaleString('en-US')}`;
}

/** 10.18 這種月.日 */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** 分數判讀：文字 + 是否警示 */
export function scoreVerdict(score: number): { label: string; warn: boolean } {
  if (score >= 60) return { label: '建議入手', warn: false };
  if (score >= 40) return { label: '可以再想想', warn: false };
  return { label: '建議再考慮', warn: true };
}

/** 衣櫃裡可搭配的件數少於此值，分析參考價值有限 */
export const MIN_RELIABLE_CONSIDERED = 6;
