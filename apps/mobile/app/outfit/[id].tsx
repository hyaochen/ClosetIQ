import { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel, ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { showAlert, showConfirm } from '@/lib/alert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wearLoading, setWearLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['outfits', id],
    queryFn: () => api(`/api/outfits/${id}`),
    enabled: !!id,
  });

  const outfit = data?.outfit;

  const handleWearToday = async () => {
    if (!outfit) return;
    setWearLoading(true);
    try {
      const itemIds = outfit.items.map((oi: any) => oi.clothingItem?.id).filter(Boolean);
      await api('/api/wear-logs', {
        method: 'POST',
        body: JSON.stringify({
          outfitId: id,
          itemIds,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['outfits', id] });
      queryClient.invalidateQueries({ queryKey: ['wear-logs'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      showAlert('已記錄', '今天的穿搭已記錄！');
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setWearLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('刪除穿搭', '確定要刪除這套穿搭嗎？');
    if (confirmed) {
      await api(`/api/outfits/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
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

  if (!outfit) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <Text className="text-gray-400">找不到此穿搭</Text>
      </View>
    );
  }

  const wearCount = outfit.wearLogs?.length ?? 0;

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-5 py-4 gap-4">
        {/* Title */}
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex-1">
            {outfit.name || '未命名穿搭'}
          </Text>
          <View className="bg-primary-50 dark:bg-primary-900 px-3 py-1 rounded-full">
            <Text className="text-sm text-primary-700 dark:text-primary-300 font-medium">穿過 {wearCount} 次</Text>
          </View>
        </View>

        {/* Rating */}
        {outfit.rating && (
          <View className="flex-row">
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={star <= outfit.rating! ? 'star' : 'star-outline'}
                size={20}
                color={star <= outfit.rating! ? '#f59e0b' : '#d1d5db'}
              />
            ))}
          </View>
        )}

        {/* Wear Today */}
        <Pressable
          className="bg-primary-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 active:bg-primary-700"
          onPress={handleWearToday}
          disabled={wearLoading}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="white" />
          <Text className="text-white text-base font-semibold">
            {wearLoading ? '記錄中...' : '今天穿了這套'}
          </Text>
        </Pressable>

        {/* Items */}
        <View className="gap-3">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">包含衣物</Text>
          {outfit.items?.map((outfitItem: any) => {
            const item = outfitItem.clothingItem;
            const thumb = item?.images?.[0]?.thumbnailPath;
            return (
              <Pressable
                key={outfitItem.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-3 flex-row items-center gap-3 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
                onPress={() => router.push(`/item/${item?.id}`)}
              >
                <View className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {thumb ? (
                    <Image
                      source={{ uri: `${API_BASE}/api/images/file/${thumb}` }}
                      className="w-full h-full"
                      contentFit="cover"
                    />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <Ionicons name="shirt-outline" size={24} color="#9ca3af" />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-medium text-gray-900 dark:text-gray-50">{item?.name}</Text>
                  <Text className="text-sm text-gray-500 dark:text-gray-400">
                    {ClothingCategoryLabel[item?.category as keyof typeof ClothingCategoryLabel] || item?.category}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
              </Pressable>
            );
          })}
        </View>

        {/* Occasions */}
        {outfit.occasions?.length > 0 && (
          <View>
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">適合場合</Text>
            <View className="flex-row flex-wrap gap-2">
              {outfit.occasions.map((o: string) => (
                <View key={o} className="bg-primary-50 dark:bg-primary-900 px-3 py-1.5 rounded-full">
                  <Text className="text-sm text-primary-700 dark:text-primary-300">
                    {OccasionLabel[o as keyof typeof OccasionLabel]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Wear history */}
        {outfit.wearLogs?.length > 0 && (
          <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">穿著紀錄</Text>
            {outfit.wearLogs.map((log: any) => (
              <View key={log.id} className="flex-row justify-between py-1.5 border-b border-gray-50 dark:border-gray-800">
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  {new Date(log.date).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                {log.occasion && (
                  <Text className="text-sm text-gray-400">
                    {OccasionLabel[log.occasion as keyof typeof OccasionLabel]}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {outfit.notes && (
          <View className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
            <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">備註</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">{outfit.notes}</Text>
          </View>
        )}

        {/* Delete */}
        <Pressable
          className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl py-3 items-center active:bg-red-100 dark:active:bg-red-900"
          onPress={handleDelete}
        >
          <Text className="text-red-500 font-semibold">刪除穿搭</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
