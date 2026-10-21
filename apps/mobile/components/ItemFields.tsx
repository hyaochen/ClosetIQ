import { useState, useMemo } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import {
  ClothingCategoryLabel,
  ColorFamilyLabel,
  PatternLabel,
  SeasonLabel,
  OccasionLabel,
  ConditionLabel,
} from '@closet/shared';
import { api } from '@/lib/api';
import { imageUrl, tileImage } from '@/lib/images';
import { useColors } from '@/lib/theme';
import { AI_LOW_CONFIDENCE, cleanSuggestedText, type Suggestion } from '@/lib/ai';
import { useStorageLocations } from '@/lib/queries';
import { Txt, FieldRow, TextField, ChipGroup, MultiChipGroup, Chip, PickerSheet } from '@/components/ui';

export type ItemFormState = ReturnType<typeof useItemForm>;

/** 新增 / 編輯共用的衣物表單狀態 */
export function useItemForm() {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [pattern, setPattern] = useState('SOLID');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [condition, setCondition] = useState('GOOD');
  const [brand, setBrand] = useState('');
  const [materials, setMaterials] = useState<string[]>([]);
  const [size, setSize] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [storageLocationId, setStorageLocationId] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>(['#000000']);
  /** AI 預填但信心低的欄位（虛線框「待確認」）；使用者動過該欄就移出 */
  const [uncertain, setUncertain] = useState<string[]>([]);
  const confirm = (key: string) => setUncertain((u) => (u.includes(key) ? u.filter((k) => k !== key) : u));

  /** 套用 AI 建議：只填還空著的欄位，不蓋掉使用者已經打的內容 */
  const applySuggestion = (s: Suggestion) => {
    const low: string[] = [];
    const mark = (key: string, f: { confidence: number } | null) => {
      if (f && f.confidence < AI_LOW_CONFIDENCE) low.push(key);
    };
    if (s.nameSuggestion && !name) { setName(cleanSuggestedText(s.nameSuggestion.value)); mark('name', s.nameSuggestion); }
    if (s.category && !category) { setCategory(s.category.value); mark('category', s.category); }
    if (s.subcategory && !subcategory) { setSubcategory(cleanSuggestedText(s.subcategory.value)); mark('subcategory', s.subcategory); }
    if (s.colorFamily && !colorFamily) { setColorFamily(s.colorFamily.value); mark('colorFamily', s.colorFamily); }
    if (s.colors) setColors(s.colors.value);
    if (s.pattern) { setPattern(s.pattern.value); mark('pattern', s.pattern); }
    if (s.material && materials.length === 0) { setMaterials([cleanSuggestedText(s.material.value)]); mark('material', s.material); }
    if (s.seasons && seasons.length === 0) { setSeasons(s.seasons.value); mark('seasons', s.seasons); }
    if (s.occasions && occasions.length === 0) { setOccasions(s.occasions.value); mark('occasions', s.occasions); }
    setUncertain(low);
  };

  const toggle = (arr: string[], key: string, set: (v: string[]) => void) =>
    set(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const fill = (item: any) => {
    setName(item.name || '');
    setCategory(item.category || '');
    setSubcategory(item.subcategory || '');
    setColorFamily(item.colorFamily || '');
    setPattern(item.pattern || 'SOLID');
    setSeasons(item.seasons || []);
    setOccasions(item.occasions || []);
    setCondition(item.condition || 'GOOD');
    setBrand(item.brand || '');
    setMaterials(item.material ? item.material.split('、').map((s: string) => s.trim()).filter(Boolean) : []);
    setSize(item.size || '');
    setPurchasePrice(item.purchasePrice ? String(Number(item.purchasePrice)) : '');
    setNotes(item.notes || '');
    setStorageLocationId(item.storageLocationId ?? null);
  };

  /** 驗證，回傳錯誤訊息或 null */
  const validate = (): string | null => {
    if (!name.trim()) return '請輸入衣物名稱';
    if (!category) return '請選擇分類';
    if (!colorFamily) return '請選擇色系';
    if (seasons.length === 0) return '請至少選擇一個季節';
    if (occasions.length === 0) return '請至少選擇一個場合';
    return null;
  };

  const payload = () => ({
    name: name.trim(),
    category,
    subcategory: subcategory || undefined,
    colors,
    colorFamily,
    pattern,
    seasons,
    occasions,
    condition,
    brand: brand || undefined,
    material: materials.length > 0 ? materials.join('、') : undefined,
    size: size || undefined,
    purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
    notes: notes || undefined,
    storageLocationId,
  });

  return {
    name, setName, category, setCategory, subcategory, setSubcategory, colorFamily, setColorFamily,
    pattern, setPattern, seasons, setSeasons, occasions, setOccasions, condition, setCondition,
    brand, setBrand, materials, setMaterials, size, setSize, purchasePrice, setPurchasePrice,
    notes, setNotes, storageLocationId, setStorageLocationId, toggle, fill, validate, payload,
    colors, uncertain, confirm, applySuggestion,
  };
}

export type PhotoExisting = { id: string; thumbnailPath: string; isPrimary: boolean };
export type PhotoNew = { uri: string };

/** 照片區：卡色底方塊縮圖 + 拍照 / 相簿 */
export function PhotoBlock({
  existing = [],
  added,
  max = 5,
  onRemoveExisting,
  onRemoveAdded,
  onPick,
}: {
  existing?: PhotoExisting[];
  added: PhotoNew[];
  max?: number;
  onRemoveExisting?: (id: string) => void;
  onRemoveAdded: (index: number) => void;
  onPick: (useCamera: boolean) => void;
}) {
  const c = useColors();
  const total = existing.length + added.length;
  const Tile = ({ children, label, onRemove, tag }: { children: React.ReactNode; label: string; onRemove: () => void; tag?: string }) => (
    <View style={{ width: 84, height: 84, backgroundColor: c.card }}>
      {children}
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`移除${label}`}
        hitSlop={8}
        style={{ position: 'absolute', top: 0, right: 0, width: 24, height: 24, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="close" size={14} color={c.onInk} />
      </Pressable>
      {tag ? (
        <View style={{ position: 'absolute', left: 0, bottom: 0, backgroundColor: c.paper, paddingHorizontal: 5 }}>
          <Txt size={10} style={{ lineHeight: 15 }}>{tag}</Txt>
        </View>
      ) : null}
    </View>
  );
  const Add = ({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 84, height: 84, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink, alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={22} color={c.ink} />
      <Txt size={12}>{label}</Txt>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {existing.map((img, i) => (
        <Tile key={img.id} label={`第 ${i + 1} 張照片`} tag={img.isPrimary ? '主圖' : undefined} onRemove={() => onRemoveExisting?.(img.id)}>
          <Image source={{ uri: imageUrl(tileImage(img.thumbnailPath).path ?? img.thumbnailPath) }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Tile>
      ))}
      {added.map((img, i) => (
        <Tile key={`n${i}`} label="新照片" tag="新增" onRemove={() => onRemoveAdded(i)}>
          <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Tile>
      ))}
      {total < max ? (
        <>
          <Add icon="camera-outline" label="拍照" onPress={() => onPick(true)} />
          <Add icon="images-outline" label="相簿" onPress={() => onPick(false)} />
        </>
      ) : null}
    </View>
  );
}

/** 表單欄位（欄位列樣式，對應 AddItem 設計稿） */
export function ItemFields({ form }: { form: ItemFormState }) {
  const c = useColors();
  const [brandFocused, setBrandFocused] = useState(false);
  const [materialInput, setMaterialInput] = useState('');
  const [materialFocused, setMaterialFocused] = useState(false);
  const [locSheet, setLocSheet] = useState(false);
  const { data: locData } = useStorageLocations();
  const locations = locData?.locations ?? [];

  const { data: brandList = [] } = useQuery<string[]>({ queryKey: ['brands'], queryFn: () => api('/api/items/brands') });
  const { data: materialList = [] } = useQuery<string[]>({ queryKey: ['materials'], queryFn: () => api('/api/items/materials') });

  const filteredBrands = useMemo(
    () => (form.brand ? brandList.filter((b) => b.toLowerCase().includes(form.brand.toLowerCase()) && b !== form.brand) : brandList),
    [form.brand, brandList]
  );
  const filteredMaterials = useMemo(
    () =>
      materialList.filter(
        (m) => !form.materials.includes(m) && (!materialInput || m.toLowerCase().includes(materialInput.toLowerCase()))
      ),
    [materialInput, materialList, form.materials]
  );

  const addMaterial = (m: string) => {
    const t = m.trim();
    if (t && !form.materials.includes(t)) form.setMaterials([...form.materials, t]);
    setMaterialInput('');
  };

  const locName = locations.find((l) => l.id === form.storageLocationId)?.name;
  const low = (key: string) => form.uncertain.includes(key);

  return (
    <View>
      <FieldRow label="名稱 *" low={low('name')}>
        <TextField serif value={form.name} onChangeText={(v) => { form.confirm('name'); form.setName(v); }} placeholder="例：白色短袖 T 恤" accessibilityLabel="名稱" />
      </FieldRow>
      <FieldRow label="分類 *" stacked low={low('category')}>
        <ChipGroup low={low('category')} items={ClothingCategoryLabel} selected={form.category} onSelect={(k) => { form.confirm('category'); form.setCategory(k); }} />
      </FieldRow>
      <FieldRow label="細分類" low={low('subcategory')}>
        <TextField value={form.subcategory} onChangeText={(v) => { form.confirm('subcategory'); form.setSubcategory(v); }} placeholder="例：Polo 衫、牛仔褲" accessibilityLabel="細分類" />
      </FieldRow>
      <FieldRow label="色系 *" stacked low={low('colorFamily')}>
        <ChipGroup low={low('colorFamily')} items={ColorFamilyLabel} selected={form.colorFamily} onSelect={(k) => { form.confirm('colorFamily'); form.setColorFamily(k); }} />
      </FieldRow>
      <FieldRow label="圖案" stacked low={low('pattern')}>
        <ChipGroup low={low('pattern')} items={PatternLabel} selected={form.pattern} onSelect={(k) => { form.confirm('pattern'); form.setPattern(k); }} />
      </FieldRow>
      <FieldRow label="季節 *" stacked low={low('seasons')}>
        <MultiChipGroup low={low('seasons')} items={SeasonLabel} selected={form.seasons} onToggle={(k) => { form.confirm('seasons'); form.toggle(form.seasons, k, form.setSeasons); }} />
      </FieldRow>
      <FieldRow label="場合 *" stacked low={low('occasions')}>
        <MultiChipGroup low={low('occasions')} items={OccasionLabel} selected={form.occasions} onToggle={(k) => { form.confirm('occasions'); form.toggle(form.occasions, k, form.setOccasions); }} />
      </FieldRow>
      <FieldRow label="狀況" stacked>
        <ChipGroup items={ConditionLabel} selected={form.condition} onSelect={form.setCondition} />
      </FieldRow>

      {/* 收納位置 */}
      <FieldRow label="收納">
        <Pressable
          onPress={() => setLocSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="選擇收納位置"
          style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Txt size={14} tone={locName ? 'ink' : 'mute'}>{locName ?? '未指定'}</Txt>
          <Ionicons name="chevron-forward" size={14} color={c.ink} />
        </Pressable>
      </FieldRow>

      {/* 品牌 */}
      <FieldRow label="品牌" stacked>
        <TextField
          value={form.brand}
          onChangeText={form.setBrand}
          placeholder="例：UNIQLO"
          accessibilityLabel="品牌"
          onFocus={() => setBrandFocused(true)}
          onBlur={() => setTimeout(() => setBrandFocused(false), 200)}
        />
        {brandFocused && filteredBrands.length > 0 ? (
          <View style={{ borderWidth: 1, borderColor: c.ink, maxHeight: 160, backgroundColor: c.paper }}>
            <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {filteredBrands.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => { form.setBrand(b); setBrandFocused(false); }}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: pressed ? c.card : 'transparent' })}
                >
                  <Txt size={14}>{b}</Txt>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </FieldRow>

      {/* 材質 */}
      <FieldRow label="材質" stacked low={low('material')}>
        {form.materials.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {form.materials.map((m) => (
              <Chip
                key={m}
                label={m}
                selected={!low('material')}
                dashed={low('material')}
                onPress={() => { form.confirm('material'); form.setMaterials(form.materials.filter((x) => x !== m)); }}
                trailing={<Ionicons name="close" size={12} color={low('material') ? c.accent : c.onInk} />}
              />
            ))}
          </View>
        ) : null}
        <TextField
          value={materialInput}
          onChangeText={(v) => { form.confirm('material'); setMaterialInput(v); }}
          placeholder="輸入材質，按 Enter 加入（例：棉）"
          accessibilityLabel="材質"
          onFocus={() => setMaterialFocused(true)}
          onBlur={() => setTimeout(() => setMaterialFocused(false), 200)}
          onSubmitEditing={() => addMaterial(materialInput)}
          returnKeyType="done"
        />
        {materialFocused && filteredMaterials.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {filteredMaterials.slice(0, 12).map((m) => (
              <Chip key={m} label={m} onPress={() => addMaterial(m)} />
            ))}
          </View>
        ) : null}
      </FieldRow>

      <FieldRow label="尺寸">
        <TextField value={form.size} onChangeText={form.setSize} placeholder="M" accessibilityLabel="尺寸" />
      </FieldRow>
      <FieldRow label="價格">
        <TextField value={form.purchasePrice} onChangeText={form.setPurchasePrice} placeholder="購買價格（元）" keyboardType="numeric" accessibilityLabel="購買價格" />
      </FieldRow>
      <FieldRow label="備註" stacked>
        <TextField value={form.notes} onChangeText={form.setNotes} placeholder="其他記錄" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} accessibilityLabel="備註" />
      </FieldRow>

      <PickerSheet
        visible={locSheet}
        title="收納位置"
        selected={form.storageLocationId ?? ''}
        onClose={() => setLocSheet(false)}
        onSelect={(v) => { form.setStorageLocationId(v || null); setLocSheet(false); }}
        options={[
          { value: '', label: '未指定' },
          ...locations.map((l) => ({ value: l.id, label: l.name, hint: l.isOffSeason ? '換季收納處' : undefined })),
        ]}
      />
    </View>
  );
}

