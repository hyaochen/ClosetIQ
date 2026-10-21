import { Platform, type TextStyle } from 'react-native';
import { useThemeStore } from './theme-store';

/**
 * Editorial 設計系統 tokens（單一來源）。
 * tailwind.config.js 的 colors 與此檔保持一致；需要 JS 值（inline style、圖示顏色）時用 useColors()。
 */
export const lightColors = {
  paper: '#F4F0E8', // 紙：頁面底
  card: '#E9E2D4', // 卡：衣物圖底、卡片
  ink: '#1A1917', // 墨：主文字、粗線
  mute: '#5E5A53', // 灰字
  line: '#CFC7B8', // 細線
  accent: '#A8472A', // 赭紅
  onAccent: '#FFFFFF',
  olive: '#4F5B3A', // 橄欖（送洗中）
  onOlive: '#FFFFFF',
  onInk: '#F4F0E8', // 墨底上的文字
};

export const darkColors: Colors = {
  paper: '#161513',
  card: '#242220',
  ink: '#EDE7DC',
  mute: '#A59E92',
  line: '#3D3933',
  accent: '#D0794F',
  onAccent: '#161513',
  olive: '#9AAA78',
  onOlive: '#161513',
  onInk: '#161513',
};

export type Colors = typeof lightColors;

export function useColors(): Colors {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500;1,600&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@500;700&display=swap';

/**
 * 字體：web 用 Google Fonts（見 lib/fonts.ts 注入），native 使用系統字（task 規定的 fallback）。
 */
const web = Platform.OS === 'web';

export const fonts = {
  serif: web ? "'Noto Serif TC', 'Songti TC', 'PMingLiU', serif" : undefined,
  sans: web ? "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', system-ui, sans-serif" : undefined,
  numeral: web ? "'Cormorant Garamond', 'Noto Serif TC', Georgia, serif" : undefined,
};

export const textStyles = {
  serifTitle: { fontFamily: fonts.serif, fontWeight: '700' } as TextStyle,
  serifMedium: { fontFamily: fonts.serif, fontWeight: '500' } as TextStyle,
  numeral: { fontFamily: fonts.numeral, fontStyle: 'italic', fontWeight: '600' } as TextStyle,
  sans: { fontFamily: fonts.sans } as TextStyle,
};

export const SPACING = { gutter: 20 } as const;
export const MIN_TOUCH = 44;
