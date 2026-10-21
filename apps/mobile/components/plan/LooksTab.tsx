import { View, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { imageUrl, imageTileUrl, type ImageLike } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { Txt, Serif, Button } from '@/components/ui';

const GAP = 12;

/** 作品集：2 欄卡片；有封面圖用封面，沒有就用衣物縮圖拼排 */
export function LooksTab({ maxWidth }: { maxWidth: number }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const cols = 2;
  const cardWidth = Math.floor((Math.min(width, maxWidth) - 40 - GAP * (cols - 1)) / cols);

  const { data, isLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api('/api/outfits'),
  });
  const outfits: any[] = data?.outfits ?? [];

  if (isLoading) return <ActivityIndicator color={c.ink} style={{ marginTop: 48 }} />;
  if (outfits.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 56, gap: 14 }}>
        <Ionicons name="layers-outline" size={44} color={c.mute} />
        <Txt tone="mute">還沒有建立任何穿搭</Txt>
        <Button label="建立第一套穿搭" onPress={() => router.push('/outfit/builder')} />
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, rowGap: 18, marginTop: 16 }}>
      {outfits.map((o) => {
        const thumbs: (string | null)[] = (o.items ?? [])
          .map((oi: any) => imageTileUrl(oi.clothingItem?.images?.[0] as ImageLike | undefined))
          .slice(0, 4);
        const wears = o._count?.wearLogs ?? 0;
        const name = o.name || '未命名穿搭';
        return (
          <Pressable
            key={o.id}
            onPress={() => router.push(`/outfit/${o.id}`)}
            accessibilityRole="button"
            accessibilityLabel={name}
            style={({ pressed }) => ({ width: cardWidth, gap: 6, opacity: pressed ? 0.75 : 1 })}
          >
            <View style={{ height: 196, backgroundColor: c.tile, overflow: 'hidden' }}>
              {o.coverThumbPath ? (
                <Image source={{ uri: imageUrl(o.coverThumbPath) }} style={{ width: '100%', height: '100%' }} contentFit="contain" accessibilityIgnoresInvertColors />
              ) : thumbs.length === 0 ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="shirt-outline" size={32} color={c.mute} />
                </View>
              ) : (
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 6 }}>
                  {thumbs.map((t, i) => (
                    <View key={i} style={{ width: thumbs.length === 1 ? '100%' : '50%', height: thumbs.length <= 2 ? '100%' : '50%', padding: 3 }}>
                      {t ? (
                        <Image source={{ uri: t }} style={{ flex: 1 }} contentFit="contain" accessibilityIgnoresInvertColors />
                      ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="shirt-outline" size={20} color={c.mute} />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
              <Serif size={14} medium numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Serif>
              <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{`穿 ${wears} 次`}</Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
