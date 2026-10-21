import { useState } from 'react';
import { View, ScrollView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api, tokenStorage } from '@/lib/api';
import { API_BASE } from '@/lib/images';
import { queryClient } from '@/lib/query-client';
import { invalidateWardrobe } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { Txt, Serif, Button, Screen } from '@/components/ui';
import { ItemFields, PhotoBlock, useItemForm, type PhotoNew } from '@/components/ItemFields';

type SelectedImage = PhotoNew & { type?: string; fileName?: string };

export default function AddItemScreen() {
  const c = useColors();
  const form = useItemForm();
  const [images, setImages] = useState<SelectedImage[]>([]);
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
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
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

  const handleSubmit = async () => {
    const err = form.validate();
    if (err) {
      showAlert('提示', err);
      return;
    }

    setLoading(true);
    try {
      // 1. 建立衣物
      const { item } = await api('/api/items', { method: 'POST', body: JSON.stringify(form.payload()) });

      // 2. 上傳照片
      const token = await tokenStorage.get('accessToken');
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const formData = new FormData();

        if (Platform.OS === 'web') {
          const response = await fetch(img.uri);
          const blob = await response.blob();
          formData.append('file', blob, img.fileName || 'photo.jpg');
        } else {
          formData.append('file', { uri: img.uri, type: img.type || 'image/jpeg', name: img.fileName || 'photo.jpg' } as any);
        }

        await fetch(`${API_BASE}/api/items/${item.id}/images?primary=${i === 0 ? 'true' : 'false'}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      invalidateWardrobe();
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      showAlert('成功', '衣物已新增');
      router.back();
    } catch (e: any) {
      showAlert('新增失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      {/* 頂欄：取消 / 新增衣物 */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <View style={{ height: 54, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe'))} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Txt size={14}>取消</Txt>
          </Pressable>
          <Serif size={17} accessibilityRole="header">新增衣物</Serif>
          <View style={{ width: 52 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
          <Txt size={12} tone="mute" letterSpacing={1.2} style={{ marginBottom: 8 }}>照片（最多 5 張，第一張為主圖）</Txt>
          <PhotoBlock added={images} onRemoveAdded={(i) => setImages((p) => p.filter((_, k) => k !== i))} onPick={pickImage} />
          <View style={{ height: 14 }} />
          <ItemFields form={form} />
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
          <Button label="存進衣櫃" onPress={handleSubmit} loading={loading} />
        </View>
      </View>
    </View>
  );
}
