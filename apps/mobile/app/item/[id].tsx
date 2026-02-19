import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import {
  ClothingCategoryLabel,
  ColorFamilyLabel,
  PatternLabel,
  SeasonLabel,
  OccasionLabel,
  ConditionLabel,
  costPerWear,
} from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { showAlert, showConfirm } from '@/lib/alert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const screenWidth = Dimensions.get('window').width;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wearLoading, setWearLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['items', id],
    queryFn: () => api(`/api/items/${id}`),
    enabled: !!id,
  });

  const item = data?.item;

  const handleWearToday = async () => {
    if (!id) return;
    setWearLoading(true);
    try {
      await api('/api/wear-logs', {
        method: 'POST',
        body: JSON.stringify({
          itemIds: [id],
          date: new Date().toISOString().split('T')[0],
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['items', id] });
      queryClient.invalidateQueries({ queryKey: ['wear-logs'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      showAlert('已記錄', '今天的穿著已記錄！');
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setWearLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('斷捨離', '要將這件衣物移至斷捨離嗎？');
    if (confirmed) {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      router.back();
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#4c6ef5" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <Text className="text-gray-400">找不到此衣物</Text>
      </View>
    );
  }

  const wearCount = item._count?.wearLogItems ?? 0;
  const cpw = costPerWear(item.purchasePrice ? Number(item.purchasePrice) : null, wearCount);

  // Recent wear history
  const recentWears = item.wearLogItems?.map((wli: any) => wli.wearLog) ?? [];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Images */}
      {item.images?.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {item.images.map((img: any) => (
            <Image
              key={img.id}
              source={{ uri: `${API_BASE}/api/images/file/${img.displayPath}` }}
              style={{ width: screenWidth, height: screenWidth }}
              contentFit="cover"
            />
          ))}
        </ScrollView>
      )}

      <View className="px-5 py-4 gap-4">
        {/* Name & Category */}
        <View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50">{item.name}</Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {ClothingCategoryLabel[item.category as keyof typeof ClothingCategoryLabel]}
            {item.subcategory && ` · ${item.subcategory}`}
          </Text>
        </View>

        {/* Quick Action: Wear Today */}
        <Pressable
          className="bg-primary-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 active:bg-primary-700"
          onPress={handleWearToday}
          disabled={wearLoading}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="white" />
          <Text className="text-white text-base font-semibold">
            {wearLoading ? '記錄中...' : '記錄今天穿了'}
          </Text>
        </Pressable>

        {/* Stats */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 items-center border border-gray-100 dark:border-gray-800">
            <Text className="text-xl font-bold text-primary-600">{wearCount}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">穿著次數</Text>
          </View>
          {cpw !== null && (
            <View className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 items-center border border-gray-100 dark:border-gray-800">
              <Text className="text-xl font-bold text-green-600">${cpw}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">每次成本</Text>
            </View>
          )}
          {item.purchasePrice && (
            <View className="flex-1 bg-white dark:bg-gray-900 rounded-xl p-3 items-center border border-gray-100 dark:border-gray-800">
              <Text className="text-xl font-bold text-gray-700 dark:text-gray-300">${Number(item.purchasePrice)}</Text>
              <Text className="text-xs text-gray-500 dark:text-gray-400">購買價格</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800 gap-2">
          <DetailRow label="色系" value={ColorFamilyLabel[item.colorFamily as keyof typeof ColorFamilyLabel]} />
          <DetailRow label="圖案" value={PatternLabel[item.pattern as keyof typeof PatternLabel]} />
          <DetailRow label="季節" value={item.seasons.map((s: string) => SeasonLabel[s as keyof typeof SeasonLabel]).join('、')} />
          <DetailRow label="場合" value={item.occasions.map((o: string) => OccasionLabel[o as keyof typeof OccasionLabel]).join('、')} />
          <DetailRow label="狀態" value={ConditionLabel[item.condition as keyof typeof ConditionLabel]} />
          {item.brand && <DetailRow label="品牌" value={item.brand} />}
          {item.material && <DetailRow label="材質" value={item.material} />}
          {item.size && <DetailRow label="尺寸" value={item.size} />}
          {item.notes && <DetailRow label="備註" value={item.notes} />}
        </View>

        {/* Recent Wear History */}
        {recentWears.length > 0 && (
          <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">最近穿著紀錄</Text>
            {recentWears.map((log: any, idx: number) => (
              <View key={idx} className="flex-row justify-between py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-b-0">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(log.date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                {log.occasion && (
                  <Text className="text-sm text-gray-400">
                    {OccasionLabel[log.occasion as keyof typeof OccasionLabel] || log.occasion}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Edit */}
        <Pressable
          className="bg-white dark:bg-gray-900 border border-primary-200 dark:border-primary-800 rounded-xl py-3 flex-row items-center justify-center gap-2 active:bg-primary-50 dark:active:bg-primary-950"
          onPress={() => router.push(`/item/edit?id=${id}`)}
        >
          <Ionicons name="create-outline" size={18} color="#4c6ef5" />
          <Text className="text-primary-600 font-semibold">編輯衣物資料</Text>
        </Pressable>

        {/* Similar Items */}
        <Pressable
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl py-3 flex-row items-center justify-center gap-2 active:bg-gray-50 dark:active:bg-gray-800"
          onPress={() => {/* TODO: navigate to similar */}}
        >
          <Ionicons name="copy-outline" size={18} color="#6b7280" />
          <Text className="text-gray-600 dark:text-gray-400 font-medium">查看相似衣物</Text>
        </Pressable>

        {/* Delete */}
        <Pressable
          className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl py-3 items-center active:bg-red-100 dark:active:bg-red-900"
          onPress={handleDelete}
        >
          <Text className="text-red-500 font-semibold">斷捨離</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm text-gray-900 dark:text-gray-50 font-medium">{value}</Text>
    </View>
  );
}
