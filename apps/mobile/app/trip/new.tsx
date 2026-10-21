import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { invalidateTrips, diffDaysYmd, dotMd } from '@/lib/plan-queries';
import { TopBar, Screen, FieldRow, TextField, Txt, Eyebrow, Button, Hairline, SectionHeader } from '@/components/ui';
import { DateRangePicker } from '@/components/plan/DateRangePicker';
import { tripLengthLabel } from '@/components/plan/PackTab';

type Place = { name: string; lat: number; lon: number; days: number };

/** 新增旅行：名稱、目的地（地名查詢）、起訖日 */
export default function NewTripScreen() {
  const c = useColors();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const days = start && end ? diffDaysYmd(start, end) + 1 : null;
  const canSave = name.trim().length > 0 && destination.trim().length > 0 && !!start && !!end && !saving;

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
    if (!start || !end) return;
    setSaving(true);
    try {
      const res = await api('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim(),
          startDate: start,
          endDate: end,
          ...(place ? { lat: place.lat, lon: place.lon } : {}),
        }),
      });
      const id: string = res.trip.id;
      // 建好就直接依天氣與計畫產生打包清單；失敗也進詳情頁，那邊可以重新產生
      try {
        await api(`/api/trips/${id}/generate`, { method: 'POST' });
      } catch {
        /* 詳情頁可重試 */
      }
      invalidateTrips(id);
      router.replace(`/trip/${id}`);
    } catch (err: any) {
      showAlert('建立失敗', err.message);
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar title="新增旅行" eyebrow="NEW TRIP" />
      <Screen bottomPad={48} contentStyle={{ paddingTop: 4 }}>
        <FieldRow label="名稱">
          <TextField serif placeholder="例如：東京四日" value={name} onChangeText={setName} maxLength={100} accessibilityLabel="旅行名稱" />
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
              style={{ height: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: c.ink, justifyContent: 'center', opacity: destination.trim() ? 1 : 0.4 }}
            >
              {lookup === 'loading' ? <ActivityIndicator size="small" color={c.ink} /> : <Txt size={13}>查詢</Txt>}
            </Pressable>
          </View>
        </FieldRow>
        {place ? (
          <View style={{ paddingVertical: 8 }} accessibilityLiveRegion="polite">
            <Txt size={12} tone="mute">{`找到：${place.name}（${place.lat}, ${place.lon}）${place.days > 0 ? ` . 有 ${place.days} 天預報` : ' . 暫時查不到預報'}`}</Txt>
          </View>
        ) : lookup === 'missing' ? (
          <View style={{ paddingVertical: 8 }} accessibilityLiveRegion="polite">
            <Txt size={12} tone="accent">找不到這個地名，試試英文或更大的城市名；也可以直接建立，只是沒有預報。</Txt>
          </View>
        ) : null}

        <SectionHeader title="日期" style={{ marginTop: 20 }} />
        <View style={{ marginTop: 6 }}>
          <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
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
        <Eyebrow style={{ marginBottom: 10 }}>建立後會依天氣預報與已排的計畫自動產生打包清單</Eyebrow>
        <Button label="建立旅行" onPress={save} loading={saving} disabled={!canSave || (days ?? 0) > 60} />
      </Screen>
    </View>
  );
}
