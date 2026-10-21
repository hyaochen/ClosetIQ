import { useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { tileUrl } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { localDateString } from '@/lib/queries';
import {
  usePlace, usePlanRange, useTrips, autoPlan, wearPlan,
  addDaysYmd, diffDaysYmd, parseYmd, dotMd, FORECAST_HORIZON_DAYS,
  type PlanDay, type TripSummary, type AutoPlanResult,
} from '@/lib/plan-queries';
import { Txt, Numeral, Button, Hairline } from '@/components/ui';
import { CONDITION_SHORT, BoxTag } from './shared';

const TILE = 44;
const MAX_THUMBS = 3;

/** 計畫：從今天起 7 天，可往後翻週 */
export function PlanTab() {
  const c = useColors();
  const today = useMemo(() => localDateString(), []);
  const place = usePlace();
  const [offset, setOffset] = useState(0); // 第幾週（0 = 從今天起）
  const from = addDaysYmd(today, offset * 7);
  const to = addDaysYmd(from, 6);
  const { data, isLoading } = usePlanRange(from, to, place);
  const { data: tripData } = useTrips();
  const [auto, setAuto] = useState<{ loading: boolean; result: AutoPlanResult | null }>({ loading: false, result: null });
  const [wearing, setWearing] = useState<string | null>(null);

  const goWeek = (next: number) => {
    setOffset(Math.max(0, next));
    setAuto({ loading: false, result: null }); // 上一週的排程結果不要帶到別週
  };

  const days = data?.days ?? [];
  const emptyCount = days.filter((d) => !d.plan).length;

  const tripOf = (date: string): TripSummary | undefined =>
    (tripData?.trips ?? []).find((t) => date >= t.startDate && date <= t.endDate);

  const runAuto = async () => {
    setAuto({ loading: true, result: null });
    try {
      const result = await autoPlan(from, to, place);
      setAuto({ loading: false, result });
    } catch (err: any) {
      setAuto({ loading: false, result: null });
      showAlert('自動排程失敗', err.message);
    }
  };

  const wear = async (date: string) => {
    setWearing(date);
    try {
      await wearPlan(date);
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setWearing(null);
    }
  };

  const rangeLabel = `${dotMd(from)} - ${dotMd(to)}`;

  return (
    <View style={{ marginTop: 12 }}>
      {/* 週切換 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => goWeek(offset - 1)}
          disabled={offset === 0}
          accessibilityRole="button"
          accessibilityLabel="上一週"
          style={{ width: 44, height: 44, justifyContent: 'center', opacity: offset === 0 ? 0.3 : 1 }}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Numeral size={22}>{rangeLabel}</Numeral>
          {offset > 0 ? (
            <Pressable onPress={() => goWeek(0)} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Txt size={11} tone="mute" letterSpacing={1}>回到今天</Txt>
            </Pressable>
          ) : (
            <Txt size={11} tone="mute" letterSpacing={1}>THIS WEEK</Txt>
          )}
        </View>
        <Pressable
          onPress={() => goWeek(offset + 1)}
          accessibilityRole="button"
          accessibilityLabel="下一週"
          style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }}
        >
          <Ionicons name="chevron-forward" size={20} color={c.ink} />
        </Pressable>
      </View>

      <Hairline tone="ink" style={{ marginTop: 4 }} />

      {isLoading ? (
        <ActivityIndicator color={c.ink} style={{ marginTop: 40 }} />
      ) : (
        <View>
          {days.map((d) => (
            <DayRow
              key={d.date}
              day={d}
              today={today}
              trip={tripOf(d.date)}
              wearing={wearing === d.date}
              onWear={() => wear(d.date)}
            />
          ))}
        </View>
      )}

      {/* 自動排 */}
      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          label={offset === 0 ? '自動排滿這週' : '自動排滿這一週'}
          variant="outline"
          icon="sparkles-outline"
          loading={auto.loading}
          disabled={emptyCount === 0 && !auto.loading}
          onPress={runAuto}
        />
        {emptyCount === 0 && !auto.result ? (
          <Txt size={12} tone="mute">這一週每天都已安排。</Txt>
        ) : (
          <Txt size={12} tone="mute">只補空白的日子，已安排的不會動；一週內不會重複同一件上衣。</Txt>
        )}
        {auto.result ? <AutoResult result={auto.result} /> : null}
      </View>
    </View>
  );
}

function AutoResult({ result }: { result: AutoPlanResult }) {
  const c = useColors();
  // 「已有計畫，保留不動」不算失敗，不列出
  const problems = result.skipped.filter((s) => !s.reason.includes('保留不動'));
  return (
    <View accessibilityLiveRegion="polite" style={{ borderWidth: 1, borderColor: c.line, padding: 12, gap: 4 }}>
      <Txt size={13} bold>{`已補上 ${result.created.length} 天`}</Txt>
      {problems.map((p) => (
        <Txt key={p.date} size={12} tone="accent">{`${dotMd(p.date)}　${p.reason}`}</Txt>
      ))}
    </View>
  );
}

function forecastText(d: PlanDay, today: string): { top: string; bottom: string } {
  if (d.forecast) {
    const avg = Math.round((d.forecast.min + d.forecast.max) / 2);
    const rain = d.forecast.rainChance >= 50 ? `${d.forecast.rainChance}%` : '';
    return { top: `${avg}°`, bottom: `${CONDITION_SHORT[d.forecast.condition] ?? ''}${rain ? ' ' + rain : ''}` };
  }
  return diffDaysYmd(today, d.date) >= FORECAST_HORIZON_DAYS ? { top: '無預報', bottom: '' } : { top: '--', bottom: '' };
}

function DayRow({
  day, today, trip, wearing, onWear,
}: {
  day: PlanDay;
  today: string;
  trip?: TripSummary;
  wearing: boolean;
  onWear: () => void;
}) {
  const c = useColors();
  const isToday = day.date === today;
  const { d } = parseYmd(day.date);
  const f = forecastText(day, today);
  const items = day.plan?.items ?? [];
  const shown = items.slice(0, MAX_THUMBS);
  const more = items.length - shown.length;
  const canWear = !!day.plan && day.date <= today && !day.hasWearLog;

  return (
    <Pressable
      onPress={() => router.push(`/plan/${day.date}`)}
      accessibilityRole="button"
      accessibilityLabel={`${dotMd(day.date)} 星期${day.weekday}，${day.plan ? '已安排穿搭' : '尚未安排'}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ width: 44 }}>
        <Numeral size={26} style={{ color: isToday ? c.accent : c.ink }}>{String(d)}</Numeral>
        <Txt size={11} tone="mute" style={{ lineHeight: 15 }}>{isToday ? '今天' : day.weekday}</Txt>
      </View>
      <View style={{ width: 58 }}>
        <Txt size={12} tone="mute" style={{ lineHeight: 17 }} numberOfLines={1}>{f.top}</Txt>
        {f.bottom ? <Txt size={12} tone="mute" style={{ lineHeight: 17 }} numberOfLines={1}>{f.bottom}</Txt> : null}
      </View>

      {day.plan ? (
        <View style={{ flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', overflow: 'hidden' }}>
          {shown.map((it, i) => (
            <View key={it.id} style={{ width: TILE, height: TILE, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {it.thumbnail ? (
                <Image source={{ uri: tileUrl(it.thumbnail) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
              ) : (
                <Ionicons name="shirt-outline" size={20} color={c.mute} />
              )}
              {more > 0 && i === shown.length - 1 ? (
                <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: c.ink, paddingHorizontal: 4 }}>
                  <Txt size={10} tone="onInk" style={{ lineHeight: 14 }}>{`+${more}`}</Txt>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flex: 1, height: TILE, borderWidth: 1, borderStyle: 'dashed', borderColor: c.mute, alignItems: 'center', justifyContent: 'center' }}>
          <Txt size={12} tone="mute">安排穿搭</Txt>
        </View>
      )}

      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {trip ? <BoxTag label={trip.name} maxWidth={64} /> : null}
        {day.hasWearLog ? (
          <Txt size={10} tone="mute" style={{ lineHeight: 14 }}>已穿</Txt>
        ) : canWear ? (
          <Pressable
            onPress={onWear}
            disabled={wearing}
            accessibilityRole="button"
            accessibilityLabel="就穿這套"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ borderWidth: 1, borderColor: c.ink, paddingHorizontal: 6, paddingVertical: 2, opacity: wearing ? 0.5 : 1 }}
          >
            <Txt size={10} letterSpacing={1} style={{ lineHeight: 15 }}>就穿這套</Txt>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
