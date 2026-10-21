import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

/**
 * 暖機：登入後先抓一次衣物清單，api() 會把所有 ClothingImage 的去背資訊登記進 lib/images 的登記表，
 * 這樣計畫、日記、回顧、斷捨離等只拿到縮圖路徑字串的畫面也能換成去背縮圖（含直接開深連結的情況）。
 * 登記表更新時，用 useImagesVersion() 的元件會自動重畫。
 */
export function ImageRegistryWarmup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useQuery({
    queryKey: ['image-registry-warmup'],
    queryFn: () => api('/api/items?limit=50&page=1&sortBy=createdAt&sortOrder=desc'),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });
  return null;
}
