import { useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel, ConditionLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { invalidateWardrobe } from '@/lib/queries';
import { TopBar, Txt, Serif, Numeral, Button, GarmentTile, StatRow } from '@/components/ui';

export default function DeclutterScreen() {
  const c = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['declutter-suggestions'],
    queryFn: () => api('/api/stats/declutter-suggestions'),
  });

  const suggestions: any[] = data?.suggestions ?? [];
  const current = suggestions[currentIndex];

  const handleAction = async (reason: string | null) => {
    if (!current) return;
    if (reason) {
      try {
        await api(`/api/items/${current.id}?reason=${reason}`, { method: 'DELETE' });
        invalidateWardrobe();
        queryClient.invalidateQueries({ queryKey: ['stats'] });
      } catch (err: any) {
        showAlert('操作失敗', err.message);
        return;
      }
    }
    if (currentIndex < suggestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      showAlert('完成', '你已經檢視了所有建議的衣物。');
      refetch();
      setCurrentIndex(0);
    }
  };

  const wrap = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="DECLUTTER" title="斷捨離" />
      {body}
    </View>
  );

  if (isLoading) {
    return wrap(<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.ink} /></View>);
  }

  if (suggestions.length === 0) {
    return wrap(
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
        <Ionicons name="checkmark-circle-outline" size={48} color={c.mute} />
        <Serif size={22}>衣櫃狀態良好</Serif>
        <Txt tone="mute">目前沒有建議斷捨離的衣物</Txt>
      </View>
    );
  }

  return wrap(
    <View style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
      {/* 進度 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Numeral size={18}>{`${currentIndex + 1} / ${suggestions.length}`}</Numeral>
        <View style={{ flex: 1, height: 3, backgroundColor: c.card }}>
          <View style={{ height: 3, width: `${((currentIndex + 1) / suggestions.length) * 100}%`, backgroundColor: c.ink }} />
        </View>
      </View>

      {current ? (
        <View style={{ flex: 1, marginTop: 12 }}>
          <GarmentTile path={current.thumbnail} tile={current} fill style={{ minHeight: 220 }} />
          <Serif size={24} style={{ marginTop: 14, lineHeight: 30 }} numberOfLines={2}>{current.name}</Serif>
          <Txt size={12} tone="mute">
            {`${ClothingCategoryLabel[current.category as keyof typeof ClothingCategoryLabel] ?? current.category} · ${ConditionLabel[current.condition as keyof typeof ConditionLabel] ?? ''}`}
          </Txt>
          <View style={{ marginTop: 12 }}>
            <StatRow
              stats={[
                { value: current.wearCount, label: '穿著次數' },
                { value: current.costPerWear !== null ? `$${current.costPerWear}` : '-', label: '每次成本' },
                { value: current.lastWorn ? new Date(current.lastWorn).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : '-', label: '上次穿著' },
              ]}
            />
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 16 }}>
        <Button label="保留" style={{ flex: 1.2 }} onPress={() => handleAction(null)} />
        <Button label="捐贈" variant="outline" style={{ flex: 1 }} onPress={() => handleAction('DONATED')} />
        <Button label="售出" variant="outline" style={{ flex: 1 }} onPress={() => handleAction('SOLD')} />
        <Button label="丟棄" variant="danger" style={{ flex: 1 }} onPress={() => handleAction('DISCARDED')} />
      </View>
    </View>
  );
}
