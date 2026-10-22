import { useState, useEffect } from 'react';
import { View, ScrollView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { api, tokenStorage } from '@/lib/api';
import { API_BASE } from '@/lib/images';
import { queryClient } from '@/lib/query-client';
import { invalidateWardrobe } from '@/lib/queries';
import { useColors } from '@/lib/theme';
import { showAlert } from '@/lib/alert';
import { Txt, Serif, Button } from '@/components/ui';
import { ItemFields, PhotoBlock, useItemForm, type PhotoExisting, type PhotoNew } from '@/components/ItemFields';

type NewImage = PhotoNew & { type?: string; fileName?: string };

export default function EditItemScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const form = useItemForm();

  const { data, isLoading } = useQuery({
    queryKey: ['items', id],
    queryFn: () => api(`/api/items/${id}`),
    enabled: !!id,
  });

  const [initialized, setInitialized] = useState(false);
  const [existingImages, setExistingImages] = useState<PhotoExisting[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (data?.item && !initialized) {
      const item = data.item;
      form.fill(item);
      setExistingImages(
        (item.images || []).map((img: any) => ({ id: img.id, thumbnailPath: img.thumbnailPath, isPrimary: img.isPrimary, cutoutStatus: img.cutoutStatus, cutoutPath: img.cutoutPath, cutoutThumbPath: img.cutoutThumbPath }))
      );
      setInitialized(true);
    }
  }, [data, initialized]);

  const totalImages = existingImages.length + newImages.length;

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
          selectionLimit: 5 - totalImages,
        });

    if (!result.canceled) {
      const imgs = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || 'photo.jpg',
      }));
      setNewImages((prev) => [...prev, ...imgs].slice(0, 5 - existingImages.length));
    }
  };

  const removeExistingImage = (imageId: string) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    setDeletedImageIds((prev) => [...prev, imageId]);
  };

  const handleSubmit = async () => {
    const err = form.validate();
    if (err) {
      showAlert('提示', err);
      return;
    }

    setLoading(true);
    try {
      // 1. 更新資料
      await api(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(form.payload()) });

      // 2. 刪除被移除的照片
      for (const imageId of deletedImageIds) {
        try {
          await api(`/api/images/${imageId}`, { method: 'DELETE' });
        } catch {
          // 忽略刪除錯誤
        }
      }

      // 3. 上傳新照片
      const token = await tokenStorage.get('accessToken');
      for (let i = 0; i < newImages.length; i++) {
        const img = newImages[i];
        const formData = new FormData();

        if (Platform.OS === 'web') {
          const response = await fetch(img.uri);
          const blob = await response.blob();
          formData.append('file', blob, img.fileName || 'photo.jpg');
        } else {
          formData.append('file', { uri: img.uri, type: img.type || 'image/jpeg', name: img.fileName || 'photo.jpg' } as any);
        }

        const isPrimary = existingImages.length === 0 && i === 0;
        await fetch(`${API_BASE}/api/items/${id}/images?primary=${isPrimary ? 'true' : 'false'}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
      }

      invalidateWardrobe();
      queryClient.invalidateQueries({ queryKey: ['items', id] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      showAlert('成功', '衣物已更新');
      router.back();
    } catch (e: any) {
      showAlert('更新失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe'));

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <View style={{ height: 54, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          <Pressable onPress={cancel} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Txt size={14}>取消</Txt>
          </Pressable>
          <Serif size={17} accessibilityRole="header">編輯衣物</Serif>
          <View style={{ width: 52 }} />
        </View>
      </View>

      {isLoading || !initialized ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.ink} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
            <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 }}>
              <Txt size={12} tone="mute" letterSpacing={1.2} style={{ marginBottom: 8 }}>照片（最多 5 張）</Txt>
              <PhotoBlock
                existing={existingImages}
                added={newImages}
                onRemoveExisting={removeExistingImage}
                onRemoveAdded={(i) => setNewImages((p) => p.filter((_, k) => k !== i))}
                onPick={pickImage}
              />
              <View style={{ height: 14 }} />
              <ItemFields form={form} />
            </View>
          </ScrollView>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
            <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
              <Button label="儲存變更" onPress={handleSubmit} loading={loading} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
