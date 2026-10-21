import '../global.css';
import '@/lib/fonts';
import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/query-client';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useColors } from '@/lib/theme';
import { useColorScheme } from 'nativewind';
import { AlertModal } from '@/components/AlertModal';
import { ImageRegistryWarmup } from '@/components/ImageRegistryWarmup';

export default function RootLayout() {
  const loadSession = useAuthStore((s) => s.loadSession);
  const { isDark, loadTheme } = useThemeStore();
  const { setColorScheme } = useColorScheme();
  const c = useColors();

  useEffect(() => {
    loadSession();
    loadTheme();
  }, []);

  useEffect(() => {
    setColorScheme(isDark ? 'dark' : 'light');
  }, [isDark]);

  // web：body 底色跟著主題，避免過度捲動露出白底
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = c.paper;
      document.documentElement.style.backgroundColor = c.paper;
      document.documentElement.lang = 'zh-Hant';
      document.title = '電子衣櫃';
    }
  }, [c.paper]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ImageRegistryWarmup />
        <View style={{ flex: 1, backgroundColor: c.paper }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: c.paper },
              animation: Platform.OS === 'web' ? 'none' : 'default',
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="item/[id]" />
            <Stack.Screen name="item/add" />
            <Stack.Screen name="item/edit" />
            <Stack.Screen name="outfit/[id]" />
            <Stack.Screen name="outfit/builder" />
            <Stack.Screen name="declutter" />
            <Stack.Screen name="analytics" />
            <Stack.Screen name="laundry" />
            <Stack.Screen name="storage" />
          </Stack>
        </View>
        <AlertModal />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
