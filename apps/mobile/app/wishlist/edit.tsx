import { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api } from '@/lib/api';
import { useColors } from '@/lib/theme';
import { showAlert, showConfirm } from '@/lib/alert';
import { invalidateWishlist, uploadWishlistImage, useWishlistItem } from '@/lib/wishlist';
import { Txt, Serif, Button } from '@/components/ui';
import { WishlistFields, useWishlistForm } from '@/components/wishlist/WishlistForm';

export default function EditWishlistScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const form = useWishlistForm();
  const { data: item, isLoading } = useWishlistItem(id);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item && !initialized) {
      form.fill(item);
      setInitialized(true);
    }
  }, [item, initialized]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/wardrobe'));

  const submit = async () => {
    const err = form.validate();
    if (err) return showAlert('提示', err);
    setLoading(true);
    try {
      await api(`/api/wishlist/${id}`, { method: 'PUT', body: JSON.stringify(form.updatePayload()) });
      if (form.image) await uploadWishlistImage(id as string, form.image);
      invalidateWishlist();
      goBack();
    } catch (e: any) {
      showAlert('儲存失敗', e.message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async () => {
    if (!(await showConfirm('刪除項目', '會從願望清單徹底移除，無法復原。若只是不想買了，可在詳情頁按「不買了」保留紀錄。'))) return;
    try {
      await api(`/api/wishlist/${id}`, { method: 'DELETE' });
      invalidateWishlist();
      router.replace('/(tabs)/wardrobe?tab=wishlist');
    } catch (e: any) {
      showAlert('刪除失敗', e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: c.ink }}>
        <View style={{ height: 54, width: '100%', maxWidth: 560, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }}>
          <Pressable onPress={goBack} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
            <Txt size={14}>取消</Txt>
          </Pressable>
          <Serif size={17} accessibilityRole="header">編輯願望清單</Serif>
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
            <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16, gap: 24 }}>
              <WishlistFields form={form} existingThumb={item?.imageThumbnailPath} />
              <Button label="刪除這個項目" variant="danger" onPress={remove} />
            </View>
          </ScrollView>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.paper, borderTopWidth: 1, borderTopColor: c.ink }}>
            <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 22 }}>
              <Button label="儲存" onPress={submit} loading={loading} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
