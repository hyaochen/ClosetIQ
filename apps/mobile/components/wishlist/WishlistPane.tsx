import { useState, useMemo } from 'react';
import { View, FlatList, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ClothingCategoryLabel, type WishlistStatus } from '@closet/shared';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { Txt, Serif, Numeral, Chip, GarmentTile, Button } from '@/components/ui';
import {
  useWishlist, useWishlistScores, useWardrobeGaps, WISHLIST_STATUS_LABEL, formatPrice, formatMonthDay, scoreVerdict,
  type WishlistItem,
} from '@/lib/wishlist';
import { WardrobeSegment, GapList } from './parts';

const STATUSES: WishlistStatus[] = ['WANT', 'BOUGHT', 'DROPPED'];

/** 衣櫃分頁的「願望清單」面板：標題、分段、狀態篩選、卡片列表、空狀態 */
export function WishlistPane({ onSwitch }: { onSwitch: (m: 'items' | 'wishlist') => void }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const [status, setStatus] = useState<WishlistStatus>('WANT');
  const { data, isLoading, isError, refetch } = useWishlist();
  const { data: gaps = [] } = useWardrobeGaps();

  const all = data ?? [];
  const counts = useMemo(() => {
    const m: Record<WishlistStatus, number> = { WANT: 0, BOUGHT: 0, DROPPED: 0 };
    all.forEach((w) => { m[w.status] += 1; });
    return m;
  }, [all]);
  const shown = all.filter((w) => w.status === status);
  const scores = useWishlistScores(status === 'WANT' ? shown.map((w) => w.id) : []);

  const maxWidth = 560;
  const fabRight = Math.max(20, (width - maxWidth) / 2 + 20);

  const header = (
    <View>
      <View style={{ height: 22 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Serif size={34} letterSpacing={1.4} accessibilityRole="header">衣櫃</Serif>
          <Numeral size={18} tone="mute">wishlist</Numeral>
        </View>
      </View>
      <WardrobeSegment mode="wishlist" wishCount={counts.WANT} onChange={onSwitch} />
      {all.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 12, alignItems: 'center' }}>
          {STATUSES.map((s) => (
            <Chip key={s} label={`${WISHLIST_STATUS_LABEL[s]} ${counts[s]}`} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  let empty: React.ReactNode = null;
  if (isLoading) {
    empty = <View style={{ paddingVertical: 48 }}><ActivityIndicator color={c.ink} /></View>;
  } else if (isError) {
    empty = (
      <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
        <Txt tone="mute">讀取願望清單失敗</Txt>
        <Button label="重試" variant="outline" onPress={() => refetch()} />
      </View>
    );
  } else if (all.length === 0) {
    empty = (
      <View style={{ paddingTop: 20, gap: 22 }}>
        <View style={{ borderTopWidth: 1, borderTopColor: c.ink, paddingTop: 14, gap: 8 }}>
          <Serif size={22}>還沒有想買的東西</Serif>
          <Txt size={13} tone="mute">
            看到想買的衣服，先記在這裡。{'\n'}App 會告訴你它和衣櫃裡幾件衣物能搭配、有沒有買重，也會列出衣櫃目前缺什麼。
          </Txt>
          <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
            <Button label="新增第一個項目" icon="add" onPress={() => router.push('/wishlist/add')} />
          </View>
        </View>
        <View>
          <Txt size={12} tone="mute" letterSpacing={1.2} style={{ marginBottom: 6 }}>不知道買什麼？先看看衣櫃缺口</Txt>
          <GapList gaps={gaps} limit={3} />
        </View>
      </View>
    );
  } else if (shown.length === 0) {
    empty = (
      <View style={{ alignItems: 'center', paddingVertical: 40 }}>
        <Txt tone="mute">沒有「{WISHLIST_STATUS_LABEL[status]}」的項目</Txt>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 20 }}>
        <FlatList
          data={isLoading || isError ? [] : shown}
          keyExtractor={(w) => w.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <WishRow item={item} score={scores[item.id]} />}
        />
      </View>
      <Pressable
        onPress={() => router.push('/wishlist/add')}
        accessibilityRole="button"
        accessibilityLabel="新增願望清單項目"
        style={({ pressed }) => ({
          position: 'absolute', right: fabRight, bottom: 20, width: 56, height: 56,
          backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="add" size={26} color={c.onInk} />
      </Pressable>
    </View>
  );
}

function WishRow({ item, score }: { item: WishlistItem; score?: number }) {
  const c = useColors();
  const price = formatPrice(item.price);
  const verdict = score !== undefined ? scoreVerdict(score) : null;
  const meta = `${formatMonthDay(item.createdAt)} 加入${item.url ? ' · 附商品連結' : ''}`;
  const dim = item.status !== 'WANT';
  return (
    <Pressable
      onPress={() => router.push(`/wishlist/${item.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}，${price ?? '未填價格'}${score !== undefined ? `，購前分數 ${score}` : ''}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1, flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, minHeight: MIN_TOUCH })}
    >
      <View style={{ width: 96, height: 116 }}>
        <GarmentTile path={item.imageThumbnailPath} fill dim={dim} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={11} tone="mute" letterSpacing={1.9} style={{ lineHeight: 16 }}>
          {ClothingCategoryLabel[item.category as keyof typeof ClothingCategoryLabel] ?? item.category} · {WISHLIST_STATUS_LABEL[item.status]}
        </Txt>
        <Serif size={17} numberOfLines={2} style={{ marginTop: 2 }}>{item.name}</Serif>
        {price ? <Numeral size={20} style={{ marginTop: 2 }}>{price}</Numeral> : <Txt size={12} tone="mute" style={{ marginTop: 4 }}>未填價格</Txt>}
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <Txt size={11} tone="mute" style={{ lineHeight: 16, flexShrink: 1 }} numberOfLines={1}>{meta}</Txt>
          {verdict ? (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Txt size={11} tone={verdict.warn ? 'accent' : 'mute'} style={{ lineHeight: 16 }}>購前分數</Txt>
              <Numeral size={22} tone={verdict.warn ? 'accent' : 'ink'}>{String(score)}</Numeral>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

