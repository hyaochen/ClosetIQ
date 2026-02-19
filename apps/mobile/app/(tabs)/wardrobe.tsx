import { useState } from 'react';
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ClothingCategory, ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const categories = [
  { key: undefined, label: '全部' },
  ...Object.entries(ClothingCategoryLabel).map(([key, label]) => ({ key, label })),
];

export default function WardrobeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['items', selectedCategory],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set('category', selectedCategory);
      params.set('limit', '50');
      return api(`/api/items?${params.toString()}`);
    },
  });

  const items = data?.items ?? [];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat.key ?? 'all'}
            className={`px-4 py-2 rounded-full ${
              selectedCategory === cat.key
                ? 'bg-primary-600'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Text
              className={`text-sm font-medium ${
                selectedCategory === cat.key ? 'text-white' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Items Grid */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4c6ef5" />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="shirt-outline" size={64} color="#d1d5db" />
          <Text className="text-gray-400 text-lg mt-4 text-center">
            衣櫃裡還沒有衣物
          </Text>
          <Pressable
            className="bg-primary-600 rounded-xl px-6 py-3 mt-6 active:bg-primary-700"
            onPress={() => router.push('/item/add')}
          >
            <Text className="text-white font-semibold">新增第一件衣物</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={3}
          contentContainerStyle={{ padding: 8 }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              className="flex-1 m-1 aspect-square rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 active:opacity-80"
              style={{ maxWidth: '33%' }}
              onPress={() => router.push(`/item/${item.id}`)}
            >
              {item.images?.[0]?.thumbnailPath ? (
                <Image
                  source={{ uri: `${API_BASE}/api/images/file/${item.images[0].thumbnailPath}` }}
                  className="w-full h-full"
                  contentFit="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <Ionicons name="shirt-outline" size={32} color="#9ca3af" />
                </View>
              )}
              <View className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1">
                <Text className="text-white text-xs" numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-600 items-center justify-center shadow-lg active:bg-primary-700"
        onPress={() => router.push('/item/add')}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </View>
  );
}
