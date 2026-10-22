import { useEffect, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { localDateString } from '@/lib/queries';
import { useTrip, invalidateTrips, diffDaysYmd, dotMd } from '@/lib/plan-queries';
import { TopBar, Screen, FieldRow, TextField, Txt, Eyebrow, Button, Hairline, SectionHeader } from '@/components/ui';
import { DateRangePicker } from '@/components/plan/DateRangePicker';
import { tripLengthLabel } from '@/components/plan/PackTab';

type Place = { name: string; lat: number; lon: number; days: number };

/** 編輯旅行：名稱、目的地（地名查詢）、起訖日；改了日期或目的地會提示重新產生打包清單 */
export default function EditTripScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useTrip(id);
  const trip = data?.trip;

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (trip && !ready) {
      setName(trip.name);
      setDestination(trip.destination);
      setStart(trip.startDate);
      setEnd(trip.endDate);
      setReady(true);
    }
  }, [trip, ready]);

  const today = localDateString();
  const days = start && end ? diffDaysYmd(start, end) + 1 : null;
  const destChanged = !!trip && destination.trim() !== trip.destination;
  const dateChanged = !!trip && (start !== trip.startDate || end !== trip.endDate);
  const changed = !!trip && (name.trim() !== trip.name || destChanged || dateChanged);
  const canSave = changed && name.trim().length > 0 && destination.trim().length > 0 && !!start && !!end && !saving && (days ?? 0) <= 60;

  const search = async () => {
    const q = destination.trim();
    if (!q) return;
    setLookup('loading');
    setPlace(null);
    try {
      const res = await api(`/api/weather/forecast?city=${encodeURIComponent(q)}`);
      setPlace({ name: res.location ?? q, lat: res.lat, lon: res.lon, days: res.days?.length ?? 0 });
      setLookup('idle');
    } catch {
      setLookup('missing');
    }
  };

  const save = async () => {
    if (!start || !end || !trip) return;
    setSaving(true);
    try {
      await api(`/api/trips/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim(),
          startDate: start,
          endDate: end,
          // 目的地變了：有查詢結果就帶座標，沒有就交給伺服器重新查
          ...(destChanged && place ? { lat: place.lat, lon: place.lon } : {}),
        }),
      });
      invalidateTrips(id);
      if ((destChanged || dateChanged) && (data?.items.length ?? 0) > 0) {
        const yes = await showConfirm(
          '重新產生打包清單？',
          '日期或目的地改了，預報和天數都不同。要依新的條件重新產生嗎？只會更新系統產生且還沒勾的項目，手動加的和已勾選的會保留。',
        );
        if (yes) {
          try {
            await api(`/api/trips/${id}/generate`, { method: 'POST' });
            invalidateTrips(id);
          } catch (err: any) {
            showAlert('產生失敗', err.message);
          }
        }
      }
      router.back();
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar title="編輯旅行" eyebrow="EDIT TRIP" />
      {!ready ? (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 80 }}>
          <ActivityIndicator color={c.ink} />
        </View>
      ) : (
        <Screen bottomPad={48} contentStyle={{ paddingTop: 4 }}>
          <FieldRow label="名稱">
            <TextField serif value={name} onChangeText={setName} maxLength={100} accessibilityLabel="旅行名稱" />
          </FieldRow>

          <FieldRow label="目的地">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextField
                placeholder="城市名，例如 東京、首爾、台中"
                value={destination}
                onChangeText={(t) => { setDestination(t); setPlace(null); setLookup('idle'); }}
                onSubmitEditing={search}
                returnKeyType="search"
                maxLength={100}
                accessibilityLabel="目的地"
                style={{ flex: 1 }}
              />
              <Pressable
                onPress={search}
                disabled={!destination.trim() || lookup === 'loading'}
                accessibilityRole="button"
                accessibilityLabel="查詢地名"
                style={{ height: 44, minWidth: 56, paddingHorizontal: 12, borderWidth: 1, borderColor: c.ink, justifyContent: 'center', alignItems: 'center', opacity: destination.trim() ? 1 : 0.4 }}
              >
                {lookup === 'loading' ? <ActivityIndicator size="small" color={c.ink} /> : <Txt size={13}>查詢</Txt>}
              </Pressable>
            </View>
          </FieldRow>
          {place ? (
            <View style={{ paddingVertical: 8 }} accessibilityLiveRegion="polite">
              <Txt size={12} tone="mute">{`找到「${destination.trim()}」（${place.lat}, ${place.lon}）${place.days > 0 ? ` . 有 ${place.days} 天預報` : ' . 暫時查不到預報'}`}</Txt>
            </View>
          ) : lookup === 'missing' ? (
            <View style={{ paddingVertical: 8 }} accessibilityLiveRegion="polite">
              <Txt size={12} tone="accent">找不到這個地名，試試英文或更大的城市名；也可以直接儲存，只是沒有預報。</Txt>
            </View>
          ) : destChanged ? (
            <View style={{ paddingVertical: 8 }}>
              <Txt size={12} tone="mute">改了目的地，儲存時會自動重新查詢座標。</Txt>
            </View>
          ) : null}

          <SectionHeader title="日期" style={{ marginTop: 20 }} />
          <View style={{ marginTop: 6 }}>
            <DateRangePicker
              start={start}
              end={end}
              minDate={trip && trip.startDate < today ? trip.startDate : today}
              onChange={(s, e) => { setStart(s); setEnd(e); }}
            />
          </View>
          <View style={{ marginTop: 8, minHeight: 24 }}>
            {start && end ? (
              <Txt size={13}>{`${dotMd(start)} - ${dotMd(end)} . ${tripLengthLabel(days ?? 1)}`}</Txt>
            ) : start ? (
              <Txt size={13} tone="mute">再點一下回程日（同一天 = 當日來回）</Txt>
            ) : (
              <Txt size={13} tone="mute">點選出發日</Txt>
            )}
          </View>
          {days !== null && days > 60 ? <Txt size={12} tone="accent">旅行最多 60 天</Txt> : null}

          <Hairline style={{ marginTop: 12, marginBottom: 16 }} />
          <Eyebrow style={{ marginBottom: 10 }}>改了日期或目的地後，會問你要不要重新產生打包清單</Eyebrow>
          <Button label="儲存" onPress={save} loading={saving} disabled={!canSave} />
        </Screen>
      )}
    </View>
  );
}
