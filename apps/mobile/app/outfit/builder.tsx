import { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel, OccasionLabel, SeasonLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { showAlert } from '@/lib/alert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 100;

export default function OutfitBuilderScreen() {
  const [name, setName] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['items-builder'],
    queryFn: ({ pageParam = 1 }) =>
      api(`/api/items?limit=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  if (hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }

  const allItems: any[] = data?.pages.flatMap((page: any) => page.items) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;

  const items = selectedCategory
    ? allItems.filter((item: any) => item.category === selectedCategory)
    : allItems;

  const categories = [
    { key: undefined, label: '全部' },
    ...Object.entries(ClothingCategoryLabel).map(([key, label]) => ({ key, label })),
  ];

  const toggleItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleArray = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      showAlert('提示', '請至少選擇一件衣物');
      return;
    }
    setLoading(true);
    try {
      await api('/api/outfits', {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined, itemIds: selectedItems, occasions, seasons, rating }),
      });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      showAlert('成功', '穿搭已儲存');
      router.back();
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-4">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">穿搭名稱</Text>
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
          placeholder="例：上班日常穿搭"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
        />
      </View>

      {selectedItems.length > 0 && (
        <View className="px-5 mt-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">已選擇 {selectedItems.length} 件</Text>
          <View className="flex-row flex-wrap gap-2">
            {selectedItems.map((itemId) => {
              const item = allItems.find((i: any) => i.id === itemId);
              if (!item) return null;
              return (
                <Pressable key={itemId} className="w-16 h-16 rounded-lg overflow-hidden border-2 border-primary-500 relative" onPress={() => toggleItem(itemId)}>
                  {item.images?.[0]?.thumbnailPath ? (
                    <Image source={{ uri: `${API_BASE}/api/images/file/${item.images[0].thumbnailPath}` }} className="w-full h-full" contentFit="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                      <Ionicons name="shirt-outline" size={20} color="#9ca3af" />
                    </View>
                  )}
                  <View className="absolute top-0 right-0 w-4 h-4 bg-primary-600 rounded-bl items-center justify-center">
                    <Ionicons name="checkmark" size={10} color="white" />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View className="mt-4">
        <View style={{ height: 44 }} className="border-b border-gray-200 dark:border-gray-800">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, alignItems: 'center', gap: 8 }} style={{ flex: 1 }}>
            {categories.map((cat) => (
              <Pressable
                key={cat.key ?? 'all'}
                className={`px-3.5 py-1.5 rounded-full ${selectedCategory === cat.key ? 'bg-primary-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Text className={`text-xs font-medium ${selectedCategory === cat.key ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      <View className="px-5 mt-3">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          選擇衣物
          {!isLoading && <Text className="text-xs font-normal text-gray-400">{'  '}顯示 {items.length} / 共 {total} 件{isFetchingNextPage ? '  載入中...' : ''}</Text>}
        </Text>
        {isLoading ? (
          <View className="py-8 items-center"><ActivityIndicator size="small" color="#4c6ef5" /></View>
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {items.map((item: any) => (
              <Pressable
                key={item.id}
                className={`w-20 h-20 rounded-lg overflow-hidden ${selectedItems.includes(item.id) ? 'border-2 border-primary-500' : 'border border-gray-200 dark:border-gray-700'}`}
                onPress={() => toggleItem(item.id)}
              >
                {item.images?.[0]?.thumbnailPath ? (
                  <Image source={{ uri: `${API_BASE}/api/images/file/${item.images[0].thumbnailPath}` }} className="w-full h-full" contentFit="cover" />
                ) : (
                  <View className="w-full h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                    <Ionicons name="shirt-outline" size={20} color="#9ca3af" />
                    <Text className="text-[8px] text-gray-400 mt-0.5" numberOfLines={1}>{item.name}</Text>
                  </View>
                )}
                {selectedItems.includes(item.id) && (
                  <View className="absolute top-0 right-0 w-4 h-4 bg-primary-600 rounded-bl items-center justify-center">
                    <Ionicons name="checkmark" size={10} color="white" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View className="px-5 mt-4">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">場合</Text>
        <View className="flex-row flex-wrap gap-2">
          {Object.entries(OccasionLabel).map(([key, label]) => (
            <Pressable key={key} className={`px-3.5 py-2 rounded-full ${occasions.includes(key) ? 'bg-primary-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'}`} onPress={() => toggleArray(occasions, key, setOccasions)}>
              <Text className={`text-sm ${occasions.includes(key) ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="px-5 mt-4">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">評分</Text>
        <View className="flex-row gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => setRating(rating === star ? undefined : star)}>
              <Ionicons name={rating && star <= rating ? 'star' : 'star-outline'} size={28} color={rating && star <= rating ? '#f59e0b' : '#d1d5db'} />
            </Pressable>
          ))}
        </View>
      </View>

      <View className="px-5 mt-6">
        <Pressable className="bg-primary-600 rounded-xl py-4 items-center active:bg-primary-700" onPress={handleSave} disabled={loading}>
          <Text className="text-white text-base font-semibold">{loading ? '儲存中...' : '儲存穿搭'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
