import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/lib/theme';
import { localDateString } from '@/lib/queries';
import { MONTH_ZH, pad, pct, useYearlyRecap } from '@/lib/journal';
import { Screen, TopBar, SectionHeader, Txt, Serif, Numeral, StatRow } from '@/components/ui';
import { Delta, TopLists } from '@/components/journal/Recap';

const CHART_H = 120;

/** 年度回顧：每月紀錄天數長條、Top 單品與組合、與上一年比較 */
export default function YearRecapScreen() {
  const c = useColors();
  const params = useLocalSearchParams<{ year?: string }>();
  const nowYear = Number(localDateString().slice(0, 4));
  const [year, setYear] = useState(() => (params.year && /^\d{4}$/.test(params.year) ? Number(params.year) : nowYear));
  const { data, isLoading } = useYearlyRecap(year);
  const maxDays = Math.max(1, ...(data?.monthlyDaysLogged ?? [0]));
  const empty = !!data && data.daysLogged === 0;
  const todayMonth = Number(localDateString().slice(5, 7));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="YEAR IN REVIEW" title={`${year} 年度回顧`} backLabel="回到日記" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/journal'))} />
      <Screen>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.ink }}>
          <Pressable onPress={() => setYear(year - 1)} accessibilityRole="button" accessibilityLabel="上一年" style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={18} color={c.ink} />
          </Pressable>
          <Numeral size={28}>{String(year)}</Numeral>
          <Pressable onPress={() => setYear(year + 1)} disabled={year >= nowYear} accessibilityRole="button" accessibilityLabel="下一年" style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end', opacity: year >= nowYear ? 0.3 : 1 }}>
            <Ionicons name="chevron-forward" size={18} color={c.ink} />
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 24 }} /> : null}

        {data ? (
          empty ? (
            <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
              <Ionicons name="book-outline" size={30} color={c.mute} />
              <Serif size={17}>{`${year} 年還沒有任何紀錄`}</Serif>
              <Txt size={13} tone="mute" style={{ textAlign: 'center' }}>每天拍一張穿搭照或記下穿了什麼，年底就能在這裡回顧一整年。</Txt>
            </View>
          ) : (
            <>
              <View style={{ marginTop: 14 }}>
                <StatRow
                  stats={[
                    { value: data.daysLogged, label: '天有紀錄' },
                    { value: pct(data.usageRate), label: '衣櫃使用率' },
                    { value: data.itemsWorn, label: '件穿過的衣物' },
                  ]}
                />
              </View>
              <View style={{ paddingVertical: 10, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <Txt size={12} tone="mute" style={{ width: 52 }}>與去年比</Txt>
                <Delta value={data.daysLogged - data.previous.daysLogged} unit=" 天" label="紀錄" />
                <Delta value={Math.round(data.usageRateDelta * 100)} unit="%" label="使用率" />
              </View>

              <SectionHeader title="每月紀錄天數" style={{ marginTop: 20 }} />
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 44, paddingTop: 12, gap: 6 }} accessibilityLabel="每月紀錄天數長條圖">
                {data.monthlyDaysLogged.map((n, i) => {
                  const key = `${year}-${pad(i + 1)}`;
                  const isNow = year === nowYear && i + 1 === todayMonth;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => router.push({ pathname: '/(tabs)/journal', params: { month: key } })}
                      accessibilityRole="button"
                      accessibilityLabel={`${MONTH_ZH[i]}，${n} 天有紀錄`}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                    >
                      <Numeral size={14} tone={n > 0 ? 'ink' : 'mute'}>{String(n)}</Numeral>
                      <View style={{ width: '100%', height: n > 0 ? Math.max(3, (n / maxDays) * CHART_H) : 1, marginTop: 2, backgroundColor: n > 0 ? (isNow ? c.accent : c.ink) : c.line }} />
                      <Txt size={11} tone="mute" style={{ lineHeight: 18, marginTop: 4 }}>{String(i + 1)}</Txt>
                    </Pressable>
                  );
                })}
              </View>
              <Txt size={11} tone="mute" style={{ marginTop: 2 }}>橫軸為月份，點長條可回到那個月的日記。</Txt>

              <SectionHeader title="今年的衣櫃主角" style={{ marginTop: 20 }} />
              <TopLists recap={data} itemsTitle="最常穿單品" pairsTitle="最常一起穿的組合" />
            </>
          )
        ) : null}
      </Screen>
    </View>
  );
}
