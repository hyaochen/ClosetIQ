import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/lib/theme';
import { localDateString } from '@/lib/queries';
import { useTrips, dotMd, type TripSummary } from '@/lib/plan-queries';
import { Txt, Serif, Numeral, Eyebrow, Button, BarMeter, Hairline } from '@/components/ui';
import { BoxTag } from './shared';

export function tripLengthLabel(days: number) {
  return days <= 1 ? '當日來回' : `${days} 天 ${days - 1} 夜`;
}

/** 打包：旅行列表 + 新增旅行 */
export function PackTab() {
  const c = useColors();
  const { data, isLoading } = useTrips();
  const today = localDateString();
  const trips = data?.trips ?? [];
  // 還沒結束的排前面（由近到遠），已結束的放後面
  const upcoming = trips.filter((t) => t.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = trips.filter((t) => t.endDate < today);

  return (
    <View style={{ marginTop: 16 }}>
      <Button label="新增旅行" icon="add" variant="outline" onPress={() => router.push('/trip/new')} />

      {isLoading ? (
        <ActivityIndicator color={c.ink} style={{ marginTop: 40 }} />
      ) : trips.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
          <Ionicons name="bag-handle-outline" size={44} color={c.mute} />
          <Txt tone="mute" style={{ textAlign: 'center' }}>還沒有旅行。新增一趟，依天氣與計畫產生打包清單。</Txt>
        </View>
      ) : (
        <View style={{ marginTop: 8 }}>
          {upcoming.map((t) => <TripRow key={t.id} trip={t} today={today} />)}
          {past.length > 0 ? (
            <View style={{ marginTop: 20 }}>
              <Eyebrow>PAST</Eyebrow>
              <Hairline tone="ink" style={{ marginTop: 4 }} />
              {past.map((t) => <TripRow key={t.id} trip={t} today={today} />)}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

function TripRow({ trip, today }: { trip: TripSummary; today: string }) {
  const c = useColors();
  const ongoing = trip.startDate <= today && today <= trip.endDate;
  const ratio = trip.itemCount > 0 ? trip.packedCount / trip.itemCount : 0;
  return (
    <Pressable
      onPress={() => router.push(`/trip/${trip.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}，${trip.destination}`}
      style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, gap: 6, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Eyebrow>{`TRIP . ${tripLengthLabel(trip.days)}`}</Eyebrow>
        {ongoing ? <BoxTag label="旅途中" /> : null}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <Serif size={22} style={{ flexShrink: 1 }} numberOfLines={1}>{trip.name}</Serif>
        <Numeral size={17}>{`${dotMd(trip.startDate)} - ${dotMd(trip.endDate)}`}</Numeral>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Txt size={12} tone="mute" numberOfLines={1} style={{ flexShrink: 1, maxWidth: 110 }}>{trip.destination}</Txt>
        {trip.itemCount > 0 ? (
          <>
            <BarMeter ratio={ratio} />
            <Txt size={12}>{`${trip.packedCount} / ${trip.itemCount}`}</Txt>
          </>
        ) : (
          <Txt size={12} tone="accent">尚未產生打包清單</Txt>
        )}
      </View>
    </Pressable>
  );
}
