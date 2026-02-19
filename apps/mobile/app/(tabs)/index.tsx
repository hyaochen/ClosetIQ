import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/lib/auth-store';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-5 pt-6 pb-4">
        <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50">
          嗨，{user?.displayName || '你好'}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          今天想穿什麼？
        </Text>
      </View>

      {/* Quick Actions */}
      <View className="px-5 gap-3">
        <Pressable
          className="bg-primary-600 rounded-2xl p-5 active:bg-primary-700"
          onPress={() => router.push('/suggest')}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="sparkles" size={28} color="white" />
            <View className="flex-1">
              <Text className="text-white text-lg font-semibold">今日穿搭推薦</Text>
              <Text className="text-primary-200 text-sm mt-0.5">根據天氣和你的衣櫃智慧推薦</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </View>
        </Pressable>

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
            onPress={() => router.push('/item/add')}
          >
            <Ionicons name="add-circle-outline" size={28} color="#4c6ef5" />
            <Text className="text-gray-900 dark:text-gray-50 font-semibold mt-2">新增衣物</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">拍照或上傳</Text>
          </Pressable>

          <Pressable
            className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
            onPress={() => router.push('/outfit/builder')}
          >
            <Ionicons name="layers-outline" size={28} color="#4c6ef5" />
            <Text className="text-gray-900 dark:text-gray-50 font-semibold mt-2">組合穿搭</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">搭配你的衣物</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <Pressable
            className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
            onPress={() => router.push('/wear-history')}
          >
            <Ionicons name="calendar-outline" size={28} color="#8b5cf6" />
            <Text className="text-gray-900 dark:text-gray-50 font-semibold mt-2">穿著紀錄</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">日曆查看歷史</Text>
          </Pressable>

          <Pressable
            className="flex-1 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
            onPress={() => router.push('/declutter')}
          >
            <Ionicons name="trash-outline" size={28} color="#ef4444" />
            <Text className="text-gray-900 dark:text-gray-50 font-semibold mt-2">斷捨離</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">整理你的衣櫃</Text>
          </Pressable>
        </View>

        <Pressable
          className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800 flex-row items-center gap-3"
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="stats-chart-outline" size={28} color="#10b981" />
          <View className="flex-1">
            <Text className="text-gray-900 dark:text-gray-50 font-semibold">統計分析</Text>
            <Text className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">衣櫃數據、穿著頻率、每次成本</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
        </Pressable>
      </View>

      <View className="h-8" />
    </ScrollView>
  );
}
