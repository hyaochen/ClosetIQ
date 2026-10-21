import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { OccasionLabel } from '@closet/shared';
import type { JournalLog } from '@closet/shared';
import { useColors } from '@/lib/theme';
import { imageUrl } from '@/lib/images';
import { localDateString, logWear } from '@/lib/queries';
import {
  WEEKDAY_FULL, weekdayOf, useJournalMonth, uploadOotdForDate, uploadOotdForLog, deleteOotdPhoto, updateLogItems, deleteLog,
} from '@/lib/journal';
import { showAlert, showConfirm } from '@/lib/alert';
import { Screen, TopBar, SectionHeader, Txt, Serif, Numeral, Button, GarmentTile } from '@/components/ui';
import { usePhotoSource } from '@/components/journal/PhotoSource';
import { ItemPicker } from '@/components/journal/ItemPicker';

/** 當日詳情：照片大圖、穿了哪些衣物、補選衣物、換照片、刪照片 */
export default function JournalDayScreen() {
  const c = useColors();
  const { date, pick } = useLocalSearchParams<{ date: string; pick?: string }>();
  const day = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localDateString();
  const todayKey = useMemo(() => localDateString(), []);
  const future = day > todayKey;
  const { data, isLoading } = useJournalMonth(day.slice(0, 7));
  const logs: JournalLog[] = data?.days.find((d) => d.date === day)?.logs ?? [];

  const photoSource = usePhotoSource();
  const [busy, setBusy] = useState<string | null>(null);
  // picker target: log id, or 'new' to create a log for this day
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const autoOpened = useRef(false);

  // 拍完照後直接補選衣物
  useEffect(() => {
    if (pick === '1' && !autoOpened.current && logs.length > 0) {
      const target = logs.find((l) => l.items.length === 0) ?? logs[0];
      autoOpened.current = true;
      setPickerFor(target.id);
    }
  }, [pick, logs]);

  const [, m, d] = day.split('-').map(Number);
  const title = `${m} 月 ${d} 日 ${WEEKDAY_FULL[weekdayOf(day)]}`;

  const run = async (key: string, fn: () => Promise<unknown>, failTitle: string) => {
    setBusy(key);
    try {
      await fn();
    } catch (e: any) {
      showAlert(failTitle, e.message);
    } finally {
      setBusy(null);
    }
  };

  const changePhoto = async (log: JournalLog) => {
    const photo = await photoSource.ask();
    if (photo) await run(`photo-${log.id}`, () => uploadOotdForLog(log.id, photo), '上傳失敗');
  };
  const newPhotoForDay = async () => {
    const photo = await photoSource.ask();
    if (!photo) return;
    await run('new-photo', async () => {
      const { log, created } = await uploadOotdForDate(day, photo);
      if (created || log.items.length === 0) setPickerFor(log.id);
    }, '上傳失敗');
  };
  const removePhoto = async (log: JournalLog) => {
    const ok = await showConfirm('刪除照片', '只會刪掉照片，穿搭紀錄和衣物會保留。');
    if (ok) await run(`photo-${log.id}`, () => deleteOotdPhoto(log.id), '刪除失敗');
  };
  const removeLog = async (log: JournalLog) => {
    const ok = await showConfirm('刪除這筆紀錄', log.photoThumbnailPath ? '照片和穿著紀錄都會刪掉。' : '這天的穿著紀錄會刪掉。');
    if (ok) await run(`log-${log.id}`, () => deleteLog(log.id), '刪除失敗');
  };

  const confirmPicker = async (ids: string[]) => {
    const target = pickerFor;
    if (!target) return;
    await run('picker', async () => {
      if (target === 'new') {
        if (ids.length === 0) return;
        await logWear({ itemIds: ids, date: day });
      } else {
        await updateLogItems(target, ids);
      }
      setPickerFor(null);
    }, '儲存失敗');
  };

  const pickerInitial = pickerFor && pickerFor !== 'new' ? logs.find((l) => l.id === pickerFor)?.items.map((i) => i.id) ?? [] : [];

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="JOURNAL" title={title} backLabel="回到日記" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/journal'))} />
      <Screen>
        {isLoading ? <ActivityIndicator color={c.ink} style={{ marginVertical: 24 }} /> : null}

        {!isLoading && logs.length === 0 ? (
          <View style={{ paddingTop: 8 }}>
            <View style={{ height: 320, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }}>
              <Ionicons name="camera-outline" size={34} color={c.mute} />
              <Serif size={17}>這天還沒有紀錄</Serif>
              <Txt size={13} tone="mute" style={{ textAlign: 'center' }}>
                {future ? '還沒到這一天，等到了再來記錄。' : '上傳當天的穿搭照，或直接選出穿了哪些衣物。'}
              </Txt>
            </View>
            {!future ? (
              <View style={{ gap: 10, marginTop: 16 }}>
                <Button label="新增穿搭照片" icon="camera-outline" loading={busy === 'new-photo'} onPress={newPhotoForDay} />
                <Button label="只記錄穿了哪些衣物" variant="outline" onPress={() => setPickerFor('new')} />
              </View>
            ) : null}
          </View>
        ) : null}

        {logs.map((log, idx) => {
          const meta = [log.occasion ? OccasionLabel[log.occasion as keyof typeof OccasionLabel] : null].filter(Boolean).join(' · ');
          return (
            <View key={log.id} style={{ marginTop: idx === 0 ? 4 : 28 }}>
              {logs.length > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <Numeral size={22}>{String(idx + 1)}</Numeral>
                  <Txt size={12} tone="mute">{`第 ${idx + 1} 筆${meta ? ' · ' + meta : ''}`}</Txt>
                </View>
              ) : meta ? (
                <Txt size={12} tone="mute" style={{ marginBottom: 8 }}>{meta}</Txt>
              ) : null}

              {log.photoDisplayPath ? (
                <View style={{ width: '100%', maxWidth: 380, aspectRatio: 3 / 4, alignSelf: 'center', backgroundColor: c.card, borderWidth: 1, borderColor: c.line }}>
                  <Image source={{ uri: imageUrl(log.photoDisplayPath) }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`${title} 的穿搭照片`} accessibilityIgnoresInvertColors />
                </View>
              ) : (
                <View style={{ height: 120, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Ionicons name="image-outline" size={24} color={c.mute} />
                  <Txt size={13} tone="mute">還沒有這筆紀錄的穿搭照</Txt>
                </View>
              )}

              {!future ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <Button
                    label={log.photoDisplayPath ? '換照片' : '新增照片'}
                    variant="outline"
                    icon="camera-outline"
                    height={44}
                    loading={busy === `photo-${log.id}`}
                    onPress={() => changePhoto(log)}
                    style={{ flex: 1 }}
                  />
                  {log.photoDisplayPath ? (
                    <Button label="刪除照片" variant="danger" height={44} disabled={busy === `photo-${log.id}`} onPress={() => removePhoto(log)} style={{ flex: 1 }} />
                  ) : null}
                </View>
              ) : null}

              <SectionHeader
                title={`穿了這些（${log.items.length} 件）`}
                link={log.items.length > 0 ? '補選衣物' : undefined}
                onLink={() => setPickerFor(log.id)}
                style={{ marginTop: 20 }}
              />
              {log.items.length === 0 ? (
                <View style={{ paddingVertical: 14, gap: 10 }}>
                  <Txt tone="mute">還沒有選衣物。選好之後，這天會算進衣櫃使用率和最常穿的統計。</Txt>
                  <Button label="選擇今天穿的衣物" variant="outline" height={44} onPress={() => setPickerFor(log.id)} />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginTop: 10 }}>
                  {log.items.map((it) => (
                    <Pressable
                      key={it.id}
                      onPress={() => router.push(`/item/${it.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={it.name}
                      style={{ width: '25%', padding: 4 }}
                    >
                      <GarmentTile path={it.thumbnailPath} tile={it} height={78} />
                      <Txt size={11} numberOfLines={1} style={{ lineHeight: 15, marginTop: 3 }}>{it.name}</Txt>
                    </Pressable>
                  ))}
                </View>
              )}
              {log.notes ? <Txt size={13} tone="mute" style={{ marginTop: 8 }}>{log.notes}</Txt> : null}

              <Pressable
                onPress={() => removeLog(log)}
                accessibilityRole="button"
                accessibilityLabel="刪除這筆紀錄"
                style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
              >
                <Txt size={12} tone="mute" style={{ textDecorationLine: 'underline' }}>刪除這筆紀錄</Txt>
              </Pressable>
            </View>
          );
        })}

        {logs.length > 0 && !future ? (
          <View style={{ marginTop: 20 }}>
            <Button label="這天再加一筆紀錄" variant="outline" height={44} onPress={() => setPickerFor('new')} />
          </View>
        ) : null}
      </Screen>

      <ItemPicker
        visible={pickerFor !== null}
        initial={pickerInitial}
        confirmLabel={pickerFor === 'new' ? '記錄' : '完成'}
        busy={busy === 'picker'}
        onConfirm={confirmPicker}
        onClose={() => setPickerFor(null)}
      />
      {photoSource.sheet}
    </View>
  );
}
