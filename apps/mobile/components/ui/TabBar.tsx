import { View, Pressable } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/lib/theme';
import { Txt } from './Text';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: 'sunny-outline',
  wardrobe: 'shirt-outline',
  outfits: 'layers-outline',
  journal: 'book-outline',
  me: 'person-outline',
};

const LABELS: Record<string, string> = {
  index: '今日',
  wardrobe: '衣櫃',
  outfits: '穿搭',
  journal: '日記',
  me: '我的',
};

/** 自訂底部分頁：上緣 1px 墨線、選中項上方 2px 墨線、icon + 字 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink, paddingBottom: insets.bottom }}>
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: 560, alignSelf: 'center', height: 60 }}>
        {state.routes.map((route, i) => {
          const on = state.index === i;
          const fg = on ? c.ink : c.mute;
          const label = LABELS[route.name] ?? route.name;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: on }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!on && !event.defaultPrevented) navigation.navigate(route.name as never);
              }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                marginTop: -1,
                borderTopWidth: 2,
                borderTopColor: on ? c.ink : 'transparent',
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons name={ICONS[route.name] ?? 'ellipse-outline'} size={22} color={fg} />
              <Txt size={11} letterSpacing={1.1} style={{ color: fg, lineHeight: 15, fontWeight: on ? '700' : '400' }}>{label}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
