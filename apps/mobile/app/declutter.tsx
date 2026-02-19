import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel, ConditionLabel, DeclutterReasonLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { showAlert } from '@/lib/alert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export default function DeclutterScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['declutter-suggestions'],
    queryFn: () => api('/api/stats/declutter-suggestions'),
  });

  const suggestions = data?.suggestions ?? [];
  const current = suggestions[currentIndex];

  const handleAction = async (reason: string | null) => {
    if (!current) return;

    if (reason) {
      try {
        await api(`/api/items/${current.id}?reason=${reason}`, { method: 'DELETE' });
        queryClient.invalidateQueries({ queryKey: ['items'] });
      } catch (err: any) {
        showAlert('操作失敗', err.message);
        return;
      }
    }

    // Move to next
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      showAlert('完成', '你已經檢視了所有建議的衣物！');
      refetch();
      setCurrentIndex(0);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#4c6ef5" />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950 px-8">
        <Ionicons name="checkmark-circle-outline" size={64} color="#10b981" />
        <Text className="text-xl font-semibold text-gray-900 dark:text-gray-50 mt-4 text-center">
          衣櫃狀態良好！
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
          目前沒有建議斷捨離的衣物
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      {/* Progress */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {currentIndex + 1} / {suggestions.length}
        </Text>
        <View className="bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-2">
          <View
            className="bg-primary-600 rounded-full h-1.5"
            style={{ width: `${((currentIndex + 1) / suggestions.length) * 100}%` }}
          />
        </View>
      </View>

      {/* Card */}
      {current && (
        <View className="flex-1 px-5 py-4">
          <View className="flex-1 bg-white dark:bg-gray-900 rounded-3xl overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
            {/* Image */}
            <View className="flex-1 bg-gray-100 dark:bg-gray-800">
              {current.thumbnail ? (
                <Image
                  source={{ uri: `${API_BASE}/api/images/file/${current.thumbnail}` }}
                  className="w-full h-full"
                  contentFit="contain"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Ionicons name="shirt-outline" size={64} color="#d1d5db" />
                </View>
              )}
            </View>

            {/* Info */}
            <View className="p-5">
              <Text className="text-xl font-bold text-gray-900 dark:text-gray-50">{current.name}</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {ClothingCategoryLabel[current.category as keyof typeof ClothingCategoryLabel]}
                {' · '}
                {ConditionLabel[current.condition as keyof typeof ConditionLabel]}
              </Text>
              <View className="flex-row gap-4 mt-3">
                <View>
                  <Text className="text-xs text-gray-400">穿著次數</Text>
                  <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{current.wearCount}</Text>
                </View>
                {current.costPerWear !== null && (
                  <View>
                    <Text className="text-xs text-gray-400">每次成本</Text>
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">${current.costPerWear}</Text>
                  </View>
                )}
                {current.lastWorn && (
                  <View>
                    <Text className="text-xs text-gray-400">上次穿著</Text>
                    <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
                      {new Date(current.lastWorn).toLocaleDateString('zh-TW')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View className="px-5 pb-8">
        <View className="flex-row gap-3 justify-center">
          <ActionButton
            icon="heart-outline"
            label="保留"
            color="#10b981"
            bgColor="bg-green-50"
            borderColor="border-green-200"
            onPress={() => handleAction(null)}
          />
          <ActionButton
            icon="gift-outline"
            label="捐贈"
            color="#3b82f6"
            bgColor="bg-blue-50"
            borderColor="border-blue-200"
            onPress={() => handleAction('DONATED')}
          />
          <ActionButton
            icon="cash-outline"
            label="售出"
            color="#f59e0b"
            bgColor="bg-yellow-50"
            borderColor="border-yellow-200"
            onPress={() => handleAction('SOLD')}
          />
          <ActionButton
            icon="trash-outline"
            label="丟棄"
            color="#ef4444"
            bgColor="bg-red-50"
            borderColor="border-red-200"
            onPress={() => handleAction('DISCARDED')}
          />
        </View>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  color,
  bgColor,
  borderColor,
  onPress,
}: {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`${bgColor} border ${borderColor} rounded-2xl py-3 px-5 items-center active:opacity-80`}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={24} color={color} />
      <Text className="text-xs font-medium mt-1" style={{ color }}>{label}</Text>
    </Pressable>
  );
}
