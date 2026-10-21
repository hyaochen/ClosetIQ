import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ClothingCategoryLabel, ColorFamilyLabel, SeasonLabel, OccasionLabel,
} from '@closet/shared';
import { showAlert } from '@/lib/alert';
import { isHttpUrl, type WishlistItem, type PickedImage } from '@/lib/wishlist';
import { Txt, FieldRow, TextField, ChipGroup, MultiChipGroup } from '@/components/ui';
import { PhotoBlock } from '@/components/ItemFields';

/** 新增 / 編輯共用的願望清單表單狀態 */
export function useWishlistForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);

  const toggle = (arr: string[], key: string, set: (v: string[]) => void) =>
    set(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const fill = (w: WishlistItem) => {
    setName(w.name);
    setCategory(w.category);
    setSubcategory(w.subcategory ?? '');
    setColorFamily(w.colorFamily);
    setSeasons(w.seasons ?? []);
    setOccasions(w.occasions ?? []);
    setPrice(w.price !== null && w.price !== undefined ? String(w.price) : '');
    setUrl(w.url ?? '');
    setNote(w.note ?? '');
  };

  const validate = (): string | null => {
    if (!name.trim()) return '請輸入名稱';
    if (!category) return '請選擇分類';
    if (!colorFamily) return '請選擇色系';
    if (price.trim() && (Number.isNaN(Number(price)) || Number(price) < 0)) return '價格請輸入大於等於 0 的數字';
    if (url.trim() && !isHttpUrl(url)) return '商品連結必須以 http:// 或 https:// 開頭';
    return null;
  };

  /** 建立用：空欄位不送 */
  const createPayload = () => ({
    name: name.trim(),
    category,
    subcategory: subcategory.trim() || undefined,
    colorFamily,
    colors: [] as string[],
    seasons,
    occasions,
    price: price.trim() ? Number(price) : undefined,
    url: url.trim() || undefined,
    note: note.trim() || undefined,
  });

  /** 更新用：清空的欄位送 null 以真正清除 */
  const updatePayload = () => ({
    name: name.trim(),
    category,
    subcategory: subcategory.trim() || null,
    colorFamily,
    seasons,
    occasions,
    price: price.trim() ? Number(price) : null,
    url: url.trim() || null,
    note: note.trim() || null,
  });

  return {
    name, setName, category, setCategory, subcategory, setSubcategory, colorFamily, setColorFamily,
    seasons, setSeasons, occasions, setOccasions, price, setPrice, url, setUrl, note, setNote,
    image, setImage, toggle, fill, validate, createPayload, updatePayload,
  };
}

export type WishlistFormState = ReturnType<typeof useWishlistForm>;

/** 選圖（相機／相簿），單張 */
export async function pickWishlistImage(useCamera: boolean): Promise<PickedImage | null> {
  const perm = useCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    showAlert('需要權限', useCamera ? '請允許使用相機' : '請允許存取相簿');
    return null;
  }
  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
  if (result.canceled || !result.assets[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, type: a.mimeType || 'image/jpeg', fileName: a.fileName || 'photo.jpg' };
}

/** 欄位列樣式比照新增衣物表單 */
export function WishlistFields({
  form,
  existingThumb,
}: {
  form: WishlistFormState;
  existingThumb?: string | null;
}) {
  const hasExisting = !!existingThumb && !form.image;
  return (
    <View>
      <Txt size={12} tone="mute" letterSpacing={1.2} style={{ marginBottom: 8 }}>照片（選填，一張）</Txt>
      <PhotoBlock
        existing={hasExisting ? [{ id: 'current', thumbnailPath: existingThumb as string, isPrimary: true }] : []}
        added={form.image ? [form.image] : []}
        max={hasExisting ? 2 : 1}
        onRemoveAdded={() => form.setImage(null)}
        onRemoveExisting={() => {
          showAlert('更換照片', '直接選擇新的照片即可取代現有照片。');
        }}
        onPick={async (cam) => {
          const img = await pickWishlistImage(cam);
          if (img) form.setImage(img);
        }}
      />
      <View style={{ height: 14 }} />

      <FieldRow label="名稱 *">
        <TextField serif value={form.name} onChangeText={form.setName} placeholder="例：橄欖綠工裝襯衫" accessibilityLabel="名稱" />
      </FieldRow>
      <FieldRow label="分類 *" stacked>
        <ChipGroup items={ClothingCategoryLabel} selected={form.category} onSelect={form.setCategory} />
      </FieldRow>
      <FieldRow label="細分類">
        <TextField value={form.subcategory} onChangeText={form.setSubcategory} placeholder="例：襯衫、牛仔褲" accessibilityLabel="細分類" />
      </FieldRow>
      <FieldRow label="色系 *" stacked>
        <ChipGroup items={ColorFamilyLabel} selected={form.colorFamily} onSelect={form.setColorFamily} />
      </FieldRow>
      <FieldRow label="季節" stacked>
        <MultiChipGroup items={SeasonLabel} selected={form.seasons} onToggle={(k) => form.toggle(form.seasons, k, form.setSeasons)} />
        <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>不選 = 不限季節</Txt>
      </FieldRow>
      <FieldRow label="場合" stacked>
        <MultiChipGroup items={OccasionLabel} selected={form.occasions} onToggle={(k) => form.toggle(form.occasions, k, form.setOccasions)} />
        <Txt size={11} tone="mute" style={{ lineHeight: 16 }}>不選 = 不限場合</Txt>
      </FieldRow>
      <FieldRow label="價格">
        <TextField value={form.price} onChangeText={form.setPrice} placeholder="預計價格（元）" keyboardType="numeric" accessibilityLabel="價格" />
      </FieldRow>
      <FieldRow label="連結">
        <TextField
          value={form.url}
          onChangeText={form.setUrl}
          placeholder="https://"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="商品連結"
        />
      </FieldRow>
      <FieldRow label="備註" stacked>
        <TextField value={form.note} onChangeText={form.setNote} placeholder="尺寸、折扣日、想搭什麼" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} accessibilityLabel="備註" />
      </FieldRow>
    </View>
  );
}
