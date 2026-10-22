import { View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RecapCore, RecapItem, RecapPair } from '@closet/shared';
import { useColors } from '@/lib/theme';
import { imageUrl } from '@/lib/images';
import { Txt, Numeral, GarmentTile } from '@/components/ui';

/** 與上期比較：箭頭圖示 + 文字（上升/下降/持平） */
export function Delta({ value, unit, label }: { value: number; unit: string; label: string }) {
  const c = useColors();
  const up = value > 0;
  const down = value < 0;
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${label}${up ? '增加' : down ? '減少' : '持平'}${Math.abs(value)}${unit}`}>
      {up || down ? <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={13} color={up ? c.olive : c.accent} /> : <Ionicons name="remove" size={13} color={c.mute} />}
      <Txt size={13} style={{ color: up ? c.olive : down ? c.accent : c.mute }}>
        {up || down ? `${Math.abs(value)}${unit}` : '持平'}
      </Txt>
      <Txt size={12} tone="mute">{label}</Txt>
    </View>
  );
}

export function TopItemRow({ item, rank }: { item: RecapItem; rank: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Numeral size={18} tone="mute" style={{ width: 20 }}>{String(rank)}</Numeral>
      <View style={{ width: 44, height: 44 }}>
        <GarmentTile path={item.thumbnailPath} tile={item} fill />
      </View>
      <Txt size={14} numberOfLines={1} style={{ flex: 1 }}>{item.name}</Txt>
      <Numeral size={20}>{`x${item.count}`}</Numeral>
    </View>
  );
}

export function TopPairRow({ pair, rank }: { pair: RecapPair; rank: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Numeral size={18} tone="mute" style={{ width: 20 }}>{String(rank)}</Numeral>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {pair.items.map((p) => (
          <View key={p.id} style={{ width: 44, height: 44, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center' }}>
            {p.tileThumbPath ? <Image source={{ uri: imageUrl(p.tileThumbPath) }} style={{ width: '100%', height: '100%' }} contentFit="contain" /> : <Ionicons name="shirt-outline" size={18} color={c.mute} />}
          </View>
        ))}
      </View>
      <Txt size={13} numberOfLines={2} style={{ flex: 1 }}>{pair.items.map((p) => p.name).join(' + ')}</Txt>
      <Numeral size={20}>{`x${pair.count}`}</Numeral>
    </View>
  );
}

/** 最常穿單品／組合清單（月度、年度共用）；空資料時回傳 null */
export function TopLists({ recap, itemsTitle = '最常穿單品', pairsTitle = '最常一起穿' }: { recap: RecapCore; itemsTitle?: string; pairsTitle?: string }) {
  return (
    <View>
      {recap.topItems.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Txt size={12} tone="mute" letterSpacing={1.2}>{itemsTitle}</Txt>
          {recap.topItems.map((it, i) => <TopItemRow key={it.id} item={it} rank={i + 1} />)}
        </View>
      ) : null}
      {recap.topPairs.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <Txt size={12} tone="mute" letterSpacing={1.2}>{pairsTitle}</Txt>
          {recap.topPairs.map((p, i) => <TopPairRow key={p.items.map((x) => x.id).join('-')} pair={p} rank={i + 1} />)}
        </View>
      ) : null}
    </View>
  );
}
