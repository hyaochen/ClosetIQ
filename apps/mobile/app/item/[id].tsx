import { useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  ClothingCategoryLabel,
  ColorFamilyLabel,
  PatternLabel,
  SeasonLabel,
  OccasionLabel,
  ConditionLabel,
  costPerWear,
  type LaundryStatus,
} from '@closet/shared';
import { api } from '@/lib/api';
import { imageUrl, fullImage } from '@/lib/images';
import { recutout } from '@/lib/cutout';
import { queryClient } from '@/lib/query-client';
import { useColors } from '@/lib/theme';
import { logWear, setLaundryStatus, localDateString, logDateKey, useEffectiveSeason, itemIsOffSeason } from '@/lib/queries';
import { showAlert, showConfirm } from '@/lib/alert';
import {
  TopBar, IconButton, Txt, Serif, Numeral, Eyebrow, Segmented, StatRow, SpecRow, Button, StatusTag, SectionHeader,
} from '@/components/ui';

function daysAgo(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.max(0, Math.round((today - then) / 86400000));
}

export default function ItemDetailScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const colW = Math.min(width, 560);
  const season = useEffectiveSeason();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wearLoading, setWearLoading] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['items', id],
    queryFn: () => api(`/api/items/${id}`),
    enabled: !!id,
    // 有照片正在去背（5 分鐘內上傳的）就輪詢，完成後主圖自動換成去背圖
    refetchInterval: (q) =>
      ((q.state.data as any)?.item?.images ?? []).some(
        (i: any) => i.cutoutStatus === 'PENDING' && Date.now() - new Date(i.createdAt).getTime() < 5 * 60_000
      )
        ? 1500
        : false,
  });
  const item = data?.item;
  const [recutting, setRecutting] = useState(false);

  const handleRecutout = async (imageId: string) => {
    setRecutting(true);
    try {
      await recutout(imageId);
      await queryClient.invalidateQueries({ queryKey: ['items', id] });
    } catch (err: any) {
      showAlert('重新去背失敗', err.message);
    } finally {
      setRecutting(false);
    }
  };

  const pickLaundry = async (status: LaundryStatus) => {
    if (!id) return;
    try {
      await setLaundryStatus([id], status);
      queryClient.invalidateQueries({ queryKey: ['items', id] });
    } catch (err: any) {
      showAlert('更新失敗', err.message);
    }
  };

  const handleWearToday = async () => {
    if (!id) return;
    setWearLoading(true);
    try {
      await logWear({ itemIds: [id] });
      queryClient.invalidateQueries({ queryKey: ['items', id] });
      showAlert('已記錄', '今天的穿著已記錄。上衣、下身、洋裝與內衣褲會自動轉為待洗。');
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setWearLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('斷捨離', '要將這件衣物移至斷捨離嗎？');
    if (confirmed) {
      await api(`/api/items/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['laundry'] });
      router.back();
    }
  };

  if (isLoading || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <TopBar eyebrow="ITEM" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {isLoading ? <ActivityIndicator color={c.ink} /> : <Txt tone="mute">找不到此衣物</Txt>}
        </View>
      </View>
    );
  }

  const wearCount = item._count?.wearLogItems ?? 0;
  const cpw = costPerWear(item.purchasePrice ? Number(item.purchasePrice) : null, wearCount);
  const lastLog = item.wearLogItems?.[0]?.wearLog;
  const lastAgo = lastLog ? daysAgo(logDateKey(lastLog.date)) : null;
  const recentWears = (item.wearLogItems ?? []).map((w: any) => w.wearLog);
  const off = itemIsOffSeason(item, season);
  const images: any[] = item.images ?? [];
  const catLabel = ClothingCategoryLabel[item.category as keyof typeof ClothingCategoryLabel];

  const metaLine = [
    item.brand,
    item.size,
    item.purchaseDate ? `${new Date(item.purchaseDate).getFullYear()}.${String(new Date(item.purchaseDate).getMonth() + 1).padStart(2, '0')} 購入` : null,
    item.purchasePrice ? `NT$${Number(item.purchasePrice).toLocaleString()}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar
        eyebrow={`ITEM No. ${String(item.id).slice(0, 4).toUpperCase()}`}
        backLabel="返回"
        right={<IconButton name="create-outline" label="編輯" size={20} onPress={() => router.push(`/item/edit?id=${id}`)} />}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {/* 圖片 */}
          <View style={{ height: 292, backgroundColor: c.card }}>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / colW))}
                scrollEventThrottle={50}
              >
                {images.map((img: any) => {
                  // 主圖優先用去背圖（放在卡色底上），否則用顯示版原圖
                  const shown = fullImage(img);
                  return (
                    <View key={img.id} style={{ width: colW, height: 292, alignItems: 'center', justifyContent: 'center' }}>
                      {shown.path ? (
                        <Image
                          source={{ uri: imageUrl(shown.path) }}
                          style={{ width: '100%', height: '100%', opacity: off ? 0.8 : 1 }}
                          contentFit="contain"
                          accessibilityIgnoresInvertColors
                        />
                      ) : null}
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="shirt-outline" size={64} color={c.mute} />
              </View>
            )}
            {images.length > 1 ? (
              <View style={{ position: 'absolute', right: 14, bottom: 10 }}>
                <Numeral size={16}>{`${imgIndex + 1} / ${images.length}`}</Numeral>
              </View>
            ) : null}
            {off ? (
              <View style={{ position: 'absolute', left: 12, top: 12 }}>
                <StatusTag kind="OFF_SEASON" />
              </View>
            ) : null}
            {images[imgIndex] ? (
              <View style={{ position: 'absolute', left: 14, bottom: 4 }}>
                {images[imgIndex].cutoutStatus === 'PENDING' ? (
                  <View style={{ minHeight: 36, justifyContent: 'center' }}>
                    <Txt size={12} tone="mute">去背處理中</Txt>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => handleRecutout(images[imgIndex].id)}
                    disabled={recutting}
                    accessibilityRole="button"
                    accessibilityLabel="重新去背"
                    hitSlop={6}
                    style={{ minHeight: 36, justifyContent: 'center', opacity: recutting ? 0.5 : 1 }}
                  >
                    <Txt size={12} style={{ textDecorationLine: 'underline' }}>{images[imgIndex].cutoutStatus === 'DONE' ? '重新去背' : '去背'}</Txt>
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Eyebrow>{`${catLabel}${item.subcategory && item.subcategory !== catLabel ? ` · ${item.subcategory}` : ''} · ${item.category}`}</Eyebrow>
            <Serif size={26} letterSpacing={0.8} style={{ marginTop: 4, lineHeight: 33 }} accessibilityRole="header">{item.name}</Serif>
            {metaLine ? <Txt size={12} tone="mute" style={{ marginTop: 2 }}>{metaLine}</Txt> : null}

            {/* 洗衣狀態 */}
            <View style={{ marginTop: 14 }}>
              <Segmented<LaundryStatus>
                label="洗衣狀態"
                height={44}
                value={(item.laundryStatus as LaundryStatus) ?? 'CLEAN'}
                onChange={pickLaundry}
                options={[
                  { value: 'CLEAN', label: '乾淨' },
                  { value: 'DIRTY', label: '待洗', activeBg: c.accent, activeFg: c.onAccent },
                  { value: 'CLEANING', label: '送洗中', activeBg: c.olive, activeFg: c.onOlive },
                ]}
              />
            </View>

            <View style={{ marginTop: 14 }}>
              <StatRow
                stats={[
                  { value: wearCount, label: '次穿著' },
                  { value: cpw !== null ? Math.round(cpw) : '-', label: 'NT$／次' },
                  { value: lastAgo !== null ? lastAgo : '-', label: lastAgo === 0 ? '今天穿過' : '天前穿過' },
                ]}
              />
            </View>

            <View style={{ marginTop: 4 }}>
              {item.material ? <SpecRow label="材質" value={item.material} /> : null}
              <SpecRow label="季節" value={item.seasons.map((s: string) => SeasonLabel[s as keyof typeof SeasonLabel]).join(' · ') || '不限'} />
              <SpecRow label="場合" value={item.occasions.map((o: string) => OccasionLabel[o as keyof typeof OccasionLabel]).join(' · ') || '不限'} />
              <SpecRow label="色系" value={`${ColorFamilyLabel[item.colorFamily as keyof typeof ColorFamilyLabel]} · ${PatternLabel[item.pattern as keyof typeof PatternLabel]}`} />
              <SpecRow label="狀況" value={ConditionLabel[item.condition as keyof typeof ConditionLabel]} />
              <SpecRow label="收納" value={item.storageLocation?.name ?? '未指定'} last={!item.notes} />
              {item.notes ? <SpecRow label="備註" value={item.notes} last /> : null}
            </View>

            {recentWears.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <SectionHeader title="最近穿著" />
                {recentWears.map((log: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 38, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.line }}>
                    <Txt size={13} tone="mute">{logDateKey(log.date).replace(/-/g, '.')}</Txt>
                    {log.occasion ? <Txt size={13}>{OccasionLabel[log.occasion as keyof typeof OccasionLabel] || log.occasion}</Txt> : null}
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable onPress={handleDelete} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}>
              <Txt size={13} tone="accent" style={{ textDecorationLine: 'underline' }}>移至斷捨離</Txt>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* 固定底欄 */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <Button label="放進穿搭" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/outfit/builder')} />
          <Button label="今天穿它" style={{ flex: 1.4 }} onPress={handleWearToday} loading={wearLoading} />
        </View>
      </View>
    </View>
  );
}
