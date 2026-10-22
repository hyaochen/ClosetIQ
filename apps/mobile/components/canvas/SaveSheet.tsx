import { View, ScrollView, Pressable } from 'react-native';
import { OccasionLabel, SeasonLabel } from '@closet/shared';
import { useColors } from '@/lib/theme';
import { Txt, Serif, Numeral, FieldRow, TextField, MultiChipGroup, Button, SectionHeader } from '@/components/ui';

export type OutfitMeta = {
  name: string;
  occasions: string[];
  seasons: string[];
  rating?: number;
};

/** 儲存前的底部抽屜：名稱、場合、季節、評分（原 builder 的欄位全數保留） */
export function SaveSheet({
  visible,
  meta,
  onChange,
  pieceCount,
  saving,
  onSave,
  onClose,
}: {
  visible: boolean;
  meta: OutfitMeta;
  onChange: (m: OutfitMeta) => void;
  pieceCount: number;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  if (!visible) return null;
  const toggle = (key: 'occasions' | 'seasons', k: string) =>
    onChange({ ...meta, [key]: meta[key].includes(k) ? meta[key].filter((x) => x !== k) : [...meta[key], k] });
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'flex-end' }} testID="save-sheet">
      <Pressable accessibilityLabel="關閉" onPress={onClose} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(26,25,23,0.45)' }} />
      <View style={{ backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink, maxHeight: '86%' }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', flexShrink: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Serif size={20} accessibilityRole="header">儲存穿搭</Serif>
              <Txt size={12} tone="mute">{pieceCount} 件衣物</Txt>
            </View>
            <FieldRow label="名稱">
              <TextField serif value={meta.name} onChangeText={(t) => onChange({ ...meta, name: t })} placeholder="例：上班日常穿搭" accessibilityLabel="穿搭名稱" maxLength={100} />
            </FieldRow>

            <SectionHeader title="場合" style={{ marginTop: 16 }} />
            <View style={{ paddingTop: 10 }}>
              <MultiChipGroup items={OccasionLabel} selected={meta.occasions} onToggle={(k) => toggle('occasions', k)} />
            </View>

            <SectionHeader title="季節" style={{ marginTop: 18 }} />
            <View style={{ paddingTop: 10 }}>
              <MultiChipGroup items={SeasonLabel} selected={meta.seasons} onToggle={(k) => toggle('seasons', k)} />
            </View>

            <SectionHeader title="評分" style={{ marginTop: 18 }} />
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = meta.rating === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => onChange({ ...meta, rating: on ? undefined : n })}
                    accessibilityRole="radio"
                    accessibilityLabel={`${n} 分`}
                    accessibilityState={{ selected: on }}
                    style={{ width: 48, height: 48, borderWidth: 1, borderColor: c.ink, backgroundColor: on ? c.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Numeral size={22} tone={on ? 'onInk' : 'ink'}>{String(n)}</Numeral>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, borderTopWidth: 1, borderTopColor: c.line }}>
            <Button label="儲存穿搭並產生封面" onPress={onSave} loading={saving} />
          </View>
        </View>
      </View>
    </View>
  );
}
