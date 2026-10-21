import { Tabs } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { TabBar } from '@/components/ui';
import { api } from '@/lib/api';

/**
 * 暖機：先抓一次衣物清單，api() 會把所有 ClothingImage 的去背資訊登記進 lib/images 的登記表，
 * 這樣計畫、日記、回顧等只拿到縮圖路徑字串的畫面也能換成去背縮圖，不用等使用者先進衣櫃。
 */
function useImageRegistryWarmup() {
  useQuery({
    queryKey: ['image-registry-warmup'],
    queryFn: () => api('/api/items?limit=50&page=1&sortBy=createdAt&sortOrder=desc'),
    staleTime: 5 * 60 * 1000,
  });
}

/** 今日 / 衣櫃 / 穿搭 / 日記 / 我的 */
export default function TabLayout() {
  useImageRegistryWarmup();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: '今日' }} />
      <Tabs.Screen name="wardrobe" options={{ title: '衣櫃' }} />
      <Tabs.Screen name="outfits" options={{ title: '穿搭' }} />
      <Tabs.Screen name="journal" options={{ title: '日記' }} />
      <Tabs.Screen name="me" options={{ title: '我的' }} />
    </Tabs>
  );
}
