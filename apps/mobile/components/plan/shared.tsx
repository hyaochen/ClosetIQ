import { View } from 'react-native';
import { Txt } from '@/components/ui';
import { useColors } from '@/lib/theme';

/** 預報狀態短標：晴 / 陰 / 雨 / 雪 / 風 */
export const CONDITION_SHORT: Record<string, string> = {
  SUNNY: '晴',
  CLOUDY: '陰',
  RAINY: '雨',
  SNOWY: '雪',
  WINDY: '風',
};

/** 打包清單的類別短標（設計稿：上衣 / 下身 / 外套 / 鞋 / 其他） */
export const CATEGORY_SHORT: Record<string, string> = {
  TOP: '上衣',
  BOTTOM: '下身',
  OUTERWEAR: '外套',
  DRESS: '洋裝',
  SHOES: '鞋',
  ACCESSORY: '配件',
  UNDERWEAR: '內著',
  BAG: '包包',
};
export const PACK_CATEGORY_ORDER = ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'SHOES', 'UNDERWEAR', 'ACCESSORY', 'BAG', 'OTHER'];

/** 赭紅小方塊（今日頁週格、計畫標記共用） */
export function Dot({ color, size = 6 }: { color?: string; size?: number }) {
  const c = useColors();
  return <View style={{ width: size, height: size, backgroundColor: color ?? c.accent }} />;
}

/** 小框標籤（旅行名稱、無預報） */
export function BoxTag({ label, maxWidth }: { label: string; maxWidth?: number }) {
  const c = useColors();
  return (
    <View style={{ borderWidth: 1, borderColor: c.ink, paddingHorizontal: 5, paddingVertical: 1, maxWidth }}>
      <Txt size={10} letterSpacing={1} numberOfLines={1} style={{ lineHeight: 15 }}>{label}</Txt>
    </View>
  );
}
