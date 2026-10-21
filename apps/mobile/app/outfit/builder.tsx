import { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel, OccasionLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import {
  TopBar, Txt, Serif, Numeral, FieldRow, TextField, MultiChipGroup, Button, GarmentTile, SectionHeader,
} from '@/components/ui';

const PAGE_SIZE = 100;
const CATEGORY_TABS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: '全部' },
  ...Object.entries(ClothingCategoryLabel).map(([key, label]) => ({ key, label })),
];

export default function OutfitBuilderScreen() {
  const c = useColors();
  const [name, setName] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['items-builder'],
    queryFn: ({ pageParam = 1 }) => api(`/api/items?limit=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage]);

  const allItems: any[] = data?.pages.flatMap((p: any) => p.items) ?? [];
  const total = data?.pages[0]?.pagination?.total ?? 0;
  const items = selectedCategory ? allItems.filter((i) => i.category === selectedCategory) : allItems;

  const toggleItem = (id: string) =>
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));

  const handleSave = async () => {
    if (selectedItems.length === 0) {
      showAlert('提示', '請至少選擇一件衣物');
      return;
    }
    setLoading(true);
    try {
      await api('/api/outfits', {
        method: 'POST',
        body: JSON.stringify({ name: name || undefined, itemIds: selectedItems, occasions, seasons: [], rating }),
      });
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      showAlert('成功', '穿搭已儲存');
      router.back();
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="NEW LOOK" title="新穿搭" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <FieldRow label="名稱">
            <TextField serif value={name} onChangeText={setName} placeholder="例：上班日常穿搭" accessibilityLabel="穿搭名稱" />
          </FieldRow>

          {/* 已選 */}
          <SectionHeader title={`已選 ${selectedItems.length} 件`} style={{ marginTop: 18 }} />
          {selectedItems.length === 0 ? (
            <Txt size={13} tone="mute" style={{ paddingVertical: 12 }}>從下方挑選衣物，點一下加入。</Txt>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
              {selectedItems.map((itemId) => {
                const item = allItems.find((i) => i.id === itemId);
                if (!item) return null;
                return (
                  <Pressable key={itemId} onPress={() => toggleItem(itemId)} accessibilityRole="button" accessibilityLabel={`移除 ${item.name}`} style={{ width: 72 }}>
                    <GarmentTile path={item.images?.[0]?.thumbnailPath} height={72} />
                    <View style={{ position: 'absolute', right: 0, top: 0, width: 20, height: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={13} color={c.onInk} />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* 選擇衣物 */}
          <SectionHeader title="選擇衣物" link={isLoading ? '' : `${items.length} / ${total} 件${isFetchingNextPage ? ' · 載入中' : ''}`} style={{ marginTop: 14 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
            {CATEGORY_TABS.map((t) => {
              const on = selectedCategory === t.key;
              return (
                <Pressable
                  key={t.key ?? 'all'}
                  onPress={() => setSelectedCategory(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: on ? c.ink : 'transparent' }}
                >
                  <Txt size={14} tone={on ? 'ink' : 'mute'} bold={on} style={{ lineHeight: 20 }}>{t.label}</Txt>
                </Pressable>
              );
            })}
          </ScrollView>
          {isLoading ? (
            <ActivityIndicator color={c.ink} style={{ paddingVertical: 32 }} />
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {items.map((item) => {
                const on = selectedItems.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleItem(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item.name}
                    style={{ width: 80, borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.line }}
                  >
                    <GarmentTile path={item.images?.[0]?.thumbnailPath} height={76} dim={item.laundryStatus !== 'CLEAN'} />
                    {on ? (
                      <View style={{ position: 'absolute', right: 0, top: 0, width: 18, height: 18, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={12} color={c.onInk} />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <SectionHeader title="場合" style={{ marginTop: 22 }} />
          <View style={{ paddingTop: 10 }}>
            <MultiChipGroup
              items={OccasionLabel}
              selected={occasions}
              onToggle={(k) => setOccasions((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
            />
          </View>

          <SectionHeader title="評分" style={{ marginTop: 22 }} />
          <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const on = rating === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRating(on ? undefined : n)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n} 分`}
                  accessibilityState={{ selected: on }}
                  style={{ width: 48, height: 48, borderWidth: 1, borderColor: c.ink, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Numeral size={22} tone={on ? 'onInk' : 'ink'}>{String(n)}</Numeral>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <Button label={selectedItems.length ? `儲存穿搭（${selectedItems.length} 件）` : '儲存穿搭'} onPress={handleSave} loading={loading} />
        </View>
      </View>
    </View>
  );
}
