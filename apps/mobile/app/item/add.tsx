import { ReactNode, useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { imageUrl, API_BASE } from '@/lib/images';
import { queryClient } from '@/lib/query-client';
import { invalidateWardrobe, useStorageLocations } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { useAnalyzeStatus, analyzeImage, type Suggestion } from '@/lib/ai';
import {
  uploadItemImage,
  useCutoutStatus,
  recutout,
  skipCutoutOnServer,
  discardDraft,
  type PickedPhoto,
} from '@/lib/cutout';
import { Txt, Serif, Numeral, Button } from '@/components/ui';
import { CheckerFrame } from '@/components/CheckerFrame';
import { ItemFields, PhotoBlock, useItemForm } from '@/components/ItemFields';

type Step = 1 | 2 | 3;
const STEPS = ['拍照', '去背', '確認'];
const MAX_EXTRA = 4; // 主圖之外最多再加 4 張
type AiState = 'idle' | 'loading' | 'done' | 'error';

export default function AddItemScreen() {
  const c = useColors();
  const form = useItemForm();
  const { data: aiStatus } = useAnalyzeStatus();
  const { data: locData } = useStorageLocations();

  const [step, setStep] = useState<Step>(1);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [draft, setDraft] = useState<{ itemId: string; imageId: string; firstStatus: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [extra, setExtra] = useState<PickedPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiState, setAiState] = useState<AiState>('idle');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savedRef = useRef(false);

  const { data: cutData } = useCutoutStatus(draft?.imageId ?? null);
  const cut = cutData?.image;
  const cutStatus = cut?.cutoutStatus ?? draft?.firstStatus ?? 'PENDING';

  // 沒存就離開（上一頁等導覽）：把草稿清掉
  useEffect(() => {
    return () => {
      const d = draftRef.current;
      if (d && !savedRef.current) void discardDraft(d.itemId, [d.imageId]);
    };
  }, []);

  // 關閉分頁／重新整理時 effect cleanup 不會跑：用 keepalive 請求盡量清掉草稿（做不到的由後端 24 小時後清）
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onHide = () => {
      const d = draftRef.current;
      if (!d || savedRef.current) return;
      try {
        fetch(`${API_BASE}/api/items/${d.itemId}?permanent=true`, {
          method: 'DELETE',
          keepalive: true,
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        });
      } catch {
        // 盡力而為
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // AI 建議回來後只填還空著的欄位
  useEffect(() => {
    if (suggestion) form.applySuggestion(suggestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion]);

  const pickPhoto = async (useCamera: boolean, multiple = false, limit = 1): Promise<PickedPhoto[]> => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('需要權限', useCamera ? '請允許使用相機' : '請允許存取相簿');
      return [];
    }
    // 不裁切：去背需要完整的衣物輪廓
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
          allowsMultipleSelection: multiple,
          selectionLimit: multiple ? limit : 1,
        });
    if (result.canceled) return [];
    return result.assets.map((a) => ({ uri: a.uri, type: a.mimeType || 'image/jpeg', fileName: a.fileName || 'photo.jpg' }));
  };

  /** 第 1 步 -> 第 2 步：建立隱藏的草稿衣物、上傳主圖（後端背景去背）、並行請 AI 辨識 */
  const start = async (useCamera: boolean) => {
    const [p] = await pickPhoto(useCamera);
    if (!p) return;
    setPhoto(p);
    setStep(2);
    setStarting(true);
    try {
      const { item } = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          draft: true,
          name: '未命名衣物',
          category: 'TOP',
          colors: ['#000000'],
          colorFamily: 'BLACK',
          seasons: ['SPRING'],
          occasions: ['CASUAL'],
        }),
      });
      let image;
      try {
        image = await uploadItemImage(item.id, p, true);
      } catch (e) {
        await discardDraft(item.id, []);
        throw e;
      }
      setDraft({ itemId: item.id, imageId: image.id, firstStatus: image.cutoutStatus });
      if (image.cutoutStatus === 'NONE') setStep(3); // 沒有去背服務：直接進確認
      if (aiStatus?.enabled) {
        setAiState('loading');
        analyzeImage(image.id)
          .then((s) => { setSuggestion(s); setAiState('done'); })
          .catch(() => setAiState('error'));
      }
    } catch (e: any) {
      showAlert('上傳失敗', e.message);
      setStep(1);
      setPhoto(null);
    } finally {
      setStarting(false);
    }
  };

  const retake = async () => {
    const d = draftRef.current;
    if (step === 3 && form.name) {
      const ok = await showConfirm('重新拍照', '已填的欄位會保留，但這張照片會換掉。要重拍嗎？');
      if (!ok) return;
    }
    if (d) await discardDraft(d.itemId, [d.imageId]);
    setDraft(null);
    setPhoto(null);
    setSuggestion(null);
    setAiState('idle');
    setStep(1);
  };

  const cancel = async () => {
    if (draftRef.current) {
      const ok = await showConfirm('放棄新增', '這件衣物還沒存，要放棄嗎？');
      if (!ok) return;
    }
    router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe');
  };

  const useOriginal = async () => {
    if (!draft) return;
    setBusyAction(true);
    try {
      await skipCutoutOnServer(draft.imageId);
      setStep(3);
    } catch (e: any) {
      showAlert('操作失敗', e.message);
    } finally {
      setBusyAction(false);
    }
  };

  const redoCutout = async () => {
    if (!draft) return;
    setBusyAction(true);
    try {
      await recutout(draft.imageId);
    } catch (e: any) {
      showAlert('重新去背失敗', e.message);
    } finally {
      setBusyAction(false);
    }
  };

  const addExtra = async (useCamera: boolean) => {
    const picked = await pickPhoto(useCamera, true, MAX_EXTRA - extra.length);
    if (picked.length) setExtra((prev) => [...prev, ...picked].slice(0, MAX_EXTRA));
  };

  const handleSubmit = async () => {
    if (!draft) return;
    const err = form.validate();
    if (err) {
      showAlert('提示', err);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/items/${draft.itemId}`, { method: 'PUT', body: JSON.stringify({ ...form.payload(), draft: false }) });
      savedRef.current = true;
      for (const p of extra) {
        try {
          await uploadItemImage(draft.itemId, p, false);
        } catch {
          // 其他照片上傳失敗不影響主圖與衣物
        }
      }
      invalidateWardrobe();
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      showAlert('成功', '衣物已存入衣櫃');
      router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe');
    } catch (e: any) {
      showAlert('儲存失敗', e.message);
    } finally {
      setSaving(false);
    }
  };

  const locName = (locData?.locations ?? []).find((l) => l.id === form.storageLocationId)?.name ?? '未指定';
  const cutDone = cutStatus === 'DONE' && !!cut?.cutoutPath;
  const pending = cutStatus === 'PENDING' || starting;

  // ---- 共用片段（用函式回傳 JSX，避免每次 render 重新掛載圖片） ----
  const header = (
    <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
      <View style={{ height: 54, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
        <Pressable onPress={cancel} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Txt size={14}>{step === 1 ? '取消' : '放棄'}</Txt>
        </Pressable>
        <Serif size={17} accessibilityRole="header">新增衣物</Serif>
        <View style={{ width: 52, alignItems: 'flex-end', paddingRight: 8 }}>
          <Numeral size={16}>{`${step} / 3`}</Numeral>
        </View>
      </View>
    </View>
  );

  const stepBars = (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 12 }}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const cur = n === step;
        return (
          <View key={label} style={{ flex: 1, gap: 4 }}>
            <View style={{ height: 3, backgroundColor: done ? c.ink : cur ? c.accent : c.line }} />
            <Txt size={11} letterSpacing={1.1} style={{ color: cur ? c.accent : c.mute }}>{`${n} ${label}`}</Txt>
          </View>
        );
      })}
    </View>
  );

  const preview = (height: number) => {
    const tag = cutDone ? '已去背' : pending ? '去背中' : cutStatus === 'FAILED' ? '去背失敗' : '原圖';
    return (
      <CheckerFrame height={height} style={{ marginHorizontal: 20, marginTop: 12 }}>
        {cutDone ? (
          <View style={{ width: '100%', height: '100%', padding: 14 }}>
            <Image
              source={{ uri: imageUrl(cut!.cutoutPath!) }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              accessibilityLabel="去背後的衣物"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: '100%', opacity: pending ? 0.45 : 1 }}
            contentFit="contain"
            accessibilityLabel="原始照片"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {pending ? (
          <View style={{ position: 'absolute', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={c.ink} />
            <Txt size={13} letterSpacing={1.2}>去背處理中，約幾秒</Txt>
          </View>
        ) : null}
        <View style={{ position: 'absolute', left: 10, top: 10, backgroundColor: c.ink, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Txt size={11} letterSpacing={1.3} style={{ color: c.onInk, lineHeight: 16 }}>{tag}</Txt>
        </View>
        <Pressable
          onPress={retake}
          accessibilityRole="button"
          accessibilityLabel="重拍"
          hitSlop={10}
          style={{ position: 'absolute', right: 10, bottom: 6, minHeight: 32, justifyContent: 'center' }}
        >
          <Txt size={12} style={{ textDecorationLine: 'underline' }}>重拍</Txt>
        </Pressable>
      </CheckerFrame>
    );
  };

  const bottomBar = (children: ReactNode) => (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
      <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {children}
      </View>
    </View>
  );

  // ---- 第 1 步：拍照 ----
  if (step === 1) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        {header}
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {stepBars}
          <View
            style={{ marginHorizontal: 20, marginTop: 12, height: 260, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 24 }}
          >
            <Ionicons name="camera-outline" size={40} color={c.ink} />
            <Serif size={18}>拍一張衣物照</Serif>
            <Txt size={12} tone="mute" style={{ textAlign: 'center', lineHeight: 19 }}>
              平放或掛起來、單件入鏡，背景越單純，去背越乾淨
            </Txt>
          </View>
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 10 }}>
            <Button label="拍照" icon="camera-outline" onPress={() => start(true)} />
            <Button label="從相簿選" icon="images-outline" variant="outline" onPress={() => start(false)} />
          </View>
        </View>
      </View>
    );
  }

  // ---- 第 2 步：去背 ----
  if (step === 2) {
    return (
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        {header}
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {stepBars}
          {preview(300)}
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 4 }}>
            <Serif size={18}>{cutDone ? '去背完成' : cutStatus === 'FAILED' ? '這張去背沒成功' : '正在幫你去背'}</Serif>
            <Txt size={13} tone="mute" style={{ lineHeight: 20 }}>
              {cutDone
                ? '衣物會放在卡色底上顯示。不滿意可以改用原圖。'
                : cutStatus === 'FAILED'
                  ? '可以重新去背一次，或直接用原圖繼續。'
                  : '不想等的話，可以先用原圖繼續。'}
            </Txt>
          </View>
        </View>
        {bottomBar(
          <>
            {cutStatus === 'FAILED' ? (
              <Button label="重新去背" variant="outline" style={{ flex: 1 }} loading={busyAction} onPress={redoCutout} />
            ) : (
              <Button label="用原圖" variant="outline" style={{ flex: 1 }} loading={busyAction} disabled={!draft} onPress={useOriginal} />
            )}
            <Button label="下一步" style={{ flex: 1.4 }} disabled={pending || !draft} onPress={() => setStep(3)} />
          </>
        )}
      </View>
    );
  }

  // ---- 第 3 步：確認 ----
  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
          {stepBars}
          {preview(180)}

          <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
            {aiStatus?.enabled ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Serif size={18} accessibilityRole="header">AI 辨識結果</Serif>
                {aiState === 'loading' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ActivityIndicator size="small" color={c.mute} />
                    <Txt size={11} tone="mute">辨識中</Txt>
                  </View>
                ) : aiState === 'done' ? (
                  <Txt size={11} tone="mute">點一下即可修改</Txt>
                ) : aiState === 'error' ? (
                  <Txt size={11} tone="mute">暫時無法辨識，請手動填寫</Txt>
                ) : null}
              </View>
            ) : null}
            <View style={{ marginTop: aiStatus?.enabled ? 4 : 0 }}>
              <ItemFields form={form} />
            </View>

            <View style={{ marginTop: 16 }}>
              <Txt size={12} tone="mute" letterSpacing={1.2} style={{ marginBottom: 8 }}>更多照片（選填，最多再加 4 張）</Txt>
              <PhotoBlock
                added={extra}
                max={MAX_EXTRA}
                onRemoveAdded={(i) => setExtra((p) => p.filter((_, k) => k !== i))}
                onPick={addExtra}
              />
            </View>
          </View>
        </View>
      </ScrollView>
      {bottomBar(
        <>
          <View style={{ flex: 1 }}>
            <Txt size={11} tone="mute" letterSpacing={1.1}>收納位置</Txt>
            <Txt size={14} numberOfLines={1}>{locName}</Txt>
          </View>
          <Button label="存入衣櫃" loading={saving} onPress={handleSubmit} style={{ paddingHorizontal: 26 }} />
        </>
      )}
    </View>
  );
}
