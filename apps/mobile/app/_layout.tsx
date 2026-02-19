import '../global.css';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useColorScheme } from 'nativewind';

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession);
  const { isDark, loadTheme } = useThemeStore();
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    loadSession();
    loadTheme();
  }, []);

  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className="flex-1 bg-white dark:bg-gray-950">
        <Stack
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: isDark ? '#030712' : '#ffffff' },
            headerTintColor: isDark ? '#f9fafb' : '#1f2937',
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: isDark ? '#030712' : '#f9fafb' },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="item/[id]" options={{ headerShown: true, title: '衣物詳情' }} />
          <Stack.Screen name="item/add" options={{ headerShown: true, title: '新增衣物' }} />
          <Stack.Screen name="item/edit" options={{ headerShown: true, title: '編輯衣物' }} />
          <Stack.Screen name="outfit/[id]" options={{ headerShown: true, title: '穿搭詳情' }} />
          <Stack.Screen name="outfit/builder" options={{ headerShown: true, title: '穿搭組合' }} />
          <Stack.Screen name="declutter" options={{ headerShown: true, title: '斷捨離助手' }} />
          <Stack.Screen name="wear-history" options={{ headerShown: true, title: '穿著紀錄' }} />
          <Stack.Screen name="analytics" options={{ headerShown: true, title: '統計分析' }} />
        </Stack>
      </View>
    </QueryClientProvider>
  );
}
