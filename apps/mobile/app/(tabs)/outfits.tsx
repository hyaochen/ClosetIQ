import { View, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { OccasionLabel } from '@closet/shared';
import { api } from '@/lib/api';
import { imageUrl } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { Screen, PageHeader, Hairline, Txt, Serif, Button } from '@/components/ui';

const GAP = 12;

export default function OutfitsScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;
  const maxWidth = cols === 2 ? 560 : 900;
  const cardWidth = Math.floor((Math.min(width, maxWidth) - 40 - GAP * (cols - 1)) / cols);

  const { data, isLoading } = useQuery({
    queryKey: ['outfits'],
    queryFn: () => api('/api/outfits'),
  });
  const outfits: any[] = data?.outfits ?? [];

  return (
    <Screen maxWidth={maxWidth}>
      <PageHeader
        title="穿搭"
        sub={`${outfits.length} looks`}
        right={<Button label="新穿搭" icon="add" height={44} onPress={() => router.push('/outfit/builder')} />}
      />
      <Hairline tone="ink" style={{ marginTop: 8, marginBottom: 16 }} />

      {isLoading ? (
        <ActivityIndicator color={c.ink} style={{ marginTop: 48 }} />
      ) : outfits.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 56, gap: 14 }}>
          <Ionicons name="layers-outline" size={44} color={c.mute} />
          <Txt tone="mute">還沒有建立穿搭組合</Txt>
          <Button label="建立第一套穿搭" onPress={() => router.push('/outfit/builder')} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, rowGap: 20 }}>
          {outfits.map((o) => {
            const thumbs = (o.items ?? []).map((oi: any) => oi.clothingItem?.images?.[0]?.thumbnailPath).slice(0, 4);
            const count = o.items?.length ?? 0;
            const wears = o._count?.wearLogs ?? 0;
            const occ = (o.occasions ?? []).map((k: string) => OccasionLabel[k as keyof typeof OccasionLabel]).filter(Boolean).slice(0, 2).join(' / ');
            return (
              <Pressable
                key={o.id}
                onPress={() => router.push(`/outfit/${o.id}`)}
                accessibilityRole="button"
                accessibilityLabel={o.name || '未命名穿搭'}
                style={({ pressed }) => ({ width: cardWidth, gap: 6, opacity: pressed ? 0.75 : 1 })}
              >
                <View style={{ height: 176, backgroundColor: c.card, flexDirection: 'row', flexWrap: 'wrap', padding: 6 }}>
                  {thumbs.length === 0 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="shirt-outline" size={32} color={c.mute} />
                    </View>
                  ) : (
                    thumbs.map((t: string | undefined, i: number) => (
                      <View key={i} style={{ width: thumbs.length === 1 ? '100%' : '50%', height: thumbs.length <= 2 ? '100%' : '50%', padding: 3 }}>
                        {t ? (
                          <Image source={{ uri: imageUrl(t) }} style={{ flex: 1 }} contentFit="contain" accessibilityIgnoresInvertColors />
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="shirt-outline" size={20} color={c.mute} />
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
                <Serif size={14} medium numberOfLines={1}>{o.name || '未命名穿搭'}</Serif>
                <Txt size={11} tone="mute" numberOfLines={1} style={{ marginTop: -4, lineHeight: 16 }}>
                  {`${count} 件 · 穿過 ${wears} 次${occ ? ' · ' + occ : ''}`}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
