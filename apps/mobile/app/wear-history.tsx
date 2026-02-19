import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel, WeatherConditionLabel } from '@closet/shared';
import { api } from '@/lib/api';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export default function WearHistoryScreen() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Fetch logs for current month
  const fromDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const toDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${lastDay}`;

  const { data, isLoading } = useQuery({
    queryKey: ['wear-logs', fromDate, toDate],
    queryFn: () => api(`/api/wear-logs?from=${fromDate}&to=${toDate}&limit=100`),
  });

  const logs = data?.logs ?? [];

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const log of logs) {
      const dateStr = new Date(log.date).toISOString().split('T')[0];
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(log);
    }
    return map;
  }, [logs]);

  // Calendar generation
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1).getDay();
    const totalDays = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const days: (number | null)[] = [];

    // Padding for days before the 1st
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= totalDays; d++) days.push(d);

    return days;
  }, [currentMonth]);

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
    setSelectedDate(null);
  };

  const getDateString = (day: number) => {
    return `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const selectedLogs = selectedDate ? (logsByDate[selectedDate] ?? []) : [];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Month Navigation */}
      <View className="bg-white dark:bg-gray-900 px-5 py-4 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <Pressable onPress={prevMonth} className="p-2">
          <Ionicons name="chevron-back" size={24} color="#4b5563" />
        </Pressable>
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {currentMonth.year} 年 {MONTHS[currentMonth.month]}
        </Text>
        <Pressable onPress={nextMonth} className="p-2">
          <Ionicons name="chevron-forward" size={24} color="#4b5563" />
        </Pressable>
      </View>

      {/* Weekday Headers */}
      <View className="bg-white dark:bg-gray-900 flex-row px-2 pt-2">
        {WEEKDAYS.map((day) => (
          <View key={day} className="flex-1 items-center py-2">
            <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">{day}</Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <View className="bg-white dark:bg-gray-900 px-2 pb-3 flex-row flex-wrap">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <View key={`empty-${idx}`} style={{ width: '14.28%' }} className="aspect-square p-0.5" />;
          }

          const dateStr = getDateString(day);
          const hasLogs = !!logsByDate[dateStr];
          const isSelected = selectedDate === dateStr;
          const isToday = dateStr === new Date().toISOString().split('T')[0];

          return (
            <Pressable
              key={day}
              style={{ width: '14.28%' }}
              className="aspect-square p-0.5"
              onPress={() => setSelectedDate(isSelected ? null : dateStr)}
            >
              <View
                className={`flex-1 rounded-xl items-center justify-center ${
                  isSelected ? 'bg-primary-600' : isToday ? 'bg-primary-50 dark:bg-primary-900' : ''
                }`}
              >
                <Text
                  className={`text-sm ${
                    isSelected
                      ? 'text-white font-bold'
                      : isToday
                      ? 'text-primary-700 dark:text-primary-300 font-semibold'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {day}
                </Text>
                {hasLogs && (
                  <View
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white' : 'bg-primary-500'
                    }`}
                  />
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Loading */}
      {isLoading && (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#4c6ef5" />
        </View>
      )}

      {/* Selected Date Logs */}
      {selectedDate && (
        <View className="px-5 py-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('zh-TW', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            的穿著
          </Text>

          {selectedLogs.length === 0 ? (
            <View className="bg-white dark:bg-gray-900 rounded-xl p-6 items-center border border-gray-100 dark:border-gray-800">
              <Ionicons name="shirt-outline" size={32} color="#d1d5db" />
              <Text className="text-gray-400 mt-2">這天沒有穿著紀錄</Text>
            </View>
          ) : (
            <View className="gap-3">
              {selectedLogs.map((log: any) => (
                <View key={log.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                  {/* Weather & Occasion */}
                  <View className="flex-row items-center gap-2 mb-3">
                    {log.occasion && (
                      <View className="bg-primary-50 dark:bg-primary-900 px-2.5 py-1 rounded-full">
                        <Text className="text-xs text-primary-700 dark:text-primary-300 font-medium">
                          {OccasionLabel[log.occasion as keyof typeof OccasionLabel]}
                        </Text>
                      </View>
                    )}
                    {log.weatherTemp != null && (
                      <View className="bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full flex-row items-center gap-1">
                        <Ionicons name="thermometer-outline" size={12} color="#3b82f6" />
                        <Text className="text-xs text-blue-700 dark:text-blue-400">{log.weatherTemp}°C</Text>
                      </View>
                    )}
                    {log.weatherCondition && (
                      <Text className="text-xs text-gray-400">
                        {WeatherConditionLabel[log.weatherCondition as keyof typeof WeatherConditionLabel]}
                      </Text>
                    )}
                  </View>

                  {/* Items */}
                  <View className="flex-row flex-wrap gap-2">
                    {log.items?.map((wli: any) => {
                      const item = wli.clothingItem;
                      const thumb = item?.images?.[0]?.thumbnailPath;
                      return (
                        <View key={wli.id} className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-950 rounded-lg p-2">
                          <View className="w-10 h-10 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-700">
                            {thumb ? (
                              <Image
                                source={{ uri: `${API_BASE}/api/images/file/${thumb}` }}
                                className="w-full h-full"
                                contentFit="cover"
                              />
                            ) : (
                              <View className="w-full h-full items-center justify-center">
                                <Ionicons name="shirt-outline" size={16} color="#9ca3af" />
                              </View>
                            )}
                          </View>
                          <Text className="text-sm text-gray-700 dark:text-gray-300" numberOfLines={1}>
                            {item?.name}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {log.notes && (
                    <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">{log.notes}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Monthly Summary */}
      {!selectedDate && logs.length > 0 && (
        <View className="px-5 py-4">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            本月穿著 {logs.length} 次
          </Text>
          <View className="gap-2">
            {logs.slice(0, 10).map((log: any) => (
              <Pressable
                key={log.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-3 flex-row items-center border border-gray-100 dark:border-gray-800 active:bg-gray-50 dark:active:bg-gray-800"
                onPress={() => setSelectedDate(new Date(log.date).toISOString().split('T')[0])}
              >
                <View className="mr-3">
                  <Text className="text-lg font-bold text-primary-600">
                    {new Date(log.date).getDate()}
                  </Text>
                  <Text className="text-[10px] text-gray-400">
                    {WEEKDAYS[new Date(log.date).getDay()]}
                  </Text>
                </View>
                <View className="flex-row flex-1 gap-1.5">
                  {log.items?.slice(0, 4).map((wli: any) => {
                    const thumb = wli.clothingItem?.images?.[0]?.thumbnailPath;
                    return (
                      <View key={wli.id} className="w-9 h-9 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                        {thumb ? (
                          <Image
                            source={{ uri: `${API_BASE}/api/images/file/${thumb}` }}
                            className="w-full h-full"
                            contentFit="cover"
                          />
                        ) : (
                          <View className="w-full h-full items-center justify-center">
                            <Ionicons name="shirt-outline" size={14} color="#9ca3af" />
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {(log.items?.length ?? 0) > 4 && (
                    <View className="w-9 h-9 rounded-md bg-gray-100 dark:bg-gray-800 items-center justify-center">
                      <Text className="text-[10px] text-gray-500 dark:text-gray-400">+{log.items.length - 4}</Text>
                    </View>
                  )}
                </View>
                {log.occasion && (
                  <Text className="text-xs text-gray-400 ml-2">
                    {OccasionLabel[log.occasion as keyof typeof OccasionLabel]}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}
