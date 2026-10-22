import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CanvasBackground } from '@closet/shared';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { Txt, Serif } from '@/components/ui';
import { CanvasStage, type PiecePatch } from './CanvasStage';
import { CanvasToolbar, CanvasStepBar, ItemTray, BackgroundPicker, type StepKey } from './CanvasParts';
import { SaveSheet, type OutfitMeta } from './SaveSheet';
import {
  canvasImagePath, clamp, normDeg, SCALE_MIN, SCALE_MAX, defaultPiece, layoutToPieces, piecesToLayout, primaryImage, type EditorPiece,
} from './canvas-utils';
import { exportOutfitPng } from './export';

const PAGE_SIZE = 100;
const MAX_PIECES = 30;
const ASPECT = 1.25; // 4:5，與後端 1080x1350 封面同比例，匯出時不會出現多餘留白

/**
 * 拼貼穿搭畫布編輯器。
 * - 新建（沒有 outfitId）：從空白或預選衣物開始，第一次按「儲存」才建立穿搭並產生封面。
 * - 編輯（有 outfitId）：載入已存版面；沒有版面時呼叫 /canvas/auto 當起點。
 * 只在按「儲存」時打 API（PUT /canvas 會 render 封面），拖曳過程只更新本機 state。
 */
export function CanvasEditor({ outfitId, presetItemIds }: { outfitId?: string; presetItemIds?: string[] }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();

  const [pieces, setPieces] = useState<EditorPiece[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [background, setBackground] = useState<CanvasBackground>('card');
  const [meta, setMeta] = useState<OutfitMeta>({ name: '', occasions: [], seasons: [] });
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [baseline, setBaseline] = useState('');
  const initRef = useRef(false);
  const createdRef = useRef<string | null>(null);
  const targetId = outfitId ?? createdRef.current ?? undefined;

  // 衣物（全量載入，與原 builder 相同）
  const itemsQ = useInfiniteQuery({
    queryKey: ['items-builder'],
    queryFn: ({ pageParam = 1 }) => api(`/api/items?limit=${PAGE_SIZE}&page=${pageParam}`),
    initialPageParam: 1,
    getNextPageParam: (last: any) => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
  });
  useEffect(() => {
    if (itemsQ.hasNextPage && !itemsQ.isFetchingNextPage) itemsQ.fetchNextPage();
  }, [itemsQ.hasNextPage, itemsQ.isFetchingNextPage]);
  const items: any[] = useMemo(() => itemsQ.data?.pages.flatMap((p: any) => p.items) ?? [], [itemsQ.data]);
  const itemsLoaded = !itemsQ.isLoading && !itemsQ.hasNextPage;

  const outfitQ = useQuery({
    queryKey: ['outfits', outfitId],
    queryFn: () => api(`/api/outfits/${outfitId}`),
    enabled: !!outfitId,
    refetchOnMount: 'always',
  });
  const outfit = outfitQ.data?.outfit;

  const countQ = useQuery({ queryKey: ['outfits', 'editor-count'], queryFn: () => api('/api/outfits') });
  const lookNo = useMemo(() => {
    const list: any[] = countQ.data?.outfits ?? [];
    if (!outfitId) return list.length + 1;
    const idx = list.findIndex((o) => o.id === outfitId);
    return idx < 0 ? list.length : list.length - idx;
  }, [countQ.data, outfitId]);

  // 畫布尺寸：4:5，依視窗高度壓縮，避免整頁需要捲動才看得到工具列
  const colW = Math.min(winW, 560);
  const reserved = insets.top + 54 + 14 + 62 + 12 + 116 + 76 + 16;
  const W = Math.floor(clamp(Math.min(colW - 40, (winH - reserved) / ASPECT), 240, 480));
  const H = Math.round(W * ASPECT);

  // 初始化（只做一次）
  useEffect(() => {
    if (initRef.current || !itemsLoaded) return;
    if (outfitId && !outfit) return;
    initRef.current = true;
    (async () => {
      const byId = new Map<string, any>(items.map((i) => [i.id, i]));
      if (!outfitId) {
        const start: EditorPiece[] = [];
        for (const id of presetItemIds ?? []) {
          const it = byId.get(id);
          const p = it ? defaultPiece(it, start.length) : null;
          if (p) start.push(p);
        }
        setPieces(start);
        setSelected(start[0]?.itemId ?? null);
        setBaseline(JSON.stringify({ l: piecesToLayout(start, 'card', W, H), m: { name: '', occasions: [], seasons: [] } }));
        setReady(true);
        return;
      }
      const members = (outfit.items ?? []).map((oi: any) => oi.clothingItem).filter(Boolean);
      for (const m of members) byId.set(m.id, m);
      let layout = outfit.canvasLayout;
      if (!layout && members.length > 0) {
        try {
          const r = await api(`/api/outfits/${outfitId}/canvas/auto`, { method: 'POST', body: JSON.stringify({ background: 'card', render: false }) });
          layout = r.layout;
        } catch {
          layout = null;
        }
      }
      let start: EditorPiece[] = [];
      let bg: CanvasBackground = 'card';
      if (layout) {
        start = layoutToPieces(layout, byId);
        bg = layout.background;
      } else {
        for (const m of members) {
          const p = defaultPiece(m, start.length);
          if (p) start.push(p);
        }
      }
      const m: OutfitMeta = { name: outfit.name ?? '', occasions: outfit.occasions ?? [], seasons: outfit.seasons ?? [], rating: outfit.rating ?? undefined };
      setPieces(start);
      setBackground(bg);
      setMeta(m);
      setBaseline(JSON.stringify({ l: piecesToLayout(start, bg, W, H), m }));
      setReady(true);
    })();
  }, [itemsLoaded, outfit, outfitId]);

  const signature = useMemo(() => JSON.stringify({ l: piecesToLayout(pieces, background, W, H), m: meta }), [pieces, background, meta, W, H]);
  const dirty = ready && signature !== baseline;

  const patch = useCallback(
    (id: string, p: PiecePatch) =>
      setPieces((ps) =>
        ps.map((x) => {
          if (x.itemId !== id) return x;
          const next = { ...x };
          for (const k of Object.keys(p) as (keyof PiecePatch)[]) {
            const v = p[k];
            if (v !== undefined) next[k] = typeof v === 'function' ? v(x[k]) : v;
          }
          return next;
        }),
      ),
    [],
  );

  const handlePick = (item: any) => {
    if (pieces.some((p) => p.itemId === item.id)) {
      setSelected(item.id);
      return;
    }
    if (pieces.length >= MAX_PIECES) {
      showAlert('已達上限', `一張畫布最多放 ${MAX_PIECES} 件衣物。`);
      return;
    }
    const p = defaultPiece(item, pieces.length);
    if (!p) {
      showAlert('無法放上畫布', `「${item.name}」還沒有照片，請先到衣物詳情補上照片。`);
      return;
    }
    setPieces((ps) => [...ps, p]);
    setSelected(p.itemId);
  };

  const handleTool = (k: 'front' | 'back' | 'flip' | 'remove') => {
    if (!selected) return;
    setPieces((ps) => {
      const i = ps.findIndex((p) => p.itemId === selected);
      if (i < 0) return ps;
      const cur = ps[i];
      const rest = ps.filter((_, j) => j !== i);
      if (k === 'front') return [...rest, cur];
      if (k === 'back') return [cur, ...rest];
      if (k === 'flip') return ps.map((p, j) => (j === i ? { ...p, flipX: !p.flipX } : p));
      return rest;
    });
    if (k === 'remove') setSelected(null);
  };

  // 步進鈕：縮放每次 10%、旋轉每次 15 度（與手勢共用範圍限制）
  const handleStep = (k: StepKey) => {
    if (!selected) return;
    const cur = pieces.find((p) => p.itemId === selected);
    if (!cur) return;
    if (k === 'shrink') patch(selected, { scale: clamp(cur.scale * 0.9, SCALE_MIN, SCALE_MAX) });
    else if (k === 'grow') patch(selected, { scale: clamp(cur.scale * 1.1, SCALE_MIN, SCALE_MAX) });
    else patch(selected, { rotate: normDeg(cur.rotate + (k === 'rotR' ? 15 : -15)) });
  };

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/outfits');
  };
  const handleCancel = async () => {
    if (dirty && !(await showConfirm('放棄變更？', '尚未儲存的版面會遺失。'))) return;
    leave();
  };

  const openSave = () => {
    if (pieces.length === 0) {
      showAlert('畫布是空的', '先從下方挑選至少一件衣物，再儲存。');
      return;
    }
    setSelected(null);
    setSheet(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const layout = piecesToLayout(pieces, background, W, H);
      const ids = pieces.map((p) => p.itemId);
      const body = { name: meta.name.trim() || undefined, occasions: meta.occasions, seasons: meta.seasons, rating: meta.rating };
      let id = targetId;
      if (!id) {
        const r = await api('/api/outfits', { method: 'POST', body: JSON.stringify({ ...body, itemIds: ids }) });
        id = r.outfit.id as string;
        createdRef.current = id;
      } else {
        // 沒有照片、不可能放上畫布的既有成員要保留，不能因為「同步畫布」被默默移除
        const unplaceable = (outfit?.items ?? [])
          .map((oi: any) => oi.clothingItem)
          .filter((m: any) => m && !canvasImagePath(primaryImage(m)) && !ids.includes(m.id))
          .map((m: any) => m.id as string);
        await api(`/api/outfits/${id}`, { method: 'PUT', body: JSON.stringify({ ...body, itemIds: [...ids, ...unplaceable] }) });
      }
      await api(`/api/outfits/${id}/canvas`, { method: 'PUT', body: JSON.stringify({ layout, syncItems: false, render: true }) });
      setBaseline(signature);
      queryClient.invalidateQueries({ queryKey: ['outfits'] });
      setSheet(false);
      if (outfitId) leave();
      else router.replace(`/outfit/${id}`);
    } catch (err: any) {
      showAlert('儲存失敗', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!targetId) {
      showAlert('請先儲存', '匯出圖片前，請先按右上角「儲存」，穿搭才會有版面可以匯出。');
      return;
    }
    if (dirty) {
      if (await showConfirm('尚有未儲存的變更', '匯出的是上次儲存的版面。要先儲存再匯出嗎？')) openSave();
      return;
    }
    try {
      await exportOutfitPng(targetId, meta.name);
    } catch (err: any) {
      showAlert('匯出失敗', err.message);
    }
  };

  const usedIds = useMemo(() => new Set(pieces.map((p) => p.itemId)), [pieces]);
  const title = outfitId ? '編輯穿搭' : '新穿搭';

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {/* 頂列：取消 / 標題 / 儲存 */}
      <View style={{ backgroundColor: c.paper, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <View style={{ height: 54, paddingTop: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          <Pressable onPress={handleCancel} accessibilityRole="button" accessibilityLabel="取消" style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Txt size={14}>取消</Txt>
          </Pressable>
          <Serif size={17} accessibilityRole="header">{title}</Serif>
          <Pressable onPress={openSave} accessibilityRole="button" accessibilityLabel="儲存" style={{ height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Txt size={14} bold>儲存</Txt>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled" scrollEnabled>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 14 }}>
          <View style={{ alignSelf: 'center' }}>
            {ready ? (
              <CanvasStage
                width={W}
                height={H}
                background={background}
                pieces={pieces}
                selected={selected}
                onSelect={setSelected}
                onPatch={patch}
                caption={`Look No. ${lookNo}`}
                emptyHint="從下方挑選衣物，點一下就會放上畫布。"
              />
            ) : (
              <View style={{ width: W, height: H, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={c.ink} />
              </View>
            )}
          </View>

          <View style={{ marginTop: 10 }}>
            {selected ? <CanvasStepBar onStep={handleStep} /> : null}
            <CanvasToolbar enabled={!!selected} onTool={handleTool} />
          </View>

          <View style={{ marginTop: 6 }}>
            <ItemTray items={items} usedIds={usedIds} loading={itemsQ.isLoading || !!itemsQ.hasNextPage} onPick={handlePick} />
          </View>
        </View>
      </ScrollView>

      {/* 底列：背景色 + 匯出圖片 */}
      <View style={{ backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 22), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <BackgroundPicker value={background} onChange={setBackground} />
          <Pressable
            onPress={handleExport}
            accessibilityRole="button"
            accessibilityLabel="匯出圖片"
            style={({ pressed }) => ({ height: 44, paddingHorizontal: 18, borderWidth: 1, borderColor: c.ink, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="download-outline" size={16} color={c.ink} />
            <Txt size={13} letterSpacing={0.8}>匯出圖片</Txt>
          </Pressable>
        </View>
      </View>

      <SaveSheet visible={sheet} meta={meta} onChange={setMeta} pieceCount={pieces.length} saving={saving} onSave={handleSave} onClose={() => setSheet(false)} />
    </View>
  );
}
