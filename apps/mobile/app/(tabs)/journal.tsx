import { useState, useMemo } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel, WeatherConditionLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { localDateString, logDateKey } from '@/lib/queries';
import { Screen, PageHeader, SectionHeader, Hairline, Txt, Serif, Numeral, StatRow } from '@/components/ui';
import { router } from 'expo-router';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ZH = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function JournalScreen() {
  const c = useColors();
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateString(today);
  const [cur, setCur] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);

  const from = `${cur.year}-${pad(cur.month + 1)}-01`;
  const lastDay = new Date(cur.year, cur.month + 1, 0).getDate();
  const to = `${cur.year}-${pad(cur.month + 1)}-${pad(lastDay)}`;

  const { data, isLoading } = useQuery({
    queryKey: ['wear-logs', 'month', from, to],
    queryFn: () => api(`/api/wear-logs?from=${from}&to=${to}&limit=100`),
  });
  const { data: overview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => api('/api/stats/overview'),
  });

  const logs: any[] = data?.logs ?? [];
  const byDate = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const l of logs) (m[logDateKey(l.date)] ||= []).push(l);
    return m;
  }, [logs]);

  const recap = useMemo(() => {
    const worn = new Map<string, { name: string; n: number }>();
    for (const l of logs) {
      for (const wi of l.items ?? []) {
        const id = wi.clothingItem?.id;
        if (!id) continue;
        const e = worn.get(id) ?? { name: wi.clothingItem.name, n: 0 };
        e.n += 1;
        worn.set(id, e);
      }
    }
    let top: { name: string; n: number } | null = null;
    worn.forEach((v) => { if (!top || v.n > top.n) top = v; });
    const active = overview?.activeItems ?? 0;
    return {
      days: Object.keys(byDate).length,
      usage: active > 0 ? Math.round((worn.size / active) * 100) : 0,
      top: top as { name: string; n: number } | null,
    };
  }, [logs, byDate, overview]);

  // 月曆：週一開頭
  const cells = useMemo(() => {
    const lead = (new Date(cur.year, cur.month, 1).getDay() + 6) % 7;
    const arr: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= lastDay; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cur, lastDay]);

  const shift = (delta: number) => {
    setCur((p) => {
      const d = new Date(p.year, p.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    setSelected(null);
  };

  const keyOf = (d: number) => `${cur.year}-${pad(cur.month + 1)}-${pad(d)}`;
  const selLogs = selected ? byDate[selected] ?? [] : [];
  const isThisMonth = cur.year === today.getFullYear() && cur.month === today.getMonth();

  return (
    <Screen>
      <PageHeader title="日記" />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="上個月" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Numeral size={24}>{MONTH_EN[cur.month]}</Numeral>
          <Txt size={13} tone="mute">{`${cur.year} · ${MONTH_ZH[cur.month]}`}</Txt>
        </View>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="下個月" style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Ionicons name="chevron-forward" size={18} color={c.ink} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
        {WEEKDAYS.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{w}</Txt>
          </View>
        ))}
      </View>

      {isLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 20 }} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginHorizontal: -2 }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 62, padding: 2 }} />;
          const key = keyOf(d);
          const dayLogs = byDate[key] ?? [];
          const has = dayLogs.length > 0;
          const isToday = key === todayKey;
          const isSel = key === selected;
          const future = key > todayKey;
          const thumbs: (string | undefined)[] = dayLogs
            .flatMap((l) => (l.items ?? []).map((wi: any) => wi.clothingItem?.images?.[0]?.thumbnailPath))
            .slice(0, 4);
          return (
            <View key={key} style={{ width: `${100 / 7}%`, height: 62, padding: 2 }}>
              <Pressable
                onPress={() => setSelected(isSel ? null : key)}
                accessibilityRole="button"
                accessibilityLabel={`${cur.month + 1} 月 ${d} 日${has ? `，穿了 ${dayLogs.reduce((a, l) => a + (l.items?.length ?? 0), 0)} 件` : '，沒有紀錄'}`}
                accessibilityState={{ selected: isSel }}
                style={{
                  flex: 1,
                  backgroundColor: has ? c.card : 'transparent',
                  borderWidth: isToday || isSel ? 2 : 1,
                  borderColor: isSel ? c.ink : isToday ? c.accent : future ? c.card : c.line,
                  overflow: 'hidden',
                }}
              >
                {has ? (
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingTop: 13, paddingHorizontal: 1 }}>
                    {thumbs.map((t, ti) => (
                      <View key={ti} style={{ width: thumbs.length === 1 ? '100%' : '50%', height: thumbs.length <= 2 ? '100%' : '50%', padding: 1 }}>
                        {t ? <Image source={{ uri: imageUrl(t) }} style={{ flex: 1 }} contentFit="contain" /> : <View style={{ flex: 1, backgroundColor: c.line }} />}
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ position: 'absolute', left: 3, top: 0 }}>
                  <Numeral size={13} tone={isToday ? 'accent' : future ? 'mute' : 'ink'}>{String(d)}</Numeral>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* 選中日期 */}
      {selected ? (
        <View style={{ marginTop: 16 }}>
          <SectionHeader title={`${Number(selected.slice(5, 7))} 月 ${Number(selected.slice(8, 10))} 日的穿搭`} />
          {selLogs.length === 0 ? (
            <Txt tone="mute" style={{ paddingVertical: 14 }}>這天沒有穿著紀錄</Txt>
          ) : (
            selLogs.map((log) => (
              <View key={log.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 8 }}>
                <Txt size={12} tone="mute">
                  {[
                    log.occasion ? OccasionLabel[log.occasion as keyof typeof OccasionLabel] : null,
                    log.weatherTemp != null ? `${log.weatherTemp}°` : null,
                    log.weatherCondition ? WeatherConditionLabel[log.weatherCondition as keyof typeof WeatherConditionLabel] : null,
                  ].filter(Boolean).join(' · ') || '穿搭紀錄'}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {(log.items ?? []).map((wi: any) => {
                    const it = wi.clothingItem;
                    const t = it?.images?.[0]?.thumbnailPath;
                    return (
                      <Pressable
                        key={wi.id}
                        onPress={() => it?.id && router.push(`/item/${it.id}`)}
                        accessibilityRole="button"
                        accessibilityLabel={it?.name}
                        style={{ width: 72, gap: 4 }}
                      >
                        <View style={{ height: 72, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                          {t ? <Image source={{ uri: imageUrl(t) }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : <Ionicons name="shirt-outline" size={22} color={c.mute} />}
                        </View>
                        <Txt size={11} numberOfLines={1} style={{ lineHeight: 15 }}>{it?.name}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
                {log.notes ? <Txt size={13} tone="mute">{log.notes}</Txt> : null}
              </View>
            ))
          )}
        </View>
      ) : null}

      {/* 月回顧 */}
      <View style={{ marginTop: 18 }}>
        <SectionHeader title={`${MONTH_ZH[cur.month]}回顧`} link={isThisMonth ? `至 ${pad(today.getMonth() + 1)}.${pad(today.getDate())}` : undefined} />
        <StatRow
          stats={[
            { value: recap.days, label: '天有紀錄' },
            { value: `${recap.usage}%`, label: '衣櫃使用率' },
            { value: recap.top ? `x${recap.top.n}` : '0', label: recap.top ? recap.top.name : '本月最常穿' },
          ]}
        />
        <Hairline />
        <View style={{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Txt size={13} tone="mute">本月穿著紀錄</Txt>
          <Txt size={13}>{`${logs.length} 筆`}</Txt>
        </View>
      </View>
    </Screen>
  );
}
