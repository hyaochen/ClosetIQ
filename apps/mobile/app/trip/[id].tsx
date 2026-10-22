import { useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { useTrip, invalidateTrips, dotMd, parseYmd, type TripItem } from '@/lib/plan-queries';
import { TopBar, Screen, Txt, Serif, Numeral, Eyebrow, Button, BarMeter, TextField, Chip } from '@/components/ui';
import { ItemPicker } from '@/components/journal/ItemPicker';
import { CATEGORY_SHORT, PACK_CATEGORY_ORDER } from '@/components/plan/shared';
import { tripLengthLabel } from '@/components/plan/PackTab';

const QUICK_ADDS = ['雨傘', '充電器', '盥洗用品', '防曬乳', '拖鞋'];

/** 旅行詳情：目的地、日期、預報摘要、進度條、依類別的打包清單 */
export default function TripDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useTrip(id);
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [adding, setAdding] = useState(false);
  const [picker, setPicker] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);

  const trip = data?.trip;
  const items = data?.items ?? [];
  const weather = data?.weather;

  const groups = useMemo(() => {
    const map = new Map<string, TripItem[]>();
    for (const it of items) {
      const key = it.category && PACK_CATEGORY_ORDER.includes(it.category) ? it.category : 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return PACK_CATEGORY_ORDER.filter((k) => map.has(k)).map((k) => ({
      key: k,
      items: map.get(k)!.sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }, [items]);

  const packed = items.filter((i) => i.packed).length;
  const total = items.length;

  const refresh = () => invalidateTrips(id);

  const toggle = async (item: TripItem) => {
    // 先樂觀更新，勾選要立即有感
    queryClient.setQueryData(['trip', id], (old: any) =>
      old ? { ...old, items: old.items.map((i: TripItem) => (i.id === item.id ? { ...i, packed: !i.packed } : i)) } : old,
    );
    try {
      await api(`/api/trips/${id}/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ packed: !item.packed }) });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    } catch (err: any) {
      refresh();
      showAlert('更新失敗', err.message);
    }
  };

  const remove = async (item: TripItem) => {
    try {
      await api(`/api/trips/${id}/items/${item.id}`, { method: 'DELETE' });
      refresh();
    } catch (err: any) {
      showAlert('刪除失敗', err.message);
    }
  };

  const regenerate = async () => {
    setGenerating(true);
    try {
      const res = await api(`/api/trips/${id}/generate`, { method: 'POST' });
      setWarnings(res.warnings ?? []);
      refresh();
    } catch (err: any) {
      showAlert('產生失敗', err.message);
    } finally {
      setGenerating(false);
    }
  };

  const addCustom = async (name: string) => {
    const n = name.trim();
    if (!n || adding) return;
    setAdding(true);
    try {
      await api(`/api/trips/${id}/items`, { method: 'POST', body: JSON.stringify({ customName: n, reason: '自訂項目' }) });
      setCustom('');
      refresh();
    } catch (err: any) {
      showAlert('新增失敗', err.message);
    } finally {
      setAdding(false);
    }
  };

  // 從衣櫃加入：多選衣物格；清單裡已有的不重複加入
  const inListIds = items.map((i) => i.clothingItemId).filter((x): x is string => !!x);
  const addFromCloset = async (ids: string[]) => {
    const fresh = ids.filter((x) => !inListIds.includes(x));
    if (fresh.length === 0) {
      setPicker(false);
      return;
    }
    setPickBusy(true);
    try {
      let failed = 0;
      for (const clothingItemId of fresh) {
        try {
          await api(`/api/trips/${id}/items`, { method: 'POST', body: JSON.stringify({ clothingItemId, reason: '手動加入' }) });
        } catch {
          failed += 1;
        }
      }
      refresh();
      setPicker(false);
      if (failed > 0) showAlert('部分加入失敗', `${failed} 件沒有加進去，請再試一次`);
    } finally {
      setPickBusy(false);
    }
  };

  const deleteTrip = async () => {
    const yes = await showConfirm('刪除旅行', `確定刪除「${trip?.name}」與它的打包清單？`);
    if (!yes) return;
    try {
      await api(`/api/trips/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      router.replace({ pathname: '/(tabs)/outfits', params: { seg: 'pack' } });
    } catch (err: any) {
      showAlert('刪除失敗', err.message);
    }
  };

  // 預報摘要：12°-19° . 26 日有雨 . N 天無預報
  const summaryParts: string[] = [];
  if (weather && weather.minTemp !== null && weather.maxTemp !== null) {
    summaryParts.push(`預報 ${Math.round(weather.minTemp)}°-${Math.round(weather.maxTemp)}°`);
  }
  if (weather && weather.rainDates.length > 0) {
    const ds = weather.rainDates.slice(0, 3).map((d) => parseYmd(d).d).join('、');
    summaryParts.push(`${ds}${weather.rainDates.length > 3 ? ' 等' : ''} 日有雨`);
  }
  if (weather && weather.unknownDates.length > 0) {
    summaryParts.push(weather.minTemp === null ? '尚無預報（超過 16 天）' : `${weather.unknownDates.length} 天無預報`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar
        eyebrow="TRIP"
        title={trip?.name}
        right={
          <View style={{ flexDirection: 'row' }}>
            <Pressable onPress={() => router.push({ pathname: '/trip/edit', params: { id } })} accessibilityRole="button" accessibilityLabel="編輯旅行" style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="create-outline" size={20} color={c.ink} />
            </Pressable>
            <Pressable onPress={deleteTrip} accessibilityRole="button" accessibilityLabel="刪除旅行" style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={20} color={c.ink} />
            </Pressable>
          </View>
        }
        onBack={() => router.replace({ pathname: '/(tabs)/outfits', params: { seg: 'pack' } })}
      />
      {isLoading || !trip ? (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 80 }}>
          {error ? <Txt tone="mute">找不到這趟旅行</Txt> : <ActivityIndicator color={c.ink} />}
        </View>
      ) : (
        <Screen bottomPad={56} contentStyle={{ paddingTop: 4 }}>
          <Eyebrow style={{ marginTop: 12 }}>{`TRIP . ${tripLengthLabel(trip.days)}`}</Eyebrow>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <Serif size={26} style={{ flexShrink: 1 }} numberOfLines={2} accessibilityRole="header">{trip.destination}</Serif>
            <Numeral size={19}>{`${dotMd(trip.startDate)} - ${dotMd(trip.endDate)}`}</Numeral>
          </View>
          {summaryParts.length > 0 ? (
            <Txt size={12} tone="mute" style={{ marginTop: 2 }}>{summaryParts.join(' . ')}</Txt>
          ) : (
            <Txt size={12} tone="mute" style={{ marginTop: 2 }}>查不到這個目的地的預報</Txt>
          )}

          {/* 進度 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <BarMeter ratio={total > 0 ? packed / total : 0} />
            <Txt size={12}>{`${packed} / ${total}`}</Txt>
          </View>

          {total === 0 ? (
            <View style={{ marginTop: 20, gap: 12, alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
              <Txt tone="mute" style={{ textAlign: 'center' }}>還沒有打包清單</Txt>
              <Button label="依天氣與計畫產生" icon="sparkles-outline" onPress={regenerate} loading={generating} />
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              {groups.map((g) =>
                g.items.map((it, i) => (
                  <PackRow
                    key={it.id}
                    item={it}
                    catLabel={i === 0 ? (CATEGORY_SHORT[g.key] ?? '其他') : ''}
                    onToggle={() => toggle(it)}
                    onRemove={!it.isAuto ? () => remove(it) : undefined}
                  />
                )),
              )}
            </View>
          )}

          {warnings.length > 0 ? (
            <View style={{ marginTop: 14, gap: 2 }} accessibilityLiveRegion="polite">
              {warnings.map((w, i) => (
                <Txt key={i} size={12} tone="accent">{w}</Txt>
              ))}
            </View>
          ) : null}

          {/* 從衣櫃加入 */}
          <View style={{ marginTop: 22 }}>
            <Button label="從衣櫃加入" variant="outline" icon="shirt-outline" onPress={() => setPicker(true)} />
          </View>

          {/* 自訂項目 */}
          <View style={{ marginTop: 22 }}>
            <Eyebrow>加自訂項目</Eyebrow>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.ink }}>
              <TextField
                placeholder="例如：雨傘、護照"
                value={custom}
                onChangeText={setCustom}
                onSubmitEditing={() => addCustom(custom)}
                returnKeyType="done"
                maxLength={50}
                accessibilityLabel="自訂項目名稱"
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={() => addCustom(custom)}
                disabled={!custom.trim() || adding}
                accessibilityRole="button"
                accessibilityLabel="加入自訂項目"
                style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', opacity: custom.trim() ? 1 : 0.35 }}
              >
                <Ionicons name="add" size={22} color={c.ink} />
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {QUICK_ADDS.filter((q) => !items.some((i) => i.name === q)).map((q) => (
                <Chip key={q} label={q} icon="add" onPress={() => addCustom(q)} />
              ))}
            </View>
          </View>

          {total > 0 ? (
            <View style={{ marginTop: 26, gap: 8 }}>
              <Button label="重新產生" variant="outline" icon="refresh-outline" onPress={regenerate} loading={generating} />
              <Txt size={12} tone="mute">只更新系統產生且還沒勾的項目；手動加的和已勾選的會保留。</Txt>
            </View>
          ) : null}
        </Screen>
      )}
      <ItemPicker
        visible={picker}
        initial={inListIds}
        title="從衣櫃加入"
        confirmLabel="加入打包清單"
        busy={pickBusy}
        onConfirm={addFromCloset}
        onClose={() => setPicker(false)}
      />
    </View>
  );
}

function PackRow({
  item, catLabel, onToggle, onRemove,
}: {
  item: TripItem;
  catLabel: string;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.packed }}
        accessibilityLabel={item.name}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, opacity: pressed ? 0.65 : 1 })}
      >
        <View style={{ width: 18, height: 18, borderWidth: 1, borderColor: c.ink, backgroundColor: item.packed ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {item.packed ? <Ionicons name="checkmark" size={13} color={c.onInk} /> : null}
        </View>
        <Txt size={11} tone="mute" style={{ width: 34, lineHeight: 16 }}>{catLabel}</Txt>
        <Txt
          size={14}
          tone={item.packed ? 'mute' : 'ink'}
          style={{ flex: 1, textDecorationLine: item.packed ? 'line-through' : 'none' }}
        >
          {item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}
        </Txt>
        {item.reason ? <Txt size={11} tone="accent" style={{ lineHeight: 16, maxWidth: 120, textAlign: 'right' }}>{item.reason}</Txt> : null}
      </Pressable>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`移除 ${item.name}`} style={{ width: 36, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Ionicons name="close" size={16} color={c.mute} />
        </Pressable>
      ) : null}
    </View>
  );
}
