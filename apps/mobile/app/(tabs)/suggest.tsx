import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { OccasionLabel, WeatherConditionLabel, ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const occasions = Object.entries(OccasionLabel);

export default function SuggestScreen() {
  const [selectedOccasion, setSelectedOccasion] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<any[] | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      // Try to get location
      let lat: number | undefined;
      let lon: number | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        lat = location.coords.latitude;
        lon = location.coords.longitude;
      } else {
        setLocationError('未授權定位，推薦將不考慮天氣');
      }

      const params = new URLSearchParams();
      if (selectedOccasion) params.set('occasion', selectedOccasion);
      if (lat !== undefined) params.set('lat', String(lat));
      if (lon !== undefined) params.set('lon', String(lon));

      const data = await api(`/api/suggestions/outfit?${params.toString()}`);
      setSuggestions(data.suggestions);
      setWeather(data.weather);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-5 pt-6">
        <Text className="text-xl font-bold text-gray-900 dark:text-gray-50">今日穿搭推薦</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">選擇場合，為你智慧搭配</Text>
      </View>

      {/* Occasion selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 8 }}
      >
        {occasions.map(([key, label]) => (
          <Pressable
            key={key}
            className={`px-5 py-2.5 rounded-full ${
              selectedOccasion === key ? 'bg-primary-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
            }`}
            onPress={() => setSelectedOccasion(selectedOccasion === key ? undefined : key)}
          >
            <Text className={`font-medium ${selectedOccasion === key ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Generate button */}
      <View className="px-5">
        <Pressable
          className="bg-primary-600 rounded-2xl py-4 items-center active:bg-primary-700"
          onPress={fetchSuggestions}
          disabled={loading}
        >
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles" size={20} color="white" />
            <Text className="text-white text-base font-semibold">
              {loading ? '搭配中...' : '為我推薦穿搭'}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Weather info */}
      {weather && (
        <View className="mx-5 mt-4 bg-blue-50 dark:bg-blue-950 rounded-xl p-3 flex-row items-center gap-2">
          <Ionicons name="partly-sunny" size={20} color="#3b82f6" />
          <Text className="text-blue-700 dark:text-blue-400 text-sm">
            目前氣溫 {weather.temp}°C，{WeatherConditionLabel[weather.condition as keyof typeof WeatherConditionLabel] || weather.condition}
          </Text>
        </View>
      )}

      {locationError && (
        <View className="mx-5 mt-2 bg-yellow-50 dark:bg-yellow-950 rounded-xl p-3 flex-row items-center gap-2">
          <Ionicons name="warning-outline" size={20} color="#d97706" />
          <Text className="text-yellow-700 dark:text-yellow-400 text-sm">{locationError}</Text>
        </View>
      )}

      {/* Suggestions */}
      {loading && (
        <View className="items-center py-12">
          <ActivityIndicator size="large" color="#4c6ef5" />
        </View>
      )}

      {suggestions && !loading && (
        <View className="px-5 mt-4 gap-4 pb-8">
          {suggestions.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="sad-outline" size={48} color="#d1d5db" />
              <Text className="text-gray-400 mt-3 text-center">
                衣櫃裡的衣物不夠組成推薦，試著多新增一些衣物吧！
              </Text>
            </View>
          ) : (
            suggestions.map((suggestion, idx) => (
              <View key={idx} className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
                <Text className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-3">
                  推薦 {idx + 1}
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {suggestion.items.map((item: any) => (
                    <View key={item.id} className="items-center" style={{ width: 76 }}>
                      <View className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {item.thumbnail ? (
                          <Image
                            source={{ uri: `${API_BASE}/api/images/file/${item.thumbnail}` }}
                            className="w-full h-full"
                            contentFit="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center">
                            <Ionicons name="shirt-outline" size={24} color="#9ca3af" />
                          </View>
                        )}
                      </View>
                      <View className="mt-1 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
                        <Text className="text-xs text-gray-500 dark:text-gray-400 text-center" numberOfLines={1}>
                          {ClothingCategoryLabel[item.category as keyof typeof ClothingCategoryLabel] ?? item.category}
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-700 dark:text-gray-300 mt-0.5 text-center" numberOfLines={1} style={{ width: 76 }}>
                        {item.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}
