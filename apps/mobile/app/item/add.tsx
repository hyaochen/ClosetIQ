import { useState, useMemo } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import {
  ClothingCategoryLabel,
  ColorFamilyLabel,
  PatternLabel,
  SeasonLabel,
  OccasionLabel,
  ConditionLabel,
} from '@closet/shared';
import { api, tokenStorage } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { showAlert } from '@/lib/alert';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

type SelectedImage = {
  uri: string;
  type?: string;
  fileName?: string;
};

export default function AddItemScreen() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [colorFamily, setColorFamily] = useState('');
  const [pattern, setPattern] = useState('SOLID');
  const [seasons, setSeasons] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [condition, setCondition] = useState('GOOD');
  const [brand, setBrand] = useState('');
  const [brandFocused, setBrandFocused] = useState(false);
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialInput, setMaterialInput] = useState('');
  const [materialFocused, setMaterialFocused] = useState(false);
  const [size, setSize] = useState('');

  const { data: brandList = [] } = useQuery<string[]>({
    queryKey: ['brands'],
    queryFn: () => api('/api/items/brands'),
  });
  const { data: materialList = [] } = useQuery<string[]>({
    queryKey: ['materials'],
    queryFn: () => api('/api/items/materials'),
  });

  const filteredBrands = useMemo(() => {
    if (!brand) return brandList;
    return brandList.filter(b => b.toLowerCase().includes(brand.toLowerCase()));
  }, [brand, brandList]);

  const filteredMaterials = useMemo(() => {
    if (!materialInput) return materialList.filter(m => !materials.includes(m));
    return materialList.filter(m => !materials.includes(m) && m.toLowerCase().includes(materialInput.toLowerCase()));
  }, [materialInput, materialList, materials]);

  const addMaterial = (m: string) => {
    const trimmed = m.trim();
    if (trimmed && !materials.includes(trimmed)) {
      setMaterials(prev => [...prev, trimmed]);
    }
    setMaterialInput('');
  };

  const removeMaterial = (m: string) => {
    setMaterials(prev => prev.filter(x => x !== m));
  };
  const [purchasePrice, setPurchasePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      showAlert('需要權限', useCamera ? '請允許使用相機' : '請允許存取相簿');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
          allowsMultipleSelection: true,
          selectionLimit: 5 - images.length,
        });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || 'photo.jpg',
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleArrayItem = (arr: string[], item: string, setter: (v: string[]) => void) => {
    setter(arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item]);
  };

  const handleSubmit = async () => {
    if (!name) { showAlert('提示', '請輸入衣物名稱'); return; }
    if (!category) { showAlert('提示', '請選擇分類'); return; }
    if (!colorFamily) { showAlert('提示', '請選擇色系'); return; }
    if (seasons.length === 0) { showAlert('提示', '請至少選擇一個季節'); return; }
    if (occasions.length === 0) { showAlert('提示', '請至少選擇一個場合'); return; }

    setLoading(true);
    try {
      // 1. Create the item
      const { item } = await api('/api/items', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          subcategory: subcategory || undefined,
          colors: ['#000000'], // Default, can be enhanced later
          colorFamily,
          pattern,
          seasons,
          occasions,
          condition,
          brand: brand || undefined,
          material: materials.length > 0 ? materials.join('\u3001') : undefined,
          size: size || undefined,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
          notes: notes || undefined,
        }),
      });

      // 2. Upload images
      const token = await tokenStorage.get('accessToken');
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const formData = new FormData();

        if (Platform.OS === 'web') {
          // On web, fetch the blob from the URI
          const response = await fetch(img.uri);
          const blob = await response.blob();
          formData.append('file', blob, img.fileName || 'photo.jpg');
        } else {
          formData.append('file', {
            uri: img.uri,
            type: img.type || 'image/jpeg',
            name: img.fileName || 'photo.jpg',
          } as any);
        }

        await fetch(
          `${API_BASE}/api/items/${item.id}/images?primary=${i === 0 ? 'true' : 'false'}`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );
      }

      // 3. Invalidate queries and navigate
      queryClient.invalidateQueries({ queryKey: ['items'] });
      showAlert('成功', '衣物已新增');
      router.back();
    } catch (err: any) {
      showAlert('新增失敗', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Image Upload */}
      <View className="px-5 pt-4">
        <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">照片</Text>
        <View className="flex-row flex-wrap gap-2">
          {images.map((img, idx) => (
            <View key={idx} className="w-20 h-20 rounded-lg overflow-hidden relative">
              <Image source={{ uri: img.uri }} style={{ width: 80, height: 80 }} contentFit="cover" />
              <Pressable
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
                onPress={() => removeImage(idx)}
              >
                <Ionicons name="close" size={12} color="white" />
              </Pressable>
            </View>
          ))}
          {images.length < 5 && (
            <View className="flex-row gap-2">
              <Pressable
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 items-center justify-center"
                onPress={() => pickImage(true)}
              >
                <Ionicons name="camera-outline" size={24} color="#9ca3af" />
                <Text className="text-xs text-gray-400 mt-0.5">拍照</Text>
              </Pressable>
              <Pressable
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 items-center justify-center"
                onPress={() => pickImage(false)}
              >
                <Ionicons name="images-outline" size={24} color="#9ca3af" />
                <Text className="text-xs text-gray-400 mt-0.5">相簿</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {/* Name */}
      <FormSection label="名稱 *">
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
          placeholder="例：白色短袖 T 恤"
          placeholderTextColor="#9ca3af"
          value={name}
          onChangeText={setName}
        />
      </FormSection>

      {/* Category */}
      <FormSection label="分類 *">
        <ChipGroup
          items={ClothingCategoryLabel}
          selected={category}
          onSelect={setCategory}
        />
      </FormSection>

      {/* Subcategory */}
      <FormSection label="細分類">
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
          placeholder="例：Polo 衫、牛仔褲"
          placeholderTextColor="#9ca3af"
          value={subcategory}
          onChangeText={setSubcategory}
        />
      </FormSection>

      {/* Color */}
      <FormSection label="色系 *">
        <ChipGroup
          items={ColorFamilyLabel}
          selected={colorFamily}
          onSelect={setColorFamily}
        />
      </FormSection>

      {/* Pattern */}
      <FormSection label="圖案">
        <ChipGroup items={PatternLabel} selected={pattern} onSelect={setPattern} />
      </FormSection>

      {/* Season */}
      <FormSection label="季節 *（可複選）">
        <MultiChipGroup
          items={SeasonLabel}
          selected={seasons}
          onToggle={(k) => toggleArrayItem(seasons, k, setSeasons)}
        />
      </FormSection>

      {/* Occasion */}
      <FormSection label="場合 *（可複選）">
        <MultiChipGroup
          items={OccasionLabel}
          selected={occasions}
          onToggle={(k) => toggleArrayItem(occasions, k, setOccasions)}
        />
      </FormSection>

      {/* Condition */}
      <FormSection label="狀態">
        <ChipGroup items={ConditionLabel} selected={condition} onSelect={setCondition} />
      </FormSection>

      {/* Brand */}
      <FormSection label="品牌">
        <View>
          <TextInput
            className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
            placeholder="例：UNIQLO"
            placeholderTextColor="#9ca3af"
            value={brand}
            onChangeText={setBrand}
            onFocus={() => setBrandFocused(true)}
            onBlur={() => setTimeout(() => setBrandFocused(false), 200)}
          />
          {brandFocused && filteredBrands.length > 0 && (
            <View className="border border-gray-200 dark:border-gray-700 rounded-xl mt-1 bg-white dark:bg-gray-900 overflow-hidden max-h-[160px]">
              <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {filteredBrands.map((b) => (
                  <Pressable
                    key={b}
                    className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 active:bg-gray-100 dark:active:bg-gray-800"
                    onPress={() => { setBrand(b); setBrandFocused(false); }}
                  >
                    <Text className="text-sm text-gray-900 dark:text-gray-50">{b}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </FormSection>

      {/* Material */}
      <FormSection label="材質">
        <View>
          {materials.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mb-2">
              {materials.map((m) => (
                <View key={m} className="flex-row items-center bg-primary-600 rounded-full px-3 py-1.5">
                  <Text className="text-sm text-white mr-1">{m}</Text>
                  <Pressable onPress={() => removeMaterial(m)} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="white" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <View className="flex-row gap-2">
            <TextInput
              className="flex-1 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
              placeholder="輸入材質，例：棉"
              placeholderTextColor="#9ca3af"
              value={materialInput}
              onChangeText={setMaterialInput}
              onFocus={() => setMaterialFocused(true)}
              onBlur={() => setTimeout(() => setMaterialFocused(false), 200)}
              onSubmitEditing={() => { if (materialInput.trim()) addMaterial(materialInput); }}
              returnKeyType="done"
            />
            {materialInput.trim() ? (
              <Pressable
                className="bg-primary-600 rounded-xl px-4 items-center justify-center active:bg-primary-700"
                onPress={() => addMaterial(materialInput)}
              >
                <Ionicons name="add" size={20} color="white" />
              </Pressable>
            ) : null}
          </View>
          {materialFocused && filteredMaterials.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mt-2">
              {filteredMaterials.map((m) => (
                <Pressable
                  key={m}
                  className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-800"
                  onPress={() => addMaterial(m)}
                >
                  <Text className="text-sm text-gray-700 dark:text-gray-300">{m}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </FormSection>

      {/* Size */}
      <FormSection label="尺寸">
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
          placeholder="M"
          placeholderTextColor="#9ca3af"
          value={size}
          onChangeText={setSize}
        />
      </FormSection>

      {/* Price */}
      <FormSection label="購買價格（元）">
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50"
          placeholder="590"
          placeholderTextColor="#9ca3af"
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          keyboardType="numeric"
        />
      </FormSection>

      {/* Notes */}
      <FormSection label="備註">
        <TextInput
          className="border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 bg-white dark:bg-gray-900 text-base text-gray-900 dark:text-gray-50 min-h-[80px]"
          placeholder="其他記錄..."
          placeholderTextColor="#9ca3af"
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />
      </FormSection>

      {/* Submit */}
      <View className="px-5 mt-6">
        <Pressable
          className="bg-primary-600 rounded-xl py-4 items-center active:bg-primary-700"
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text className="text-white text-base font-semibold">
            {loading ? '儲存中...' : '儲存衣物'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-5 mt-4">
      <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</Text>
      {children}
    </View>
  );
}

function ChipGroup({
  items,
  selected,
  onSelect,
}: {
  items: Record<string, string>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {Object.entries(items).map(([key, label]) => (
        <Pressable
          key={key}
          className={`px-3.5 py-2 rounded-full ${
            selected === key ? 'bg-primary-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
          }`}
          onPress={() => onSelect(key)}
        >
          <Text className={`text-sm ${selected === key ? 'text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function MultiChipGroup({
  items,
  selected,
  onToggle,
}: {
  items: Record<string, string>;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {Object.entries(items).map(([key, label]) => (
        <Pressable
          key={key}
          className={`px-3.5 py-2 rounded-full ${
            selected.includes(key) ? 'bg-primary-600' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
          }`}
          onPress={() => onToggle(key)}
        >
          <Text className={`text-sm ${selected.includes(key) ? 'text-white font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
