import { ReactNode } from 'react';
import { View, TextInput, Pressable, Modal, ScrollView, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, fonts, MIN_TOUCH } from '@/lib/theme';
import { Txt, Serif } from './Text';
import { Chip } from './Controls';

/** 欄位列：左灰字標籤、右內容，底部細線（AddItem 稿的欄位列樣式） */
export function FieldRow({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: stacked ? 'column' : 'row',
        alignItems: stacked ? 'stretch' : 'center',
        gap: stacked ? 6 : 12,
        minHeight: 46,
        paddingVertical: stacked ? 8 : 4,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
      }}
    >
      <Txt size={12} tone="mute" letterSpacing={1.2} style={{ width: stacked ? undefined : 64 }}>{label}</Txt>
      <View style={{ flex: stacked ? undefined : 1 }}>{children}</View>
    </View>
  );
}

/** 單行底線輸入：直角、無外框，只有底線 */
export function TextField({ serif, style, ...rest }: TextInputProps & { serif?: boolean }) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.mute}
      {...rest}
      style={[
        {
          minHeight: MIN_TOUCH - 4,
          paddingVertical: 6,
          paddingHorizontal: 0,
          fontSize: serif ? 17 : 14,
          fontFamily: serif ? fonts.serif : fonts.sans,
          color: c.ink,
          backgroundColor: 'transparent',
          // @ts-expect-error web-only，去掉 focus 外框
          outlineStyle: 'none',
        },
        style,
      ]}
    />
  );
}

/** 單選晶片群 */
export function ChipGroup({
  items,
  selected,
  onSelect,
}: {
  items: Record<string, string>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {Object.entries(items).map(([key, label]) => (
        <Chip key={key} label={label} selected={selected === key} onPress={() => onSelect(key)} />
      ))}
    </View>
  );
}

/** 複選晶片群 */
export function MultiChipGroup({
  items,
  selected,
  onToggle,
}: {
  items: Record<string, string>;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {Object.entries(items).map(([key, label]) => (
        <Chip key={key} label={label} selected={selected.includes(key)} onPress={() => onToggle(key)} />
      ))}
    </View>
  );
}

export type SheetOption = { value: string; label: string; hint?: string };

/** 底部選單（收納位置、排序…）：直角、1px 墨線、列間細線 */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  footer,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selected?: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
        accessibilityLabel="關閉選單"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink, width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '70%' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 52, borderBottomWidth: 1, borderBottomColor: c.ink }}>
            <Serif size={17}>{title}</Serif>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉" style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'flex-end', justifyContent: 'center' }}>
              <Ionicons name="close" size={22} color={c.ink} />
            </Pressable>
          </View>
          <ScrollView>
            {options.map((o) => {
              const on = o.value === selected;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => onSelect(o.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    paddingHorizontal: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: c.line,
                    backgroundColor: pressed ? c.card : 'transparent',
                  })}
                >
                  <View style={{ flex: 1 }}>
                    <Txt size={15} bold={on}>{o.label}</Txt>
                    {o.hint ? <Txt size={12} tone="mute" style={{ lineHeight: 17 }}>{o.hint}</Txt> : null}
                  </View>
                  {on ? <Ionicons name="checkmark" size={18} color={c.ink} /> : null}
                </Pressable>
              );
            })}
            {footer}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
