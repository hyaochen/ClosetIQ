import { ReactNode } from 'react';
import { View, Pressable, ActivityIndicator, Platform, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { Txt } from './Text';

/** 主要（墨底）／次要（墨線框）按鈕，直角，高度 >= 44 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  height = 48,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
}) {
  const c = useColors();
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const fg = primary ? c.onInk : danger ? c.accent : c.ink;
  const bg = primary ? c.ink : 'transparent';
  const bd = danger ? c.accent : c.ink;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        {
          minHeight: Math.max(height, MIN_TOUCH),
          paddingHorizontal: 18,
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: bd,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      <Txt size={15} letterSpacing={1.2} style={{ color: fg, fontWeight: '500' }}>{label}</Txt>
    </Pressable>
  );
}

/** 篩選晶片：已選 = 墨底；dashed = 待確認樣式 */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  trailing,
  dashed,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  trailing?: ReactNode;
  dashed?: boolean;
}) {
  const c = useColors();
  const bd = dashed ? c.accent : c.ink;
  const fg = selected ? c.onInk : dashed ? c.accent : c.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      // 視覺高度 30，hitSlop 補足 44 觸控目標
      hitSlop={{ top: 7, bottom: 7 }}
      style={({ pressed }) => ({
        height: 30,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderStyle: dashed ? 'dashed' : 'solid',
        borderColor: bd,
        backgroundColor: selected ? c.ink : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={13} color={fg} /> : null}
      <Txt size={12} style={{ color: fg, lineHeight: 16 }} numberOfLines={1}>{label}</Txt>
      {trailing}
    </Pressable>
  );
}

/** web：標籤小字在淺色底上會被瀏覽器用 LCD 次像素描邊（看起來偏藍）；提升成獨立圖層強制灰階抗鋸齒 */
const WEB_GRAY_AA: ViewStyle = (Platform.OS === 'web' ? { willChange: 'transform' } : {}) as ViewStyle;

export type StatusKind = 'DIRTY' | 'CLEANING' | 'OFF_SEASON';

/** 狀態標籤：同時用顏色與文字（待洗 / 送洗中 / 季外） */
export function StatusTag({ kind, style }: { kind: StatusKind; style?: ViewStyle }) {
  const c = useColors();
  const map = {
    DIRTY: { label: '待洗', bg: c.accent, fg: c.onAccent, bd: c.accent },
    CLEANING: { label: '送洗中', bg: c.olive, fg: c.onOlive, bd: c.olive },
    OFF_SEASON: { label: '季外', bg: c.paper, fg: c.ink, bd: c.ink },
  }[kind];
  return (
    <View style={[{ alignSelf: 'flex-start', backgroundColor: map.bg, borderWidth: 1, borderColor: map.bd, paddingHorizontal: 7, paddingVertical: 1 }, WEB_GRAY_AA, style]}>
      <Txt size={11} letterSpacing={1.1} style={{ color: map.fg, lineHeight: 17 }}>{map.label}</Txt>
    </View>
  );
}

/** 分段選擇（洗衣狀態、季節、開關）：外框 1px 墨線、格間直線、選中墨底 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  height = 40,
  label,
}: {
  options: { value: T; label: string; activeBg?: string; activeFg?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  height?: number;
  label?: string;
}) {
  const c = useColors();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: c.ink }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => ({
              flex: 1,
              height: Math.max(height, MIN_TOUCH - 4),
              alignItems: 'center',
              justifyContent: 'center',
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: c.ink,
              backgroundColor: on ? o.activeBg ?? c.ink : 'transparent',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Txt size={13} letterSpacing={1} style={{ color: on ? o.activeFg ?? c.onInk : c.ink, lineHeight: 18 }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** 列：左文字、右內容、右箭頭，底部細線 */
export function ListRow({
  left,
  right,
  onPress,
  chevron = true,
  minHeight = 48,
  index,
  last,
}: {
  left: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  minHeight?: number;
  index?: string;
  last?: boolean;
}) {
  const c = useColors();
  const content = (
    <View style={{ minHeight, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line }}>
      {index ? <Txt size={18} tone="mute" style={{ width: 22, fontStyle: 'italic', fontWeight: '600' }}>{index}</Txt> : null}
      <View style={{ flex: 1 }}>{left}</View>
      {right}
      {onPress && chevron ? <Ionicons name="chevron-forward" size={14} color={c.ink} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      {content}
    </Pressable>
  );
}
