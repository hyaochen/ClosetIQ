import { useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel, ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useColors } from '@/lib/theme';
import { logWear, logDateKey } from '@/lib/queries';
import { imageUrl } from '@/lib/images';
import { exportOutfitPng } from '@/components/canvas/export';
import { primaryImage, trayThumbPath } from '@/components/canvas/canvas-utils';
import { showAlert, showConfirm } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { TopBar, Txt, Serif, Numeral, Eyebrow, Button, GarmentTile, SectionHeader, StatRow } from '@/components/ui';

export default function OutfitDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [wearLoading, setWearLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['outfits', id],
    queryFn: () => api(`/api/outfits/${id}`),
    enabled: !!id,
  });
  const outfit = data?.outfit;
  const totalWears: number | undefined = data?.outfit?._count?.wearLogs;

  const handleWearToday = async () => {
    if (!outfit) return;
    setWearLoading(true);
    try {
      const itemIds = outfit.items.map((oi: any) => oi.clothingItem?.id).filter(Boolean);
      await logWear({ outfitId: id, itemIds });
      queryClient.invalidateQueries({ queryKey: ['outfits', id] });
      showAlert('已記錄', '今天的穿搭已記錄。上衣、下身、洋裝與內衣褲會自動轉為待洗。');
    } catch (err: any) {
      showAlert('記錄失敗', err.message);
    } finally {
      setWearLoading(false);
    }
  };

  const handleExport = async () => {
    if (!outfit?.canvasLayout) {
      showAlert('尚未排版', '這套穿搭還沒有畫布版面，請先按「編輯畫布」排好再匯出。');
      return;
    }
    try {
      await exportOutfitPng(id, outfit.name || '穿搭');
    } catch (err: any) {
      showAlert('匯出失敗', err.message);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm('刪除穿搭', '確定要刪除這套穿搭嗎？');
    if (confirmed) {
      await api(`/api/outfits/${id}`, { method: 'DELETE' });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      router.back();
    }
  };

  if (isLoading || !outfit) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <TopBar eyebrow="LOOK" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {isLoading ? <ActivityIndicator color={c.ink} /> : <Txt tone="mute">找不到此穿搭</Txt>}
        </View>
      </View>
    );
  }

  const wearCount = totalWears ?? outfit.wearLogs?.length ?? 0;
  const itemCount = outfit.items?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="LOOK" title={outfit.name || '未命名穿搭'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 18 }}>
          <Eyebrow>OUTFIT</Eyebrow>
          <Serif size={28} letterSpacing={0.8} style={{ marginTop: 4, lineHeight: 35 }} accessibilityRole="header">{outfit.name || '未命名穿搭'}</Serif>

          {/* 封面：伺服器合成的拼貼圖（4:5）；還沒有版面時顯示空白底與引導 */}
          <View style={{ marginTop: 14, alignSelf: 'center', width: '100%', maxWidth: 420, aspectRatio: 4 / 5, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            {outfit.coverPath ? (
              <Image source={{ uri: imageUrl(outfit.coverPath) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} accessibilityLabel={`${outfit.name || '穿搭'} 封面`} accessibilityIgnoresInvertColors />
            ) : (
              <View style={{ alignItems: 'center', paddingHorizontal: 28, gap: 6 }}>
                <Ionicons name="grid-outline" size={28} color={c.mute} />
                <Txt size={13} tone="mute" style={{ textAlign: 'center' }}>這套穿搭還沒有拼貼封面。按「編輯畫布」排好版面並儲存。</Txt>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
            <Pressable onPress={handleExport} accessibilityRole="button" accessibilityLabel="匯出圖片" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 }}>
              <Ionicons name="download-outline" size={16} color={c.ink} />
              <Txt size={13} style={{ textDecorationLine: 'underline' }}>匯出圖片</Txt>
            </Pressable>
          </View>

          <View style={{ marginTop: 6 }}>
            <StatRow
              stats={[
                { value: itemCount, label: '件衣物' },
                { value: wearCount, label: '次穿著' },
                { value: outfit.rating ?? '-', label: '評分 / 5' },
              ]}
            />
          </View>

          <SectionHeader title="包含衣物" style={{ marginTop: 22 }} />
          {outfit.items?.map((oi: any) => {
            const item = oi.clothingItem;
            return (
              <Pressable
                key={oi.id}
                onPress={() => router.push(`/item/${item?.id}`)}
                accessibilityRole="button"
                accessibilityLabel={item?.name}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line, opacity: pressed ? 0.7 : 1 })}
              >
                <GarmentTile path={trayThumbPath(primaryImage(item))} height={60} style={{ width: 60 }} />
                <View style={{ flex: 1 }}>
                  <Serif size={15} medium numberOfLines={1}>{item?.name}</Serif>
                  <Txt size={12} tone="mute">{ClothingCategoryLabel[item?.category as keyof typeof ClothingCategoryLabel] || item?.category}</Txt>
                </View>
              </Pressable>
            );
          })}

          {outfit.occasions?.length > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line }}>
              <Txt size={13} tone="mute" letterSpacing={1.3}>適合場合</Txt>
              <Txt size={13}>{outfit.occasions.map((o: string) => OccasionLabel[o as keyof typeof OccasionLabel]).join(' · ')}</Txt>
            </View>
          ) : null}

          {outfit.wearLogs?.length > 0 ? (
            <>
              <SectionHeader title="穿著紀錄" style={{ marginTop: 22 }} />
              {outfit.wearLogs.map((log: any) => (
                <View key={log.id} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 38, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <Numeral size={16} tone="mute">{logDateKey(log.date).replace(/-/g, '.')}</Numeral>
                  {log.occasion ? <Txt size={13}>{OccasionLabel[log.occasion as keyof typeof OccasionLabel]}</Txt> : null}
                </View>
              ))}
            </>
          ) : null}

          {outfit.notes ? (
            <View style={{ marginTop: 18 }}>
              <Txt size={12} tone="mute" letterSpacing={1.3}>備註</Txt>
              <Txt size={14} style={{ marginTop: 4 }}>{outfit.notes}</Txt>
            </View>
          ) : null}

          <Pressable onPress={handleDelete} accessibilityRole="button" style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}>
            <Txt size={13} tone="accent" style={{ textDecorationLine: 'underline' }}>刪除這套穿搭</Txt>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="編輯畫布" variant="outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/outfit/canvas', params: { id } })} />
            <Button label="今天穿了這套" style={{ flex: 1.4 }} onPress={handleWearToday} loading={wearLoading} />
          </View>
        </View>
      </View>
    </View>
  );
}
