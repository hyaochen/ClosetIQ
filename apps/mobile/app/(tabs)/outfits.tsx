import { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';
import { Screen, PageHeader, Txt } from '@/components/ui';
import { LooksTab } from '@/components/plan/LooksTab';
import { PlanTab } from '@/components/plan/PlanTab';
import { PackTab } from '@/components/plan/PackTab';

type Seg = 'look' | 'plan' | 'pack';
const SEGS: { key: Seg; label: string }[] = [
  { key: 'look', label: '作品集' },
  { key: 'plan', label: '計畫' },
  { key: 'pack', label: '打包' },
];

/** 穿搭：作品集 / 計畫 / 打包（?seg=plan 可直接開到某一段） */
export default function OutfitsScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [seg, setSeg] = useState<Seg>('look');

  useEffect(() => {
    if (params.seg === 'plan' || params.seg === 'pack' || params.seg === 'look') setSeg(params.seg);
  }, [params.seg]);

  return (
    <Screen maxWidth={560}>
      <PageHeader
        title="穿搭"
        right={
          <Pressable
            onPress={() => router.push('/outfit/builder')}
            accessibilityRole="button"
            accessibilityLabel="新穿搭"
            style={({ pressed }) => ({
              height: 40,
              paddingHorizontal: 14,
              borderWidth: 1,
              borderColor: c.ink,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add" size={16} color={c.ink} />
            <Txt size={13}>新穿搭</Txt>
          </Pressable>
        }
      />

      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, marginTop: 8, borderBottomWidth: 1, borderBottomColor: c.ink }}>
        {SEGS.map((s) => {
          const on = s.key === seg;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSeg(s.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              hitSlop={{ top: 4, bottom: 4 }}
              style={{ paddingVertical: 10, marginBottom: -1, borderBottomWidth: 2, borderBottomColor: on ? c.ink : 'transparent' }}
            >
              <Txt size={14} bold={on} tone={on ? 'ink' : 'mute'}>{s.label}</Txt>
            </Pressable>
          );
        })}
      </View>

      {seg === 'look' ? <LooksTab maxWidth={560} /> : null}
      {seg === 'plan' ? <PlanTab /> : null}
      {seg === 'pack' ? <PackTab /> : null}
    </Screen>
  );
}
