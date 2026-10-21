import { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';
import { localDateString } from '@/lib/queries';
import { Txt, Numeral } from '@/components/ui';
import { parseYmd } from '@/lib/plan-queries';

const WEEK_HEAD = ['日', '一', '二', '三', '四', '五', '六'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * 起訖日選擇（月曆）：第一次點選出發日，第二次點選回程日；
 * 已選好兩端後再點一次就重新開始。今天以前的日子不可選。
 */
export function DateRangePicker({
  start,
  end,
  onChange,
  minDate,
}: {
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  minDate?: string;
}) {
  const c = useColors();
  const min = minDate ?? localDateString();
  const base = start ?? min;
  const [view, setView] = useState(() => {
    const { y, m } = parseYmd(base);
    return { y, m };
  });

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m - 1, 1);
    const lead = first.getDay();
    const dim = new Date(view.y, view.m, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= dim; d++) out.push(`${view.y}-${pad(view.m)}-${pad(d)}`);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view]);

  const move = (delta: number) => {
    const d = new Date(view.y, view.m - 1 + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };

  const pick = (date: string) => {
    if (date < min) return;
    if (!start || (start && end)) onChange(date, null);
    else if (date < start) onChange(date, null);
    else onChange(start, date);
  };

  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View accessibilityLabel="選擇起訖日期">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="上個月" style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={18} color={c.ink} />
        </Pressable>
        <Numeral size={20}>{`${view.y} . ${pad(view.m)}`}</Numeral>
        <Pressable onPress={() => move(1)} accessibilityRole="button" accessibilityLabel="下個月" style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Ionicons name="chevron-forward" size={18} color={c.ink} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.ink, paddingBottom: 4 }}>
        {WEEK_HEAD.map((w) => (
          <View key={w} style={{ flex: 1, alignItems: 'center' }}>
            <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>{w}</Txt>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((date, ci) => {
            if (!date) return <View key={ci} style={{ flex: 1, height: 44 }} />;
            const disabled = date < min;
            const isEdge = date === start || date === end;
            const inside = !!start && !!end && date > start && date < end;
            const { d } = parseYmd(date);
            return (
              <Pressable
                key={ci}
                onPress={() => pick(date)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${view.m} 月 ${d} 日`}
                accessibilityState={{ selected: isEdge, disabled }}
                style={{
                  flex: 1,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isEdge ? c.ink : inside ? c.card : 'transparent',
                  opacity: disabled ? 0.3 : 1,
                }}
              >
                <Txt size={14} style={{ color: isEdge ? c.onInk : c.ink, lineHeight: 20 }}>{String(d)}</Txt>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
