import { useState, useCallback, useMemo, useEffect } from 'react';
import { View, ScrollView, Pressable, FlatList, ActivityIndicator, useWindowDimensions, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel, costPerWear } from '@closet/shared';
import { api } from '@/lib/api';
import { useColors, fonts } from '@/lib/theme';
import { useEffectiveSeason, itemIsOffSeason, useStorageLocations } from '@/lib/queries';
import { useWishlist } from '@/lib/wishlist';
import { WardrobeSegment } from '@/components/wishlist/parts';
import { WishlistPane } from '@/components/wishlist/WishlistPane';
import {
  Txt, Serif, Numeral, Chip, StatusTag, GarmentTile, Button, PickerSheet, IconButton,
} from '@/components/ui';

const PAGE_SIZE = 50;
const GAP = 12;

const CATEGORY_TABS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: '全部' },
  ...Object.entries(ClothingCategoryLabel).map(([key, label]) => ({ key, label })),
];

const SORTS = [
  { value: 'newest', label: '最新加入', sortBy: 'createdAt', sortOrder: 'desc' },
  { value: 'least', label: '最少穿在前', sortBy: 'wearCount', sortOrder: 'asc' },
  { value: 'most', label: '最多穿在前', sortBy: 'wearCount', sortOrder: 'desc' },
  { value: 'name', label: '名稱', sortBy: 'name', sortOrder: 'asc' },
  { value: 'price', label: '價格由高到低', sortBy: 'purchasePrice', sortOrder: 'desc' },
] as const;

export default function WardrobeScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [mode, setMode] = useState<'items' | 'wishlist'>(params.tab === 'wishlist' ? 'wishlist' : 'items');
  useEffect(() => {
    if (params.tab === 'wishlist') setMode('wishlist');
  }, [params.tab]);
  const { data: wishData } = useWishlist();
  const wishCount = (wishData ?? []).filter((w) => w.status === 'WANT').length;
  const season = useEffectiveSeason();
  const { data: locData } = useStorageLocations();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [cleanOnly, setCleanOnly] = useState(false);
  const [inSeasonOnly, setInSeasonOnly] = useState(false);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('newest');
  const [sheet, setSheet] = useState<null | 'location' | 'sort'>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchText.trim()), 300);
    return () => clearTimeout(t);
  }, [searchText]);

  const cols = width >= 1000 ? 4 : width >= 700 ? 3 : 2;
  const maxWidth = cols === 2 ? 560 : 960;
  const contentWidth = Math.min(width, maxWidth) - 40;
  const cardWidth = Math.floor((contentWidth - GAP * (cols - 1)) / cols);

  const sortDef = SORTS.find((s) => s.value === sort)!;

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['items', category ?? null, cleanOnly, inSeasonOnly, locationId ?? null, sort, search],
    queryFn: ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      if (cleanOnly) params.set('laundryStatus', 'CLEAN');
      if (inSeasonOnly) params.set('inSeason', 'true');
      if (locationId) params.set('storageLocationId', locationId);
      if (search) params.set('search', search);
      params.set('sortBy', sortDef.sortBy);
      params.set('sortOrder', sortDef.sortOrder);
      params.set('limit', String(PAGE_SIZE));
      params.set('page', String(pageParam));
      return api(`/api/items?${params.toString()}`);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  const items = data?.pages.flatMap((p: any) => p.items) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const locations = locData?.locations ?? [];
  const locationName = locations.find((l) => l.id === locationId)?.name;

  const header = useMemo(
    () => (
      <View>
        <View style={{ height: 22 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Serif size={34} letterSpacing={1.4} accessibilityRole="header">衣櫃</Serif>
            <Numeral size={18} tone="mute">{`${total} pieces`}</Numeral>
          </View>
          <IconButton name={searchOpen ? 'close' : 'search-outline'} label={searchOpen ? '關閉搜尋' : '搜尋'} onPress={() => { setSearchOpen((o) => !o); if (searchOpen) { setSearchText(''); } }} />
        </View>
        {searchOpen ? (
          <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink, marginTop: 4 }}>
            <TextInput
              autoFocus
              value={searchText}
              onChangeText={setSearchText}
              placeholder="搜尋名稱、品牌、備註"
              placeholderTextColor={c.mute}
              accessibilityLabel="搜尋衣物"
              style={{ minHeight: 44, fontSize: 15, color: c.ink, fontFamily: fonts.sans, paddingVertical: 6, outlineStyle: 'none' } as any}
            />
          </View>
        ) : null}
        <WardrobeSegment mode={mode} wishCount={wishCount} onChange={setMode} />

        {/* 分類文字分頁 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18, paddingTop: 4 }}>
          {CATEGORY_TABS.map((t) => {
            const on = category === t.key;
            return (
              <Pressable
                key={t.key ?? 'all'}
                onPress={() => setCategory(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: on ? c.ink : 'transparent' }}
              >
                <Txt size={14} tone={on ? 'ink' : 'mute'} bold={on} style={{ lineHeight: 20 }}>{t.label}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 篩選晶片 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10, alignItems: 'center' }}>
          <Chip label="乾淨" selected={cleanOnly} onPress={() => setCleanOnly((v) => !v)} />
          <Chip label="只看季內" selected={inSeasonOnly} onPress={() => setInSeasonOnly((v) => !v)} />
          <Chip
            label={locationName ?? '收納位置'}
            selected={!!locationId}
            onPress={() => setSheet('location')}
            trailing={<Ionicons name="chevron-down" size={12} color={locationId ? c.onInk : c.ink} />}
          />
          <Chip
            label={sortDef.label}
            onPress={() => setSheet('sort')}
            trailing={<Ionicons name="chevron-down" size={12} color={c.ink} />}
          />
        </ScrollView>
        <View style={{ height: 6 }} />
      </View>
    ),
    [total, searchOpen, searchText, category, cleanOnly, inSeasonOnly, locationId, locationName, sortDef.label, c, mode, wishCount]
  );

  const fabRight = Math.max(20, (width - maxWidth) / 2 + 20);

  // P6：願望清單分段（其餘 hooks 都已呼叫完，這裡才切換畫面）
  if (mode === 'wishlist') return <WishlistPane onSwitch={setMode} />;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ flex: 1, width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: 20 }}>
        {isLoading ? (
          <View style={{ flex: 1 }}>
            {header}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={c.ink} />
            </View>
          </View>
        ) : (
          <FlatList
            key={cols}
            data={items}
            numColumns={cols}
            keyExtractor={(item) => item.id}
            columnWrapperStyle={cols > 1 ? { gap: GAP } : undefined}
            contentContainerStyle={{ paddingBottom: 110, rowGap: 16 }}
            ListHeaderComponent={header}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 48, gap: 14 }}>
                <Ionicons name="shirt-outline" size={44} color={c.mute} />
                <Txt tone="mute" style={{ textAlign: 'center' }}>
                  {category || cleanOnly || inSeasonOnly || locationId || search ? '沒有符合條件的衣物' : '衣櫃裡還沒有衣物'}
                </Txt>
                <Button label="新增衣物" onPress={() => router.push('/item/add')} />
              </View>
            }
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={c.ink} style={{ paddingVertical: 16 }} /> : null}
            renderItem={({ item }) => {
              const off = itemIsOffSeason(item, season);
              const status = item.laundryStatus === 'DIRTY' ? 'DIRTY' : item.laundryStatus === 'CLEANING' ? 'CLEANING' : off ? 'OFF_SEASON' : null;
              const wears = item._count?.wearLogItems ?? 0;
              const cpw = costPerWear(item.purchasePrice ? Number(item.purchasePrice) : null, wears);
              const meta = wears === 0 ? '尚未穿過' : cpw !== null ? `穿 ${wears} 次 · NT$${Math.round(cpw)}／次` : `穿 ${wears} 次`;
              return (
                <Pressable
                  onPress={() => router.push(`/item/${item.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}，${meta}${status ? '，' + (status === 'DIRTY' ? '待洗' : status === 'CLEANING' ? '送洗中' : '季外') : ''}`}
                  style={({ pressed }) => ({ width: cardWidth, gap: 6, opacity: pressed ? 0.75 : 1 })}
                >
                  <GarmentTile
                    path={item.images?.[0]?.thumbnailPath}
                    image={item.images?.[0]}
                    height={176}
                    dim={off && !status}
                    overlay={status ? <StatusTag kind={status} /> : null}
                  />
                  <Serif size={14} medium numberOfLines={1}>{item.name}</Serif>
                  <Txt size={11} tone="mute" numberOfLines={1} style={{ marginTop: -4, lineHeight: 16 }}>{meta}</Txt>
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {/* 新增：方形墨色按鈕 */}
      <Pressable
        onPress={() => router.push('/item/add')}
        accessibilityRole="button"
        accessibilityLabel="新增衣物"
        style={({ pressed }) => ({
          position: 'absolute',
          right: fabRight,
          bottom: 20,
          width: 56,
          height: 56,
          backgroundColor: c.ink,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Ionicons name="add" size={26} color={c.onInk} />
      </Pressable>

      <PickerSheet
        visible={sheet === 'location'}
        title="收納位置"
        selected={locationId ?? ''}
        onClose={() => setSheet(null)}
        onSelect={(v) => { setLocationId(v || undefined); setSheet(null); }}
        options={[
          { value: '', label: '全部位置' },
          ...locations.map((l) => ({ value: l.id, label: l.name, hint: `${l.itemCount} 件${l.isOffSeason ? ' · 換季收納處' : ''}` })),
        ]}
      />
      <PickerSheet
        visible={sheet === 'sort'}
        title="排序"
        selected={sort}
        onClose={() => setSheet(null)}
        onSelect={(v) => { setSort(v as typeof sort); setSheet(null); }}
        options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
      />
    </View>
  );
}
