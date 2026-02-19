import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function OutfitsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api('/api/outfits'),
  });

  const outfits = data?.outfits ?? [];

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#4c6ef5" />
        </View>
      ) : outfits.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="layers-outline" size={64} color="#d1d5db" />
          <Text className="text-gray-400 text-lg mt-4 text-center">
            還沒有建立穿搭組合
          </Text>
          <Pressable
            className="bg-primary-600 rounded-xl px-6 py-3 mt-6 active:bg-primary-700"
            onPress={() => router.push('/outfit/builder')}
          >
            <Text className="text-white font-semibold">建立第一套穿搭</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={outfits}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
              onPress={() => router.push(`/outfit/${item.id}`)}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {item.name || '未命名穿搭'}
                </Text>
                <Text className="text-xs text-gray-400">
                  穿過 {item._count?.wearLogs ?? 0} 次
                </Text>
              </View>
              <ScrollableItemThumbnails items={item.items} />
              {item.rating && (
                <View className="flex-row mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= item.rating! ? 'star' : 'star-outline'}
                      size={16}
                      color={star <= item.rating! ? '#f59e0b' : '#d1d5db'}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      <Pressable
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary-600 items-center justify-center shadow-lg active:bg-primary-700"
        onPress={() => router.push('/outfit/builder')}
      >
        <Ionicons name="add" size={28} color="white" />
      </Pressable>
    </View>
  );
}

function ScrollableItemThumbnails({ items }: { items: any[] }) {
  return (
    <View className="flex-row gap-2">
      {items.map((outfitItem) => {
        const thumb = outfitItem.clothingItem?.images?.[0]?.thumbnailPath;
        return (
          <View key={outfitItem.id} className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {thumb ? (
              <Image
                source={{ uri: `${API_BASE}/api/images/file/${thumb}` }}
                className="w-full h-full"
                contentFit="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center">
                <Ionicons name="shirt-outline" size={20} color="#9ca3af" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
