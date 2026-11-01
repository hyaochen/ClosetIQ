import { useEffect, useRef, useState } from 'react';
import { View, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { imageUrl, fullImage } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { submitTryon, getTryonJob, fetchTryonResult, formatElapsed, downloadDataUrl, useTryonStatus, type TryonJobView } from '@/lib/tryon';

const POLL_MS = 2500;
const MAX_POLL_FAILS = 4; // consecutive network errors before giving up
import type { PickedPhoto } from '@/lib/cutout';
import { TopBar, Txt, Serif, Eyebrow, Button } from '@/components/ui';
import { WebcamCapture, canUseWebcam } from '@/components/WebcamCapture';

export default function TryonScreen() {
  const c = useColors();
  const { width } = useWindowDimensions();
  const colW = Math.min(width, 560);
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useTryonStatus();
  const { data } = useQuery({ queryKey: ['items', id], queryFn: () => api(`/api/items/${id}`), enabled: !!id });
  const item = data?.item;
  const garment = item?.images?.[0] ? fullImage(item.images[0]) : null;

  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<TryonJobView | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef(0);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const blobUrl = useRef<string | null>(null);
  const running = submitting || jobId !== null;

  // 輪詢：每 2.5 秒問一次進度；離開頁面（unmount）或換 job 就停。
  useEffect(() => {
    if (!jobId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fails = 0;
    const finish = (title: string, msg: string) => {
      setJobId(null);
      setJob(null);
      showAlert(title, msg);
    };
    const tick = async () => {
      try {
        const v = await getTryonJob(jobId);
        if (stopped) return;
        fails = 0;
        setJob(v);
        if (v.status === 'done') {
          const url = await fetchTryonResult(jobId);
          if (stopped) return;
          setResult(url);
          setJobId(null);
          setJob(null);
          return;
        }
        if (v.status === 'failed') return finish('試穿失敗', v.error || '虛擬試穿暫時失敗，請稍後再試');
      } catch (err: any) {
        if (stopped) return;
        const msg = String(err?.message || '');
        fails += 1;
        if (msg.includes('找不到') || fails >= MAX_POLL_FAILS) {
          return finish('試穿失敗', msg.includes('找不到') ? '找不到結果，請重新試穿' : '連線不穩，無法取得結果，請重新試穿');
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId]);

  // 已用時間（本機時鐘，每秒更新；只在等待時跑，unmount 清掉）
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt.current), 1000);
    return () => clearInterval(t);
  }, [running]);

  // 換照片或離開頁面時釋放舊的 blob URL
  const revokeBlob = () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
  };
  useEffect(() => revokeBlob, []);

  const onWebcamCapture = (p: PickedPhoto) => {
    revokeBlob();
    blobUrl.current = p.uri;
    setPhoto(p);
    setResult(null);
    setWebcamOpen(false);
  };

  const pick = async (useCamera: boolean) => {
    if (useCamera && Platform.OS === 'web' && canUseWebcam()) {
      setWebcamOpen(true);
      return;
    }
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('需要權限', useCamera ? '請允許使用相機' : '請允許存取相簿');
      return;
    }
    const r = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (r.canceled) return;
    const a = r.assets[0];
    revokeBlob();
    setPhoto({ uri: a.uri, type: a.mimeType || 'image/jpeg', fileName: a.fileName || 'person.jpg' });
    setResult(null);
  };

  const run = async () => {
    if (!id || !photo) return;
    setSubmitting(true);
    setResult(null);
    setJob(null);
    startedAt.current = Date.now();
    setElapsedMs(0);
    try {
      setJobId(await submitTryon(id, photo));
    } catch (err: any) {
      showAlert('試穿失敗', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const phaseLabel = submitting
    ? '送出中'
    : job?.status === 'queued'
      ? `排隊中（前面還有 ${job.queuePosition ?? 1} 張）`
      : '合成中';

  const enabled = status.data?.enabled === true;

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <TopBar eyebrow="TRY ON" backLabel="返回" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <Eyebrow>虛擬試穿</Eyebrow>
          <Serif size={24} letterSpacing={0.8} style={{ marginTop: 4 }} accessibilityRole="header">{item?.name ?? ''}</Serif>

          {status.isLoading ? (
            <ActivityIndicator color={c.ink} style={{ marginTop: 24 }} />
          ) : !enabled ? (
            <Txt tone="mute" style={{ marginTop: 16 }}>試穿服務目前未開啟。</Txt>
          ) : (
            <>
              <Txt size={13} tone="mute" style={{ marginTop: 8 }}>
                拍一張站直、光線足夠的全身照，約需半分鐘到數分鐘合成。照片只在本機處理，不會儲存。
              </Txt>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Button label="拍照" icon="camera-outline" variant="outline" style={{ flex: 1 }} onPress={() => pick(true)} disabled={running} />
                <Button label="選照片" icon="image-outline" variant="outline" style={{ flex: 1 }} onPress={() => pick(false)} disabled={running} />
              </View>

              {webcamOpen ? (
                <WebcamCapture
                  onCapture={onWebcamCapture}
                  onClose={() => setWebcamOpen(false)}
                  onUseLibrary={() => pick(false)}
                />
              ) : null}

              {photo ? (
                <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Txt size={12} tone="mute">全身照</Txt>
                    <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 2 / 3, backgroundColor: c.tile }} contentFit="contain" accessibilityIgnoresInvertColors />
                  </View>
                  {garment?.path ? (
                    <View style={{ flex: 1 }}>
                      <Txt size={12} tone="mute">衣物</Txt>
                      <Image source={{ uri: imageUrl(garment.path) }} style={{ width: '100%', aspectRatio: 2 / 3, backgroundColor: c.tile }} contentFit="contain" accessibilityIgnoresInvertColors />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {photo ? (
                <View style={{ marginTop: 16 }}>
                  <Button label={running ? `${phaseLabel}，請稍候` : '開始試穿'} onPress={run} loading={running} disabled={running} />
                </View>
              ) : null}

              {running ? (
                <View style={{ marginTop: 10 }} accessibilityLiveRegion="polite">
                  <Txt size={13}>{phaseLabel}，已用時間 {formatElapsed(elapsedMs)}</Txt>
                  <Txt size={12} tone="mute" style={{ marginTop: 4 }}>
                    主機忙碌時可能需要數分鐘，請保持此頁開啟；離開此頁會停止顯示進度。
                  </Txt>
                </View>
              ) : null}

              {result ? (
                <View style={{ marginTop: 20 }}>
                  <Eyebrow>結果</Eyebrow>
                  <Image
                    source={{ uri: result }}
                    style={{ width: colW - 40, aspectRatio: 2 / 3, marginTop: 8, backgroundColor: c.tile }}
                    contentFit="contain"
                    accessibilityIgnoresInvertColors
                    accessibilityLabel="試穿合成照"
                  />
                  {Platform.OS === 'web' ? (
                    <View style={{ marginTop: 12 }}>
                      <Button label="下載合成照" icon="download-outline" variant="outline" onPress={() => downloadDataUrl(result, `tryon-${id}.png`)} />
                    </View>
                  ) : (
                    <Txt size={12} tone="mute" style={{ marginTop: 8 }}>請用截圖保存。</Txt>
                  )}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
