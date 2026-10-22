import { useMemo, useState } from 'react';
import { View, ScrollView, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CanvasBackgroundHex, ClothingCategoryLabel, type CanvasBackground } from '@closet/shared';
import { useColors } from '@/lib/theme';
import { imageUrl } from '@/lib/images';
import { Txt, Eyebrow } from '@/components/ui';
import { primaryImage, trayThumbPath, canvasImagePath } from './canvas-utils';

type ToolKey = 'front' | 'back' | 'flip' | 'remove';
const TOOLS: { key: ToolKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'front', label: '置前', icon: 'arrow-up-outline' },
  { key: 'back', label: '置後', icon: 'arrow-down-outline' },
  { key: 'flip', label: '翻轉', icon: 'swap-horizontal-outline' },
  { key: 'remove', label: '移除', icon: 'trash-outline' },
];

/** 工具列：置前／置後／翻轉／移除（四格、格間細線、上下墨線） */
export function CanvasToolbar({ enabled, onTool }: { enabled: boolean; onTool: (k: ToolKey) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.ink }}>
      {TOOLS.map((t, i) => (
        <Pressable
          key={t.key}
          disabled={!enabled}
          onPress={() => onTool(t.key)}
          accessibilityRole="button"
          accessibilityLabel={t.label}
          accessibilityState={{ disabled: !enabled }}
          style={({ pressed }) => ({
            flex: 1,
            height: 52,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: c.line,
            opacity: !enabled ? 0.35 : pressed ? 0.6 : 1,
          })}
        >
          <Ionicons name={t.icon} size={18} color={c.ink} />
          <Txt size={11} style={{ lineHeight: 15 }}>{t.label}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

const CATEGORY_ORDER = ['TOP', 'BOTTOM', 'OUTERWEAR', 'DRESS', 'SHOES', 'BAG', 'ACCESSORY', 'UNDERWEAR'];

/** 下方抽屜：依分類列出衣物縮圖（去背圖優先），已放上畫布的標小方塊 */
export function ItemTray({
  items,
  usedIds,
  loading,
  onPick,
}: {
  items: any[];
  usedIds: Set<string>;
  loading?: boolean;
  onPick: (item: any) => void;
}) {
  const c = useColors();
  const [cat, setCat] = useState<string | undefined>(undefined);
  const tabs = useMemo(() => {
    const present = new Set(items.map((i) => i.category));
    return [{ key: undefined as string | undefined, label: '全部' }, ...CATEGORY_ORDER.filter((k) => present.has(k)).map((k) => ({ key: k as string | undefined, label: ClothingCategoryLabel[k as keyof typeof ClothingCategoryLabel] }))];
  }, [items]);
  const shown = cat ? items.filter((i) => i.category === cat) : items;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
        {tabs.map((t) => {
          const on = cat === t.key;
          return (
            <Pressable
              key={t.key ?? 'all'}
              onPress={() => setCat(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}
            >
              <View style={{ paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: on ? c.ink : 'transparent' }}>
                <Txt size={12} tone={on ? 'ink' : 'mute'} bold={on} style={{ lineHeight: 18 }}>{t.label}</Txt>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {loading && items.length === 0 ? <Txt size={12} tone="mute" style={{ height: 62, lineHeight: 62 }}>載入衣物中</Txt> : null}
        {!loading && shown.length === 0 ? <Txt size={12} tone="mute" style={{ height: 62, lineHeight: 62 }}>這個分類還沒有衣物</Txt> : null}
        {shown.map((item) => {
          const used = usedIds.has(item.id);
          const img = primaryImage(item);
          const path = trayThumbPath(img);
          const usable = !!canvasImagePath(img);
          return (
            <Pressable
              key={item.id}
              onPress={() => onPick(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}${used ? '（已在畫布上）' : usable ? '' : '（沒有照片）'}`}
              style={({ pressed }) => ({ width: 62, height: 62, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : usable ? 1 : 0.5 })}
            >
              {path ? (
                <Image source={{ uri: imageUrl(path) }} resizeMode="contain" style={{ width: 54, height: 54 }} accessibilityIgnoresInvertColors />
              ) : (
                <Ionicons name="shirt-outline" size={24} color={c.mute} />
              )}
              {used ? <View style={{ position: 'absolute', right: 3, top: 3, width: 7, height: 7, backgroundColor: c.ink }} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const BG_OPTIONS: { key: CanvasBackground; label: string }[] = [
  { key: 'card', label: '卡色' },
  { key: 'white', label: '白色' },
  { key: 'clay', label: '淺赭' },
];

/** 背景三色選擇 */
export function BackgroundPicker({ value, onChange }: { value: CanvasBackground; onChange: (b: CanvasBackground) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Eyebrow style={{ letterSpacing: 1.1 }}>背景</Eyebrow>
      {BG_OPTIONS.map((b) => {
        const on = value === b.key;
        return (
          <Pressable
            key={b.key}
            onPress={() => onChange(b.key)}
            accessibilityRole="radio"
            accessibilityLabel={b.label}
            accessibilityState={{ selected: on }}
            style={{ width: 30, height: 30, backgroundColor: CanvasBackgroundHex[b.key], borderWidth: on ? 2 : 1, borderColor: on ? c.ink : c.line }}
          />
        );
      })}
    </View>
  );
}
