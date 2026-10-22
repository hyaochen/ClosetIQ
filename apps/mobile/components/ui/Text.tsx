import { Text, type TextProps, type TextStyle } from 'react-native';
import { useColors, fonts, textStyles } from '@/lib/theme';

type Tone = 'ink' | 'mute' | 'accent' | 'onInk' | 'onAccent';

type Props = TextProps & {
  tone?: Tone;
  size?: number;
  bold?: boolean;
  letterSpacing?: number;
};

function useTone(tone: Tone): string {
  const c = useColors();
  switch (tone) {
    case 'mute': return c.mute;
    case 'accent': return c.accent;
    case 'onInk': return c.onInk;
    case 'onAccent': return c.onAccent;
    default: return c.ink;
  }
}

/** 內文：Noto Sans TC，行高 1.6 */
export function Txt({ tone = 'ink', size = 14, bold, letterSpacing, style, ...rest }: Props) {
  const color = useTone(tone);
  const base: TextStyle = {
    fontFamily: fonts.sans,
    fontSize: size,
    lineHeight: Math.round(size * 1.6),
    color,
    fontWeight: bold ? '700' : '400',
    letterSpacing,
  };
  return <Text {...rest} style={[base, style]} />;
}

/** 標題：Noto Serif TC 700（medium = 500，用於小標） */
export function Serif({ tone = 'ink', size = 17, medium, letterSpacing, style, ...rest }: Props & { medium?: boolean }) {
  const color = useTone(tone);
  return (
    <Text
      {...rest}
      style={[
        medium ? textStyles.serifMedium : textStyles.serifTitle,
        { fontSize: size, lineHeight: Math.round(size * 1.25), color, letterSpacing },
        style,
      ]}
    />
  );
}

/** 數字與英文點綴：Cormorant Garamond italic 600 */
export function Numeral({ tone = 'ink', size = 20, style, ...rest }: Props) {
  const color = useTone(tone);
  return (
    <Text
      {...rest}
      style={[textStyles.numeral, { fontSize: size, lineHeight: Math.round(size * 1.15), color }, style]}
    />
  );
}

/** 小標籤文字：11px、字距寬、灰字 */
export function Eyebrow({ tone = 'mute', style, ...rest }: Props) {
  const color = useTone(tone);
  return (
    <Text
      {...rest}
      style={[{ fontFamily: fonts.sans, fontSize: 11, letterSpacing: 2, color, lineHeight: 16 }, style]}
    />
  );
}
