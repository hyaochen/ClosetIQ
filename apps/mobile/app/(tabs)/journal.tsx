import { useState, useMemo, useEffect } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useColors } from '@/lib/theme';
import { imageUrl, tileUrl, useImagesVersion } from '@/lib/images';
import { localDateString } from '@/lib/queries';
import {
  MONTH_EN, MONTH_ZH, WEEKDAYS_MON, pad, shiftMonth, useJournalMonth, useMonthlyRecap, uploadOotdForDate, pct,
} from '@/lib/journal';
import { showAlert } from '@/lib/alert';
import { Screen, PageHeader, SectionHeader, Hairline, Txt, Numeral, StatRow } from '@/components/ui';
import { usePhotoSource } from '@/components/journal/PhotoSource';
import { Delta, TopLists } from '@/components/journal/Recap';
import type { JournalDay } from '@closet/shared';

export default function JournalScreen() {
  useImagesVersion();
  const c = useColors();
  const params = useLocalSearchParams<{ month?: string }>();
  const todayKey = useMemo(() => localDateString(), []);
  const thisMonth = todayKey.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [uploading, setUploading] = useState(false);
  const photoSource = usePhotoSource();

  // 從年度回顧點某個月回來
  useEffect(() => {
    if (params.month && /^\d{4}-\d{2}$/.test(params.month)) setMonth(params.month);
  }, [params.month]);

  const [year, mon] = month.split('-').map(Number);
  const monthIndex = mon - 1;
  const lastDay = new Date(year, mon, 0).getDate();
  const { data, isLoading } = useJournalMonth(month);
  const { data: recap, isLoading: recapLoading } = useMonthlyRecap(month);

  const byDate = useMemo(() => {
    const m: Record<string, JournalDay> = {};
    for (const d of data?.days ?? []) m[d.date] = d;
    return m;
  }, [data]);

  // 月曆：週一開頭
  const cells = useMemo(() => {
    const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const arr: (number | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= lastDay; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [year, monthIndex, lastDay]);

  const isThisMonth = month === thisMonth;
  const emptyMonth = !isLoading && (data?.days.length ?? 0) === 0;

  const shoot = async () => {
    const photo = await photoSource.ask();
    if (!photo) return;
    setUploading(true);
    try {
      const { log } = await uploadOotdForDate(todayKey, photo);
      // 直接進入當日詳情並開啟補選衣物
      router.push({ pathname: '/journal/[date]', params: { date: log.date, pick: log.items.length === 0 ? '1' : '0' } });
    } catch (e: any) {
      showAlert('上傳失敗', e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <PageHeader
        title="日記"
        right={
          <Pressable
            onPress={shoot}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="拍今日穿搭"
            style={({ pressed }) => ({ height: 44, paddingHorizontal: 14, backgroundColor: c.ink, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: uploading ? 0.5 : pressed ? 0.75 : 1 })}
          >
            {uploading ? <ActivityIndicator size="small" color={c.onInk} /> : <Ionicons name="camera-outline" size={16} color={c.onInk} />}
            <Txt size={13} style={{ color: c.onInk }}>拍今日穿搭</Txt>
          </Pressable>
        }
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <Pressable onPress={() => setMonth(shiftMonth(month, -1))} accessibilityRole="button" accessibilityLabel="上個月" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Numeral size={24}>{MONTH_EN[monthIndex]}</Numeral>
          <Txt size={13} tone="mute">{`${year} · ${MONTH_ZH[monthIndex]}`}</Txt>
        </View>
        <Pressable onPress={() => setMonth(shiftMonth(month, 1))} accessibilityRole="button" accessibilityLabel="下個月" style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Ionicons name="chevron-forward" size={18} color={c.ink} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
        {WEEKDAYS_MON.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{w}</Txt>
          </View>
        ))}
      </View>

      {isLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 20 }} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginHorizontal: -2 }}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 64, padding: 2 }} />;
          const key = `${month}-${pad(d)}`;
          const day = byDate[key];
          const has = !!day;
          const isToday = key === todayKey;
          const future = key > todayKey;
          const photo = day?.photoThumbnailPath;
          const thumbs: (string | null)[] = has && !photo
            ? day.logs.flatMap((l) => l.items.map((it) => it.thumbnailPath)).slice(0, 4)
            : [];
          const count = has ? day.logs.reduce((a, l) => a + l.items.length, 0) : 0;
          return (
            <View key={key} style={{ width: `${100 / 7}%`, height: 64, padding: 2 }}>
              <Pressable
                onPress={() => router.push({ pathname: '/journal/[date]', params: { date: key } })}
                disabled={future}
                accessibilityRole="button"
                accessibilityLabel={`${mon} 月 ${d} 日${has ? (photo ? '，有穿搭照片' : '') + `，穿了 ${count} 件` : '，沒有紀錄'}`}
                style={{
                  flex: 1,
                  backgroundColor: has ? c.tile : 'transparent',
                  borderWidth: isToday ? 2 : 1,
                  borderColor: isToday ? c.accent : future ? c.card : c.line,
                  overflow: 'hidden',
                }}
              >
                {photo ? (
                  <Image source={{ uri: imageUrl(photo) }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} contentFit="cover" accessibilityIgnoresInvertColors />
                ) : has ? (
                  <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', paddingTop: 14, paddingHorizontal: 1 }}>
                    {thumbs.length === 0 ? (
                      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="ellipse" size={6} color={c.accent} />
                      </View>
                    ) : null}
                    {thumbs.map((t, ti) => (
                      <View key={ti} style={{ width: thumbs.length === 1 ? '100%' : '50%', height: thumbs.length <= 2 ? '100%' : '50%', padding: 1 }}>
                        {t ? <Image source={{ uri: tileUrl(t) }} style={{ flex: 1 }} contentFit="contain" /> : <View style={{ flex: 1, backgroundColor: c.line }} />}
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ position: 'absolute', left: 0, top: 0, paddingHorizontal: 3, backgroundColor: photo ? c.paper : 'transparent', opacity: photo ? 0.92 : 1 }}>
                  <Numeral size={13} tone={isToday ? 'accent' : future ? 'mute' : 'ink'} style={{ opacity: future ? 0.7 : 1 }}>{String(d)}</Numeral>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>

      {emptyMonth ? (
        <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Txt tone="mute">{isThisMonth ? '這個月還沒有穿搭紀錄。拍下今天的穿搭，月曆就會開始長出照片。' : `${MONTH_ZH[monthIndex]}沒有任何穿搭紀錄。點月曆上的日期，可以補記那天穿了什麼。`}</Txt>
        </View>
      ) : null}

      {/* 月回顧 */}
      <View style={{ marginTop: 18 }}>
        <SectionHeader
          title={`${MONTH_ZH[monthIndex]}回顧`}
          link={recap ? (isThisMonth ? `至 ${recap.throughDate.slice(5, 7)}.${recap.throughDate.slice(8, 10)}` : undefined) : undefined}
        />
        {recapLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 16 }} /> : null}
        {recap ? (
          recap.daysLogged === 0 ? (
            <View style={{ paddingVertical: 14 }}>
              <Txt tone="mute">{`${MONTH_ZH[monthIndex]}還沒有紀錄，所以沒有回顧可看。`}</Txt>
              {recap.previous.daysLogged > 0 ? (
                <Txt size={13} tone="mute" style={{ marginTop: 4 }}>{`上個月有 ${recap.previous.daysLogged} 天紀錄，衣櫃使用率 ${pct(recap.previous.usageRate)}。`}</Txt>
              ) : null}
            </View>
          ) : (
            <>
              <StatRow
                stats={[
                  { value: recap.daysLogged, label: '天有紀錄' },
                  { value: pct(recap.usageRate), label: '衣櫃使用率' },
                  { value: recap.topItems[0] ? `x${recap.topItems[0].count}` : '0', label: recap.topItems[0]?.name ?? '本月最常穿' },
                ]}
              />
              <View style={{ paddingVertical: 10, flexDirection: 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <Txt size={12} tone="mute" style={{ width: 52 }}>與上月比</Txt>
                <Delta value={recap.daysLogged - recap.previous.daysLogged} unit=" 天" label="紀錄" />
                <Delta value={Math.round(recap.usageRateDelta * 100)} unit="%" label="使用率" />
              </View>
              <View style={{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <Txt size={13} tone="mute">本月穿著紀錄</Txt>
                <Txt size={13}>{`${recap.wearLogCount} 筆 · 穿過 ${recap.itemsWorn} / ${recap.wardrobeSize} 件`}</Txt>
              </View>
              <TopLists recap={recap} />
            </>
          )
        ) : null}
        <Pressable
          onPress={() => router.push({ pathname: '/journal/year', params: { year: String(year) } })}
          accessibilityRole="button"
          accessibilityLabel={`看 ${year} 年度回顧`}
          style={({ pressed }) => ({ marginTop: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: c.ink, borderBottomWidth: 1, borderBottomColor: c.ink, opacity: pressed ? 0.65 : 1 })}
        >
          <Txt size={14}>{`${year} 年度回顧`}</Txt>
          <Ionicons name="chevron-forward" size={14} color={c.ink} />
        </Pressable>
      </View>
    </Screen>
  );
}
