import { View, Pressable, Platform, Linking } from 'react-native';
import { useColors, MIN_TOUCH } from '@/lib/theme';
import { Txt, Serif, Numeral } from '@/components/ui';
import type { WardrobeGap, GapSeverity } from '@closet/shared';

/** 衣櫃頂部分段：我的衣物 / 願望清單 N（Wardrobe、Wishlist 設計稿） */
export function WardrobeSegment({
  mode,
  wishCount,
  onChange,
}: {
  mode: 'items' | 'wishlist';
  wishCount: number;
  onChange: (m: 'items' | 'wishlist') => void;
}) {
  const c = useColors();
  const Tab = ({ on, onPress, children, label }: { on: boolean; onPress: () => void; children: React.ReactNode; label: string }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      style={{
        minHeight: MIN_TOUCH,
        justifyContent: 'center',
        borderBottomWidth: 2,
        borderBottomColor: on ? c.ink : 'transparent',
        marginBottom: -1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>{children}</View>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderBottomColor: c.ink, marginTop: 8 }} accessibilityRole="tablist">
      <Tab on={mode === 'items'} onPress={() => onChange('items')} label="我的衣物">
        <Txt size={14} bold={mode === 'items'} tone={mode === 'items' ? 'ink' : 'mute'}>我的衣物</Txt>
      </Tab>
      <Tab on={mode === 'wishlist'} onPress={() => onChange('wishlist')} label={`願望清單 ${wishCount}`}>
        <Txt size={14} bold={mode === 'wishlist'} tone={mode === 'wishlist' ? 'ink' : 'mute'}>願望清單</Txt>
        <Numeral size={15} tone={mode === 'wishlist' ? 'ink' : 'mute'}>{String(wishCount)}</Numeral>
      </Tab>
    </View>
  );
}

const SEVERITY: Record<GapSeverity, { label: string; filled: boolean }> = {
  high: { label: '急需', filled: true },
  medium: { label: '建議補', filled: false },
  low: { label: '可補', filled: false },
};

/** 衣櫃缺口：severity 用文字標示 + 赭紅色（不只靠顏色） */
export function GapList({ gaps, limit, title = true }: { gaps: WardrobeGap[]; limit?: number; title?: boolean }) {
  const c = useColors();
  const shown = limit ? gaps.slice(0, limit) : gaps;
  return (
    <View>
      {title ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomWidth: 1, borderBottomColor: c.ink, paddingBottom: 6 }}>
          <Serif size={17} accessibilityRole="header">衣櫃缺口</Serif>
          <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>依場合與季節計算</Txt>
        </View>
      ) : null}
      {shown.length === 0 ? (
        <View style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: c.line }}>
          <Txt size={13} tone="mute">目前沒有明顯缺口，場合與季節都有基本款。</Txt>
        </View>
      ) : (
        shown.map((g, i) => {
          const sev = SEVERITY[g.severity];
          return (
            <View
              key={`${g.kind}-${g.label}-${i}`}
              accessible
              accessibilityLabel={`${sev.label}：${g.label}，${g.detail}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.line }}
            >
              <View style={{ flex: 1 }}>
                <Txt size={13}>{g.label}</Txt>
                <Txt size={12} tone="accent" style={{ lineHeight: 18 }}>{g.detail}</Txt>
              </View>
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                  borderWidth: 1,
                  borderColor: g.severity === 'low' ? c.mute : c.accent,
                  backgroundColor: sev.filled ? c.accent : 'transparent',
                }}
              >
                <Txt size={11} letterSpacing={1.1} style={{ lineHeight: 17, color: sev.filled ? c.onAccent : g.severity === 'low' ? c.mute : c.accent }}>
                  {sev.label}
                </Txt>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

/** 開啟商品連結：web 用新分頁（noopener），native 交給系統 */
export function openExternalUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}
