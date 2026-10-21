import { ReactNode } from 'react';
import { View, ScrollView, Pressable, type ViewStyle, type ScrollViewProps } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { Txt, Serif, Numeral, Eyebrow } from './Text';

/** 1px 細線；ink = 墨色分區線，line = 淺色分隔線 */
export function Hairline({ tone = 'line', thick = 1, style }: { tone?: 'ink' | 'line'; thick?: number; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[{ height: thick, backgroundColor: tone === 'ink' ? c.ink : c.line }, style]} />;
}

/**
 * 頁面容器：紙色底 + 置中欄（桌機不會拉滿全寬）。
 * scroll=false 時給 FlatList 等自己捲動的內容用。
 */
export function Screen({
  children,
  scroll = true,
  maxWidth = 560,
  pad = true,
  bottomPad = 32,
  safeTop = false,
  contentStyle,
  ...rest
}: {
  children: ReactNode;
  scroll?: boolean;
  maxWidth?: number;
  pad?: boolean;
  bottomPad?: number;
  safeTop?: boolean;
  contentStyle?: ViewStyle;
} & Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const inner: ViewStyle = {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    paddingHorizontal: pad ? 20 : 0,
    ...contentStyle,
  };
  const top = safeTop ? insets.top : 0;
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper, paddingTop: top }}>
        <View style={[inner, { flex: 1 }]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingTop: top + 22, paddingBottom: bottomPad }}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      <View style={inner}>{children}</View>
    </ScrollView>
  );
}

/** 襯線大標 + 斜體副標（+ 右側動作） */
export function PageHeader({
  title,
  sub,
  right,
  rule = false,
  size = 34,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  rule?: boolean;
  size?: number;
}) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexShrink: 1 }}>
          <Serif size={size} letterSpacing={1.4} accessibilityRole="header">{title}</Serif>
          {sub ? <Numeral size={18} tone="mute">{sub}</Numeral> : null}
        </View>
        {right}
      </View>
      {rule ? <Hairline tone="ink" style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

/** 區塊標題 + 右側連結 + 下方 1px 墨線 */
export function SectionHeader({
  title,
  link,
  onLink,
  style,
}: {
  title: string;
  link?: string;
  onLink?: () => void;
  style?: ViewStyle;
}) {
  const c = useColors();
  return (
    <View style={[{ borderBottomWidth: 1, borderBottomColor: c.ink, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }, style]}>
      <Serif size={17} accessibilityRole="header">{title}</Serif>
      {link ? (
        <Pressable onPress={onLink} accessibilityRole="link" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}>
          <Txt size={12} tone="mute" letterSpacing={1}>{link}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** 非分頁畫面的頂欄：返回、置中小標、右側動作 */
export function TopBar({
  title,
  eyebrow,
  right,
  onBack,
  backLabel = '返回',
}: {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const handleBack = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };
  return (
    <View style={{ backgroundColor: c.paper, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: c.ink }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={22} color={c.ink} />
        </Pressable>
        <View style={{ alignItems: 'center', flexShrink: 1 }}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {title ? <Serif size={17} numberOfLines={1}>{title}</Serif> : null}
        </View>
        <View style={{ minWidth: MIN_TOUCH, alignItems: 'flex-end' }}>{right}</View>
      </View>
    </View>
  );
}

/** 圖示按鈕（觸控目標 44） */
export function IconButton({
  name,
  label,
  onPress,
  size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  size?: number;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={name} size={size} color={c.ink} />
    </Pressable>
  );
}
