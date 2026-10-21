import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { invalidateWardrobe } from '@/lib/queries';
import { useBackfill, startBackfill, cancelBackfill } from '@/lib/cutout';
import { Screen, TopBar, Txt, Serif, Numeral, Button, BarMeter, Hairline } from '@/components/ui';

/** 每次補跑的張數上限（後端上限 100，一次最多處理這麼多，剩下的再按一次繼續） */
const BATCH = 100;

export default function TidyPhotosScreen() {
  const c = useColors();
  const { data, isLoading } = useBackfill();
  const [busy, setBusy] = useState(false);
  const job = data?.job ?? null;
  const running = !!job?.running;
  const remaining = data?.remaining ?? 0;

  // 一輪結束（running 由真轉假）後，刷新衣櫃讓各頁換成去背圖
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) invalidateWardrobe();
    wasRunning.current = running;
  }, [running]);

  const act = async (fn: () => Promise<void>, failTitle: string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      showAlert(failTitle, e.message);
    } finally {
      setBusy(false);
    }
  };

  const ratio = job && job.total > 0 ? job.done / job.total : 0;
  const finished = job && !job.running;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="PHOTOS" title="整理舊照片" />
      <Screen>
        {isLoading ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={c.ink} />
          </View>
        ) : data && !data.enabled ? (
          <View style={{ paddingTop: 8 }}>
            <Serif size={18}>去背服務尚未啟用</Serif>
            <Txt size={13} tone="mute" style={{ marginTop: 6, lineHeight: 21 }}>
              目前伺服器沒有開啟去背功能，舊照片不需要整理。
            </Txt>
          </View>
        ) : (
          <View>
            <Txt size={13} tone="mute" style={{ lineHeight: 21 }}>
              在去背功能上線前拍的照片還是原圖。這裡會一張一張幫它們去背，完成後衣櫃裡的衣物會自動換成乾淨的去背圖。
            </Txt>

            <View style={{ marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.ink, paddingVertical: 10, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Numeral size={44}>{String(remaining)}</Numeral>
              <Txt size={13} tone="mute">張照片還沒去背</Txt>
            </View>

            {running && job ? (
              <View style={{ marginTop: 18 }} accessibilityLiveRegion="polite">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <Txt size={13}>{job.cancelled ? '正在停止（做完目前這張）' : '整理中'}</Txt>
                  <Numeral size={18}>{`${job.done} / ${job.total}`}</Numeral>
                </View>
                <BarMeter ratio={ratio} height={8} />
                <Txt size={12} tone="mute" style={{ marginTop: 8 }}>
                  可以離開這一頁，整理會在伺服器上繼續進行。
                </Txt>
              </View>
            ) : finished && job ? (
              <View style={{ marginTop: 18 }}>
                <Hairline />
                <Txt size={13} style={{ marginTop: 10, lineHeight: 21 }}>
                  {job.cancelled ? '已停止。' : '這一輪完成。'}
                  {` 處理 ${job.done} 張`}
                  {job.failed > 0 ? `，其中 ${job.failed} 張失敗（可以再整理一次）` : ''}
                  {'。'}
                </Txt>
              </View>
            ) : null}

            <View style={{ marginTop: 22, flexDirection: 'row', gap: 10 }}>
              {running ? (
                <Button
                  label="取消整理"
                  variant="outline"
                  style={{ flex: 1 }}
                  loading={busy}
                  disabled={!!job?.cancelled}
                  onPress={() => act(cancelBackfill, '取消失敗')}
                />
              ) : (
                <Button
                  label={finished && remaining > 0 ? '繼續整理' : '開始整理'}
                  style={{ flex: 1 }}
                  loading={busy}
                  disabled={remaining === 0}
                  onPress={() => act(() => startBackfill(BATCH), '無法開始整理')}
                />
              )}
            </View>
            {remaining === 0 && !running ? (
              <Txt size={12} tone="mute" style={{ marginTop: 10 }}>所有照片都已處理完。</Txt>
            ) : (
              <Txt size={12} tone="mute" style={{ marginTop: 10, lineHeight: 19 }}>
                新到舊、一次處理最多 {BATCH} 張。每張約幾秒，伺服器一次只做一張。
              </Txt>
            )}
          </View>
        )}
      </Screen>
    </View>
  );
}
