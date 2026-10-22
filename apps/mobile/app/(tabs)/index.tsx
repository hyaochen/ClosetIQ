import { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel, WeatherConditionLabel, SeasonLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { useLaundry, useMe, logWear, localDateString } from '@/lib/queries';
import { usePlanWeek, parseYmd } from '@/lib/plan-queries';
import { showAlert } from '@/lib/alert';
import {
  Screen, Txt, Serif, Numeral, Eyebrow, Hairline, SectionHeader, Button, Chip, GarmentTile,
} from '@/components/ui';
import type { TileLike } from '@/lib/images';

const WEEK_EN = ['Sun.', 'Mon.', 'Tue.', 'Wed.', 'Thu.', 'Fri.', 'Sat.'];

type SuggestionItem = TileLike & { id: string; name: string; category: string; thumbnail: string | null };
type Suggestion = { items: SuggestionItem[]; score: number };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function TodayScreen() {
  const c = useColors();
  const now = useMemo(() => new Date(), []);
  const todayKey = localDateString(now);
  const { data: me } = useMe();
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherAsked, setWeatherAsked] = useState(false);
  const [occasion, setOccasion] = useState<string | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [wornSig, setWornSig] = useState<string | null>(null);

  // 已授權才自動取得位置；未授權時由使用者按連結再要求，不在載入時跳權限視窗
  useEffect(() => {
    (async () => {
      try {
        const p = await Location.getForegroundPermissionsAsync();
        if (p.granted) {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        }
      } catch {
        /* 沒有定位就不顯示天氣 */
      }
    })();
  }, []);

  const askWeather = async () => {
    setWeatherAsked(true);
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.granted) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      }
    } catch {
      /* ignore */
    }
  };

  // 座標優先序：目前定位 -> 常用城市 -> 台北。Open-Meteo 沒有反向地名，所以只有用常用城市時才顯示城市名
  const home = me && me.homeLat !== null && me.homeLon !== null ? { lat: me.homeLat, lon: me.homeLon } : null;
  const place = coords ?? home ?? { lat: 25.03, lon: 121.56 };
  const cityName = !coords && home ? me?.homeCity ?? null : null;

  const { data, isLoading } = useQuery<{ suggestions: Suggestion[]; weather: { temp: number; condition: string } | null }>({
    queryKey: ['suggestions', place.lat, place.lon, occasion ?? null],
    queryFn: () => {
      const params = new URLSearchParams();
      if (occasion) params.set('occasion', occasion);
      params.set('lat', String(place.lat));
      params.set('lon', String(place.lon));
      return api(`/api/suggestions/outfit?${params.toString()}`);
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!me, // 等常用城市載入，避免先用台北查一輪
  });

  const suggestions = data?.suggestions ?? [];
  const weather = data?.weather ?? null;
  const total = suggestions.length;
  const current = suggestions[total ? index % total : 0];
  const sig = current ? current.items.map((i) => i.id).sort().join(',') : null;
  const worn = !!sig && wornSig === sig;

  // 本週 7 格：今天起 7 天的預報與計畫
  const { data: weekData } = usePlanWeek(place);
  const week = weekData?.days ?? [];

  const { data: laundry } = useLaundry();
  const dirty = (laundry?.items ?? []).filter((i) => i.laundryStatus === 'DIRTY').length;
  const cleaning = (laundry?.items ?? []).filter((i) => i.laundryStatus === 'CLEANING').length;

  const wearThis = async () => {
    if (!current || saving) return;
    setSaving(true);
    try {
      await logWear({
        itemIds: current.items.map((i) => i.id),
        occasion,
        weatherTemp: weather?.temp,
      });
      setWornSig(sig);
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = `${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${WEEK_EN[now.getDay()]}`;
  const weatherText = weather
    ? `${cityName ? `${cityName} ` : ''}${weather.temp}° ${WeatherConditionLabel[weather.condition as keyof typeof WeatherConditionLabel] ?? ''}`
    : null;
  const names = current ? current.items.map((i) => i.name).join(' · ') : '';
  const advice =
    weather && weather.temp < 15
      ? `氣溫 ${weather.temp}°，已幫你搭上外套`
      : weather && weather.temp >= 28
        ? `氣溫 ${weather.temp}°，挑了透氣的季節衣物`
        : null;

  // 拼貼：依件數決定欄列
  const n = current?.items.length ?? 0;
  const cols = n <= 2 ? Math.max(n, 1) : n <= 4 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(n / cols));

  return (
    <Screen>
      {/* 刊頭 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <Numeral size={20}>{dateLabel}</Numeral>
        {weatherText ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cloud-outline" size={16} color={c.mute} />
            <Txt size={13} tone="mute">{weatherText}</Txt>
          </View>
        ) : (
          <Pressable onPress={askWeather} accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 8 }} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="cloud-outline" size={16} color={c.mute} />
            <Txt size={13} tone="mute">{coords || weatherAsked ? '暫無天氣資料' : '開啟定位看天氣'}</Txt>
          </Pressable>
        )}
      </View>

      {/* 大標 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 }}>
        <View>
          <Eyebrow>TODAY'S EDIT</Eyebrow>
          <Serif size={40} letterSpacing={1.6} style={{ marginTop: 4, lineHeight: 44 }} accessibilityRole="header">今日穿搭</Serif>
        </View>
        {total > 0 ? (
          <Numeral size={16} tone="mute" style={{ paddingBottom: 6 }}>{`No. ${pad((index % total) + 1)} / ${pad(total)}`}</Numeral>
        ) : null}
      </View>

      {/* 場合 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 12, alignItems: 'center' }}>
        <Chip label="不限場合" selected={!occasion} onPress={() => { setOccasion(undefined); setIndex(0); }} />
        {Object.entries(OccasionLabel).map(([k, label]) => (
          <Chip key={k} label={label} selected={occasion === k} onPress={() => { setOccasion(occasion === k ? undefined : k); setIndex(0); }} />
        ))}
      </ScrollView>

      {/* 推薦大圖 */}
      {isLoading || !me ? (
        <View style={{ height: 262, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.ink} />
        </View>
      ) : !current ? (
        <View style={{ height: 262, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
          <Txt tone="mute" style={{ textAlign: 'center' }}>目前沒有乾淨又合季節的衣物可以搭配</Txt>
          <Button label="看洗衣籃" variant="outline" onPress={() => router.push('/laundry')} />
        </View>
      ) : (
        <View>
          <View style={{ height: 262, backgroundColor: c.tile, flexDirection: 'row', flexWrap: 'wrap', padding: 8 }}>
            {current.items.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => router.push(`/item/${it.id}`)}
                accessibilityRole="button"
                accessibilityLabel={it.name}
                style={{ width: `${100 / cols}%`, height: `${100 / rows}%`, padding: 4 }}
              >
                <GarmentTile path={it.thumbnail} tile={it} fill />
              </Pressable>
            ))}
            <View style={{ position: 'absolute', left: 12, bottom: 10, backgroundColor: c.paper, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Txt size={11} letterSpacing={1.8} style={{ lineHeight: 16 }}>
                {occasion ? OccasionLabel[occasion as keyof typeof OccasionLabel] : '日常'}
                {me ? `・${SeasonLabel[me.effectiveSeason as keyof typeof SeasonLabel]}季` : ''}
              </Txt>
            </View>
          </View>

          <Txt size={13} style={{ marginTop: 12 }}>{names}</Txt>
          {advice ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <View style={{ width: 6, height: 6, backgroundColor: c.accent }} />
              <Txt size={13} tone="mute">{advice}</Txt>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {worn ? (
              <View
                accessibilityLiveRegion="polite"
                style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: c.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Ionicons name="checkmark" size={18} color={c.ink} />
                <Txt size={15} letterSpacing={1.2} style={{ fontWeight: '500' }}>已記錄今天穿搭</Txt>
              </View>
            ) : (
              <Button label="就穿這套" onPress={wearThis} loading={saving} style={{ flex: 1 }} />
            )}
            <Button
              label="換一套"
              variant="outline"
              icon="swap-horizontal-outline"
              onPress={() => setIndex((i) => (i + 1) % Math.max(total, 1))}
              disabled={total < 2}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

      {/* 本週 */}
      <SectionHeader
        title="本週穿搭"
        link="安排計畫"
        onLink={() => router.push({ pathname: '/(tabs)/outfits', params: { seg: 'plan' } })}
        style={{ marginTop: 22 }}
      />
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
        {week.map((d) => {
          const isToday = d.date === todayKey;
          const fg = isToday ? c.onInk : c.ink;
          const { m, d: dayNum } = parseYmd(d.date);
          const temp = d.forecast ? `${Math.round((d.forecast.min + d.forecast.max) / 2)}°` : '--';
          const status = d.hasPlan ? '，已安排穿搭' : '';
          return (
            <Pressable
              key={d.date}
              onPress={() => router.push({ pathname: '/(tabs)/outfits', params: { seg: 'plan' } })}
              accessibilityRole="button"
              accessibilityLabel={`${m} 月 ${dayNum} 日 星期${d.weekday}${status}${d.hasWearLog ? '，已有穿著紀錄' : ''}`}
              style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, backgroundColor: isToday ? c.ink : 'transparent' }}
            >
              <Txt size={11} style={{ color: fg, lineHeight: 16 }}>{d.weekday}</Txt>
              <Numeral size={20} style={{ color: fg }}>{String(dayNum)}</Numeral>
              <View
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: d.hasPlan ? (isToday ? c.onInk : c.accent) : 'transparent',
                  borderWidth: !d.hasPlan && d.hasWearLog ? 1 : 0,
                  borderColor: fg,
                }}
              />
              <Txt size={10} style={{ color: isToday ? c.onInk : c.mute, lineHeight: 14 }}>{temp}</Txt>
            </Pressable>
          );
        })}
      </View>

      {/* 待洗提醒 */}
      <Pressable
        onPress={() => router.push('/laundry')}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: 14,
          minHeight: 48,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: c.line,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        {dirty + cleaning > 0 ? (
          <Txt size={13}>
            <Txt size={13} tone="accent" bold>{`待洗 ${dirty} 件`}</Txt>
            <Txt size={13} tone="mute">{cleaning > 0 ? ` · 送洗中 ${cleaning} 件` : ' · 點開洗衣籃'}</Txt>
          </Txt>
        ) : (
          <Txt size={13} tone="mute">洗衣籃是空的，衣服都是乾淨的</Txt>
        )}
        <Ionicons name="chevron-forward" size={14} color={c.ink} />
      </Pressable>
    </Screen>
  );
}
