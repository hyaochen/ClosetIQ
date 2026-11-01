import { useState } from 'react';
import { View, ScrollView, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { imageUrl, fullImage } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { requestTryon, downloadDataUrl, useTryonStatus } from '@/lib/tryon';
import type { PickedPhoto } from '@/lib/cutout';
import { TopBar, Txt, Serif, Eyebrow, Button } from '@/components/ui';

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
  const [running, setRunning] = useState(false);

  const pick = async (useCamera: boolean) => {
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
    setPhoto({ uri: a.uri, type: a.mimeType || 'image/jpeg', fileName: a.fileName || 'person.jpg' });
    setResult(null);
  };

  const run = async () => {
    if (!id || !photo) return;
    setRunning(true);
    try {
      setResult(await requestTryon(id, photo));
    } catch (err: any) {
      showAlert('試穿失敗', err.message);
    } finally {
      setRunning(false);
    }
  };

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
                  <Button label={running ? '合成中，請稍候' : '開始試穿'} onPress={run} loading={running} disabled={running} />
                </View>
              ) : null}

              {running ? (
                <Txt size={12} tone="mute" style={{ marginTop: 10 }}>正在合成，請保持此頁開啟。</Txt>
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
