import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { tileUrl } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { localDateString } from '@/lib/queries';
import { usePlace, usePlanRange, savePlan, removePlan, wearPlan, dotMd, weekdayOf, parseYmd } from '@/lib/plan-queries';
import {
  TopBar, Screen, Txt, Serif, Numeral, Eyebrow, Button, Chip, Segmented, GarmentTile, StatusTag, SectionHeader, Hairline,
} from '@/components/ui';
import { CONDITION_SHORT, BoxTag } from '@/components/plan/shared';
import { useTrips } from '@/lib/plan-queries';

const PAGE_SIZE = 100;
const GRID_GAP = 8;
const CATEGORY_TABS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: '全部' },
  ...Object.entries(ClothingCategoryLabel).map(([key, label]) => ({ key, label })),
];

type Mode = 'outfit' | 'items';

/** 安排某一天：選既有穿搭，或自己挑衣物；當天可「就穿這套」轉成穿著紀錄 */
export default function PlanDayScreen() {
  const c = useColors();
  const { date } = useLocalSearchParams<{ date: string }>();
  const today = localDateString();
  const place = usePlace();
  const { data: rangeData, isLoading: planLoading } = usePlanRange(date, date, place);
  const { data: tripData } = useTrips();
  const day = rangeData?.days?.[0];
  const plan = day?.plan ?? null;
  const trip = (tripData?.trips ?? []).find((t) => date >= t.startDate && date <= t.endDate);

  const [mode, setMode] = useState<Mode>('outfit');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  // 已有計畫時，挑衣物從現有內容開始改
  useEffect(() => {
    if (plan && !touched) setSelected(plan.items.map((i) => i.id));
  }, [plan, touched]);

  const { data: outfitData, isLoading: outfitsLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api('/api/outfits'),
  });
  const outfits: any[] = outfitData?.outfits ?? [];

  const { data: itemPages, hasNextPage, fetchNextPage, isFetchingNextPage, isLoading: itemsLoading } = useInfiniteQuery({
    queryKey: ['items-plan'],
    queryFn: ({ pageParam = 1 }) => api(`/api/items?limit=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last: any) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled: mode === 'items',
  });
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage]);
  const allItems: any[] = itemPages?.pages.flatMap((p: any) => p.items) ?? [];
  const shownItems = category ? allItems.filter((i) => i.category === category) : allItems;

  const toggle = (id: string) => {
    setTouched(true);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const done = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/(tabs)/outfits', params: { seg: 'plan' } });
  };

  const pickOutfit = async (outfitId: string) => {
    setBusy(true);
    try {
      await savePlan(date, { outfitId });
      done();
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveItems = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      await savePlan(date, { itemIds: selected });
      done();
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
    } finally {
      setBusy(false);
    }
  };

  const clearPlan = async () => {
    const yes = await showConfirm('清除計畫', `清除 ${dotMd(date)} 的穿搭安排？`);
    if (!yes) return;
    setBusy(true);
    try {
      await removePlan(date);
      setTouched(false);
      setSelected([]);
    } catch (err: any) {
      showAlert('清除失敗', err.message);
    } finally {
      setBusy(false);
    }
  };

  const wear = async () => {
    setBusy(true);
    try {
      await wearPlan(date);
      showAlert('已記錄', '已把這套記成當天的穿著紀錄。');
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setBusy(false);
    }
  };

  const f = day?.forecast;
  const weatherLine = f
    ? `${Math.round(f.min)}°-${Math.round(f.max)}° . ${CONDITION_SHORT[f.condition] ?? ''}${f.rainChance >= 30 ? ` . 降雨 ${f.rainChance}%` : ''}`
    : '無預報';
  const canWear = !!plan && date <= today && !day?.hasWearLog;
  const { d } = parseYmd(date);

  const selectedCount = selected.length;
  const unchanged = useMemo(() => {
    if (!plan) return false;
    const a = [...plan.items.map((i) => i.id)].sort().join(',');
    const b = [...selected].sort().join(',');
    return a === b;
  }, [plan, selected]);

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="PLAN" title={`${dotMd(date)} 星期${weekdayOf(date)}`} />
      <Screen bottomPad={mode === 'items' ? 24 : 48} contentStyle={{ paddingTop: 4 }}>
        {/* 當天摘要 */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Numeral size={40} style={{ color: date === today ? c.accent : c.ink }}>{String(d)}</Numeral>
            <Txt size={13} tone="mute">{weatherLine}</Txt>
          </View>
          {trip ? <BoxTag label={trip.name} maxWidth={120} /> : null}
        </View>
        <Hairline tone="ink" style={{ marginTop: 8 }} />

        {/* 目前計畫 */}
        {planLoading ? (
          <ActivityIndicator color={c.ink} style={{ marginTop: 24 }} />
        ) : plan ? (
          <View style={{ marginTop: 14, gap: 12 }}>
            <Eyebrow>目前安排</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {plan.items.map((it) => (
                <Pressable key={it.id} onPress={() => router.push(`/item/${it.id}`)} accessibilityRole="button" accessibilityLabel={it.name} style={{ width: 84, gap: 4 }}>
                  <GarmentTile path={it.thumbnail} height={84} />
                  <Txt size={11} numberOfLines={1} style={{ lineHeight: 16 }}>{it.name}</Txt>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {canWear ? <Button label="就穿這套" icon="checkmark" onPress={wear} loading={busy} style={{ flex: 1 }} /> : null}
              {day?.hasWearLog ? (
                <View style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <Ionicons name="checkmark" size={18} color={c.ink} />
                  <Txt size={14}>當天已有穿著紀錄</Txt>
                </View>
              ) : null}
              <Button label="清除計畫" variant="outline" onPress={clearPlan} disabled={busy} style={canWear || day?.hasWearLog ? undefined : { flex: 1 }} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 14, height: 56, borderWidth: 1, borderStyle: 'dashed', borderColor: c.mute, alignItems: 'center', justifyContent: 'center' }}>
            <Txt size={13} tone="mute">這天還沒有安排</Txt>
          </View>
        )}

        {/* 安排方式 */}
        <SectionHeader title={plan ? '改成別的' : '安排穿搭'} style={{ marginTop: 22 }} />
        <View style={{ marginTop: 12 }}>
          <Segmented
            label="安排方式"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'outfit', label: '選既有穿搭' },
              { value: 'items', label: '挑衣物' },
            ]}
          />
        </View>

        {mode === 'outfit' ? (
          <View style={{ marginTop: 6 }}>
            {outfitsLoading ? (
              <ActivityIndicator color={c.ink} style={{ marginTop: 24 }} />
            ) : outfits.length === 0 ? (
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
                <Txt tone="mute">還沒有穿搭可選</Txt>
                <Button label="建立穿搭" variant="outline" onPress={() => router.push('/outfit/builder')} />
              </View>
            ) : (
              outfits.map((o) => {
                const thumbs: (string | undefined)[] = (o.items ?? []).map((oi: any) => oi.clothingItem?.images?.[0]?.thumbnailPath).slice(0, 4);
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => pickOutfit(o.id)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={`選 ${o.name || '未命名穿搭'}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 60,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: c.line,
                      opacity: pressed || busy ? 0.65 : 1,
                    })}
                  >
                    <View style={{ width: 148, flexDirection: 'row', gap: 4 }}>
                      {thumbs.map((t, i) => (
                        <View key={i} style={{ width: 34, height: 34, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {t ? (
                            <Image source={{ uri: tileUrl(t) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
                          ) : (
                            <Ionicons name="shirt-outline" size={16} color={c.mute} />
                          )}
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Serif size={15} medium numberOfLines={1}>{o.name || '未命名穿搭'}</Serif>
                      <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{`${o.items?.length ?? 0} 件 . 穿 ${o._count?.wearLogs ?? 0} 次`}</Txt>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={c.ink} />
                  </Pressable>
                );
              })
            )}
          </View>
        ) : (
          <View style={{ marginTop: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 12 }}>
              {CATEGORY_TABS.map((t) => (
                <Chip key={t.label} label={t.label} selected={category === t.key} onPress={() => setCategory(t.key)} />
              ))}
            </ScrollView>
            {itemsLoading ? (
              <ActivityIndicator color={c.ink} style={{ marginTop: 24 }} />
            ) : shownItems.length === 0 ? (
              <Txt tone="mute" style={{ textAlign: 'center', paddingVertical: 32 }}>這個分類沒有衣物</Txt>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                {shownItems.map((it) => {
                  const on = selected.includes(it.id);
                  const dirty = it.laundryStatus === 'DIRTY' || it.laundryStatus === 'CLEANING';
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => toggle(it.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={it.name}
                      style={{ width: '31.5%', gap: 4 }}
                    >
                      <View style={{ borderWidth: 2, borderColor: on ? c.ink : 'transparent' }}>
                        <GarmentTile
                          path={it.images?.[0]?.thumbnailPath}
                          height={104}
                          dim={dirty}
                          overlay={dirty ? <StatusTag kind={it.laundryStatus === 'DIRTY' ? 'DIRTY' : 'CLEANING'} /> : undefined}
                        />
                        {on ? (
                          <View style={{ position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="checkmark" size={14} color={c.onInk} />
                          </View>
                        ) : null}
                      </View>
                      <Txt size={11} numberOfLines={1} style={{ lineHeight: 16 }}>{it.name}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </Screen>

      {mode === 'items' ? (
        <View style={{ borderTopWidth: 1, borderTopColor: c.ink, backgroundColor: c.paper, paddingHorizontal: 20, paddingVertical: 10 }}>
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Txt size={13} tone="mute" style={{ minWidth: 56 }}>{`已選 ${selectedCount} 件`}</Txt>
            <Button
              label={plan ? '更新這天' : '儲存這天'}
              onPress={saveItems}
              loading={busy}
              disabled={selectedCount === 0 || (!!plan && unchanged)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
