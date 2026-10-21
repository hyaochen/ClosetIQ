import { ReactNode } from 'react';
import { View, Pressable, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';
import { imageUrl, tileImage, type ImageLike } from '@/lib/images';
import { Txt, Numeral } from './Text';

/** 斜體大數字 + 小標，格間直線分隔，上下 1px 墨線 */
export function StatRow({ stats }: { stats: { value: string | number; label: string }[] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.ink }}>
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{ flex: 1, paddingVertical: 8, paddingLeft: 12, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: c.line }}
        >
          <Numeral size={30}>{String(s.value)}</Numeral>
          <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{s.label}</Txt>
        </View>
      ))}
    </View>
  );
}

/** 衣物縮圖：卡色底 + 圖片 contain；沒有圖時顯示圖示 */
export function GarmentTile({
  path,
  image,
  height = 176,
  fill,
  dim,
  overlay,
  style,
  fit = 'contain',
}: {
  /** 縮圖路徑；若該張圖已去背（資料來自 api()）會自動改用去背圖 */
  path?: string | null;
  /** 也可直接傳整個 ClothingImage 物件 */
  image?: ImageLike | null;
  height?: number;
  /** 填滿父容器（flex: 1）而非固定高度 */
  fill?: boolean;
  dim?: boolean;
  overlay?: ReactNode;
  style?: ViewStyle;
  fit?: 'contain' | 'cover';
}) {
  const c = useColors();
  // 去背完成：透明圖放在卡色底上（卡色來自 token，深色模式自動換色）；否則用原縮圖
  const shown = tileImage(path, image);
  return (
    <View style={[fill ? { flex: 1 } : { height }, { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {shown.path ? (
        <Image
          source={{ uri: imageUrl(shown.path) }}
          style={{ width: '100%', height: '100%', opacity: dim ? 0.55 : 1 }}
          contentFit={shown.cutout ? 'contain' : fit}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="shirt-outline" size={fill ? 32 : Math.min(40, height / 3)} color={c.mute} style={{ opacity: dim ? 0.55 : 1 }} />
      )}
      {overlay ? <View style={{ position: 'absolute', left: 8, top: 8 }}>{overlay}</View> : null}
    </View>
  );
}

/** 水平比例條（收納位置、統計） */
export function BarMeter({ ratio, height = 6 }: { ratio: number; height?: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={{ flex: 1, height, backgroundColor: c.card }}>
      <View style={{ height, width: `${pct}%`, backgroundColor: c.ink }} />
    </View>
  );
}

/** 規格表一列：左灰字標籤、右值，底部細線 */
export function SpecRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 38, gap: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      <Txt size={13} tone="mute" letterSpacing={1.3}>{label}</Txt>
      <Txt size={13} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Txt>
    </View>
  );
}

/** 可點的卡片容器（作品集卡、統計卡） */
export function Tappable({ onPress, children, style, label }: { onPress: () => void; children: ReactNode; style?: ViewStyle; label?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }, style]}>
      {children}
    </Pressable>
  );
}
