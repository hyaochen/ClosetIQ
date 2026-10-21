import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { LaundryStatus } from '@closet/shared';
import { useColors } from '@/lib/theme';
import { useLaundry, setLaundryStatus } from '@/lib/queries';
import { showAlert, showConfirm } from '@/lib/alert';
import { Screen, TopBar, Txt, Serif, Numeral, Button, Hairline, GarmentTile, StatusTag, SectionHeader } from '@/components/ui';
import { View as RNView } from 'react-native';

export default function LaundryScreen() {
  const c = useColors();
  const { data, isLoading } = useLaundry();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const items: any[] = data?.items ?? [];
  const dirty = items.filter((i) => i.laundryStatus === 'DIRTY');
  const cleaning = items.filter((i) => i.laundryStatus === 'CLEANING');

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const apply = async (ids: string[], status: LaundryStatus) => {
    if (ids.length === 0 || busy) return;
    setBusy(true);
    try {
      await setLaundryStatus(ids, status);
      setSelected([]);
    } catch (err: any) {
      showAlert('更新失敗', err.message);
    } finally {
      setBusy(false);
    }
  };

  const allClean = async () => {
    const ok = await showConfirm('全部洗好了', `洗衣籃裡的 ${items.length} 件衣物都會變回乾淨。`);
    if (ok) apply(items.map((i) => i.id), 'CLEAN');
  };

  const renderRow = (it: any) => {
    const on = selected.includes(it.id);
    return (
      <Pressable
        key={it.id}
        onPress={() => toggle(it.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={it.name}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ width: 22, height: 22, borderWidth: 1, borderColor: c.ink, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {on ? <Ionicons name="checkmark" size={15} color={c.onInk} /> : null}
        </View>
        <GarmentTile path={it.images?.[0]?.thumbnailPath} image={it.images?.[0]} height={56} style={{ width: 56 }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Serif size={15} medium numberOfLines={1}>{it.name}</Serif>
          <StatusTag kind={it.laundryStatus === 'CLEANING' ? 'CLEANING' : 'DIRTY'} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="LAUNDRY" title="洗衣籃" />
      <Screen bottomPad={selected.length > 0 ? 120 : 40} safeTop={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Numeral size={34}>{String(items.length)}</Numeral>
            <Txt tone="mute">件需要處理</Txt>
          </View>
          {items.length > 0 ? <Button label="全部洗好了" height={44} icon="checkmark" onPress={allClean} loading={busy} /> : null}
        </View>
        <Hairline tone="ink" style={{ marginTop: 10 }} />

        {isLoading ? (
          <ActivityIndicator color={c.ink} style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 56, gap: 12 }}>
            <Ionicons name="checkmark-circle-outline" size={44} color={c.mute} />
            <Txt tone="mute">洗衣籃是空的，衣服都是乾淨的</Txt>
            <Button label="回到衣櫃" variant="outline" onPress={() => router.push('/(tabs)/wardrobe')} />
          </View>
        ) : (
          <>
            {dirty.length > 0 ? (
              <>
                <SectionHeader title={`待洗 ${dirty.length}`} style={{ marginTop: 18 }} />
                {dirty.map(renderRow)}
              </>
            ) : null}
            {cleaning.length > 0 ? (
              <>
                <SectionHeader title={`送洗中 ${cleaning.length}`} style={{ marginTop: 18 }} />
                {cleaning.map(renderRow)}
              </>
            ) : null}
            <Txt size={12} tone="mute" style={{ marginTop: 14 }}>點選衣物可多選，再批次改狀態。</Txt>
          </>
        )}
      </Screen>

      {selected.length > 0 ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <RNView style={{ width: '100%', maxWidth: 560, alignSelf: 'center', gap: 10 }}>
            <Txt size={12} tone="mute">{`已選 ${selected.length} 件，改成`}</Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="待洗" variant="outline" style={{ flex: 1 }} onPress={() => apply(selected, 'DIRTY')} disabled={busy} />
              <Button label="送洗中" variant="outline" style={{ flex: 1 }} onPress={() => apply(selected, 'CLEANING')} disabled={busy} />
              <Button label="洗好了" style={{ flex: 1.2 }} onPress={() => apply(selected, 'CLEAN')} loading={busy} />
            </View>
          </RNView>
        </View>
      ) : null}
    </View>
  );
}
