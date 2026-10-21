import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { PickerSheet } from '@/components/ui';
import { pickPhoto, type PickedPhoto } from '@/lib/journal';
import { showAlert } from '@/lib/alert';

/**
 * 取得 OOTD 照片：web 直接開檔案選擇（手機瀏覽器可選相機），
 * native 先問「拍照／相簿」。回傳 ask() 與要放進畫面的 sheet 元素。
 */
export function usePhotoSource() {
  const [resolver, setResolver] = useState<null | { resolve: (p: PickedPhoto | null) => void }>(null);

  const ask = useCallback(async (): Promise<PickedPhoto | null> => {
    try {
      if (Platform.OS === 'web') return await pickPhoto('library');
      return await new Promise<PickedPhoto | null>((resolve) => setResolver({ resolve }));
    } catch (e: any) {
      showAlert('無法取得照片', e.message);
      return null;
    }
  }, []);

  const choose = async (source: 'camera' | 'library') => {
    const r = resolver;
    setResolver(null);
    if (!r) return;
    try {
      r.resolve(await pickPhoto(source));
    } catch (e: any) {
      showAlert('無法取得照片', e.message);
      r.resolve(null);
    }
  };

  const sheet = (
    <PickerSheet
      visible={!!resolver}
      title="選擇照片來源"
      options={[
        { value: 'camera', label: '拍照', hint: '用相機拍下今天的穿搭' },
        { value: 'library', label: '從相簿選擇' },
      ]}
      onSelect={(v) => choose(v as 'camera' | 'library')}
      onClose={() => {
        resolver?.resolve(null);
        setResolver(null);
      }}
    />
  );

  return { ask, sheet };
}
