import { Tabs } from 'expo-router';
import { TabBar } from '@/components/ui';

/** 今日 / 衣櫃 / 穿搭 / 日記 / 我的 */
export default function TabLayout() {
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
