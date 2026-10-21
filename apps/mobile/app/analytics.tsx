import { View, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { Screen, TopBar, Txt, Serif, Numeral, SectionHeader, StatRow, BarMeter, Hairline } from '@/components/ui';

export default function AnalyticsScreen() {
  const c = useColors();
  const { data, isLoading } = useQuery({
    queryKey: ['stats', 'advanced'],
    queryFn: () => api('/api/stats/advanced'),
  });

  const wrap = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="ANALYTICS" title="統計分析" />
      {body}
    </View>
  );

  if (isLoading) {
    return wrap(<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.ink} /></View>);
  }
  if (!data) {
    return wrap(<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Txt tone="mute">無法載入統計資料</Txt></View>);
  }

  const { brandBreakdown, spending, materialBreakdown, costPerWear } = data;
  const maxMonth = Math.max(1, ...spending.monthlySpending.map((s: any) => s.amount));

  return wrap(
    <Screen>
      <Serif size={26} accessibilityRole="header">花費總覽</Serif>
      <View style={{ marginTop: 12 }}>
        <StatRow
          stats={[
            { value: `$${spending.totalSpent.toLocaleString()}`, label: '總花費' },
            { value: `$${spending.avgMonthlySpending.toLocaleString()}`, label: '月均花費' },
            { value: spending.itemsWithPriceCount > 0 ? `$${Math.round(spending.totalSpent / spending.itemsWithPriceCount).toLocaleString()}` : '-', label: '平均單價' },
          ]}
        />
      </View>
      <Txt size={12} tone="mute" style={{ marginTop: 6 }}>{`有價格記錄 ${spending.itemsWithPriceCount} / ${spending.totalItemCount} 件`}</Txt>

      {spending.categorySpending.length > 0 ? (
        <>
          <SectionHeader title="各分類花費" style={{ marginTop: 22 }} />
          {spending.categorySpending.map((cat: any) => (
            <BarRow
              key={cat.category}
              label={ClothingCategoryLabel[cat.category as keyof typeof ClothingCategoryLabel] || cat.category}
              value={`$${cat.amount.toLocaleString()}`}
              ratio={spending.totalSpent > 0 ? cat.amount / spending.totalSpent : 0}
            />
          ))}
        </>
      ) : null}

      {spending.monthlySpending.length > 0 ? (
        <>
          <SectionHeader title="月度花費" style={{ marginTop: 22 }} />
          {spending.monthlySpending.map((m: any) => (
            <BarRow key={m.month} label={m.month} value={`$${m.amount.toLocaleString()}`} ratio={m.amount / maxMonth} />
          ))}
        </>
      ) : null}

      <SectionHeader title="品牌分布" style={{ marginTop: 22 }} />
      {brandBreakdown.length === 0 ? (
        <Txt tone="mute" style={{ paddingVertical: 12 }}>尚無品牌資料</Txt>
      ) : (
        brandBreakdown.map((b: any) => (
          <View key={b.brand} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Serif size={15} medium numberOfLines={1}>{b.brand}</Serif>
              <Txt size={12} tone="mute">{`${b.count} 件 · 穿 ${b.totalWears} 次${b.totalSpent > 0 ? ` · $${b.totalSpent.toLocaleString()}` : ''}`}</Txt>
            </View>
            {b.avgCostPerWear !== null ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Numeral size={20}>{`$${b.avgCostPerWear}`}</Numeral>
                <Txt size={10} tone="mute" style={{ lineHeight: 14 }}>每次成本</Txt>
              </View>
            ) : (
              <Txt size={12} tone="mute">尚未穿著</Txt>
            )}
          </View>
        ))
      )}

      <SectionHeader title="材質分布" style={{ marginTop: 22 }} />
      {materialBreakdown.length === 0 ? (
        <Txt tone="mute" style={{ paddingVertical: 12 }}>尚無材質資料</Txt>
      ) : (
        materialBreakdown.map((m: any) => (
          <BarRow key={m.material} label={m.material} value={`${m.count} 件`} ratio={m.count / (materialBreakdown[0]?.count || 1)} />
        ))
      )}

      <SectionHeader title="每次穿著成本排行" style={{ marginTop: 22 }} />
      {costPerWear.bestValue.length === 0 && costPerWear.worstValue.length === 0 ? (
        <Txt tone="mute" style={{ paddingVertical: 12 }}>需要有價格及穿著紀錄才能計算</Txt>
      ) : (
        <>
          {costPerWear.bestValue.length > 0 ? (
            <>
              <Txt size={12} tone="mute" letterSpacing={1.3} style={{ marginTop: 12 }}>最划算（每次成本最低）</Txt>
              {costPerWear.bestValue.map((item: any) => <CostRow key={item.id} item={item} />)}
            </>
          ) : null}
          {costPerWear.worstValue.length > 0 ? (
            <>
              <Txt size={12} tone="accent" letterSpacing={1.3} style={{ marginTop: 16 }}>最浪費（每次成本最高）</Txt>
              {costPerWear.worstValue.map((item: any) => <CostRow key={item.id} item={item} bad />)}
            </>
          ) : null}
        </>
      )}
      <Hairline />
    </Screen>
  );
}

function BarRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Txt size={13} numberOfLines={1} style={{ width: 96 }}>{label}</Txt>
      <BarMeter ratio={Math.max(ratio, 0.02)} />
      <Txt size={13} style={{ minWidth: 64, textAlign: 'right' }}>{value}</Txt>
    </View>
  );
}

function CostRow({ item, bad }: { item: any; bad?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50, borderBottomWidth: 1, borderBottomColor: c.line, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Txt size={14} numberOfLines={1}>{item.name}</Txt>
        <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{`${item.brand ? item.brand + ' · ' : ''}$${item.purchasePrice} · 穿 ${item.wearCount} 次`}</Txt>
      </View>
      <Numeral size={20} tone={bad ? 'accent' : 'ink'}>{`$${item.costPerWear}`}</Numeral>
      <Txt size={11} tone="mute">／次</Txt>
    </View>
  );
}
