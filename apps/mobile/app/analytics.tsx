import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';

export default function AnalyticsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'advanced'],
    queryFn: () => api('/api/stats/advanced'),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#4c6ef5" />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Text className="text-gray-400">無法載入統計資料</Text>
      </View>
    );
  }

  const { brandBreakdown, spending, materialBreakdown, costPerWear } = data;

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Spending Overview */}
      <Section title="花費總覽" icon="wallet-outline">
        <View className="flex-row gap-3 mb-3">
          <MiniCard label="總花費" value={`$${spending.totalSpent.toLocaleString()}`} color="#4c6ef5" />
          <MiniCard label="月均花費" value={`$${spending.avgMonthlySpending.toLocaleString()}`} color="#10b981" />
        </View>
        <View className="flex-row gap-3 mb-4">
          <MiniCard
            label="有價格記錄"
            value={`${spending.itemsWithPriceCount}/${spending.totalItemCount}`}
            color="#f59e0b"
          />
          <MiniCard
            label="平均單價"
            value={spending.itemsWithPriceCount > 0
              ? `$${Math.round(spending.totalSpent / spending.itemsWithPriceCount).toLocaleString()}`
              : '-'}
            color="#8b5cf6"
          />
        </View>

        {/* Category Spending */}
        {spending.categorySpending.length > 0 && (
          <View>
            <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">各分類花費</Text>
            {spending.categorySpending.map((cat: any) => (
              <BarRow
                key={cat.category}
                label={ClothingCategoryLabel[cat.category as keyof typeof ClothingCategoryLabel] || cat.category}
                value={`$${cat.amount.toLocaleString()}`}
                ratio={spending.totalSpent > 0 ? cat.amount / spending.totalSpent : 0}
                color="#4c6ef5"
              />
            ))}
          </View>
        )}

        {/* Monthly Spending */}
        {spending.monthlySpending.length > 0 && (
          <View className="mt-4">
            <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">月度花費</Text>
            {spending.monthlySpending.map((m: any) => {
              const maxMonth = Math.max(...spending.monthlySpending.map((s: any) => s.amount));
              return (
                <BarRow
                  key={m.month}
                  label={m.month}
                  value={`$${m.amount.toLocaleString()}`}
                  ratio={maxMonth > 0 ? m.amount / maxMonth : 0}
                  color="#10b981"
                />
              );
            })}
          </View>
        )}
      </Section>

      {/* Brand Breakdown */}
      <Section title="品牌分布" icon="pricetag-outline">
        {brandBreakdown.length === 0 ? (
          <Text className="text-gray-400 text-sm">尚無品牌資料</Text>
        ) : (
          brandBreakdown.map((b: any) => (
            <View key={b.brand} className="flex-row items-center py-2.5 border-b border-gray-50 dark:border-gray-800">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">{b.brand}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {b.count} 件 · 穿 {b.totalWears} 次
                  {b.totalSpent > 0 ? ` · $${b.totalSpent.toLocaleString()}` : ''}
                </Text>
              </View>
              <View className="items-end">
                {b.avgCostPerWear !== null ? (
                  <View>
                    <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      ${b.avgCostPerWear}/次
                    </Text>
                    <Text className="text-[10px] text-gray-400 text-right">每次成本</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-gray-400">尚未穿著</Text>
                )}
              </View>
            </View>
          ))
        )}
      </Section>

      {/* Material Breakdown */}
      <Section title="材質分布" icon="layers-outline">
        {materialBreakdown.length === 0 ? (
          <Text className="text-gray-400 text-sm">尚無材質資料</Text>
        ) : (
          <>
            {materialBreakdown.map((m: any) => {
              const maxCount = materialBreakdown[0]?.count || 1;
              return (
                <BarRow
                  key={m.material}
                  label={m.material}
                  value={`${m.count} 件`}
                  ratio={m.count / maxCount}
                  color="#8b5cf6"
                />
              );
            })}
          </>
        )}
      </Section>

      {/* Cost Per Wear Rankings */}
      <Section title="每次穿著成本排行" icon="trending-down-outline">
        {costPerWear.bestValue.length === 0 && costPerWear.worstValue.length === 0 ? (
          <Text className="text-gray-400 text-sm">需要有價格及穿著紀錄才能計算</Text>
        ) : (
          <>
            {costPerWear.bestValue.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-semibold text-green-600 dark:text-green-400 mb-2">
                  💰 最划算（每次成本最低）
                </Text>
                {costPerWear.bestValue.map((item: any) => (
                  <CostRow key={item.id} item={item} highlight="good" />
                ))}
              </View>
            )}
            {costPerWear.worstValue.length > 0 && (
              <View>
                <Text className="text-xs font-semibold text-red-500 dark:text-red-400 mb-2">
                  🔥 最浪費（每次成本最高）
                </Text>
                {costPerWear.worstValue.map((item: any) => (
                  <CostRow key={item.id} item={item} highlight="bad" />
                ))}
              </View>
            )}
          </>
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View className="mx-5 mt-4 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
      <View className="flex-row items-center gap-2 mb-3">
        <Ionicons name={icon as any} size={18} color="#6b7280" />
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 items-center">
      <Text className="text-lg font-bold" style={{ color }}>{value}</Text>
      <Text className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</Text>
    </View>
  );
}

function BarRow({ label, value, ratio, color }: { label: string; value: string; ratio: number; color: string }) {
  return (
    <View className="mb-2">
      <View className="flex-row justify-between mb-1">
        <Text className="text-sm text-gray-700 dark:text-gray-300">{label}</Text>
        <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">{value}</Text>
      </View>
      <View className="bg-gray-100 dark:bg-gray-800 rounded-full h-2">
        <View
          className="rounded-full h-2"
          style={{ width: `${Math.max(ratio * 100, 2)}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

function CostRow({ item, highlight }: { item: any; highlight: 'good' | 'bad' }) {
  return (
    <View className="flex-row items-center py-2 border-b border-gray-50 dark:border-gray-800">
      <View className="flex-1">
        <Text className="text-sm text-gray-900 dark:text-gray-50" numberOfLines={1}>{item.name}</Text>
        <Text className="text-xs text-gray-400">
          {item.brand ? `${item.brand} · ` : ''}${item.purchasePrice} · 穿 {item.wearCount} 次
        </Text>
      </View>
      <View className={`px-2.5 py-1 rounded-full ${
        highlight === 'good'
          ? 'bg-green-50 dark:bg-green-950'
          : 'bg-red-50 dark:bg-red-950'
      }`}>
        <Text className={`text-sm font-semibold ${
          highlight === 'good'
            ? 'text-green-700 dark:text-green-400'
            : 'text-red-600 dark:text-red-400'
        }`}>
          ${item.costPerWear}/次
        </Text>
      </View>
    </View>
  );
}
