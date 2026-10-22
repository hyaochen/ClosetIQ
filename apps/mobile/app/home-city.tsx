import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { useMe, updateSettings } from '@/lib/queries';
import { TopBar, Screen, FieldRow, TextField, Txt, Eyebrow, Button, Hairline } from '@/components/ui';

type Place = { name: string; lat: number; lon: number };

/** 常用城市：用地名查詢（Open-Meteo）選一個城市；今日刊頭、週計畫、推薦在沒有定位時都用它 */
export default function HomeCityScreen() {
  const c = useColors();
  const { data: me } = useMe();
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'missing'>('idle');
  const [saving, setSaving] = useState(false);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLookup('loading');
    setPlace(null);
    try {
      const res = await api(`/api/weather/forecast?city=${encodeURIComponent(q)}`);
      setPlace({ name: res.location ?? q, lat: res.lat, lon: res.lon });
      setLookup('idle');
    } catch {
      setLookup('missing');
    }
  };

  const save = async () => {
    if (!place) return;
    setSaving(true);
    try {
      await updateSettings({ homeCity: place.name, homeLat: place.lat, homeLon: place.lon });
      router.back();
    } catch (err: any) {
      showAlert('設定失敗', err.message);
      setSaving(false);
    }
  };

  const clear = async () => {
    const ok = await showConfirm('清除常用城市', '清除後沒有定位時會改用台北的天氣。');
    if (!ok) return;
    try {
      await updateSettings({ homeCity: null, homeLat: null, homeLon: null });
      router.back();
    } catch (err: any) {
      showAlert('設定失敗', err.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar title="常用城市" eyebrow="HOME CITY" />
      <Screen bottomPad={48} contentStyle={{ paddingTop: 4 }}>
        <FieldRow label="目前">
          <Txt size={15}>{me?.homeCity ?? '未設定（預設台北）'}</Txt>
        </FieldRow>

        <FieldRow label="城市">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextField
              placeholder="城市名，例如 台中、高雄、Tokyo"
              value={query}
              onChangeText={(t) => { setQuery(t); setPlace(null); setLookup('idle'); }}
              onSubmitEditing={search}
              returnKeyType="search"
              maxLength={100}
              accessibilityLabel="城市名稱"
              style={{ flex: 1 }}
            />
            <Pressable
              onPress={search}
              disabled={!query.trim() || lookup === 'loading'}
              accessibilityRole="button"
              accessibilityLabel="查詢地名"
              style={{ height: 44, minWidth: 56, paddingHorizontal: 12, borderWidth: 1, borderColor: c.ink, justifyContent: 'center', alignItems: 'center', opacity: query.trim() ? 1 : 0.4 }}
            >
              {lookup === 'loading' ? <ActivityIndicator size="small" color={c.ink} /> : <Txt size={13}>查詢</Txt>}
            </Pressable>
          </View>
        </FieldRow>

        {place ? (
          <View style={{ paddingVertical: 10 }} accessibilityLiveRegion="polite">
            <Txt size={14}>{`找到：${place.name}`}</Txt>
            <Txt size={12} tone="mute" style={{ marginTop: 2 }}>{`座標 ${place.lat.toFixed(2)}, ${place.lon.toFixed(2)}`}</Txt>
          </View>
        ) : lookup === 'missing' ? (
          <View style={{ paddingVertical: 10 }} accessibilityLiveRegion="polite">
            <Txt size={12} tone="accent">找不到這個地名，試試英文或更大的城市名。</Txt>
          </View>
        ) : null}

        <Hairline style={{ marginTop: 12, marginBottom: 16 }} />
        <Eyebrow style={{ marginBottom: 10 }}>有開啟定位時，今日頁仍以目前位置為主</Eyebrow>
        <Button label="設為常用城市" onPress={save} loading={saving} disabled={!place || saving} />
        {me?.homeCity ? (
          <Pressable onPress={clear} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', marginTop: 6 }}>
            <Txt size={13} tone="mute" style={{ textDecorationLine: 'underline' }}>清除常用城市</Txt>
          </Pressable>
        ) : null}
      </Screen>
    </View>
  );
}
