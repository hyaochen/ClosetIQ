import { useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ClothingCategoryLabel, type WishlistSimilarItem } from '@closet/shared';
import { api } from '@/lib/api';
import { tileUrl, useImagesVersion } from '@/lib/images';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { invalidateWardrobe } from '@/lib/queries';
import { queryClient } from '@/lib/query-client';
import {
  useWishlistItem, useWishlistAnalysis, useWardrobeGaps, invalidateWishlist, formatPrice, formatMonthDay,
  scoreVerdict, WISHLIST_STATUS_LABEL, MIN_RELIABLE_CONSIDERED,
} from '@/lib/wishlist';
import {
  Screen, TopBar, IconButton, Txt, Serif, Numeral, Button, GarmentTile, BarMeter, Hairline,
} from '@/components/ui';
import { GapList, openExternalUrl } from '@/components/wishlist/parts';

const MAX_SIMILAR_SHOWN = 4;

export default function WishlistDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isLoading, isError } = useWishlistItem(id);
  const analysisOn = !!item && item.status !== 'BOUGHT';
  const { data: analysis, isLoading: analysisLoading, isError: analysisError } = useWishlistAnalysis(id, analysisOn);
  const { data: gaps = [] } = useWardrobeGaps();
  const [busy, setBusy] = useState<null | 'drop' | 'buy' | 'restore'>(null);

  const goList = () => router.replace('/(tabs)/wardrobe?tab=wishlist');

  const drop = async () => {
    if (!(await showConfirm('不買了', '會保留在「不買了」分類，之後還能改回想買。'))) return;
    setBusy('drop');
    try {
      await api(`/api/wishlist/${id}/drop`, { method: 'POST' });
      invalidateWishlist();
      goList();
    } catch (e: any) {
      showAlert('操作失敗', e.message);
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    setBusy('restore');
    try {
      await api(`/api/wishlist/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'WANT' }) });
      invalidateWishlist();
    } catch (e: any) {
      showAlert('操作失敗', e.message);
    } finally {
      setBusy(null);
    }
  };

  const buy = async () => {
    if (!item) return;
    const price = formatPrice(item.price);
    const ok = await showConfirm('買了，移進衣櫃', `會把「${item.name}」${price ? `（${price}）` : ''}新增為衣物，並帶入照片與價格。`);
    if (!ok) return;
    setBusy('buy');
    try {
      const res = await api('/api/wishlist/' + id + '/purchase', { method: 'POST', body: JSON.stringify({}) });
      invalidateWishlist();
      invalidateWardrobe();
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      router.replace(`/item/${res.item.id}`);
      showAlert(
        '已移進衣櫃',
        item.imageThumbnailPath
          ? '照片與價格已帶入。可以在衣物頁補更多照片，或做去背讓衣櫃圖更乾淨。'
          : '這件還沒有照片，可以在衣物頁補拍照片，再做去背。'
      );
    } catch (e: any) {
      showAlert('操作失敗', e.message);
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <TopBar eyebrow="購前分析" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.ink} /></View>
      </View>
    );
  }
  if (isError || !item) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <TopBar eyebrow="購前分析" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 }}>
          <Txt tone="mute">找不到這個願望清單項目</Txt>
          <Button label="回願望清單" variant="outline" onPress={goList} />
        </View>
      </View>
    );
  }

  const price = formatPrice(item.price);
  const catLabel = ClothingCategoryLabel[item.category as keyof typeof ClothingCategoryLabel] ?? item.category;
  
  const similar = analysis?.similarItems ?? [];
  const strong = similar.filter((s) => s.matchType === 'COLOR');
  const weak = similar.filter((s) => s.matchType !== 'COLOR');
  const lowData = !!analysis && analysis.totalConsidered < MIN_RELIABLE_CONSIDERED;
  // 樣本太少時不給入手建議，只標示僅供參考
  const verdict = analysis ? (lowData ? { label: '樣本少，僅供參考', warn: false } : scoreVerdict(analysis.score)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar
        eyebrow="購前分析"
        right={item.status === 'BOUGHT' ? undefined : <IconButton name="create-outline" label="編輯" onPress={() => router.push(`/wishlist/edit?id=${item.id}`)} />}
      />
      <Screen bottomPad={40} contentStyle={{ paddingTop: 0 }}>
        {/* 上：圖 + 資訊 */}
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
          <View style={{ width: 116, height: 136 }}>
            <GarmentTile path={item.imageDisplayPath ?? item.imageThumbnailPath} fill />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={11} tone="mute" letterSpacing={1.9} style={{ lineHeight: 16 }}>{catLabel} · {WISHLIST_STATUS_LABEL[item.status]}</Txt>
            <Serif size={19} style={{ marginTop: 2 }}>{item.name}</Serif>
            {price ? <Numeral size={22} style={{ marginTop: 2 }}>{price}</Numeral> : <Txt size={12} tone="mute">未填價格</Txt>}
            <View style={{ flex: 1 }} />
            <Txt size={12} tone="mute" style={{ lineHeight: 18 }}>{formatMonthDay(item.createdAt)} 加入</Txt>
            {item.url ? (
              <Pressable
                onPress={() => openExternalUrl(item.url as string)}
                accessibilityRole="link"
                accessibilityLabel="開啟商品連結"
                hitSlop={{ top: 8, bottom: 8 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 }}
              >
                <Txt size={12} style={{ textDecorationLine: 'underline', lineHeight: 18 }}>商品連結</Txt>
                <Ionicons name="open-outline" size={12} color={c.ink} />
              </Pressable>
            ) : null}
          </View>
        </View>
        {item.note ? <Txt size={12} tone="mute" style={{ marginTop: 10 }}>{item.note}</Txt> : null}

        {item.status === 'BOUGHT' ? (
          <View style={{ marginTop: 18, gap: 12 }}>
            <Hairline tone="ink" />
            <Serif size={17}>已移進衣櫃</Serif>
            <Txt size={13} tone="mute">這個項目已經買入，之後的穿著與管理請到衣物頁。</Txt>
            {item.boughtItemId ? <Button label="查看衣物" variant="outline" onPress={() => router.push(`/item/${item.boughtItemId}`)} /> : null}
          </View>
        ) : (
          <>
            {/* 能搭配幾件 */}
            <Hairline tone="ink" style={{ marginTop: 16 }} />
            {analysisLoading ? (
              <View style={{ paddingVertical: 28 }}><ActivityIndicator color={c.ink} /></View>
            ) : analysisError || !analysis ? (
              <View style={{ paddingVertical: 20 }}><Txt tone="mute" size={13}>購前分析暫時算不出來，稍後再試。</Txt></View>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 10, paddingBottom: 6 }}>
                  <Numeral size={56} style={{ lineHeight: 58 }} accessibilityLabel={`${analysis.compatibleCount} 件`}>{String(analysis.compatibleCount)}</Numeral>
                  <Txt size={13} style={{ paddingBottom: 4, flex: 1 }}>件現有衣物能和它搭配</Txt>
                </View>

                {lowData ? (
                  <View style={{ marginTop: 12, padding: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink }}>
                    <Txt size={12} style={{ lineHeight: 19 }}>
                      衣櫃裡能與它搭的類別只有 {analysis.totalConsidered} 件衣物，樣本太少，分數與搭配數只能參考。多登錄一些衣物後會準得多。
                    </Txt>
                  </View>
                ) : null}

                {analysis.byCategory.some((b) => b.total > 0) ? (
                  <View style={{ gap: 6, marginTop: 10 }}>
                    {analysis.byCategory.filter((b) => b.total > 0).map((b) => (
                      <View key={b.category} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 20 }}>
                        <Txt size={12} tone="mute" style={{ width: 34, lineHeight: 18 }}>
                          {b.category === 'DRESS' ? '洋裝' : ClothingCategoryLabel[b.category as keyof typeof ClothingCategoryLabel] ?? b.category}
                        </Txt>
                        <BarMeter ratio={b.total ? b.compatible / b.total : 0} height={8} />
                        <Txt size={12} style={{ width: 44, textAlign: 'right', lineHeight: 18 }}>{b.compatible} / {b.total}</Txt>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* 相似單品警示 */}
                {similar.length > 0 ? (
                  <View style={{ marginTop: 14, borderWidth: 1, borderColor: c.accent, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Txt size={12} style={{ lineHeight: 19 }}>
                      <Txt size={12} tone="accent" bold>相似單品 {similar.length} 件</Txt>
                      ：{similarSentence(strong, weak)}
                    </Txt>
                    <View style={{ marginTop: 6 }}>
                      {similar.slice(0, MAX_SIMILAR_SHOWN).map((s, i, arr) => (
                        <SimilarRow key={s.id} s={s} last={i === arr.length - 1} />
                      ))}
                      {similar.length > MAX_SIMILAR_SHOWN ? (
                        <Txt size={11} tone="mute" style={{ marginTop: 4 }}>另有 {similar.length - MAX_SIMILAR_SHOWN} 件</Txt>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={{ marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.line, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Ionicons name="checkmark" size={16} color={c.ink} />
                    <Txt size={12} style={{ flex: 1 }}>衣櫃裡沒有相似單品，不會買重。</Txt>
                  </View>
                )}

                {/* 分數與理由 */}
                <Hairline tone="ink" style={{ marginTop: 18 }} />
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 8 }}>
                  <Txt size={12} tone="mute" letterSpacing={1.2} style={{ paddingBottom: 6 }}>購前分數</Txt>
                  <Numeral size={40} tone={verdict?.warn ? 'accent' : 'ink'} style={{ lineHeight: 40 }}>{String(analysis.score)}</Numeral>
                  <Txt size={12} tone="mute" style={{ paddingBottom: 6 }}>/ 100</Txt>
                  <View style={{ flex: 1 }} />
                  {verdict ? (
                    <Txt size={13} bold tone={verdict.warn ? 'accent' : 'ink'} style={{ paddingBottom: 5 }}>{verdict.label}</Txt>
                  ) : null}
                </View>
                {analysis.reasons.length > 0 ? (
                  <View style={{ marginTop: 6 }}>
                    {analysis.reasons.map((r, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 10, minHeight: 40, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.line, alignItems: 'flex-start' }}>
                        <Numeral size={15} tone="mute" style={{ width: 16, lineHeight: 22 }}>{String(i + 1)}</Numeral>
                        <Txt size={13} style={{ flex: 1, lineHeight: 21 }}>{r}</Txt>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            )}

            {/* 動作 */}
            {item.status === 'WANT' ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Button label="不買了" variant="outline" onPress={drop} loading={busy === 'drop'} disabled={busy !== null} height={46} style={{ flex: 1 }} />
                <Button label="買了，移進衣櫃" onPress={buy} loading={busy === 'buy'} disabled={busy !== null} height={46} style={{ flex: 1.4 }} />
              </View>
            ) : (
              <View style={{ marginTop: 16, gap: 10 }}>
                <Txt size={12} tone="mute">這個項目已標記為「不買了」。</Txt>
                <Button label="改回想買" variant="outline" onPress={restore} loading={busy === 'restore'} disabled={busy !== null} height={46} />
              </View>
            )}
          </>
        )}

        {/* 衣櫃缺口 */}
        <View style={{ marginTop: 22 }}>
          <GapList gaps={gaps} />
        </View>
      </Screen>
    </View>
  );
}

function similarSentence(strong: WishlistSimilarItem[], weak: WishlistSimilarItem[]): string {
  const parts: string[] = [];
  if (strong.length > 0) {
    const recent = strong.reduce((sum, s) => sum + s.recentWearCount, 0);
    parts.push(`你已有 ${strong.length} 件同類別同色系的衣物，近 90 天共穿 ${recent} 次。`);
  }
  if (weak.length > 0) parts.push(`另有 ${weak.length} 件同款式但不同色。`);
  return parts.join('');
}

function SimilarRow({ s, last }: { s: WishlistSimilarItem; last: boolean }) {
  useImagesVersion();
  const c = useColors();
  return (
    <Pressable
      onPress={() => router.push(`/item/${s.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${s.name}，近 90 天穿 ${s.recentWearCount} 次，查看衣物`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: MIN_TOUCH + 4, paddingVertical: 4,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line, opacity: pressed ? 0.65 : 1,
      })}
    >
      <View style={{ width: 40, height: 46, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {s.thumbnail ? (
          <Image source={{ uri: tileUrl(s.thumbnail) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
        ) : (
          <Ionicons name="shirt-outline" size={18} color={c.mute} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={13} numberOfLines={1}>{s.name}</Txt>
        <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>
          {s.matchType === 'COLOR' ? '同色系' : '同款式不同色'} · 近 90 天穿 {s.recentWearCount} 次
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={14} color={c.ink} />
    </Pressable>
  );
}
