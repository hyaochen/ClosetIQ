import { ReactNode, useState } from 'react';
import { View, Platform, type ViewStyle } from 'react-native';
import { useColors } from '@/lib/theme';
import { useThemeStore } from '@/lib/theme-store';

const CELL = 16;

/** 透明格紋底（去背結果預覽用）：web 用 CSS 漸層，native 用格子拼出來。 */
export function CheckerFrame({ height, children, style }: { height: number; children?: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  const isDark = useThemeStore((s) => s.isDark);
  const [a, b] = isDark ? ['#2C2926', '#1F1D1B'] : ['#EFEBE3', '#FFFFFF'];
  const [w, setW] = useState(0);
  const web = Platform.OS === 'web';

  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(height / CELL);

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        {
          height,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: b,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          ...(web
            ? ({
                backgroundImage: `repeating-conic-gradient(${a} 0% 25%, ${b} 0% 50%)`,
                backgroundSize: `${CELL}px ${CELL}px`,
              } as any)
            : null),
        },
        style,
      ]}
    >
      {!web && w > 0
        ? Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols);
            const col = i % cols;
            return (r + col) % 2 === 0 ? (
              <View key={i} style={{ position: 'absolute', left: col * CELL, top: r * CELL, width: CELL, height: CELL, backgroundColor: a }} />
            ) : null;
          })
        : null}
      {children}
    </View>
  );
}
