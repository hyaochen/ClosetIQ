import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ClothingCategoryLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { Txt, Serif, Button, Chip, GarmentTile, TextField } from '@/components/ui';

const PAGE_SIZE = 100;

/**
 * 補選衣物：全螢幕選擇器。搜尋 + 分類切換 + 多選衣物格。
 * initial = 目前已選；onConfirm 回傳最終選擇（可為空陣列）。
 */
export function ItemPicker({
  visible,
  initial,
  title = '選擇今天穿的衣物',
  confirmLabel = '完成',
  busy,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  initial: string[];
  title?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<string[]>(initial);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelected(initial);
      setSearch('');
      setCategory(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['items-picker'],
    queryFn: ({ pageParam = 1 }) => api(`/api/items?limit=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last: any) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled: visible,
  });
  useEffect(() => {
    if (visible && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [visible, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const all: any[] = useMemo(() => data?.pages.flatMap((p: any) => p.items) ?? [], [data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((it) => (!category || it.category === category) && (!q || String(it.name).toLowerCase().includes(q)));
  }, [all, search, category]);
  const cats = useMemo(() => {
    const present = new Set<string>(all.map((i) => i.category));
    return Object.keys(ClothingCategoryLabel).filter((k) => present.has(k));
  }, [all]);

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.ink }}>
          <View style={{ width: '100%', maxWidth: 560, height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 }}>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉" style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color={c.ink} />
            </Pressable>
            <Serif size={17}>{title}</Serif>
            <View style={{ width: MIN_TOUCH }} />
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Ionicons name="search-outline" size={16} color={c.mute} />
            <TextField value={search} onChangeText={setSearch} placeholder="搜尋衣物名稱" style={{ flex: 1 }} accessibilityLabel="搜尋衣物名稱" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 12 }}>
            <Chip label="全部" selected={!category} onPress={() => setCategory(null)} />
            {cats.map((k) => (
              <Chip key={k} label={(ClothingCategoryLabel as Record<string, string>)[k] ?? k} selected={category === k} onPress={() => setCategory(category === k ? null : k)} />
            ))}
          </ScrollView>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 }}>
            {isLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 24 }} /> : null}
            {!isLoading && shown.length === 0 ? (
              <Txt tone="mute" style={{ paddingVertical: 24, textAlign: 'center' }}>
                {all.length === 0 ? '衣櫃裡還沒有衣物' : '沒有符合的衣物'}
              </Txt>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {shown.map((it) => {
                const on = selected.includes(it.id);
                return (
                  <View key={it.id} style={{ width: '33.333%', padding: 4 }}>
                    <Pressable
                      onPress={() => toggle(it.id)}
                      accessibilityRole="button"
                      accessibilityLabel={it.name}
                      accessibilityState={{ selected: on }}
                      style={{ borderWidth: on ? 2 : 1, borderColor: on ? c.accent : c.line }}
                    >
                      <GarmentTile path={it.images?.[0]?.thumbnailPath} image={it.images?.[0]} height={104} />
                      {on ? (
                        <View style={{ position: 'absolute', right: 0, top: 0, width: 22, height: 22, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="checkmark" size={15} color={c.onAccent} />
                        </View>
                      ) : null}
                      <View style={{ paddingHorizontal: 6, paddingVertical: 4, backgroundColor: c.paper }}>
                        <Txt size={11} numberOfLines={1} style={{ lineHeight: 15 }}>{it.name}</Txt>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={{ borderTopWidth: 1, borderTopColor: c.ink, backgroundColor: c.paper, alignItems: 'center' }}>
          <View style={{ width: '100%', maxWidth: 560, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Txt size={13} tone="mute" style={{ flex: 1 }}>{`已選 ${selected.length} 件`}</Txt>
            <Button label={confirmLabel} loading={busy} onPress={() => onConfirm(selected)} style={{ minWidth: 120 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
