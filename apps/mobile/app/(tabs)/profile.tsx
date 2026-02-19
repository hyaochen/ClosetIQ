import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ClothingCategoryLabel, ColorFamilyLabel } from '@closet/shared';
import { showConfirm } from '@/lib/alert';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { mode, isDark, setMode } = useThemeStore();

  const { data: stats } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => api('/api/stats/overview'),
  });

  const handleLogout = async () => {
    const confirmed = await showConfirm('登出', '確定要登出嗎？');
    if (confirmed) {
      await logout();
      router.replace('/(auth)/login');
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* User Info */}
      <View className="bg-white dark:bg-gray-900 px-5 py-6 border-b border-gray-100 dark:border-gray-800">
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 items-center justify-center">
            <Text className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {user?.displayName?.charAt(0) || '?'}
            </Text>
          </View>
          <View>
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-50">{user?.displayName}</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Theme Toggle */}
      <View className="px-5 py-4">
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">外觀設定</Text>
        <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <ThemeOption
            label="淺色模式"
            icon="sunny-outline"
            selected={mode === 'light'}
            onPress={() => setMode('light')}
            isDark={isDark}
          />
          <View className="border-b border-gray-100 dark:border-gray-800 mx-4" />
          <ThemeOption
            label="深色模式"
            icon="moon-outline"
            selected={mode === 'dark'}
            onPress={() => setMode('dark')}
            isDark={isDark}
          />
          <View className="border-b border-gray-100 dark:border-gray-800 mx-4" />
          <ThemeOption
            label="跟隨系統"
            icon="phone-portrait-outline"
            selected={mode === 'system'}
            onPress={() => setMode('system')}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Stats Overview */}
      {stats && (
        <View className="px-5 py-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-3">衣櫃總覽</Text>
          <View className="flex-row gap-3">
            <StatCard label="衣物總數" value={stats.activeItems} color="#4c6ef5" isDark={isDark} />
            <StatCard label="穿搭組合" value={stats.totalOutfits} color="#10b981" isDark={isDark} />
            <StatCard label="穿著紀錄" value={stats.totalWearLogs} color="#f59e0b" isDark={isDark} />
          </View>

          {/* Category breakdown */}
          {stats.categoryBreakdown?.length > 0 && (
            <View className="mt-4 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">分類分布</Text>
              {stats.categoryBreakdown.map((cat: any) => (
                <View key={cat.category} className="flex-row justify-between py-1.5">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {ClothingCategoryLabel[cat.category as keyof typeof ClothingCategoryLabel] || cat.category}
                  </Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">{cat.count} 件</Text>
                </View>
              ))}
            </View>
          )}

          {/* Color breakdown */}
          {stats.colorBreakdown?.length > 0 && (
            <View className="mt-3 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
              <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">顏色分布</Text>
              {stats.colorBreakdown.map((color: any) => (
                <View key={color.colorFamily} className="flex-row justify-between py-1.5">
                  <Text className="text-sm text-gray-600 dark:text-gray-400">
                    {ColorFamilyLabel[color.colorFamily as keyof typeof ColorFamilyLabel] || color.colorFamily}
                  </Text>
                  <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">{color.count} 件</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Menu */}
      <View className="px-5 py-2 gap-2">
        <MenuItem
          icon="analytics-outline"
          label="穿著頻率分析"
          isDark={isDark}
          onPress={() => router.push('/analytics')}
        />
        <MenuItem
          icon="trash-outline"
          label="斷捨離助手"
          color="#ef4444"
          isDark={isDark}
          onPress={() => router.push('/declutter')}
        />
      </View>

      {/* Logout */}
      <View className="px-5 py-6">
        <Pressable
          className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 rounded-xl py-3 items-center active:bg-red-50 dark:active:bg-red-950"
          onPress={handleLogout}
        >
          <Text className="text-red-500 font-semibold">登出</Text>
        </Pressable>
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}

function ThemeOption({
  label,
  icon,
  selected,
  onPress,
  isDark,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      className="flex-row items-center px-4 py-3.5"
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
      <Text className="flex-1 ml-3 text-base text-gray-800 dark:text-gray-200">{label}</Text>
      {selected && <Ionicons name="checkmark" size={20} color="#4c6ef5" />}
    </Pressable>
  );
}

function StatCard({ label, value, color, isDark }: { label: string; value: number; color: string; isDark: boolean }) {
  return (
    <View className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 items-center">
      <Text className="text-2xl font-bold" style={{ color }}>{value}</Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  color = '#4b5563',
  isDark,
  onPress,
}: {
  icon: string;
  label: string;
  color?: string;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3.5 flex-row items-center border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={22} color={color} />
      <Text className="flex-1 ml-3 text-base text-gray-800 dark:text-gray-200">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}
