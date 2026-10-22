import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SeasonLabel, type Season } from '@closet/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useThemeStore } from '@/lib/theme-store';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import {
  useMe, useStorageLocations, useLaundry, updateSettings, invalidateWardrobe,
} from '@/lib/queries';
import { useBackfill } from '@/lib/cutout';
import {
  Screen, PageHeader, SectionHeader, Hairline, Txt, Serif, Numeral, Button, Segmented, ListRow, BarMeter, PickerSheet,
} from '@/components/ui';

const SEASON_OPTIONS = (Object.keys(SeasonLabel) as Season[]).map((k) => ({ value: k, label: SeasonLabel[k] }));
const SEASON_NAME: Record<string, string> = { SPRING: '春季', SUMMER: '夏季', AUTUMN: '秋季', WINTER: '冬季' };
const THEME_LABEL = { light: '淺色', dark: '深色', system: '跟隨系統' } as const;

export default function MeScreen() {
  const c = useColors();
  const { user, logout } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const { data: me } = useMe();
  const { data: locData } = useStorageLocations();
  const { data: laundry } = useLaundry();
  const { data: backfill } = useBackfill(); // P2：還沒去背的照片張數
  const [moveSheet, setMoveSheet] = useState(false);
  const [moving, setMoving] = useState(false);

  const season = me?.effectiveSeason ?? 'AUTUMN';
  const { data: offSeason } = useQuery<any[]>({
    queryKey: ['off-season-items', season],
    queryFn: async () => (await api('/api/items?inSeason=false&limit=500')).items,
    enabled: !!me,
  });
  const strayItems = (offSeason ?? []).filter((it) => !it.storageLocation?.isOffSeason);
  const offLocations = (locData?.locations ?? []).filter((l) => l.isOffSeason);

  const locations = locData?.locations ?? [];
  const totalItems = locations.reduce((a, l) => a + l.itemCount, 0) + (locData?.unassignedCount ?? 0);

  const dirty = (laundry?.items ?? []).filter((i) => i.laundryStatus === 'DIRTY').length;
  const cleaning = (laundry?.items ?? []).filter((i) => i.laundryStatus === 'CLEANING').length;

  const pickSeason = async (s: Season) => {
    try {
      await updateSettings({ currentSeason: s });
    } catch (err: any) {
      showAlert('設定失敗', err.message);
    }
  };

  const openMove = async () => {
    if (strayItems.length === 0) return;
    if (offLocations.length === 0) {
      const ok = await showConfirm('還沒有換季收納處', '先建立一個「換季收納處」（例如床下收納箱），再把季外衣物移進去。要現在去建立嗎？');
      if (ok) router.push('/storage');
      return;
    }
    setMoveSheet(true);
  };

  const doMove = async (locationId: string) => {
    setMoveSheet(false);
    setMoving(true);
    try {
      const res = await api('/api/items/bulk-move', {
        method: 'POST',
        body: JSON.stringify({ itemIds: strayItems.map((i) => i.id), storageLocationId: locationId }),
      });
      invalidateWardrobe();
      showAlert('已移動', `${res.moved} 件季外衣物已放進收納箱`);
    } catch (err: any) {
      showAlert('移動失敗', err.message);
    } finally {
      setMoving(false);
    }
  };

  const cycleTheme = () => setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light');

  const handleLogout = async () => {
    const ok = await showConfirm('登出', '確定要登出嗎？');
    if (ok) {
      await logout();
      router.replace('/(auth)/login');
    }
  };

  return (
    <Screen>
      <PageHeader
        title="我的"
        rule
        right={
          <Txt size={13} tone="mute" numberOfLines={1} style={{ maxWidth: 200 }}>
            {user?.displayName ?? ''}
            {me ? ' · ' : ''}
            {me ? <Numeral size={16} tone="mute">{`since ${new Date(me.createdAt).getFullYear()}`}</Numeral> : null}
          </Txt>
        }
      />

      {/* 換季整理 */}
      <View style={{ marginTop: 16, backgroundColor: c.card, padding: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Serif size={18}>換季整理</Serif>
          <Txt size={12} tone="mute">{`目前：${SEASON_NAME[season] ?? ''}${me?.currentSeason ? '' : '（依月份自動）'}`}</Txt>
        </View>
        <View style={{ marginTop: 10 }}>
          <Segmented<Season> label="目前季節" options={SEASON_OPTIONS} value={season as Season} onChange={pickSeason} height={44} />
        </View>
        {me?.currentSeason ? (
          <Pressable
            onPress={() => updateSettings({ currentSeason: null }).catch((e) => showAlert('設定失敗', e.message))}
            accessibilityRole="button"
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Txt size={12} tone="mute" style={{ textDecorationLine: 'underline' }}>改回依月份自動判斷</Txt>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 10 }}>
          <Txt size={13} style={{ flex: 1, lineHeight: 21 }}>
            {strayItems.length > 0 ? (
              <>
                季外衣物 <Txt size={13} tone="accent" bold>{`${strayItems.length} 件`}</Txt>
                {'不在換季收納處，推薦不會再出現它們。'}
              </>
            ) : (
              '季外衣物都已收好，沒有要整理的。'
            )}
          </Txt>
          {strayItems.length > 0 ? (
            <Button label="移到收納箱" height={44} loading={moving} onPress={openMove} />
          ) : null}
        </View>
      </View>

      {/* 收納位置 */}
      <SectionHeader title="收納位置" link="管理" onLink={() => router.push('/storage')} style={{ marginTop: 18 }} />
      {locations.length === 0 && (locData?.unassignedCount ?? 0) === 0 ? (
        <Txt tone="mute" style={{ paddingVertical: 12 }}>還沒有收納位置</Txt>
      ) : null}
      {locations.map((l) => (
        <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Txt size={13} numberOfLines={1} style={{ width: 110 }}>{l.name}</Txt>
          <BarMeter ratio={totalItems ? l.itemCount / totalItems : 0} />
          <Numeral size={17} style={{ width: 40, textAlign: 'right' }}>{String(l.itemCount)}</Numeral>
        </View>
      ))}
      {(locData?.unassignedCount ?? 0) > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Txt size={13} tone="mute" style={{ width: 110 }}>未指定位置</Txt>
          <BarMeter ratio={totalItems ? (locData?.unassignedCount ?? 0) / totalItems : 0} />
          <Numeral size={17} tone="mute" style={{ width: 40, textAlign: 'right' }}>{String(locData?.unassignedCount ?? 0)}</Numeral>
        </View>
      ) : null}

      {/* 洗衣籃 */}
      <ListRow
        minHeight={48}
        onPress={() => router.push('/laundry')}
        left={<Txt size={13}>洗衣籃</Txt>}
        right={
          <Txt size={13}>
            <Txt size={13} tone="accent" bold>{`待洗 ${dirty}`}</Txt>
            <Txt size={13} tone="mute">{` · 送洗中 ${cleaning}`}</Txt>
          </Txt>
        }
      />

      {/* 選單 */}
      <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: c.ink }}>
        <ListRow
          index="01"
          onPress={() => router.push('/home-city')}
          left={<Txt size={14}>常用城市</Txt>}
          right={<Txt size={12} tone="mute">{me?.homeCity ?? '未設定，預設台北'}</Txt>}
        />
        <ListRow index="02" onPress={() => router.push('/analytics')} left={<Txt size={14}>統計分析</Txt>} right={<Txt size={12} tone="mute">每次成本、品牌</Txt>} />
        <ListRow index="03" onPress={() => router.push('/declutter')} left={<Txt size={14}>斷捨離</Txt>} right={<Txt size={12} tone="mute">整理建議</Txt>} />
        {backfill?.enabled ? (
          <ListRow
            index="04"
            onPress={() => router.push('/tidy-photos')}
            left={<Txt size={14}>整理舊照片</Txt>}
            right={<Txt size={12} tone="mute">{backfill.job?.running ? '整理中' : backfill.remaining > 0 ? `${backfill.remaining} 張未去背` : '都已去背'}</Txt>}
          />
        ) : null}
        <ListRow index={backfill?.enabled ? '05' : '04'} onPress={cycleTheme} left={<Txt size={14}>外觀</Txt>} right={<Txt size={12} tone="mute">{`${THEME_LABEL[mode]}，點一下切換`}</Txt>} />
        <ListRow
          index={backfill?.enabled ? '06' : '05'}
          chevron={false}
          left={<Txt size={14}>穿後自動標記待洗</Txt>}
          right={
            <View style={{ width: 120 }}>
              <Segmented<'on' | 'off'>
                label="穿後自動標記待洗"
                height={40}
                value={me?.autoDirtyOnWear === false ? 'off' : 'on'}
                onChange={(v) => updateSettings({ autoDirtyOnWear: v === 'on' }).catch((e) => showAlert('設定失敗', e.message))}
                options={[{ value: 'on', label: '開' }, { value: 'off', label: '關' }]}
              />
            </View>
          }
          minHeight={56}
        />
        <ListRow index={backfill?.enabled ? '07' : '06'} onPress={handleLogout} left={<Txt size={14}>登出</Txt>} right={<Txt size={12} tone="mute">{user?.email ?? ''}</Txt>} last />
      </View>

      <PickerSheet
        visible={moveSheet}
        title={`把 ${strayItems.length} 件季外衣物移到`}
        options={offLocations.map((l) => ({ value: l.id, label: l.name, hint: `目前 ${l.itemCount} 件` }))}
        onSelect={doMove}
        onClose={() => setMoveSheet(false)}
        footer={
          <Pressable
            onPress={() => { setMoveSheet(false); router.push('/storage'); }}
            accessibilityRole="button"
            style={{ minHeight: 52, paddingHorizontal: 20, justifyContent: 'center' }}
          >
            <Txt size={13} tone="mute" style={{ textDecorationLine: 'underline' }}>管理收納位置</Txt>
          </Pressable>
        }
      />
    </Screen>
  );
}
