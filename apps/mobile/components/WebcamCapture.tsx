import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { Txt, Button } from '@/components/ui';
import type { PickedPhoto } from '@/lib/cutout';

/** 只有網頁、非觸控、且瀏覽器有 getUserMedia 時才用內建 webcam 拍照；其餘仍走系統相機。 */
export function canUseWebcam(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    return window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function describeError(err: any): string {
  const name = String(err?.name || '');
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return '瀏覽器沒有相機權限。請點網址列旁的相機或鎖頭圖示，把相機改為「允許」後再試一次。';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return '找不到可用的鏡頭，請確認 webcam 已連接且沒有被其他程式占用。';
  if (name === 'NotReadableError' || name === 'AbortError') return '鏡頭無法啟動，可能正被其他程式使用，請關閉後再試。';
  if (typeof window !== 'undefined' && window.isSecureContext === false) return '相機只能在 HTTPS 網址使用，請改用安全連線開啟。';
  return '無法開啟相機，請改用「選照片」。';
}

const COUNTDOWN_S = 10;

export function WebcamCapture({
  onCapture,
  onClose,
  onUseLibrary,
}: {
  onCapture: (photo: PickedPhoto) => void;
  onClose: () => void;
  onUseLibrary: () => void;
}) {
  const c = useColors();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCount(null);
  }, []);

  // 開鏡頭；換鏡頭或離開時一定停掉所有 track
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stopStream();
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => {});
        }
        setReady(true);
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        if (!cancelled) setDevices(list);
      } catch (err: any) {
        if (cancelled) return;
        setFailed(true);
        showAlert('無法使用相機', describeError(err));
      }
    })();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [deviceId, stopStream]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopStream();
    },
    [stopStream],
  );

  const snap = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0); // 預覽鏡像只是 CSS，拍下的不鏡像
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showAlert('拍照失敗', '無法產生照片，請再試一次');
          return;
        }
        stopStream();
        onCapture({ uri: URL.createObjectURL(blob), type: 'image/jpeg', fileName: 'webcam.jpg' });
      },
      'image/jpeg',
      0.9,
    );
  }, [onCapture, stopStream]);

  const startCountdown = () => {
    if (timerRef.current) return;
    let n = COUNTDOWN_S;
    setCount(n);
    timerRef.current = setInterval(() => {
      n -= 1;
      if (n <= 0) {
        clearTimer();
        snap();
      } else {
        setCount(n);
      }
    }, 1000);
  };

  const close = () => {
    clearTimer();
    stopStream();
    onClose();
  };

  const nextDevice = () => {
    if (devices.length < 2) return;
    const cur = streamRef.current?.getVideoTracks()[0]?.getSettings().deviceId;
    const i = devices.findIndex((d) => d.deviceId === cur);
    setDeviceId(devices[(i + 1) % devices.length].deviceId);
  };

  return (
    <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.ink, backgroundColor: c.card, padding: 12 }}>
      <Txt size={13} tone="mute">站遠一點讓全身入鏡，光線充足。需要往後退時用「10 秒倒數」。</Txt>
      {failed ? (
        <View style={{ marginTop: 12, gap: 10 }}>
          <Txt size={13}>無法開啟相機。</Txt>
          <Button label="改用選照片" icon="image-outline" onPress={() => { close(); onUseLibrary(); }} />
          <Button label="關閉" variant="outline" onPress={close} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 12, width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {createElement('video', {
              ref: videoRef,
              autoPlay: true,
              playsInline: true,
              muted: true,
              'data-testid': 'webcam-video',
              style: { width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' },
            })}
            {count !== null ? (
              <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite">
                <Txt size={96} style={{ color: '#FFFFFF', fontWeight: '700' }}>{count}</Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button label="拍下" icon="camera-outline" style={{ flex: 1 }} onPress={() => { clearTimer(); snap(); }} disabled={!ready || count !== null} />
            {count === null ? (
              <Button label={`${COUNTDOWN_S} 秒倒數`} variant="outline" style={{ flex: 1 }} onPress={startCountdown} disabled={!ready} />
            ) : (
              <Button label="取消倒數" variant="outline" style={{ flex: 1 }} onPress={clearTimer} />
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {devices.length > 1 ? <Button label="切換鏡頭" variant="outline" height={40} style={{ flex: 1 }} onPress={nextDevice} disabled={count !== null} /> : null}
            <Button label="關閉相機" variant="outline" height={40} style={{ flex: 1 }} onPress={close} />
          </View>
        </>
      )}
    </View>
  );
}
